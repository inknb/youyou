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
    const cover = article.cover ? `<div class="blog-card-cover"><img src="${escapeHtml(bustCoverUrl(article.cover))}" alt="${escapeHtml(article.title)}" loading="lazy" onerror="this.parentElement.classList.add('broken')"></div>` : '';
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

// 封面 URL 加唯一随机参数（随机图 API 每篇取不同图，同时绕过浏览器缓存）
function bustCoverUrl(url) {
    const clean = sanitizeUrl(url);
    if (!clean) return '';
    const sep = clean.includes('?') ? '&' : '?';
    return `${clean}${sep}t=${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
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

document.addEventListener('DOMContentLoaded', () => {
    loadSiteTitle();

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
