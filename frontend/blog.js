// API 基础地址（同源部署）
const API_BASE = window.location.origin;

function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Markdown 渲染（DOMPurify 消毒，防 XSS；CDN 不可用则降级为纯文本）
function renderMarkdown(md) {
    if (typeof marked !== 'undefined') {
        let html;
        try {
            html = marked.parse(md || '');
        } catch (e) {
            html = '';
        }
        if (typeof DOMPurify !== 'undefined') {
            return DOMPurify.sanitize(html);
        }
        return escapeHtml(html);
    }
    return escapeHtml(md).replace(/\n/g, '<br>');
}

let siteTitle = '悠悠の小站';
let siteConfig = null;

async function loadSiteTitle() {
    try {
        const res = await fetch(`${API_BASE}/api/config`, { cache: 'no-store' });
        const data = await res.json();
        if (data.success && data.data?.site?.title) {
            siteTitle = data.data.site.title;
            siteConfig = data.data;
            document.getElementById('blog-site-name').textContent = siteTitle;
            document.title = `博客 · ${siteTitle}`;
        }
        if (data.success && data.data && window.initMusicPlayer) {
            initMusicPlayer(data.data);
        }
        renderFooter();
    } catch (e) { /* 忽略 */ }
}

// 渲染页脚（与首页一致：版权年份 + 起始时间 + 运行天数）
function renderFooter() {
    const site = siteConfig?.site || {};
    const copyrightEl = document.getElementById('footer-copyright');
    const runtimeEl = document.getElementById('footer-runtime');
    if (!copyrightEl && !runtimeEl) return;

    const year = new Date().getFullYear();
    const title = site.title || '悠悠の小站';
    if (copyrightEl) {
        copyrightEl.textContent = `© ${year} ${title}`;
    }
    if (runtimeEl) {
        const parts = [];
        const startDate = site.startDate || site.start_date;
        if (startDate) parts.push(`始于 ${startDate}`);
        const days = runtimeDays(startDate);
        if (days !== null) parts.push(`已运行 ${days} 天`);
        runtimeEl.textContent = parts.join(' · ');
    }
}

function runtimeDays(startDateString) {
    if (!startDateString) return null;
    const startDate = new Date(startDateString);
    if (isNaN(startDate.getTime())) return null;
    const now = new Date();
    startDate.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    return Math.floor(Math.abs(now - startDate) / (1000 * 60 * 60 * 24)) + 1;
}

let blogPage = 1;
let blogTotal = 0;
let blogKeyword = '';
const BLOG_PAGE_SIZE = 10;

async function loadArticleList() {
    const container = document.getElementById('blog-list');
    try {
        const url = `${API_BASE}/api/blog?page=${blogPage}&pageSize=${BLOG_PAGE_SIZE}${blogKeyword ? `&keyword=${encodeURIComponent(blogKeyword)}` : ''}`;
        const res = await fetch(url, { cache: 'no-store' });
        const data = await res.json();
        if (!data.success) throw new Error(data.message || '加载失败');

        const list = data.data.list || [];
        blogTotal = data.data.total || 0;

        if (blogPage === 1 && list.length === 0) {
            container.innerHTML = `<div class="blog-empty">${blogKeyword ? `没有找到与「${escapeHtml(blogKeyword)}」相关的文章` : '还没有文章，敬请期待 ~'}</div>`;
            updateLoadMore();
            return;
        }

        if (blogPage === 1) {
            container.innerHTML = list.map(article => articleCard(article)).join('');
        } else {
            container.insertAdjacentHTML('beforeend', list.map(article => articleCard(article)).join(''));
        }
        blogPage += 1;
        updateLoadMore();
        observeCards(container);
    } catch (err) {
        console.error('加载博客列表失败:', err);
        if (blogPage === 1) {
            container.innerHTML = '<div class="blog-empty">博客加载失败</div>';
        }
        updateLoadMore(false);
    }
}

function articleCard(article) {
    const cover = article.cover ? `<div class="blog-card-cover"><img src="${escapeHtml(articleCoverUrl(article.cover, article.id))}" alt="${escapeHtml(article.title)}" loading="lazy" onerror="this.parentElement.classList.add('broken')"></div>` : '';
    return `
        <a class="blog-card" href="blog.html?id=${encodeURIComponent(article.id)}" data-reveal>
            ${cover}
            <div class="blog-card-main">
                <div class="blog-card-title">${escapeHtml(article.title)}</div>
                <div class="blog-card-summary">${escapeHtml(article.summary) || '点击阅读全文 →'}</div>
            </div>
            <div class="blog-card-meta">
                <span class="blog-category">${escapeHtml(article.category)}</span>
                <span class="blog-date">${escapeHtml(article.createdAt)}</span>
            </div>
        </a>
    `;
}

function sanitizeUrl(url) {
    if (typeof url !== 'string') return '';
    const trimmed = url.trim();
    return /^https?:\/\//i.test(trimmed) ? trimmed : '';
}

// 第三方图源体积优化：yppp 原图可能 5MB+，w 参数可缩至 1/6
// 注意：必须与 app.js 的 optimizeImageUrl 保持同步
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

// 封面 URL 基于文章 id 生成确定性参数（与首页卡片一致，同一篇显示同一张图）
function articleCoverUrl(url, id) {
    const clean = optimizeImageUrl(sanitizeUrl(url));
    if (!clean) return '';
    const sep = clean.includes('?') ? '&' : '?';
    return `${clean}${sep}t=article_${id}`;
}

function updateLoadMore(show = true) {
    const btn = document.getElementById('blog-load-more');
    if (!btn) return;
    const loaded = (blogPage - 1) * BLOG_PAGE_SIZE;
    if (show && loaded < blogTotal) {
        btn.style.display = 'block';
    } else {
        btn.style.display = 'none';
    }
}

// 动态卡片滚动显现（与主页 initReveal 同一套视觉）
function observeCards(container) {
    if (!container || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                io.unobserve(entry.target);
            }
        });
    }, { threshold: 0.05, rootMargin: '0px 0px -24px 0px' });
    container.querySelectorAll('[data-reveal]:not(.revealed)').forEach(el => io.observe(el));
}

// 页面级滚动显现（顶栏/列表区/详情区），与首页 initReveal 一致
function initReveal() {
    const els = document.querySelectorAll('[data-reveal]');
    if (!('IntersectionObserver' in window)) {
        els.forEach(el => el.classList.add('revealed'));
        return;
    }
    const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                io.unobserve(entry.target);
            }
        });
    }, { threshold: 0.08, rootMargin: '0px 0px -36px 0px' });
    els.forEach(el => io.observe(el));
}

async function loadArticleDetail(id) {
    try {
        const res = await fetch(`${API_BASE}/api/blog/${encodeURIComponent(id)}`, { cache: 'no-store' });
        if (res.status === 404) {
            showNotFound();
            return;
        }
        const data = await res.json();
        if (!data.success) {
            showNotFound();
            return;
        }

        const article = data.data;
        document.title = `${article.title} · ${siteTitle}`;
        document.getElementById('blog-list-view').style.display = 'none';
        document.getElementById('blog-detail-view').style.display = 'block';
        document.getElementById('blog-detail-view').classList.add('revealed');
        document.getElementById('blog-title').textContent = article.title;
        document.getElementById('blog-category').textContent = article.category || '未分类';
        document.getElementById('blog-date').textContent = article.createdAt || '';
        document.getElementById('blog-content').innerHTML = renderMarkdown(article.content);

        // 正文图片懒加载（非首屏图片按需加载）
        const contentEl = document.getElementById('blog-content');
        contentEl.querySelectorAll('img').forEach(img => {
            img.loading = 'lazy';
            img.decoding = 'async';
        });

        // 阅读时长与字数
        renderReadingTime(article.content);

        // 上一篇 / 下一篇
        loadAdjacentArticles(article.id);
    } catch (err) {
        console.error('加载文章详情失败:', err);
        showNotFound();
    }
}

// 估算正文字数（剔除 Markdown 符号与空白），按 400 字/分钟计算阅读时长
function renderReadingTime(markdown) {
    const el = document.getElementById('blog-reading');
    if (!el) return;
    try {
        const plain = String(markdown || '')
            .replace(/```[\s\S]*?```/g, ' ')      // 代码块
            .replace(/`[^`]*`/g, ' ')             // 行内代码
            .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // 图片
            .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // 链接保留文字
            .replace(/[#>*_~\-|]/g, ' ')          // 其余符号
            .replace(/\s+/g, '');
        const chars = plain.length;
        if (chars > 0) {
            const minutes = Math.max(1, Math.round(chars / 400));
            el.textContent = `约 ${chars} 字 · 阅读 ${minutes} 分钟`;
        }
    } catch (e) { /* 忽略 */ }
}

// 加载上一篇 / 下一篇（基于全部已发布文章的时间顺序）
async function loadAdjacentArticles(currentId) {
    const pager = document.getElementById('blog-pager');
    if (!pager) return;
    try {
        const res = await fetch(`${API_BASE}/api/blog?page=1&pageSize=200`, { cache: 'no-store' });
        const data = await res.json();
        if (!data.success || !Array.isArray(data.data?.articles)) return;
        const list = data.data.articles;
        const idx = list.findIndex(a => String(a.id) === String(currentId));
        if (idx === -1 || list.length < 2) return;

        const prev = idx > 0 ? list[idx - 1] : null;
        const next = idx < list.length - 1 ? list[idx + 1] : null;
        if (!prev && !next) return;

        pager.innerHTML = `
            ${prev ? `<a class="pager-item pager-prev" href="blog.html?id=${encodeURIComponent(prev.id)}">
                <span class="pager-label">上一篇</span>
                <span class="pager-title">${escapeHtml(prev.title)}</span>
            </a>` : '<span class="pager-item pager-empty"></span>'}
            ${next ? `<a class="pager-item pager-next" href="blog.html?id=${encodeURIComponent(next.id)}">
                <span class="pager-label">下一篇</span>
                <span class="pager-title">${escapeHtml(next.title)}</span>
            </a>` : '<span class="pager-item pager-empty"></span>'}
        `;
    } catch (e) { /* 忽略 */ }
}

function showNotFound() {
    document.getElementById('blog-list-view').style.display = 'none';
    document.getElementById('blog-detail-view').style.display = 'none';
    const notFound = document.getElementById('blog-not-found');
    notFound.style.display = 'block';
    notFound.classList.add('revealed');
}

// 加载二次元壁纸背景（与首页一致：复用动漫图 API，避开主图源，仅加载一次）
let wallpaperLoaded = false;

async function loadWallpaper() {
    if (wallpaperLoaded) return;
    wallpaperLoaded = true;

    const wallpaperEl = document.getElementById('bg-wallpaper');
    if (!wallpaperEl) return;

    try {
        const res = await fetch(`${API_BASE}/api/config`, { cache: 'no-store' });
        const data = await res.json();
        if (!data.success) return;

        const enabledApis = (data.data?.apis?.anime || []).filter(api => api.enabled).sort((a, b) => a.priority - b.priority);
        if (enabledApis.length === 0) return;

        // 壁纸优先用非主图源，避免与首页卡片图片重复；只有一个源时退回共用
        const wallpaperApis = enabledApis.length > 1 ? enabledApis.slice(1) : enabledApis;
        const api = wallpaperApis[Math.floor(Math.random() * wallpaperApis.length)];

        const sep = api.url.includes('?') ? '&' : '?';
        const img = new Image();
        img.onload = () => {
            wallpaperEl.style.backgroundImage = `url(${api.url}${sep}t=${Date.now()})`;
            wallpaperEl.classList.add('ready');
        };
        img.onerror = () => { /* 加载失败保持淡色背景 */ };
        img.src = `${api.url}${sep}t=${Date.now()}`;
    } catch (e) { /* 忽略 */ }
}

document.addEventListener('DOMContentLoaded', () => {
    loadSiteTitle();
    loadWallpaper();
    initReveal();

    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) {
        loadArticleDetail(id);
        return;
    }

    loadArticleList();
    document.getElementById('blog-load-more').addEventListener('click', loadArticleList);

    // 搜索（防抖 300ms）
    const searchInput = document.getElementById('blog-search');
    let searchTimer = null;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            blogKeyword = searchInput.value.trim();
            blogPage = 1;
            loadArticleList();
        }, 300);
    });
});
