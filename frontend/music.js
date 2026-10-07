// ============================================================
// 跨页面共享音乐播放器（首页 / 博客页共用）
// 歌曲与播放进度写入 localStorage，跳转页面后自动恢复同一首歌；
// 受浏览器自动播放策略限制，进入页面后不会自动播放；
// 只有点击播放器上的控件（播放按钮 / 歌单曲目 / 上一首下一首）才会开始播放
// ============================================================
(function () {
    const API_BASE = window.location.origin;
    const STATE_KEY = 'music_state';

    let musicTracks = [];
    let musicIndex = 0;
    let musicReady = false;
    let musicPlayerInitialized = false;
    let trackErrorCount = 0;
    let musicPlaylistId = '';
    let resumeTime = null;
    let lastStateSave = 0;
    let playlistOpen = false;
    let playlistName = '';
    let userPlaybackRequested = false;  // 用户是否已通过播放器控件主动请求播放

    // 秒 → m:ss
    function formatTime(sec) {
        if (!isFinite(sec) || sec < 0) return '0:00';
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return m + ':' + String(s).padStart(2, '0');
    }

    function setMusicPlayIcon(playing) {
        [['music-play-icon', 'music-pause-icon'], ['lyric-play-icon', 'lyric-pause-icon']].forEach(([playId, pauseId]) => {
            const playIcon = document.getElementById(playId);
            const pauseIcon = document.getElementById(pauseId);
            if (playIcon) playIcon.style.display = playing ? 'none' : 'block';
            if (pauseIcon) pauseIcon.style.display = playing ? 'block' : 'none';
        });
    }

    // 持久化当前曲目与进度（跳转页面后据此恢复）
    function saveMusicState() {
        try {
            const audio = document.getElementById('music-audio');
            localStorage.setItem(STATE_KEY, JSON.stringify({
                playlistId: musicPlaylistId,
                index: musicIndex,
                time: audio && isFinite(audio.currentTime) ? audio.currentTime : 0
            }));
        } catch (e) { /* localStorage 不可用时忽略 */ }
    }

    function loadSavedState() {
        try {
            const s = JSON.parse(localStorage.getItem(STATE_KEY));
            if (s && s.playlistId === musicPlaylistId && Number.isInteger(s.index) && s.index >= 0) {
                return s;
            }
        } catch (e) { /* 忽略损坏的状态 */ }
        return null;
    }

    function loadMusicTrack(index, autoplay) {
        if (!musicTracks[index]) return;
        musicIndex = index;
        const track = musicTracks[index];
        document.getElementById('music-name').textContent = track.name;
        document.getElementById('music-artist').textContent = track.artist || '未知歌手';

        // 歌词浮层头信息同步
        const lyricName = document.getElementById('lyric-name');
        const lyricArtist = document.getElementById('lyric-artist');
        if (lyricName) lyricName.textContent = track.name;
        if (lyricArtist) lyricArtist.textContent = track.artist || '未知歌手';

        // 切歌淡入过渡
        const info = document.querySelector('#music-player .music-info');
        if (info) {
            info.classList.remove('track-swap');
            void info.offsetWidth;
            info.classList.add('track-swap');
        }

        // 更新歌单面板高亮
        updatePlaylistActive();

        // 拉取当前曲目歌词
        loadLyric(track.id);

        // 后端解析失败（版权/VIP 受限）的曲目没有直链，自动跳过
        if (!track.url) {
            handleTrackError();
            return;
        }

        const audio = document.getElementById('music-audio');
        audio.src = track.url;
        saveMusicState();

        // 恢复跨页面的播放进度（在元数据就绪后 seek）
        if (resumeTime && resumeTime > 0) {
            const applyResume = () => {
                try {
                    if (audio.duration && resumeTime < audio.duration - 5) {
                        audio.currentTime = resumeTime;
                    }
                } catch (e) { /* seek 失败从头播放 */ }
                resumeTime = null;
                audio.removeEventListener('loadedmetadata', applyResume);
            };
            audio.addEventListener('loadedmetadata', applyResume);
        }

        // 真正的播放闸门：只有用户通过播放器控件主动请求播放时才出声，
        // 其它调用路径（例如加载失败后自动切下一首）不得在用户未点击播放器时播放
        if (autoplay && userPlaybackRequested) {
            audio.play().then(() => setMusicPlayIcon(true)).catch(() => setMusicPlayIcon(false));
        }
    }

    // 当前曲目加载失败（防盗链/VIP/签名失效）时自动切换下一首，避免播放器静默卡死
    function handleTrackError() {
        setMusicPlayIcon(false);
        const player = document.getElementById('music-player');
        if (player) player.classList.remove('playing');
        if (!musicTracks.length) return;
        trackErrorCount++;
        // 整个歌单都失败则停止尝试
        if (trackErrorCount >= musicTracks.length) return;
        loadMusicTrack((musicIndex + 1) % musicTracks.length, userPlaybackRequested);
    }

    // ========== 歌词引擎 ==========
    let lyricLines = [];
    let currentLyricIndex = -1;
    let lastLyricSync = 0;
    let lyricRequestSeq = 0;  // 切歌竞态保护：只应用最后一次请求的歌词

    // 解析 LRC：返回 [{time(秒), content}] 按时间排序
    function parseLrc(text) {
        const lines = [];
        String(text || '').split('\n').forEach(line => {
            const times = line.match(/\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g);
            if (!times) return;
            const content = line.replace(/\[[^\]]*\]/g, '').trim();
            times.forEach(t => {
                const m = t.match(/\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/);
                lines.push({ time: (+m[1]) * 60 + (+m[2]) + (+(m[3] || 0)) / 1000, content });
            });
        });
        lines.sort((a, b) => a.time - b.time);
        return lines;
    }

    async function loadLyric(id) {
        const seq = ++lyricRequestSeq;
        lyricLines = [];
        currentLyricIndex = -1;
        const body = document.getElementById('lyric-body');
        const preview = document.getElementById('music-lyric-preview');
        if (body) body.innerHTML = '';
        if (preview) preview.innerHTML = '';
        try {
            const res = await fetch(`${API_BASE}/api/music/lyric?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
            const data = await res.json();
            // 竞态保护：期间若已切歌，丢弃过期响应
            if (data.success && seq === lyricRequestSeq) renderLyric(data.data);
        } catch (e) { /* 歌词获取失败时保持空态 */ }
    }

    function renderLyric(data) {
        const body = document.getElementById('lyric-body');
        const preview = document.getElementById('music-lyric-preview');

        const lrc = parseLrc(data && data.lyric);
        const transMap = {};
        parseLrc(data && data.tlyric).forEach(l => { transMap[l.time] = l.content; });

        // 浮层歌词（含翻译行）
        if (body) {
            if (lrc.length === 0) {
                body.innerHTML = '<div class="lyric-empty">暂无歌词</div>';
            } else {
                const scroll = document.createElement('div');
                scroll.className = 'lyric-scroll';
                scroll.innerHTML = lrc.map((l, i) => {
                    const trans = transMap[l.time];
                    const hasTrans = trans && trans !== l.content;
                    return `<p class="lyric-line" data-i="${i}">${escapeHtml(l.content)}${hasTrans ? `<span class="lyric-trans">${escapeHtml(trans)}</span>` : ''}</p>`;
                }).join('');
                body.innerHTML = '';
                body.appendChild(scroll);
            }
        }

        // 卡片歌词预览（紧凑，无翻译行）
        if (preview) {
            if (lrc.length === 0) {
                preview.innerHTML = '<div class="preview-empty">暂无歌词</div>';
            } else {
                const scroll = document.createElement('div');
                scroll.className = 'preview-scroll';
                scroll.innerHTML = lrc.map((l, i) => `<p class="preview-line" data-i="${i}">${escapeHtml(l.content)}</p>`).join('');
                preview.innerHTML = '';
                preview.appendChild(scroll);
            }
        }

        lyricLines = lrc;
        syncLyric(true);
    }

    // 高亮某行并居中滚动（浮层与卡片预览共用）
    function applyLyricHighlight(scroll, idx) {
        if (!scroll) return;
        const lines = scroll.querySelectorAll('.lyric-line, .preview-line');
        lines.forEach((el, i) => el.classList.toggle('active', i === idx));
        const active = lines[idx];
        if (active) {
            const offset = active.offsetTop + active.offsetHeight / 2;
            scroll.style.transform = `translateY(-${offset}px)`;
        }
    }

    // 根据播放进度高亮当前句并滚动居中（节流 300ms）
    function syncLyric(force) {
        if (!lyricLines.length) return;
        const audio = document.getElementById('music-audio');
        const t = audio ? audio.currentTime : 0;
        let idx = -1;
        for (let i = 0; i < lyricLines.length; i++) {
            if (lyricLines[i].time <= t + 0.25) idx = i; else break;
        }
        if (idx === currentLyricIndex && !force) return;
        currentLyricIndex = idx;

        applyLyricHighlight(document.querySelector('#lyric-body .lyric-scroll'), idx);
        applyLyricHighlight(document.querySelector('#music-lyric-preview .preview-scroll'), idx);
    }

    function openLyric() {
        const overlay = document.getElementById('lyric-overlay');
        if (!overlay) return;
        overlay.style.display = 'flex';
        overlay.classList.add('open');
        // 同步播放状态下的封面旋转
        const audio = document.getElementById('music-audio');
        if (audio && !audio.paused) overlay.classList.add('playing');
        syncLyric(true);
    }

    function closeLyric() {
        const overlay = document.getElementById('lyric-overlay');
        if (!overlay) return;
        overlay.classList.remove('open');
        overlay.classList.remove('playing');
        overlay.style.display = 'none';
    }

    // 渲染歌单面板
    function renderPlaylist() {
        const listEl = document.getElementById('music-playlist-list');
        const nameEl = document.getElementById('music-playlist-name');
        const countEl = document.getElementById('music-playlist-count');
        if (!listEl) return;
        if (nameEl) nameEl.textContent = playlistName || '歌单';
        if (countEl) countEl.textContent = `${musicTracks.length} 首`;
        listEl.innerHTML = musicTracks.map((t, i) => `
            <li class="music-playlist-item${i === musicIndex ? ' active' : ''}" data-index="${i}">
                <span class="pl-index">${i + 1}</span>
                <span class="pl-playing-mark"><span></span><span></span><span></span></span>
                <span class="pl-main">
                    <div class="pl-name">${escapeHtml(t.name)}</div>
                    <div class="pl-artist">${escapeHtml(t.artist || '未知歌手')}</div>
                </span>
                <span class="pl-duration">${formatTime((t.duration || 0) / 1000)}</span>
            </li>
        `).join('');
        listEl.querySelectorAll('.music-playlist-item').forEach(item => {
            item.addEventListener('click', () => {
                userPlaybackRequested = true;
                loadMusicTrack(Number(item.dataset.index), true);
            });
        });
    }

    // 面板高亮跟随切歌（仅面板内滚动，避免带动整页）
    function updatePlaylistActive() {
        const listEl = document.getElementById('music-playlist-list');
        if (!listEl) return;
        listEl.querySelectorAll('.music-playlist-item').forEach(item => {
            const active = Number(item.dataset.index) === musicIndex;
            item.classList.toggle('active', active);
            if (active && playlistOpen) {
                const top = item.offsetTop - listEl.clientHeight / 2 + item.clientHeight / 2;
                listEl.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
            }
        });
    }

    // 歌单面板开关
    function togglePlaylist(force) {
        const panel = document.getElementById('music-playlist');
        if (!panel) return;
        playlistOpen = typeof force === 'boolean' ? force : !playlistOpen;
        panel.classList.toggle('open', playlistOpen);
    }

    function escapeHtml(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    async function initMusicPlayer(config) {
        // 只初始化一次
        if (musicPlayerInitialized) return;
        musicPlayerInitialized = true;

        const player = document.getElementById('music-player');
        if (!player) return;

        const site = (config && config.site) || {};
        // 与后台默认一致：仅当显式关闭（false）才隐藏播放器，未配置过视为启用
        if (site.musicEnabled === false) return;
        const playlistId = String(site.musicPlaylistId || '').trim();
        if (!/^\d{1,20}$/.test(playlistId)) return;
        musicPlaylistId = playlistId;

        try {
            const res = await fetch(`${API_BASE}/api/music/playlist?id=${playlistId}`, { cache: 'no-store' });
            const data = await res.json();
            if (!data.success || !data.data?.tracks?.length) {
                console.error('音乐歌单加载失败:', data.message);
                return;
            }
            musicTracks = data.data.tracks;
            playlistName = data.data.name || '';
            const cover = document.getElementById('music-cover');
            if (cover && data.data.cover) cover.src = data.data.cover;
            const lyricCover = document.getElementById('lyric-cover');
            if (lyricCover && data.data.cover) lyricCover.src = data.data.cover;

            player.style.display = 'block';
            musicReady = true;

            // 渲染歌单面板 + 封面点击展开/收起
            renderPlaylist();
            if (cover) {
                cover.addEventListener('click', (e) => {
                    e.stopPropagation();
                    togglePlaylist();
                });
                document.addEventListener('click', (e) => {
                    if (!playlistOpen) return;
                    const panel = document.getElementById('music-playlist');
                    if (panel && !panel.contains(e.target) && e.target !== cover) {
                        togglePlaylist(false);
                    }
                });
            }

            // 跨页恢复：优先继续上次播放的曲目，否则随机起始
            const saved = loadSavedState();
            let startIndex;
            if (saved && musicTracks[saved.index] && musicTracks[saved.index].url) {
                startIndex = saved.index;
                resumeTime = typeof saved.time === 'number' ? saved.time : null;
            } else {
                startIndex = Math.floor(Math.random() * musicTracks.length);
            }
            // 只加载曲目并恢复上次播放进度，不自动播放：
            // 播放必须由用户点击播放器控件触发，页面其他位置的交互不会开始播放
            loadMusicTrack(startIndex, false);

            // 事件绑定（只绑定一次）
            if (!player.dataset.bound) {
                player.dataset.bound = '1';
                const audio = document.getElementById('music-audio');
                const toggle = document.getElementById('music-toggle');
                const lyricToggle = document.getElementById('lyric-toggle');
                const lyricPrev = document.getElementById('lyric-prev');
                const lyricNext = document.getElementById('lyric-next');
                const lyricBtn = document.getElementById('music-lyric-btn');
                const lyricClose = document.getElementById('lyric-close');
                const lyricOverlay = document.getElementById('lyric-overlay');
                const lyricPreview = document.getElementById('music-lyric-preview');

                const doToggle = () => {
                    if (!musicReady) return;
                    if (audio.paused) {
                        userPlaybackRequested = true;
                        audio.play().then(() => setMusicPlayIcon(true)).catch(() => {});
                    } else {
                        // 用户主动暂停：清除“用户请求播放”标志，后续自动流程不得擅自恢复播放
                        userPlaybackRequested = false;
                        audio.pause();
                        setMusicPlayIcon(false);
                    }
                };
                const doPrev = () => {
                    if (!musicReady) return;
                    userPlaybackRequested = true;
                    loadMusicTrack((musicIndex - 1 + musicTracks.length) % musicTracks.length, true);
                };
                const doNext = () => {
                    if (!musicReady) return;
                    userPlaybackRequested = true;
                    loadMusicTrack((musicIndex + 1) % musicTracks.length, true);
                };

                toggle.addEventListener('click', doToggle);
                if (lyricToggle) lyricToggle.addEventListener('click', doToggle);
                if (lyricPrev) lyricPrev.addEventListener('click', doPrev);
                if (lyricNext) lyricNext.addEventListener('click', doNext);
                if (lyricBtn) lyricBtn.addEventListener('click', openLyric);
                if (lyricPreview) lyricPreview.addEventListener('click', openLyric);
                if (lyricClose) lyricClose.addEventListener('click', closeLyric);
                if (lyricOverlay) {
                    // 点遮罩空白处关闭；ESC 关闭
                    lyricOverlay.addEventListener('click', (e) => {
                        if (e.target === lyricOverlay) closeLyric();
                    });
                    document.addEventListener('keydown', (e) => {
                        if (e.key === 'Escape' && lyricOverlay.style.display === 'flex') closeLyric();
                    });
                }

                audio.addEventListener('ended', () => {
                    loadMusicTrack((musicIndex + 1) % musicTracks.length, true);
                });
                audio.addEventListener('play', () => {
                    setMusicPlayIcon(true);
                    trackErrorCount = 0;
                    player.classList.add('playing');
                    if (lyricOverlay) lyricOverlay.classList.add('playing');
                });
                audio.addEventListener('pause', () => {
                    setMusicPlayIcon(false);
                    player.classList.remove('playing');
                    if (lyricOverlay) lyricOverlay.classList.remove('playing');
                });
                audio.addEventListener('error', handleTrackError);
                // 进度节流保存（每 5 秒）+ 歌词同步（每 300ms），跳转页面前再精确保存一次
                audio.addEventListener('timeupdate', () => {
                    const now = Date.now();
                    if (now - lastStateSave > 5000) {
                        lastStateSave = now;
                        saveMusicState();
                    }
                    if (now - lastLyricSync > 300) {
                        lastLyricSync = now;
                        syncLyric(false);
                    }
                });
                window.addEventListener('pagehide', saveMusicState);
                document.addEventListener('visibilitychange', () => {
                    if (document.visibilityState === 'hidden') saveMusicState();
                });
            }
        } catch (err) {
            console.error('音乐播放器初始化失败:', err);
        }
    }

    window.initMusicPlayer = initMusicPlayer;
})();
