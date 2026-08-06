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

async function loadSiteTitle() {
    try {
        const res = await fetch(`${API_BASE}/api/config`, { cache: 'no-store' });
        const data = await res.json();
        if (data.success && data.data?.site?.title) {
            document.getElementById('blog-site-name').textContent = data.data.site.title;
            document.title = `博客 · ${data.data.site.title}`;
        }
    } catch (e) { /* 忽略 */ }
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
        <a class="blog-card" href="blog.html?id=${encodeURIComponent(article.id)}">
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
        document.title = `${article.title} · 悠悠の小站`;
        document.getElementById('blog-list-view').style.display = 'none';
        document.getElementById('blog-detail-view').style.display = 'block';
        document.getElementById('blog-title').textContent = article.title;
        document.getElementById('blog-category').textContent = article.category || '未分类';
        document.getElementById('blog-date').textContent = article.createdAt || '';
        document.getElementById('blog-content').innerHTML = renderMarkdown(article.content);
    } catch (err) {
        console.error('加载文章详情失败:', err);
        showNotFound();
    }
}

function showNotFound() {
    document.getElementById('blog-list-view').style.display = 'none';
    document.getElementById('blog-detail-view').style.display = 'none';
    document.getElementById('blog-not-found').style.display = 'block';
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
