// API 基础地址
const API_BASE = window.location.origin;

// 全局配置数据
let configData = null;

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

// URL 协议白名单（仅允许 http/https）
function sanitizeUrl(url) {
    if (typeof url !== 'string') return '';
    const trimmed = url.trim();
    return /^https?:\/\//i.test(trimmed) ? trimmed : '';
}

// 颜色值校验（防止 style 属性注入）
function sanitizeColor(color, fallback = '#3b82f6') {
    return /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : fallback;
}

// Token 管理
const TOKEN_KEY = 'admin_token';

function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
}

// 401 跳转去重
let redirectingToLogin = false;

// 带认证的 fetch 封装
async function authFetch(url, options = {}) {
    const token = getToken();
    const headers = {
        ...options.headers,
        'Content-Type': 'application/json'
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(url, {
        ...options,
        headers
    });

    // 先判断 401，再解析 body（避免 401 空响应导致 json() 抛错）
    if (res.status === 401) {
        clearToken();
        if (!redirectingToLogin) {
            redirectingToLogin = true;
            showLoginPage();
            showToast('登录已过期，请重新登录', 'error');
            setTimeout(() => { redirectingToLogin = false; }, 1000);
        }
        throw new Error('需要重新登录');
    }

    let data;
    try {
        data = await res.json();
    } catch (e) {
        throw new Error(`服务器响应格式错误 (HTTP ${res.status})`);
    }

    // 检查是否需要重新登录
    if (data.needLogin) {
        clearToken();
        if (!redirectingToLogin) {
            redirectingToLogin = true;
            showLoginPage();
            showToast('登录已过期，请重新登录', 'error');
            setTimeout(() => { redirectingToLogin = false; }, 1000);
        }
        throw new Error('需要重新登录');
    }

    return { res, data };
}

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    // 初始化登录表单
    initLoginForm();
    initPasswordForm();
    initAccountForm();

    // 检查登录状态
    const token = getToken();
    if (token) {
        try {
            const { data } = await authFetch(`${API_BASE}/api/auth/verify`);
            if (data.success) {
                showAdminPage();
                document.getElementById('display-username').textContent = data.data.username;
                if (data.data.lastLogin) {
                    document.getElementById('display-last-login').textContent = `上次登录: ${formatTime(data.data.lastLogin)}`;
                }
                await loadConfig();
                loadBlogData();
                initNavigation();
                initForms();
            } else {
                clearToken();
                showLoginPage();
            }
        } catch (err) {
            showLoginPage();
        }
    } else {
        showLoginPage();
    }
});

// 显示登录页面
function showLoginPage() {
    document.getElementById('login-page').style.display = 'flex';
    document.getElementById('admin-layout').classList.add('hidden');
}

// 显示管理页面
function showAdminPage() {
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('admin-layout').classList.remove('hidden');
}

// 格式化时间
function formatTime(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// 切换密码可见性
function togglePasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        btn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
            </svg>
        `;
    } else {
        input.type = 'password';
        btn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
            </svg>
        `;
    }
}

// 初始化登录表单
function initLoginForm() {
    const form = document.getElementById('login-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('login-btn');
        const originalText = btn.textContent;
        btn.textContent = '登录中...';
        btn.disabled = true;

        try {
            const formData = new FormData(form);
            const res = await fetch(`${API_BASE}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: formData.get('username'),
                    password: formData.get('password')
                })
            });
            const data = await res.json();

            if (data.success) {
                setToken(data.data.token);
                showToast('登录成功');
                showAdminPage();
                document.getElementById('display-username').textContent = data.data.username;
                if (data.data.lastLogin) {
                    document.getElementById('display-last-login').textContent = `上次登录: ${formatTime(data.data.lastLogin)}`;
                }
                await loadConfig();
                loadBlogData();
                initNavigation();
                initForms();
                form.reset();
            } else {
                showToast(data.message || '登录失败', 'error');
            }
        } catch (err) {
            showToast('网络错误，请稍后重试', 'error');
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    });
}

// 初始化修改密码表单
function initPasswordForm() {
    const form = document.getElementById('password-form');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const newPassword = formData.get('newPassword');
        const confirmPassword = formData.get('confirmPassword');

        if (newPassword !== confirmPassword) {
            showToast('两次输入的密码不一致', 'error');
            return;
        }

        try {
            const { data } = await authFetch(`${API_BASE}/api/auth/change-password`, {
                method: 'POST',
                body: JSON.stringify({
                    oldPassword: formData.get('oldPassword'),
                    newPassword: newPassword
                })
            });

            if (data.success) {
                showToast('密码已修改，请重新登录');
                closePasswordModal();
                logout();
            } else {
                showToast(data.message || '修改失败', 'error');
            }
        } catch (err) {
            // 错误已在 authFetch 中处理
        }
    });
}

// 初始化账户设置表单
let accountFormInitialized = false;
function initAccountForm() {
    const form = document.getElementById('account-form');
    if (!form || accountFormInitialized) return;
    accountFormInitialized = true;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const username = formData.get('username').trim();
        const oldPassword = formData.get('oldPassword');
        const newPassword = formData.get('newPassword');
        const confirmPassword = formData.get('confirmPassword');

        // 验证
        if (!oldPassword) {
            showToast('请输入当前密码', 'error');
            return;
        }

        if (newPassword && newPassword !== confirmPassword) {
            showToast('两次输入的新密码不一致', 'error');
            return;
        }

        if (!username && !newPassword) {
            showToast('请输入要修改的用户名或新密码', 'error');
            return;
        }

        const btn = form.querySelector('button[type="submit"]');
        const originalText = btn.textContent;
        btn.textContent = '保存中...';
        btn.disabled = true;

        try {
            const { data } = await authFetch(`${API_BASE}/api/auth/update-account`, {
                method: 'POST',
                body: JSON.stringify({
                    username: username || undefined,
                    oldPassword,
                    newPassword: newPassword || undefined
                })
            });

            if (data.success) {
                showToast(data.message);
                form.reset();
                // 更新显示的用户名
                if (data.data?.username) {
                    document.getElementById('display-username').textContent = data.data.username;
                }
                // 如果需要重新登录（修改了密码）
                if (data.needRelogin) {
                    setTimeout(() => logout(), 1500);
                }
            } else {
                showToast(data.message || '修改失败', 'error');
            }
        } catch (err) {
            // 错误已在 authFetch 中处理
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    });
}

// 登出
async function logout() {
    try {
        await authFetch(`${API_BASE}/api/auth/logout`, { method: 'POST' });
    } catch (err) {
        // 忽略错误
    }
    clearToken();
    showLoginPage();
    showToast('已退出登录');
}

// 打开修改密码弹窗
function openPasswordModal() {
    const modal = document.getElementById('password-modal');
    if (!modal) return;
    modal.classList.add('show');
    document.getElementById('password-form').reset();
}

// 关闭修改密码弹窗
function closePasswordModal() {
    const modal = document.getElementById('password-modal');
    if (modal) modal.classList.remove('show');
}

// 加载配置
async function loadConfig() {
    try {
        const res = await fetch(`${API_BASE}/api/config`, { cache: 'no-store' });
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        const data = await res.json();
        if (data.success) {
            configData = data.data;
            removeErrorBanner();
            renderAll();
        } else {
            throw new Error(data.message || '返回数据格式错误');
        }
    } catch (err) {
        console.error('加载配置失败:', err);
        showToast(`加载配置失败: ${err.message}`, 'error');
        showErrorBanner(err.message);
    }
}

// 错误横幅（不销毁主内容区 DOM）
function showErrorBanner(detail) {
    removeErrorBanner();
    const main = document.querySelector('.main-content');
    if (!main) return;
    const banner = document.createElement('div');
    banner.id = 'load-error-banner';
    banner.className = 'card';
    banner.style.cssText = 'text-align:center;padding:24px;margin-bottom:16px;border:1px solid #fecaca;background:#fef2f2;';
    banner.innerHTML = `
        <p style="color:#ef4444;font-weight:600;margin-bottom:8px;">无法连接到后端服务器</p>
        <p style="color:var(--text-sub);font-size:0.85rem;">请确保后端已启动（backend 目录运行 npm start），然后 <a href="javascript:location.reload()" style="color:var(--primary-blue);">刷新页面</a></p>
        <p style="font-size:0.8rem;color:#999;margin-top:8px;">${escapeHtml(detail || '')}</p>
    `;
    main.prepend(banner);
}

function removeErrorBanner() {
    document.getElementById('load-error-banner')?.remove();
}

// 渲染所有内容
function renderAll() {
    // 同步随机一言列表（仅配置加载时；本地编辑期间不被覆盖）
    hitokotoSentences = Array.isArray(configData?.site?.hitokotoList) ? [...configData.site.hitokotoList] : [];
    renderDashboard();
    renderSiteForm();
    renderApis();
    renderHitokotoList();
    renderTags();
    renderLinks();
    renderActivities();
}

// ========== 博客管理 ==========
let blogArticles = [];

async function loadBlogData() {
    try {
        const { data } = await authFetch(`${API_BASE}/api/blog?page=1&pageSize=50`, { cache: 'no-store' });
        if (data.success) {
            blogArticles = data.data.list || [];
            renderBlog();
        } else {
            showToast(data.message || '加载博客失败', 'error');
        }
    } catch (err) {
        // 错误已在 authFetch 处理
    }
}

function renderBlog() {
    const tbody = document.getElementById('blog-table-body');
    if (!tbody) return;

    if (blogArticles.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-sub);">暂无文章</td></tr>';
        return;
    }

    tbody.innerHTML = blogArticles.map(article => `
        <tr>
            <td><strong>${escapeHtml(article.title)}</strong></td>
            <td>${escapeHtml(article.category)}</td>
            <td>${escapeHtml(article.createdAt)}</td>
            <td>${article.published ? '<span style="color: #166534; font-weight: 600;">已发布</span>' : '<span style="color: #991b1b; font-weight: 600;">草稿</span>'}</td>
            <td>
                <button class="btn btn-sm" onclick="editBlog(${article.id})" style="background: #e0e7ff; color: var(--primary-blue); margin-right: 8px;">编辑</button>
                <button class="btn btn-sm btn-danger" onclick="deleteBlog(${article.id})">删除</button>
            </td>
        </tr>
    `).join('');
}

// 博客弹窗请求序列号（防止异步详情响应覆盖新打开的弹窗）
let blogModalSeq = 0;

function openBlogModal(id = null) {
    const modal = document.getElementById('blog-modal');
    const form = document.getElementById('blog-form');
    const seq = ++blogModalSeq;

    if (id !== null) {
        const article = blogArticles.find(a => String(a.id) === String(id));
        if (!article) {
            showToast('找不到该文章', 'error');
            return;
        }
        // 列表接口不含 content，需拉详情
        authFetch(`${API_BASE}/api/blog/${id}`, { cache: 'no-store' }).then(({ data }) => {
            // 期间用户已关闭/切换弹窗，丢弃过期响应
            if (seq !== blogModalSeq || modal.classList.contains('show')) {
                if (seq === blogModalSeq) modal.classList.add('show');
                return;
            }
            if (!data.success) {
                showToast(data.message || '加载文章失败', 'error');
                return;
            }
            const full = data.data;
            form.elements.id.value = full.id;
            form.elements.title.value = full.title;
            form.elements.category.value = full.category || '';
            form.elements.summary.value = full.summary || '';
            form.elements.cover.value = full.cover || '';
            form.elements.content.value = full.content;
            form.elements.published.checked = !!full.published;
            modal.classList.add('show');
        }).catch(() => {
            showToast('加载文章失败', 'error');
        });
    } else {
        form.reset();
        form.elements.id.value = '';
        form.elements.category.value = '未分类';
        form.elements.published.checked = true;
        modal.classList.add('show');
    }
}

function closeBlogModal() {
    document.getElementById('blog-modal').classList.remove('show');
}

function editBlog(id) {
    openBlogModal(id);
}

async function deleteBlog(id) {
    if (!confirm('确定删除这篇文章？此操作不可恢复')) return;

    try {
        const { data: result } = await authFetch(`${API_BASE}/api/blog/${id}`, {
            method: 'DELETE'
        });
        if (result.success) {
            showToast('文章已删除');
            await loadBlogData();
        } else {
            showToast(result.message || '删除失败', 'error');
        }
    } catch (err) {
        showToast('删除失败', 'error');
    }
}

// ========== 导航切换 ==========
let navInitialized = false;
function initNavigation() {
    if (navInitialized) return;
    navInitialized = true;
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            const section = link.dataset.section;
            
            // 更新导航状态
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            // 切换内容区
            document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
            document.getElementById(section).classList.add('active');
        });
    });
}

// ========== 概览 ==========
function renderDashboard() {
    const stats = document.getElementById('dashboard-stats');
    if (!configData) return;

    const animeCount = configData.apis?.anime?.length || 0;
    const tagCount = configData.tags?.length || 0;
    const linkCount = configData.links?.length || 0;
    const site = configData.site || {};

    stats.innerHTML = `
        <div class="stats-grid-container">
            <div class="stat-card" data-color="#3b82f6">
                <div class="stat-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                        <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>
                </div>
                <div class="stat-content">
                    <div class="stat-value">${animeCount}</div>
                    <div class="stat-label">图片 API</div>
                </div>
            </div>
            <div class="stat-card" data-color="#22c55e">
                <div class="stat-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                        <line x1="7" y1="7" x2="7.01" y2="7"></line>
                    </svg>
                </div>
                <div class="stat-content">
                    <div class="stat-value">${tagCount}</div>
                    <div class="stat-label">个人标签</div>
                </div>
            </div>
            <div class="stat-card" data-color="#f59e0b">
                <div class="stat-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                    </svg>
                </div>
                <div class="stat-content">
                    <div class="stat-value">${linkCount}</div>
                    <div class="stat-label">外链数量</div>
                </div>
            </div>
            <div class="stat-card" data-color="#ec4899">
                <div class="stat-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                    </svg>
                </div>
                <div class="stat-content">
                    <div class="stat-value">${(configData.activities || []).length}</div>
                    <div class="stat-label">动态总数</div>
                </div>
            </div>
        </div>
        <div class="config-info-card">
            <div class="config-info-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
                <span>当前配置</span>
            </div>
            <div class="config-info-grid">
                <div class="config-info-item">
                    <span class="config-info-label">昵称</span>
                    <span class="config-info-value">${escapeHtml(site.nickname)}</span>
                </div>
                <div class="config-info-item">
                    <span class="config-info-label">问候语</span>
                    <span class="config-info-value">动态显示</span>
                </div>
                <div class="config-info-item">
                    <span class="config-info-label">QQ</span>
                    <span class="config-info-value">${escapeHtml(site.qq)}</span>
                </div>
                <div class="config-info-item">
                    <span class="config-info-label">网站标题</span>
                    <span class="config-info-value">${escapeHtml(site.title)}</span>
                </div>
            </div>
        </div>
    `;
}

let formsInitialized = false;

// ========== 网站信息 ==========
function renderSiteForm() {
    if (!configData) return;
    const form = document.getElementById('site-form');
    if (!form) return;

    // 设置所有字段
    const site = configData.site || {};
    if (form.elements.title) form.elements.title.value = site.title || '';
    if (form.elements.nickname) form.elements.nickname.value = site.nickname || '';
    if (form.elements.qq) form.elements.qq.value = site.qq || '';
    if (form.elements.customAvatar) form.elements.customAvatar.value = site.customAvatar || '';
    if (form.elements.favicon) form.elements.favicon.value = site.favicon || '';
    if (form.elements.signature) form.elements.signature.value = site.signature || '';
    if (form.elements.bio) form.elements.bio.value = site.bio || '';
}

function initForms() {
    if (formsInitialized) return;
    formsInitialized = true;

    // 初始化账户设置表单
    initAccountForm();
    
    // 网站信息表单
    document.getElementById('site-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);

        try {
            const { data: result } = await authFetch(`${API_BASE}/api/config/site`, {
                method: 'POST',
                body: JSON.stringify(data)
            });
            if (result.success) {
                showToast('保存成功！');
                await loadConfig();
            } else {
                showToast(result.message, 'error');
            }
        } catch (err) {
            showToast('保存失败', 'error');
        }
    });

    // 天气 API 表单
    document.getElementById('weather-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const weatherConfig = {
            url: formData.get('url') || 'https://uapis.cn/api/v1/misc/weather',
            city: formData.get('city') || '',
            enabled: formData.get('enabled') === 'on'
        };

        try {
            const { data: result } = await authFetch(`${API_BASE}/api/config/apis`, {
                method: 'POST',
                body: JSON.stringify({ weather: weatherConfig })
            });
            if (result.success) {
                showToast('天气配置已保存');
                await loadConfig();
            } else {
                showToast(result.message, 'error');
            }
        } catch (err) {
            showToast('保存失败', 'error');
        }
    });

    // 链接表单
    document.getElementById('link-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!configData) return;
        const formData = new FormData(e.target);
        const link = Object.fromEntries(formData);
        const index = document.getElementById('link-index').value;

        if (!link.name || !/^https?:\/\//i.test(link.url || '')) {
            showToast('链接名称必填，地址需以 http:// 或 https:// 开头', 'error');
            return;
        }
        if (link.icon && !/^https?:\/\//i.test(link.icon)) {
            showToast('图标地址需以 http:// 或 https:// 开头', 'error');
            return;
        }

        if (!Array.isArray(configData.links)) configData.links = [];
        if (index !== '') {
            configData.links[parseInt(index)] = link;
        } else {
            configData.links.push(link);
        }

        await saveLinks();
        closeLinkModal();
    });

    // 动态表单
    document.getElementById('activity-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const activity = Object.fromEntries(formData);

        if (!activity.text) {
            showToast('动态内容必填', 'error');
            return;
        }

        // 删除空的 id 字段，避免覆盖后端生成的 ID
        if (!activity.id) delete activity.id;

        const id = document.getElementById('activity-id').value;

        try {
            let result;
            if (id) {
                const { data } = await authFetch(`${API_BASE}/api/activities/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify(activity)
                });
                result = data;
            } else {
                const { data } = await authFetch(`${API_BASE}/api/activities`, {
                    method: 'POST',
                    body: JSON.stringify(activity)
                });
                result = data;
            }
            if (result.success) {
                showToast(id ? '动态已更新' : '动态已添加');
                closeActivityModal();
                await loadConfig();
            } else {
                showToast(result.message, 'error');
            }
        } catch (err) {
            showToast('操作失败', 'error');
        }
    });

    // 博客表单
    document.getElementById('blog-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const article = Object.fromEntries(formData);
        article.published = formData.get('published') === 'on';

        if (!article.title || !article.content) {
            showToast('标题和正文必填', 'error');
            return;
        }

        // 删除空的 id 字段，避免覆盖后端生成的 ID
        if (!article.id) delete article.id;

        const id = document.getElementById('blog-id').value;

        try {
            let result;
            if (id) {
                const { data } = await authFetch(`${API_BASE}/api/blog/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify(article)
                });
                result = data;
            } else {
                const { data } = await authFetch(`${API_BASE}/api/blog`, {
                    method: 'POST',
                    body: JSON.stringify(article)
                });
                result = data;
            }
            if (result.success) {
                showToast(id ? '文章已更新' : '文章已发布');
                closeBlogModal();
                await loadBlogData();
            } else {
                showToast(result.message, 'error');
            }
        } catch (err) {
            showToast('操作失败', 'error');
        }
    });
}

// ========== API 管理 ==========
function renderApis() {
    if (!configData || !configData.apis || !configData.apis.anime) return;
    
    const tbody = document.getElementById('api-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = configData.apis.anime.map((api, index) => `
        <tr>
            <td>${escapeHtml(api.name)}</td>
            <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(api.url)}</td>
            <td>${api.priority}</td>
            <td>
                <span style="padding: 4px 12px; border-radius: 100px; font-size: 0.8rem; ${api.enabled ? 'background: #dcfce7; color: #166534;' : 'background: #fee2e2; color: #991b1b;'}">
                    ${api.enabled ? '启用' : '禁用'}
                </span>
            </td>
            <td>
                <button class="btn btn-sm ${api.enabled ? 'btn-danger' : 'btn-success'}" onclick="toggleApi(${index})" style="margin-right: 8px;">
                    ${api.enabled ? '禁用' : '启用'}
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteApi(${index})">删除</button>
            </td>
        </tr>
    `).join('');
    
    const qqInfo = configData.apis.qqInfo || { url: '', enabled: false };
    const qqConfig = document.getElementById('qq-api-config');
    qqConfig.innerHTML = `
        <div class="form-row">
            <div class="form-group">
                <label class="form-label">API 地址</label>
                <input type="text" class="form-input" value="${escapeHtml(qqInfo.url)}" readonly>
            </div>
            <div class="form-group">
                <label class="form-label">状态</label>
                <div style="padding: 12px; background: ${qqInfo.enabled ? '#dcfce7' : '#fee2e2'}; border-radius: 8px; color: ${qqInfo.enabled ? '#166534' : '#991b1b'};">
                    ${qqInfo.enabled ? '[已启用]' : '[已禁用]'}
                </div>
            </div>
        </div>
    `;

    // 渲染天气 API 配置
    renderWeatherApi();
}

// 渲染天气 API 配置
function renderWeatherApi() {
    const weather = configData.apis.weather || { url: 'https://uapis.cn/api/v1/misc/weather', enabled: true, city: '' };
    document.getElementById('weather-url').value = weather.url || 'https://uapis.cn/api/v1/misc/weather';
    document.getElementById('weather-city').value = weather.city || '';
    document.getElementById('weather-enabled').checked = weather.enabled !== false;
}

// 保存失败时从服务器重新拉取配置，回滚本地变异，保持 UI 与服务器一致
async function resyncConfig() {
    try { await loadConfig(); } catch (e) { /* 忽略 */ }
}

async function toggleApi(index) {
    if (!configData?.apis?.anime?.[index]) return;
    configData.apis.anime[index].enabled = !configData.apis.anime[index].enabled;

    try {
        const { data: result } = await authFetch(`${API_BASE}/api/config/apis`, {
            method: 'POST',
            body: JSON.stringify({ anime: configData.apis.anime })
        });
        if (result.success) {
            showToast('API 状态已更新');
            await loadConfig();
        } else {
            showToast(result.message || '操作失败', 'error');
            await resyncConfig();
        }
    } catch (err) {
        showToast('操作失败', 'error');
        await resyncConfig();
    }
}

// ========== API 管理（添加/删除）==========
function openApiModal() {
    document.getElementById('api-modal').classList.add('show');
}

function closeApiModal() {
    document.getElementById('api-modal').classList.remove('show');
    document.getElementById('api-form').reset();
}

document.getElementById('api-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!configData) return;
    const formData = new FormData(e.target);
    const newApi = {
        name: formData.get('name'),
        url: formData.get('url'),
        priority: parseInt(formData.get('priority')),
        enabled: true
    };

    configData.apis.anime.push(newApi);

    try {
        const { data: result } = await authFetch(`${API_BASE}/api/config/apis`, {
            method: 'POST',
            body: JSON.stringify({ anime: configData.apis.anime })
        });
        if (result.success) {
            showToast('API 已添加');
            closeApiModal();
            await loadConfig();
        } else {
            showToast(result.message || '添加失败', 'error');
            await resyncConfig();
        }
    } catch (err) {
        showToast('添加失败', 'error');
        await resyncConfig();
    }
});

async function deleteApi(index) {
    if (!confirm('确定删除这个 API？')) return;
    if (!configData?.apis?.anime) return;

    configData.apis.anime.splice(index, 1);

    try {
        const { data: result } = await authFetch(`${API_BASE}/api/config/apis`, {
            method: 'POST',
            body: JSON.stringify({ anime: configData.apis.anime })
        });
        if (result.success) {
            showToast('API 已删除');
            await loadConfig();
        } else {
            showToast(result.message || '删除失败', 'error');
            await resyncConfig();
        }
    } catch (err) {
        showToast('删除失败', 'error');
        await resyncConfig();
    }
}

// ========== 随机一言（多句列表，刷新随机取一句） ==========
let hitokotoSentences = [];
let hitokotoEditIndex = -1;

function renderHitokotoList() {
    const listEl = document.getElementById('hitokoto-list');
    if (!listEl) return;

    if (hitokotoSentences.length === 0) {
        listEl.innerHTML = '<div style="text-align:center;color:var(--text-sub);padding:16px;">暂无句子，添加几句吧</div>';
        return;
    }

    listEl.innerHTML = hitokotoSentences.map((sentence, index) => `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;background:#f8fafc;border-radius:8px;font-size:0.9rem;">
            <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(sentence)}">${escapeHtml(sentence)}</span>
            <div style="flex-shrink:0;display:flex;gap:8px;">
                <button class="btn btn-sm" onclick="editHitokotoSentence(${index})" style="background:#e0e7ff;color:var(--primary-blue);">编辑</button>
                <button class="btn btn-sm btn-danger" onclick="removeHitokotoSentence(${index})">删除</button>
            </div>
        </div>
    `).join('');
}

function editHitokotoSentence(index) {
    const input = document.getElementById('hitokoto-input');
    if (!input) return;
    hitokotoEditIndex = index;
    input.value = hitokotoSentences[index] || '';
    input.focus();
    const btn = document.getElementById('hitokoto-add-btn');
    if (btn) btn.textContent = '更新';
    showToast('编辑中：修改后点击「更新」', 'success');
}

function addHitokotoSentence() {
    const input = document.getElementById('hitokoto-input');
    const text = input.value.trim();

    // 编辑模式
    if (hitokotoEditIndex >= 0) {
        if (!text) {
            // 清空输入框 = 取消编辑
            hitokotoEditIndex = -1;
            const btn = document.getElementById('hitokoto-add-btn');
            if (btn) btn.textContent = '添加';
            return;
        }
        hitokotoSentences[hitokotoEditIndex] = text;
        hitokotoEditIndex = -1;
        const btn = document.getElementById('hitokoto-add-btn');
        if (btn) btn.textContent = '添加';
        input.value = '';
        renderHitokotoList();
        showToast('句子已更新', 'success');
        return;
    }

    // 新增模式
    if (!text) {
        showToast('请输入句子内容', 'error');
        return;
    }
    hitokotoSentences.push(text);
    input.value = '';
    renderHitokotoList();
}

function removeHitokotoSentence(index) {
    hitokotoSentences.splice(index, 1);
    if (hitokotoEditIndex === index) hitokotoEditIndex = -1;
    renderHitokotoList();
}

if (document.getElementById('hitokoto-save')) {
    document.getElementById('hitokoto-save').addEventListener('click', async () => {
        const list = hitokotoSentences.filter(s => s && String(s).trim());
        try {
            const { data: result } = await authFetch(`${API_BASE}/api/config/site`, {
                method: 'POST',
                body: JSON.stringify({ hitokotoList: list })
            });
            if (result.success) {
                showToast('随机一言已保存');
                await loadConfig();
            } else {
                showToast(result.message || '保存失败', 'error');
            }
        } catch (err) {
            showToast('保存失败', 'error');
        }
    });

    document.getElementById('hitokoto-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addHitokotoSentence();
        }
    });
}

// ========== 标签管理 ==========
function renderTags() {
    if (!configData) return;

    const list = document.getElementById('tag-list');
    list.innerHTML = (configData.tags || []).map((tag, index) => `
        <div class="tag-item">
            <span>${escapeHtml(tag.icon)}</span>
            <span>${escapeHtml(tag.name)}</span>
            <span class="remove" onclick="removeTag(${index})">x</span>
        </div>
    `).join('');
}

async function addTag() {
    if (!configData) return;
    const icon = document.getElementById('tag-icon').value.trim();
    const name = document.getElementById('tag-name').value.trim();

    if (!icon || !name) {
        showToast('请填写完整信息', 'error');
        return;
    }

    if (!Array.isArray(configData.tags)) configData.tags = [];
    configData.tags.push({ icon, name });

    try {
        const { data: result } = await authFetch(`${API_BASE}/api/config/tags`, {
            method: 'POST',
            body: JSON.stringify({ tags: configData.tags })
        });
        if (result.success) {
            showToast('标签已添加');
            document.getElementById('tag-icon').value = '';
            document.getElementById('tag-name').value = '';
            await loadConfig();
        } else {
            showToast(result.message || '添加失败', 'error');
            await resyncConfig();
        }
    } catch (err) {
        showToast('添加失败', 'error');
        await resyncConfig();
    }
}

async function removeTag(index) {
    if (!confirm('确定删除这个标签？')) return;
    if (!configData?.tags) return;

    configData.tags.splice(index, 1);

    try {
        const { data: result } = await authFetch(`${API_BASE}/api/config/tags`, {
            method: 'POST',
            body: JSON.stringify({ tags: configData.tags })
        });
        if (result.success) {
            showToast('标签已删除');
            await loadConfig();
        } else {
            showToast(result.message || '删除失败', 'error');
            await resyncConfig();
        }
    } catch (err) {
        showToast('删除失败', 'error');
        await resyncConfig();
    }
}

// ========== 外链管理 ==========
function renderLinks() {
    if (!configData) return;

    const grid = document.getElementById('link-grid');
    grid.innerHTML = (configData.links || []).map((link, index) => {
        const color = sanitizeColor(link.color);
        const icon = sanitizeUrl(link.icon);
        return `
        <div class="link-card">
            <div class="link-icon" style="background: ${color}15;">
                ${icon ? `<img src="${escapeHtml(icon)}" alt="">` : `<span style="color: ${color};">●</span>`}
            </div>
            <div class="link-name" style="font-weight: 600; font-size: 0.9rem; color: var(--text-main);">${escapeHtml(link.name)}</div>
            <div class="link-actions" style="display: flex; gap: 8px; margin-top: 4px;">
                <button class="link-btn edit" onclick="editLink(${index})">E</button>
                <button class="link-btn delete" onclick="deleteLink(${index})">D</button>
            </div>
        </div>
    `;
    }).join('');
}

function openLinkModal(index = null) {
    const modal = document.getElementById('link-modal');
    const form = document.getElementById('link-form');
    
    if (index !== null) {
        const link = configData.links[index];
        form.elements.name.value = link.name;
        form.elements.url.value = link.url;
        form.elements.icon.value = link.icon;
        form.elements.color.value = link.color;
        document.getElementById('link-index').value = index;
    } else {
        form.reset();
        document.getElementById('link-index').value = '';
    }
    
    modal.classList.add('show');
}

function closeLinkModal() {
    document.getElementById('link-modal').classList.remove('show');
}

function editLink(index) {
    openLinkModal(index);
}

async function deleteLink(index) {
    if (!confirm('确定删除这个链接？')) return;
    if (!configData?.links) return;

    configData.links.splice(index, 1);
    await saveLinks();
}

async function saveLinks() {
    try {
        const { data: result } = await authFetch(`${API_BASE}/api/config/links`, {
            method: 'POST',
            body: JSON.stringify({ links: configData.links })
        });
        if (result.success) {
            showToast('链接已保存');
            await loadConfig();
        } else {
            showToast(result.message || '保存失败', 'error');
            await resyncConfig();
        }
    } catch (err) {
        showToast('保存失败', 'error');
        await resyncConfig();
    }
}

// ========== 动态管理 ==========
function renderActivities() {
    if (!configData) return;

    const tbody = document.getElementById('activity-table-body');
    if (!tbody) return;

    const activities = configData.activities || [];

    if (activities.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-sub);">暂无动态</td></tr>';
        return;
    }

    tbody.innerHTML = activities.map(activity => `
        <tr>
            <td>${escapeHtml(activity.text)}</td>
            <td>${escapeHtml(activity.time)}</td>
            <td>
                <button class="btn btn-sm" onclick="editActivity(${activity.id})" style="background: #e0e7ff; color: var(--primary-blue); margin-right: 8px;">编辑</button>
                <button class="btn btn-sm btn-danger" onclick="deleteActivity(${activity.id})">删除</button>
            </td>
        </tr>
    `).join('');
}

function openActivityModal(id = null) {
    const modal = document.getElementById('activity-modal');
    const form = document.getElementById('activity-form');

    if (id !== null) {
        const activity = (configData.activities || []).find(a => String(a.id) === String(id));
        if (activity) {
            form.elements.id.value = activity.id;
            form.elements.text.value = activity.text;
            form.elements.time.value = activity.time;
        } else {
            console.error('找不到动态:', id);
            showToast('找不到该动态', 'error');
            return;
        }
    } else {
        form.reset();
        form.elements.id.value = '';
    }

    modal.classList.add('show');
}

function closeActivityModal() {
    document.getElementById('activity-modal').classList.remove('show');
}

function editActivity(id) {
    openActivityModal(id);
}

async function deleteActivity(id) {
    if (!confirm('确定删除这条动态？')) return;

    console.log('正在删除动态，ID:', id);

    try {
        const { data: result } = await authFetch(`${API_BASE}/api/activities/${id}`, {
            method: 'DELETE'
        });
        console.log('删除动态响应:', result);

        if (result.success) {
            showToast('动态已删除');
            await loadConfig();
        } else {
            showToast(result.message || '删除失败', 'error');
        }
    } catch (err) {
        console.error('删除动态失败:', err);
        showToast('删除失败: ' + err.message, 'error');
    }
}

// ========== 工具函数 ==========
let toastTimer = null;
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.remove('show');
        toastTimer = null;
    }, 3000);
}
