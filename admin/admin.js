// API 基础地址
const API_BASE = window.location.origin;

// 全局配置数据
let configData = null;

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

    const data = await res.json();

    // 检查是否需要重新登录
    if (data.needLogin || res.status === 401) {
        clearToken();
        showLoginPage();
        showToast('登录已过期，请重新登录', 'error');
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
                initNavigation();
                initForms();
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
    document.getElementById('password-modal').classList.add('show');
    document.getElementById('password-form').reset();
}

// 关闭修改密码弹窗
function closePasswordModal() {
    document.getElementById('password-modal').classList.remove('show');
}

// 加载配置
async function loadConfig() {
    try {
        const res = await fetch(`${API_BASE}/api/config`);
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        const data = await res.json();
        if (data.success) {
            configData = data.data;
            renderAll();
        } else {
            throw new Error(data.message || '返回数据格式错误');
        }
    } catch (err) {
        console.error('加载配置失败:', err);
        showToast(`加载配置失败: ${err.message}`, 'error');
        
        // 显示错误信息在页面上
        document.querySelector('.main-content').innerHTML = `
            <div class="card" style="text-align: center; padding: 60px;">
                <h2 style="color: #ef4444; margin-bottom: 16px;">无法连接到后端服务器</h2>
                <p style="color: var(--text-sub); margin-bottom: 24px;">
                    请确保后端服务器已启动<br>
                    在 backend 目录运行: <code style="background: #f1f5f9; padding: 4px 8px; border-radius: 4px;">npm start</code>
                </p>
                <p style="font-size: 0.85rem; color: #999;">
                    错误详情: ${err.message}
                </p>
            </div>
        `;
    }
}

// 渲染所有内容
function renderAll() {
    renderDashboard();
    renderSiteForm();
    renderApis();
    renderHitokotoApis();
    renderTags();
    renderLinks();
    renderSchedule();
    renderActivities();
}

// ========== 导航切换 ==========
function initNavigation() {
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
                    <div class="stat-value">${configData.apis.anime.length}</div>
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
                    <div class="stat-value">${configData.tags.length}</div>
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
                    <div class="stat-value">${configData.links.length}</div>
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
                    <span class="config-info-value">${configData.site.nickname}</span>
                </div>
                <div class="config-info-item">
                    <span class="config-info-label">问候语</span>
                    <span class="config-info-value">动态显示</span>
                </div>
                <div class="config-info-item">
                    <span class="config-info-label">QQ</span>
                    <span class="config-info-value">${configData.site.qq}</span>
                </div>
                <div class="config-info-item">
                    <span class="config-info-label">网站标题</span>
                    <span class="config-info-value">${configData.site.title}</span>
                </div>
            </div>
        </div>
    `;
}

// ========== 网站信息 ==========
function renderSiteForm() {
    if (!configData) return;
    const form = document.getElementById('site-form');
    if (!form) return;

    // 设置所有字段
    if (form.elements.title) form.elements.title.value = configData.site.title || '';
    if (form.elements.nickname) form.elements.nickname.value = configData.site.nickname || '';
    if (form.elements.qq) form.elements.qq.value = configData.site.qq || '';
    if (form.elements.customAvatar) form.elements.customAvatar.value = configData.site.customAvatar || '';
    if (form.elements.favicon) form.elements.favicon.value = configData.site.favicon || '';
    if (form.elements.signature) form.elements.signature.value = configData.site.signature || '';
    if (form.elements.bio) form.elements.bio.value = configData.site.bio || '';
}

function initForms() {
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
        const formData = new FormData(e.target);
        const link = Object.fromEntries(formData);
        const index = document.getElementById('link-index').value;
        
        if (index !== '') {
            configData.links[parseInt(index)] = link;
        } else {
            configData.links.push(link);
        }
        
        await saveLinks();
        closeLinkModal();
    });
    
    // 课程表单
    document.getElementById('course-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const course = Object.fromEntries(formData);
        course.day = parseInt(course.day);
        course.color = course.color || '#3b82f6';

        // 删除空的 id 字段，避免覆盖后端生成的 ID
        if (!course.id) delete course.id;

        const id = document.getElementById('course-id').value;

        try {
            let result;
            if (id) {
                const { data } = await authFetch(`${API_BASE}/api/schedule/courses/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify(course)
                });
                result = data;
            } else {
                const { data } = await authFetch(`${API_BASE}/api/schedule/courses`, {
                    method: 'POST',
                    body: JSON.stringify(course)
                });
                result = data;
            }
            if (result.success) {
                showToast(id ? '课程已更新' : '课程已添加');
                closeCourseModal();
                await loadConfig();
            } else {
                showToast(result.message, 'error');
            }
        } catch (err) {
            showToast('操作失败', 'error');
        }
    });

    // 日程表单
    document.getElementById('event-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const event = Object.fromEntries(formData);
        event.day = parseInt(event.day);
        event.color = event.color || '#22c55e';

        // 删除空的 id 字段，避免覆盖后端生成的 ID
        if (!event.id) delete event.id;

        const id = document.getElementById('event-id').value;

        try {
            let result;
            if (id) {
                const { data } = await authFetch(`${API_BASE}/api/schedule/events/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify(event)
                });
                result = data;
            } else {
                const { data } = await authFetch(`${API_BASE}/api/schedule/events`, {
                    method: 'POST',
                    body: JSON.stringify(event)
                });
                result = data;
            }
            if (result.success) {
                showToast(id ? '日程已更新' : '日程已添加');
                closeEventModal();
                await loadConfig();
            } else {
                showToast(result.message, 'error');
            }
        } catch (err) {
            showToast('操作失败', 'error');
        }
    });

    // 动态表单
    document.getElementById('activity-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const activity = Object.fromEntries(formData);

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
}

// ========== API 管理 ==========
function renderApis() {
    if (!configData || !configData.apis || !configData.apis.anime) return;
    
    const tbody = document.getElementById('api-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = configData.apis.anime.map((api, index) => `
        <tr>
            <td>${api.name}</td>
            <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis;">${api.url}</td>
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
    
    const qqConfig = document.getElementById('qq-api-config');
    qqConfig.innerHTML = `
        <div class="form-row">
            <div class="form-group">
                <label class="form-label">API 地址</label>
                <input type="text" class="form-input" value="${configData.apis.qqInfo.url}" readonly>
            </div>
            <div class="form-group">
                <label class="form-label">状态</label>
                <div style="padding: 12px; background: ${configData.apis.qqInfo.enabled ? '#dcfce7' : '#fee2e2'}; border-radius: 8px; color: ${configData.apis.qqInfo.enabled ? '#166534' : '#991b1b'};">
                    ${configData.apis.qqInfo.enabled ? '[已启用]' : '[已禁用]'}
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

async function toggleApi(index) {
    configData.apis.anime[index].enabled = !configData.apis.anime[index].enabled;

    try {
        const { data: result } = await authFetch(`${API_BASE}/api/config/apis`, {
            method: 'POST',
            body: JSON.stringify({ anime: configData.apis.anime })
        });
        if (result.success) {
            showToast('API 状态已更新');
            await loadConfig();
        }
    } catch (err) {
        showToast('操作失败', 'error');
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
        }
    } catch (err) {
        showToast('添加失败', 'error');
    }
});

async function deleteApi(index) {
    if (!confirm('确定删除这个 API？')) return;

    configData.apis.anime.splice(index, 1);

    try {
        const { data: result } = await authFetch(`${API_BASE}/api/config/apis`, {
            method: 'POST',
            body: JSON.stringify({ anime: configData.apis.anime })
        });
        if (result.success) {
            showToast('API 已删除');
            await loadConfig();
        }
    } catch (err) {
        showToast('删除失败', 'error');
    }
}

// ========== 每日一言 API 管理 ==========
function renderHitokotoApis() {
    if (!configData || !configData.apis || !configData.apis.hitokoto) return;
    
    const tbody = document.getElementById('hitokoto-api-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = configData.apis.hitokoto.map((api, index) => `
        <tr>
            <td>${api.name}</td>
            <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis;">${api.url}</td>
            <td>${api.priority}</td>
            <td>
                <span style="padding: 4px 12px; border-radius: 100px; font-size: 0.8rem; ${api.enabled ? 'background: #dcfce7; color: #166534;' : 'background: #fee2e2; color: #991b1b;'}">
                    ${api.enabled ? '启用' : '禁用'}
                </span>
            </td>
            <td>
                <button class="btn btn-sm ${api.enabled ? 'btn-danger' : 'btn-success'}" onclick="toggleHitokotoApi(${index})" style="margin-right: 8px;">
                    ${api.enabled ? '禁用' : '启用'}
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteHitokotoApi(${index})">删除</button>
            </td>
        </tr>
    `).join('');
}

function openHitokotoApiModal() {
    document.getElementById('hitokoto-api-modal').classList.add('show');
}

function closeHitokotoApiModal() {
    document.getElementById('hitokoto-api-modal').classList.remove('show');
    document.getElementById('hitokoto-api-form').reset();
}

if (document.getElementById('hitokoto-api-form')) {
    document.getElementById('hitokoto-api-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const newApi = {
            name: formData.get('name'),
            url: formData.get('url'),
            priority: parseInt(formData.get('priority')),
            enabled: true
        };

        if (!configData.apis.hitokoto) {
            configData.apis.hitokoto = [];
        }
        configData.apis.hitokoto.push(newApi);

        try {
            const { data: result } = await authFetch(`${API_BASE}/api/config/apis`, {
                method: 'POST',
                body: JSON.stringify({ hitokoto: configData.apis.hitokoto })
            });
            if (result.success) {
                showToast('API 已添加');
                closeHitokotoApiModal();
                await loadConfig();
            }
        } catch (err) {
            showToast('添加失败', 'error');
        }
    });
}

async function toggleHitokotoApi(index) {
    configData.apis.hitokoto[index].enabled = !configData.apis.hitokoto[index].enabled;

    try {
        const { data: result } = await authFetch(`${API_BASE}/api/config/apis`, {
            method: 'POST',
            body: JSON.stringify({ hitokoto: configData.apis.hitokoto })
        });
        if (result.success) {
            showToast('API 状态已更新');
            await loadConfig();
        }
    } catch (err) {
        showToast('操作失败', 'error');
    }
}

async function deleteHitokotoApi(index) {
    if (!confirm('确定删除这个 API？')) return;

    configData.apis.hitokoto.splice(index, 1);

    try {
        const { data: result } = await authFetch(`${API_BASE}/api/config/apis`, {
            method: 'POST',
            body: JSON.stringify({ hitokoto: configData.apis.hitokoto })
        });
        if (result.success) {
            showToast('API 已删除');
            await loadConfig();
        }
    } catch (err) {
        showToast('删除失败', 'error');
    }
}

// ========== 标签管理 ==========
function renderTags() {
    if (!configData) return;

    const list = document.getElementById('tag-list');
    list.innerHTML = configData.tags.map((tag, index) => `
        <div class="tag-item">
            <span>${tag.icon}</span>
            <span>${tag.name}</span>
            <span class="remove" onclick="removeTag(${index})">x</span>
        </div>
    `).join('');
}

async function addTag() {
    const icon = document.getElementById('tag-icon').value.trim();
    const name = document.getElementById('tag-name').value.trim();

    if (!icon || !name) {
        showToast('请填写完整信息', 'error');
        return;
    }

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
        }
    } catch (err) {
        showToast('添加失败', 'error');
    }
}

async function removeTag(index) {
    if (!confirm('确定删除这个标签？')) return;

    configData.tags.splice(index, 1);

    try {
        const { data: result } = await authFetch(`${API_BASE}/api/config/tags`, {
            method: 'POST',
            body: JSON.stringify({ tags: configData.tags })
        });
        if (result.success) {
            showToast('标签已删除');
            await loadConfig();
        }
    } catch (err) {
        showToast('删除失败', 'error');
    }
}

// ========== 外链管理 ==========
function renderLinks() {
    if (!configData) return;
    
    const grid = document.getElementById('link-grid');
    grid.innerHTML = configData.links.map((link, index) => `
        <div class="link-card">
            <div class="link-icon" style="background: ${link.color}15;">
                ${link.icon ? `<img src="${link.icon}" alt="">` : '<span style="color: ${link.color};">●</span>'}
            </div>
            <div class="link-name" style="font-weight: 600; font-size: 0.9rem; color: var(--text-main);">${link.name}</div>
            <div class="link-actions" style="display: flex; gap: 8px; margin-top: 4px;">
                <button class="link-btn edit" onclick="editLink(${index})">E</button>
                <button class="link-btn delete" onclick="deleteLink(${index})">D</button>
            </div>
        </div>
    `).join('');
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
        }
    } catch (err) {
        showToast('保存失败', 'error');
    }
}

// ========== 日程管理 ==========
function renderSchedule() {
    if (!configData) return;
    
    // 渲染课程表
    const courseBody = document.getElementById('course-table-body');
    courseBody.innerHTML = configData.schedule.courses.map(course => `
        <tr>
            <td><strong>${course.name}</strong></td>
            <td>周${['一', '二', '三', '四', '五', '六', '日'][course.day - 1]}</td>
            <td>${course.startTime} - ${course.endTime}</td>
            <td>${course.location || '-'}</td>
            <td>
                <button class="btn btn-sm" onclick="editCourse(${course.id})" style="background: #e0e7ff; color: var(--primary-blue); margin-right: 8px;">编辑</button>
                <button class="btn btn-sm btn-danger" onclick="deleteCourse(${course.id})">删除</button>
            </td>
        </tr>
    `).join('');
    
    // 渲染日程安排
    const eventBody = document.getElementById('event-table-body');
    const typeMap = { hobby: '兴趣爱好', project: '项目开发', study: '学习', other: '其他' };
    eventBody.innerHTML = configData.schedule.events.map(event => `
        <tr>
            <td><strong>${event.name}</strong></td>
            <td>周${['一', '二', '三', '四', '五', '六', '日'][event.day - 1]}</td>
            <td>${event.startTime} - ${event.endTime}</td>
            <td>${typeMap[event.type] || '其他'}</td>
            <td>
                <button class="btn btn-sm" onclick="editEvent(${event.id})" style="background: #e0e7ff; color: var(--primary-blue); margin-right: 8px;">编辑</button>
                <button class="btn btn-sm btn-danger" onclick="deleteEvent(${event.id})">删除</button>
            </td>
        </tr>
    `).join('');
}

function openCourseModal(id = null) {
    const modal = document.getElementById('course-modal');
    const form = document.getElementById('course-form');
    
    if (id !== null) {
        const course = configData.schedule.courses.find(c => String(c.id) === String(id));
        if (!course) {
            console.error('找不到课程:', id);
            showToast('找不到该课程', 'error');
            return;
        }
        form.elements.id.value = course.id;
        form.elements.name.value = course.name;
        form.elements.day.value = course.day;
        form.elements.location.value = course.location || '';
        form.elements.startTime.value = course.startTime;
        form.elements.endTime.value = course.endTime;
        form.elements.color.value = course.color || '#3b82f6';
    } else {
        form.reset();
        form.elements.id.value = '';
        form.elements.color.value = '#3b82f6';
    }
    
    modal.classList.add('show');
}

function closeCourseModal() {
    document.getElementById('course-modal').classList.remove('show');
}

function editCourse(id) {
    openCourseModal(id);
}

async function deleteCourse(id) {
    if (!confirm('确定删除这门课程？')) return;

    console.log('正在删除课程，ID:', id);

    try {
        const { data: result } = await authFetch(`${API_BASE}/api/schedule/courses/${id}`, {
            method: 'DELETE'
        });
        console.log('删除课程响应:', result);

        if (result.success) {
            showToast('课程已删除');
            // 立即从本地数据中移除
            configData.schedule.courses = configData.schedule.courses.filter(c => String(c.id) !== String(id));
            renderSchedule();
        } else {
            showToast(result.message || '删除失败', 'error');
        }
    } catch (err) {
        console.error('删除课程失败:', err);
        showToast('删除失败: ' + err.message, 'error');
    }
}

function openEventModal(id = null) {
    const modal = document.getElementById('event-modal');
    const form = document.getElementById('event-form');
    
    if (id !== null) {
        const event = configData.schedule.events.find(e => String(e.id) === String(id));
        if (!event) {
            console.error('找不到日程:', id);
            showToast('找不到该日程', 'error');
            return;
        }
        form.elements.id.value = event.id;
        form.elements.name.value = event.name;
        form.elements.day.value = event.day;
        form.elements.type.value = event.type;
        form.elements.startTime.value = event.startTime;
        form.elements.endTime.value = event.endTime;
        form.elements.color.value = event.color || '#22c55e';
    } else {
        form.reset();
        form.elements.id.value = '';
        form.elements.color.value = '#22c55e';
    }
    
    modal.classList.add('show');
}

function closeEventModal() {
    document.getElementById('event-modal').classList.remove('show');
}

function editEvent(id) {
    openEventModal(id);
}

async function deleteEvent(id) {
    if (!confirm('确定删除这个日程？')) return;

    console.log('正在删除日程，ID:', id);

    try {
        const { data: result } = await authFetch(`${API_BASE}/api/schedule/events/${id}`, {
            method: 'DELETE'
        });
        console.log('删除日程响应:', result);

        if (result.success) {
            showToast('日程已删除');
            // 立即从本地数据中移除
            configData.schedule.events = configData.schedule.events.filter(e => String(e.id) !== String(id));
            renderSchedule();
        } else {
            showToast(result.message || '删除失败', 'error');
        }
    } catch (err) {
        console.error('删除日程失败:', err);
        showToast('删除失败: ' + err.message, 'error');
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
            <td>${activity.text}</td>
            <td>${activity.time}</td>
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
        const activity = configData.activities.find(a => String(a.id) === String(id));
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
            // 立即从本地数据中移除
            configData.activities = configData.activities.filter(a => String(a.id) !== String(id));
            renderActivities();
        } else {
            showToast(result.message || '删除失败', 'error');
        }
    } catch (err) {
        console.error('删除动态失败:', err);
        showToast('删除失败: ' + err.message, 'error');
    }
}

// ========== 工具函数 ==========
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
