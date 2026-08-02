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

// 颜色值校验（防止 style 属性注入）
function sanitizeColor(color, fallback = '#3b82f6') {
    return /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : fallback;
}

// 带时间戳的图片 URL（正确处理已有 query 的情况）
function withTimestamp(url) {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}t=${Date.now()}`;
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
        schedule: { courses: [], events: [] },
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

// 加载每日一言
async function loadHitokoto() {
    const subtitleEl = document.getElementById('site-subtitle');
    
    // 获取启用的 API 列表
    const enabledApis = config.apis.hitokoto?.filter(api => api.enabled).sort((a, b) => a.priority - b.priority);
    
    if (!enabledApis || enabledApis.length === 0) {
        subtitleEl.textContent = '探索简洁、逻辑与二次元的平衡点';
        return;
    }
    
    // 尝试加载第一个 API
    const primaryApi = enabledApis[0];
    
    try {
        const res = await fetch(primaryApi.url);
        if (res.ok) {
            const text = await res.text();
            subtitleEl.textContent = text.trim();
        } else {
            throw new Error('API 请求失败');
        }
    } catch (err) {
        // 失败则尝试第二个
        if (enabledApis.length > 1) {
            try {
                const res = await fetch(enabledApis[1].url);
                if (res.ok) {
                    const text = await res.text();
                    subtitleEl.textContent = text.trim();
                } else {
                    throw new Error('备用 API 请求失败');
                }
            } catch (err2) {
                subtitleEl.textContent = '探索简洁、逻辑与二次元的平衡点';
            }
        } else {
            subtitleEl.textContent = '探索简洁、逻辑与二次元的平衡点';
        }
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

    // 加载图片
    loadAnimeImage();

    // 加载日程
    await loadSchedule();

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

// 加载二次元图片
function loadAnimeImage() {
    const imgDiv = document.getElementById('anime-img');
    const enabledApis = (config.apis?.anime || []).filter(api => api.enabled).sort((a, b) => a.priority - b.priority);

    if (enabledApis.length === 0) return;

    // 尝试加载第一个 API
    const primaryApi = enabledApis[0];
    const img = new Image();

    img.onload = () => {
        imgDiv.style.backgroundImage = `url(${withTimestamp(primaryApi.url)})`;
    };

    img.onerror = () => {
        // 失败则尝试第二个
        if (enabledApis.length > 1) {
            const backupApi = enabledApis[1];
            imgDiv.style.backgroundImage = `url(${withTimestamp(backupApi.url)})`;
        }
    };

    img.src = withTimestamp(primaryApi.url);
}

// 加载日程
async function loadSchedule() {
    try {
        const res = await fetch(`${API_BASE}/api/schedule`, { cache: 'no-store' });
        const data = await res.json();
        
        if (!data.success) return;
        
        const { courses, events } = data.data;
        renderSchedule(courses, events);
        
        // 检查当前进行中的日程
        checkCurrentSchedule(courses, events);
        
    } catch (err) {
        console.error('加载日程失败:', err);
        renderSchedule([], []);
    }
}

// 渲染日程列表
function renderSchedule(courses, events) {
    const container = document.getElementById('schedule-list');
    const now = new Date();
    const currentDay = now.getDay() || 7;

    // 合并课程和日程，按时间排序
    const todayItems = [
        ...courses.filter(c => c.day === currentDay).map(c => ({ ...c, type: 'course' })),
        ...events.filter(e => e.day === currentDay).map(e => ({ ...e, type: 'event' }))
    ].sort((a, b) => a.startTime.localeCompare(b.startTime));

    if (todayItems.length === 0) {
        container.innerHTML = '<div class="schedule-empty">今天没有安排，休息一下吧 ~</div>';
        updateScheduleCount(0);
        return;
    }

    updateScheduleCount(todayItems.length);

    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    container.innerHTML = todayItems.map(item => {
        const isCurrent = currentTime >= item.startTime && currentTime <= item.endTime;
        const typeName = item.type === 'course' ? '课程' : '日程';
        const itemColor = sanitizeColor(item.color, '#02539a');

        return `
            <div class="schedule-item ${isCurrent ? 'current' : ''}" style="--item-color: ${itemColor}">
                <div class="schedule-time">
                    <span class="time-start">${escapeHtml(item.startTime)}</span>
                    <span class="time-separator"></span>
                    <span class="time-end">${escapeHtml(item.endTime)}</span>
                </div>
                <div class="schedule-info">
                    <div class="schedule-name">${escapeHtml(item.name)}</div>
                    ${item.location ? `<div class="schedule-location">${escapeHtml(item.location)}</div>` : ''}
                </div>
                <span class="schedule-type" style="background: ${itemColor}12; color: ${itemColor}; border: 1px solid ${itemColor}30;">
                    ${typeName}
                </span>
            </div>
        `;
    }).join('');
}

// 检查当前进行中的日程
function checkCurrentSchedule(courses, events) {
    const now = new Date();
    const currentDay = now.getDay() || 7;
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    const currentCourse = courses.find(c => 
        c.day === currentDay && 
        currentTime >= c.startTime && 
        currentTime <= c.endTime
    );
    
    const currentEvent = events.find(e => 
        e.day === currentDay && 
        currentTime >= e.startTime && 
        currentTime <= e.endTime
    );
    
    const alertEl = document.getElementById('schedule-alert');
    const alertText = document.getElementById('alert-text');

    const setAlert = (prefix, name, suffix) => {
        alertEl.style.display = 'block';
        alertText.textContent = '';
        alertText.appendChild(document.createTextNode(prefix));
        const strong = document.createElement('strong');
        strong.textContent = name;
        alertText.appendChild(strong);
        if (suffix) alertText.appendChild(document.createTextNode(suffix));
    };

    if (currentCourse) {
        setAlert('正在上课：', currentCourse.name, ` @ ${currentCourse.location || '未知地点'}`);
    } else if (currentEvent) {
        setAlert('正在进行：', currentEvent.name);
    } else {
        alertEl.style.display = 'none';
    }
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

// 每分钟刷新一次日程状态
setInterval(() => {
    if (config) {
        loadSchedule();
    }
}, 60000);

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

    // 检查是否启用天气 API
    if (!config?.apis?.weather?.enabled) {
        weatherBox.innerHTML = '<span style="font-size: 1.2rem;">☀</span><span>未启用</span>';
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/weather`, { cache: 'no-store' });
        const result = await res.json();

        if (result.success && result.data) {
            const data = result.data;
            const icon = getWeatherIcon(data.weather, data.weatherCode);

            weatherBox.innerHTML = `
                <span style="font-size: 1.2rem;">${icon}</span>
                <span>${data.weather} ${data.temp}°C</span>
            `;
        } else {
            weatherBox.innerHTML = '<span style="font-size: 1.2rem;">☀</span><span>获取失败</span>';
        }
    } catch (err) {
        console.error('获取天气失败:', err);
        weatherBox.innerHTML = '<span style="font-size: 1.2rem;">☀</span><span>加载失败</span>';
    }
}

// 根据天气描述和代码获取图标
function getWeatherIcon(weather, code) {
    if (!weather && !code) return '☀';

    // 优先根据天气代码判断（wttr.in 代码）
    if (code) {
        const codeNum = parseInt(code);
        // 晴朗 (113)
        if (codeNum === 113) return '☀';
        // 多云/部分多云 (119, 122, 143)
        if (codeNum >= 119 && codeNum <= 143) return '☁';
        // 小雨 (176, 263, 266, 293, 296, 299, 302, 305, 308, 353)
        if (codeNum >= 176 && codeNum <= 353 && codeNum !== 227) return '🌧';
        // 雪 (179, 182, 185, 227, 230, 233, 236, 281, 284, 317, 320, 323, 326, 329, 332, 335, 338, 350, 362, 365, 368, 371, 374, 377, 386, 389, 392, 395, 398, 371)
        if (codeNum === 179 || codeNum === 182 || codeNum === 185 ||
            (codeNum >= 227 && codeNum <= 236) ||
            (codeNum >= 281 && codeNum <= 284) ||
            (codeNum >= 317 && codeNum <= 338) ||
            (codeNum >= 350 && codeNum <= 398)) return '❄';
        // 雾 (143, 248, 260)
        if (codeNum === 143 || codeNum === 248 || codeNum === 260) return '🌫';
        // 雷暴 (200, 389, 392, 395, 386)
        if (codeNum === 200 || codeNum === 389 || codeNum === 392 || codeNum === 395 || codeNum === 386) return '⛈';
    }

    // 根据描述判断
    if (weather) {
        const w = weather.toLowerCase();
        if (w.includes('雨')) return '🌧';
        if (w.includes('雪')) return '❄';
        if (w.includes('云') || w.includes('阴') || w.includes('overcast') || w.includes('cloud')) return '☁';
        if (w.includes('雾') || w.includes('霾') || w.includes('fog') || w.includes('mist')) return '🌫';
        if (w.includes('雷') || w.includes('thunder')) return '⛈';
        if (w.includes('晴') || w.includes('sunny') || w.includes('clear')) return '☀';
    }

    return '☀';
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

    // 本周课程数
    const weekCourses = config?.schedule?.courses?.length || 0;
    document.getElementById('course-count').textContent = weekCourses;
}

// 刷新二次元图片
function refreshImage() {
    const imgDiv = document.getElementById('anime-img');
    const enabledApis = (config.apis?.anime || []).filter(api => api.enabled).sort((a, b) => a.priority - b.priority);

    if (enabledApis.length === 0) return;

    // 随机选择一个 API
    const randomApi = enabledApis[Math.floor(Math.random() * enabledApis.length)];

    // 添加旋转动画
    imgDiv.style.opacity = '0.5';

    const img = new Image();
    img.onload = () => {
        imgDiv.style.backgroundImage = `url(${withTimestamp(randomApi.url)})`;
        imgDiv.style.opacity = '1';
    };
    img.onerror = () => {
        imgDiv.style.opacity = '1';
    };
    img.src = withTimestamp(randomApi.url);
}

// 更新日程数量徽章
function updateScheduleCount(count) {
    const badge = document.getElementById('schedule-count');
    if (badge) {
        badge.textContent = `${count} 项`;
    }
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
