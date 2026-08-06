// API 基础地址（同源部署，直接使用当前源）
const API_BASE = window.location.origin;

// 全局配置
let config = null;

// HTML 转义，防止 XSS
function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// URL 协议白名单（仅允许 http/https，防止 javascript: 等协议）
function sanitizeUrl(url) {
    if (typeof url !== 'string') return '#';
    const trimmed = url.trim();
    return /^https?:\/\//i.test(trimmed) ? trimmed : '#';
}

// 封面 URL 基于文章 id 生成确定性参数：
// 同一篇文章在所有位置 URL 一致（显示同一张图），不同文章 URL 不同（随机图 API 取不同图）
function articleCoverUrl(url, id) {
    const clean = optimizeImageUrl(sanitizeUrl(url));
    if (!clean || clean === '#') return '';
    const sep = clean.includes('?') ? '&' : '?';
    return `${clean}${sep}t=article_${id}`;
}

// 第三方图源体积优化：yppp 原图可能 5MB+，w 参数可缩至 1/6
function optimizeImageUrl(url) {
    if (typeof url !== 'string') return url;
    try {
        const u = new URL(url);
        if (u.hostname.endsWith('yppp.net')) {
            u.searchParams.set('w', '1080');
            return u.toString();
        }
    } catch (e) { /* 非法 URL 原样返回 */ }
    return url;
}

// 带时间戳的图片 URL（正确处理已有 query 的情况）
function withTimestamp(url) {
    const clean = optimizeImageUrl(url);
    const sep = clean.includes('?') ? '&' : '?';
    return `${clean}${sep}t=${Date.now()}`;
}

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    await loadConfig();
    initPage();
});

// 加载配置
async function loadConfig() {
    try {
        const res = await fetch(`${API_BASE}/api/config`, { cache: 'no-store' });
        const data = await res.json();
        if (data.success) {
            config = data.data;
        } else {
            console.error('加载配置失败:', data.message);
            config = getDefaultConfig();
        }
    } catch (err) {
        console.error('加载配置失败:', err);
        // 使用默认配置
        config = getDefaultConfig();
    }
}

// 默认配置
function getDefaultConfig() {
    return {
        site: {
            title: 'Konnichiwa.',
            subtitle: '探索简洁、逻辑与二次元的平衡点',
            nickname: '悠悠',
            qq: '3199169587',
            bio: '二次元浓度极高，热衷于捣鼓各种有趣的项目。ACG 是生活必需品，代码是快乐源泉',
            signature: '小小世界 开心至上'
        },
        apis: {
            anime: [
                { name: 'yppp', url: 'https://api.yppp.net/api.php', enabled: true, priority: 1 },
                { name: 'loliapi', url: 'https://www.loliapi.com/acg/', enabled: true, priority: 2 }
            ]
        },
        tags: [
            { icon: 'gamepad', name: 'ACG' },
            { icon: 'code', name: 'Code' },
            { icon: 'rocket', name: 'Project' },
            { icon: 'sparkles', name: '二次元' }
        ],
        links: [
            { name: '博客', url: '#', icon: 'edit', color: '#3b82f6' },
            { name: 'GitHub', url: '#', icon: 'github', color: '#333' }
        ],
        widgets: {
            sakana: { enabled: true, characters: [
                { name: 'chisato', position: 'right', size: 200 },
                { name: 'takina', position: 'left', size: 200 }
            ]}
        }
    };
}

// 根据时间获取问候语
function getGreeting() {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return '早上好';
    if (hour >= 12 && hour < 14) return '中午好';
    if (hour >= 14 && hour < 18) return '下午好';
    if (hour >= 18 && hour < 22) return '晚上好';
    if (hour >= 22 || hour < 2) return '夜深了';
    return '晚安';
}

// 加载每日一言（后台配置多句，每次刷新随机取一句）
async function loadHitokoto() {
    const subtitleEl = document.getElementById('site-subtitle');
    if (!subtitleEl) return;

    // 优先：随机句子列表
    const list = Array.isArray(config?.site?.hitokotoList)
        ? config.site.hitokotoList.filter(s => s && String(s).trim())
        : [];
    if (list.length > 0) {
        subtitleEl.textContent = list[Math.floor(Math.random() * list.length)];
        return;
    }

    // 回退：旧的单句配置 → 个性签名 → 默认文案
    if (config?.site?.hitokotoText?.trim()) {
        subtitleEl.textContent = config.site.hitokotoText.trim();
    } else {
        subtitleEl.textContent = config?.site?.signature?.trim() || config?.site?.subtitle || '探索简洁、逻辑与二次元的平衡点';
    }
}

// 初始化页面
async function initPage() {
    // 设置问候语
    const greeting = getGreeting();
    document.title = greeting;
    document.getElementById('greeting').textContent = greeting;

    // 设置网站标题
    const siteTitle = document.getElementById('site-title');
    if (siteTitle && config?.site?.title) {
        siteTitle.textContent = config.site.title;
    }

    // 设置网站图标
    if (config?.site?.favicon) {
        updateFavicon(config.site.favicon);
    }

    // 加载每日一言
    loadHitokoto();

    // 启动时间更新（只启动一次，避免重复 initPage 叠加定时器）
    updateDateTime();
    startClockOnce();

    // 加载天气（使用 IP 定位）
    loadWeather();

    // 更新统计数据
    updateStats();

    // 加载 QQ 信息
    await loadQQInfo();

    // 渲染标签
    renderTags();

    // 渲染外链
    renderLinks();

    // 渲染动态
    renderActivities();

    // 加载博客
    loadBlog();

    // 加载图片
    loadAnimeImage();

    // 加载壁纸背景（首次立即加载，之后由定时器轮换）
    startWallpaper();

    // 初始化 Sakana 挂件
    initSakana();
}

// 加载 QQ 信息
async function loadQQInfo() {
    const avatarEl = document.getElementById('qq-avatar');
    const nicknameEl = document.getElementById('qq-nickname');
    const signatureEl = document.getElementById('qq-signature');
    const bioEl = document.getElementById('qq-bio');
    const site = config.site || {};

    // 设置头像：优先使用自定义头像，否则使用QQ头像
    if (site.customAvatar) {
        avatarEl.src = sanitizeUrl(site.customAvatar);
    } else if (site.qq) {
        avatarEl.src = `https://q.qlogo.cn/headimg_dl?dst_uin=${encodeURIComponent(site.qq)}&spec=640&img_type=jpg`;
    }

    // 设置其他信息（textContent 天然防 XSS）
    nicknameEl.textContent = site.nickname || '';
    signatureEl.textContent = site.signature || '';
    bioEl.innerHTML = '';
    const bioLabel = document.createElement('span');
    bioLabel.className = 'bio-label';
    bioLabel.textContent = '简介';
    bioEl.appendChild(bioLabel);
    bioEl.appendChild(document.createTextNode(site.bio || ''));
}

// 渲染标签
function renderTags() {
    const container = document.getElementById('tag-group');
    container.innerHTML = (config.tags || []).map(tag => `
        <span class="tag"><span class="tag-dot"></span>${escapeHtml(tag.name)}</span>
    `).join('');
}

// 渲染外链
function renderLinks() {
    const container = document.getElementById('links-grid');
    if (!container) return;

    if (!config.links || config.links.length === 0) {
        container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-sub); padding: 20px;">暂无链接</div>';
        return;
    }

    container.innerHTML = config.links.map(link => `
        <a href="${escapeHtml(sanitizeUrl(link.url))}" target="_blank" rel="noopener noreferrer" class="link-grid-item" title="${escapeHtml(link.name)}">
            <div class="link-grid-icon">
                ${link.icon ? `<img src="${escapeHtml(sanitizeUrl(link.icon))}" alt="${escapeHtml(link.name)}" onerror="this.style.display='none'">` : ''}
            </div>
        </a>
    `).join('');
}

// 渲染动态
function renderActivities() {
    const container = document.getElementById('activity-list');
    const activities = config?.activities || [];

    if (activities.length === 0) {
        container.innerHTML = '<div class="activity-item"><div class="activity-content"><div class="activity-text">暂无动态</div></div></div>'
        return;
    }

    container.innerHTML = activities.map(item => `
        <div class="activity-item">
            <div class="activity-dot"></div>
            <div class="activity-content">
                <div class="activity-text">${escapeHtml(item.text)}</div>
                <div class="activity-time">${escapeHtml(item.time)}</div>
            </div>
        </div>
    `).join('');
}

// 加载博客列表（60s 内不重复拉取，防切回标签页频繁请求）
let blogLoadedAt = 0;
let blogLoading = false;

async function loadBlog() {
    if (blogLoading) return;
    const now = Date.now();
    if (now - blogLoadedAt < 60000) return;

    blogLoading = true;
    const container = document.getElementById('blog-list');
    if (!container) { blogLoading = false; return; }

    try {
        // 与画廊共用同一份列表缓存（60s TTL + in-flight 去重），避免重复请求
        const { list: allList, total } = await fetchBlogList();
        const list = (allList || []).slice(0, 5);

        // 更新本站数据的博客文章统计
        const blogCountEl = document.getElementById('blog-count');
        if (blogCountEl) blogCountEl.textContent = total || 0;

        if (!list || list.length === 0) {
            container.innerHTML = '<div class="blog-empty">还没有文章，敬请期待 ~</div>';
            return;
        }

        container.innerHTML = list.map(item => {
            const cover = item.cover
                ? `<div class="blog-card-cover"><img src="${escapeHtml(articleCoverUrl(item.cover, item.id))}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.parentElement.classList.add('broken')"></div>`
                : '';
            return `
            <a class="blog-card" href="blog.html?id=${encodeURIComponent(item.id)}">
                ${cover}
                <div class="blog-card-main">
                    <div class="blog-card-title">${escapeHtml(item.title)}</div>
                    <div class="blog-card-summary">${escapeHtml(item.summary) || '点击阅读全文 →'}</div>
                </div>
                <div class="blog-card-meta">
                    <span class="blog-category">${escapeHtml(item.category)}</span>
                    <span class="blog-date">${escapeHtml(item.createdAt)}</span>
                </div>
            </a>
        `;
        }).join('');

        if (total > list.length) {
            container.innerHTML += `<a class="blog-more-line" href="blog.html">查看全部文章 (${total}) →</a>`;
        }
    } catch (err) {
        console.error('加载博客失败:', err);
        container.innerHTML = '<div class="blog-empty">博客加载失败</div>';
    } finally {
        blogLoading = false;
        blogLoadedAt = Date.now();
    }
}

// 加载二次元壁纸背景（模糊全屏背景，复用动漫图 API，仅页面首次加载时设置一张）
let wallpaperApiIndex = 0;
let wallpaperLoaded = false;

function loadWallpaper() {
    const wallpaperEl = document.getElementById('bg-wallpaper');
    if (!wallpaperEl) return;

    const enabledApis = (config.apis?.anime || []).filter(api => api.enabled).sort((a, b) => a.priority - b.priority);
    if (enabledApis.length === 0) return;

    // 壁纸优先用非主图源，避免与左侧卡片图片重复；只有一个源时退回共用
    const wallpaperApis = enabledApis.length > 1 ? enabledApis.slice(1) : enabledApis;

    const api = wallpaperApis[wallpaperApiIndex % wallpaperApis.length];
    wallpaperApiIndex = (wallpaperApiIndex + 1) % wallpaperApis.length;

    const img = new Image();
    img.onload = () => {
        wallpaperEl.style.backgroundImage = `url(${withTimestamp(api.url)})`;
        wallpaperEl.classList.add('ready');
    };
    img.onerror = () => {
        // 加载失败保持当前背景（渐变网格兜底）
    };
    img.src = withTimestamp(api.url);
}

function startWallpaper() {
    if (wallpaperLoaded) return;
    wallpaperLoaded = true;
    // 延迟加载壁纸，避免大图阻塞首屏渲染
    setTimeout(loadWallpaper, 1200);
}

// 当前卡片展示的博客文章（点击跳转用）
let galleryArticle = null;

// 博客列表缓存（60s TTL + in-flight 去重）：首页博客区块与画廊共用，翻页拉全量
let blogListCache = null;   // { list, total, at }
let blogListPromise = null;

async function fetchBlogList() {
    if (blogListCache && Date.now() - blogListCache.at < 60000) {
        return blogListCache;
    }
    if (blogListPromise) return blogListPromise;

    blogListPromise = (async () => {
        let list = [];
        let total = 0;
        let page = 1;
        const PAGE_SIZE = 50;
        try {
            do {
                const res = await fetch(`${API_BASE}/api/blog?page=${page}&pageSize=${PAGE_SIZE}`, { cache: 'no-store' });
                const data = await res.json();
                if (!data.success) break;
                total = data.data.total || 0;
                list = list.concat(data.data.list || []);
                page++;
            } while (list.length < total && page <= 20);
        } catch (e) { /* 忽略 */ }
        blogListCache = { list, total, at: Date.now() };
        return blogListCache;
    })();

    try {
        return await blogListPromise;
    } finally {
        blogListPromise = null;
    }
}

// 获取带封面的已发布博客列表（复用 fetchBlogList 缓存）
async function fetchCoveredArticles() {
    const { list } = await fetchBlogList();
    return (list || []).filter(a => a.cover);
}

// 用博客封面填充卡片：加载失败返回 false，让调用方回退动漫图 API
async function loadGalleryFromBlog() {
    const covered = await fetchCoveredArticles();
    if (covered.length === 0) return false;
    const pick = covered[Math.floor(Math.random() * covered.length)];
    return setGalleryImage(pick);
}

// 用博客封面填充卡片：加载成功 resolve(true)，失败/超时 resolve(false)
function setGalleryImage(article) {
    return new Promise((resolve) => {
        const imgDiv = document.getElementById('anime-img');
        const img = new Image();
        const timer = setTimeout(() => {
            img.onload = null;
            img.onerror = null;
            resolve(false);
        }, 10000);

        img.onload = () => {
            clearTimeout(timer);
            imgDiv.style.backgroundImage = `url(${articleCoverUrl(article.cover, article.id)})`;
            imgDiv.classList.add('blog-cover');
            imgDiv.title = `点击查看文章：${article.title}`;
            galleryArticle = { id: article.id, title: article.title };

            // 底部信息条：标题 + 摘要
            const info = document.getElementById('gallery-article-info');
            const titleEl = document.getElementById('gallery-article-title');
            const summaryEl = document.getElementById('gallery-article-summary');
            if (info && titleEl) {
                titleEl.textContent = article.title;
                summaryEl.textContent = article.summary || '点击阅读全文 →';
                info.style.display = 'block';
            }
            resolve(true);
        };
        img.onerror = () => {
            clearTimeout(timer);
            resolve(false);
        };
        img.src = articleCoverUrl(article.cover, article.id);
    });
}

// 隐藏文章信息条（回退动漫图模式时调用）
function hideGalleryArticleInfo() {
    const info = document.getElementById('gallery-article-info');
    if (info) info.style.display = 'none';
}

// 点击卡片图片：跳转到当前封面对应的博客
function openGalleryArticle() {
    if (galleryArticle) {
        window.location.href = `blog.html?id=${encodeURIComponent(galleryArticle.id)}`;
    }
}

// 加载二次元图片（优先博客封面，无封面时回退动漫图 API）
async function loadAnimeImage() {
    const imgDiv = document.getElementById('anime-img');
    if (!imgDiv) return;

    // 优先：随机博客封面
    if (await loadGalleryFromBlog()) return;

    const enabledApis = (config.apis?.anime || []).filter(api => api.enabled).sort((a, b) => a.priority - b.priority);

    if (enabledApis.length === 0) return;

    // 尝试加载第一个 API
    const primaryApi = enabledApis[0];
    const img = new Image();

    img.onload = () => {
        imgDiv.style.backgroundImage = `url(${withTimestamp(primaryApi.url)})`;
        imgDiv.classList.remove('blog-cover');
        imgDiv.title = '';
        galleryArticle = null;
        hideGalleryArticleInfo();
    };

    img.onerror = () => {
        // 失败则尝试第二个
        if (enabledApis.length > 1) {
            const backupApi = enabledApis[1];
            imgDiv.style.backgroundImage = `url(${withTimestamp(backupApi.url)})`;
            imgDiv.classList.remove('blog-cover');
            imgDiv.title = '';
            galleryArticle = null;
            hideGalleryArticleInfo();
        }
    };

    img.src = withTimestamp(primaryApi.url);
}

// 初始化 Sakana 挂件
let sakanaInitialized = false;
function initSakana() {
    if (sakanaInitialized) return;
    if (typeof SakanaWidget === 'undefined') return;
    if (!config.widgets?.sakana?.enabled) return;

    const characters = config.widgets.sakana.characters || [];
    
    characters.forEach(char => {
        if (char.position === 'right') {
            new SakanaWidget({
                character: char.name,
                size: char.size,
                autoFit: false,
                controls: false,
            }).mount('#sakana-widget-container');
        } else {
            new SakanaWidget({
                character: char.name,
                size: char.size,
                autoFit: false,
                controls: false,
            }).mount('#sakana-widget-left');
        }
    });

    sakanaInitialized = true;
}

// 页面重新可见时刷新数据，确保后台修改后切回前台能看到最新内容
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && config) {
        loadConfig().then(() => {
            initPage();
        });
    }
});

// 更新时间和日期
let clockTimer = null;
function startClockOnce() {
    if (clockTimer) return;
    clockTimer = setInterval(updateDateTime, 1000);
}

function updateDateTime() {
    const now = new Date();
    
    // 时间
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    document.getElementById('current-time').textContent = `${hours}:${minutes}`;
    
    // 日期
    const month = now.getMonth() + 1;
    const date = now.getDate();
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const weekday = weekdays[now.getDay()];
    document.getElementById('current-date').textContent = `${month}月${date}日 ${weekday}`;
}

// 加载天气
async function loadWeather() {
    const weatherBox = document.getElementById('weather-box');
    const sunnyIcon = WEATHER_ICONS.sunny;

    // 检查是否启用天气 API
    if (!config?.apis?.weather?.enabled) {
        weatherBox.innerHTML = `<span style="display:inline-flex;align-items:center;">${sunnyIcon}</span><span>未启用</span>`;
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/weather`, { cache: 'no-store' });
        const result = await res.json();

        if (result.success && result.data) {
            const data = result.data;
            const icon = getWeatherIcon(data.weather, data.weatherCode);

            weatherBox.innerHTML = `
                <span style="display:inline-flex;align-items:center;">${icon}</span>
                <span>${escapeHtml(data.weather)} ${escapeHtml(data.temp)}°C</span>
            `;
        } else {
            weatherBox.innerHTML = `<span style="display:inline-flex;align-items:center;">${sunnyIcon}</span><span>获取失败</span>`;
        }
    } catch (err) {
        console.error('获取天气失败:', err);
        weatherBox.innerHTML = `<span style="display:inline-flex;align-items:center;">${sunnyIcon}</span><span>加载失败</span>`;
    }
}

// 天气 SVG 图标（Material 线条风格，避免手机 emoji 渲染差异）
const WEATHER_ICONS = {
    sunny: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5 5l1.4 1.4M17.6 17.6L19 19M19 5l-1.4 1.4M6.4 17.6L5 19"/></svg>',
    partlyCloudy: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8.5" r="3.2"/><path d="M9 2.8v1.4M3.9 5.4l1 1M12.1 5.4l-1 1M3.3 8.5h1.4"/><path d="M17.8 12.2a3.8 3.8 0 0 0-7.3-1.7A3.4 3.4 0 0 0 7.5 17h10.3a3 3 0 0 0 0-4.8z"/></svg>',
    cloudy: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 12.2a3.8 3.8 0 0 0-7.3-1.7A3.4 3.4 0 0 0 7.5 17h10.3a3 3 0 0 0 0-4.8z"/></svg>',
    rain: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 11.5a3.8 3.8 0 0 0-7.3-1.7A3.4 3.4 0 0 0 7.5 16.3h10.3a3 3 0 0 0 0-4.8z"/><path d="M9.5 18l-1 3M13.5 18l-1 3M17 18l-1 3"/></svg>',
    heavyRain: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 11.5a3.8 3.8 0 0 0-7.3-1.7A3.4 3.4 0 0 0 7.5 16.3h10.3a3 3 0 0 0 0-4.8z"/><path d="M8.5 18l-1.2 3.5M12.5 18l-1.2 3.5M16.5 18l-1.2 3.5"/></svg>',
    thunder: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 11.5a3.8 3.8 0 0 0-7.3-1.7A3.4 3.4 0 0 0 7.5 16.3h10.3a3 3 0 0 0 0-4.8z"/><path d="M12.8 16.3l-2 4.5h2.6l-1.4 3.5"/></svg>',
    snow: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 11.5a3.8 3.8 0 0 0-7.3-1.7A3.4 3.4 0 0 0 7.5 16.3h10.3a3 3 0 0 0 0-4.8z"/><path d="M9.5 18.5v2.4M8.3 19.2l2.4 1.3M8.3 20.6l2.4-1.3M14.5 18.5v2.4M13.3 19.2l2.4 1.3M13.3 20.6l2.4-1.3"/></svg>',
    fog: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 10.5a3.8 3.8 0 0 0-7.3-1.7A3.4 3.4 0 0 0 7.5 15.3h10.3a3 3 0 0 0 0-4.8z"/><path d="M5 17.5h14M7 20h10"/></svg>'
};

// 根据天气描述和代码获取 SVG 图标
function getWeatherIcon(weather, code) {
    let key = 'sunny';

    // 优先根据天气代码判断（wttr.in / uapis.cn 代码）
    if (code) {
        const codeNum = parseInt(code);
        // 晴朗 (113)
        if (codeNum === 113) key = 'sunny';
        // 雷暴 (200, 386, 389, 392, 395)
        else if (codeNum === 200 || codeNum === 386 || codeNum === 389 || codeNum === 392 || codeNum === 395) key = 'thunder';
        // 雪 (179, 182, 185, 227-236, 281-284, 317-338, 350-352, 360-398)
        else if (codeNum === 179 || codeNum === 182 || codeNum === 185 ||
            (codeNum >= 227 && codeNum <= 236) ||
            (codeNum >= 281 && codeNum <= 284) ||
            (codeNum >= 317 && codeNum <= 338) ||
            (codeNum >= 350 && codeNum <= 352) ||
            (codeNum >= 360 && codeNum <= 398)) key = 'snow';
        // 雨 (176-353 其余，及 356-359 阵雨)
        else if ((codeNum >= 176 && codeNum <= 353) || (codeNum >= 356 && codeNum <= 359)) key = 'rain';
        // 雾 (143, 248, 260)
        else if (codeNum === 143 || codeNum === 248 || codeNum === 260) key = 'fog';
        // 多云 (116) / 阴 (119-122)
        else if (codeNum === 116) key = 'partlyCloudy';
        else if (codeNum >= 119 && codeNum <= 122) key = 'cloudy';
    }

    // 无代码时根据描述判断
    if (!code && weather) {
        const w = weather.toLowerCase();
        if (w.includes('雷') || w.includes('thunder')) key = 'thunder';
        else if (w.includes('雪') || w.includes('snow')) key = 'snow';
        else if (w.includes('雨') || w.includes('rain')) key = w.includes('大') || w.includes('暴') || w.includes('heavy') ? 'heavyRain' : 'rain';
        else if (w.includes('雾') || w.includes('霾') || w.includes('fog') || w.includes('mist')) key = 'fog';
        else if (w.includes('阴') || w.includes('overcast')) key = 'cloudy';
        else if (w.includes('云') || w.includes('cloud')) key = w.includes('多') || w.includes('partly') ? 'partlyCloudy' : 'cloudy';
        else if (w.includes('晴') || w.includes('sunny') || w.includes('clear')) key = 'sunny';
    }

    return WEATHER_ICONS[key] || WEATHER_ICONS.sunny;
}

// 更新统计数据
function updateStats() {
    // 运行天数（从配置中的启动日期计算）
    const startDateString = config?.site?.startDate;
    let days = 1;
    if (startDateString) {
        const startDate = new Date(startDateString);
        const now = new Date();
        // Set time to 0 to count full days
        startDate.setHours(0, 0, 0, 0);
        now.setHours(0, 0, 0, 0);
        const diffTime = Math.abs(now - startDate);
        days = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1; // Add 1 to be inclusive
    }
    document.getElementById('runtime-days').textContent = days;

    // 动态总数
    const activities = config?.activities?.length || 0;
    document.getElementById('activity-count').textContent = activities;
}

// 刷新二次元图片（优先随机换一篇博客封面，无封面时回退动漫图 API）
async function refreshImage() {
    const imgDiv = document.getElementById('anime-img');

    // 已有封面文章时：换到另一篇（排除当前篇）
    if (galleryArticle) {
        const covered = await fetchCoveredArticles();
        const others = covered.filter(a => String(a.id) !== String(galleryArticle.id));
        const pool = others.length > 0 ? others : covered;
        if (pool.length > 0) {
            const pick = pool[Math.floor(Math.random() * pool.length)];
            // 换图失败（封面失效）则继续回退动漫图 API
            if (await setGalleryImage(pick)) return;
        }
    }

    // 当前不是封面：尝试换成博客封面
    if (await loadGalleryFromBlog()) return;

    const enabledApis = (config.apis?.anime || []).filter(api => api.enabled).sort((a, b) => a.priority - b.priority);

    if (enabledApis.length === 0) return;

    // 随机选择一个 API
    const randomApi = enabledApis[Math.floor(Math.random() * enabledApis.length)];

    // 添加旋转动画
    imgDiv.style.opacity = '0.5';

    const img = new Image();
    img.onload = () => {
        imgDiv.style.backgroundImage = `url(${withTimestamp(randomApi.url)})`;
        imgDiv.classList.remove('blog-cover');
        imgDiv.title = '';
        galleryArticle = null;
        hideGalleryArticleInfo();
        imgDiv.style.opacity = '1';
    };
    img.onerror = () => {
        imgDiv.style.opacity = '1';
    };
    img.src = withTimestamp(randomApi.url);
}

// 更新网站图标
function updateFavicon(faviconUrl) {
    if (!faviconUrl) return;
    
    // 移除旧的 favicon
    const oldFavicon = document.querySelector('link[rel="icon"]');
    if (oldFavicon) {
        oldFavicon.remove();
    }
    
    // 创建新的 favicon
    const newFavicon = document.createElement('link');
    newFavicon.rel = 'icon';
    newFavicon.type = 'image/x-icon';
    newFavicon.href = faviconUrl;
    document.head.appendChild(newFavicon);
}
