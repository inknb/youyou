// API 基础地址
const API_BASE = window.location.origin;

// 全局配置数据
let configData = null;

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    await loadConfig();
    initNavigation();
    initForms();
});

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
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
            <div style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 24px; border-radius: 16px;">
                <div style="font-size: 2rem; font-weight: 700;">${configData.apis.anime.length}</div>
                <div style="opacity: 0.9;">图片 API 数量</div>
            </div>
            <div style="background: linear-gradient(135deg, #22c55e, #16a34a); color: white; padding: 24px; border-radius: 16px;">
                <div style="font-size: 2rem; font-weight: 700;">${configData.tags.length}</div>
                <div style="opacity: 0.9;">个人标签</div>
            </div>
            <div style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 24px; border-radius: 16px;">
                <div style="font-size: 2rem; font-weight: 700;">${configData.links.length}</div>
                <div style="opacity: 0.9;">外链数量</div>
            </div>
            <div style="background: linear-gradient(135deg, #ec4899, #db2777); color: white; padding: 24px; border-radius: 16px;">
                <div style="font-size: 2rem; font-weight: 700;">${(configData.activities || []).length}</div>
                <div style="opacity: 0.9;">动态总数</div>
            </div>
        </div>
        <div style="margin-top: 24px; padding: 20px; background: #f8fafc; border-radius: 12px;">
            <h4 style="margin-bottom: 12px;">当前配置</h4>
            <p><strong>昵称：</strong>${configData.site.nickname}</p>
            <p><strong>问候语：</strong>动态显示</p>
            <p><strong>QQ：</strong>${configData.site.qq}</p>
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
    if (form.elements.signature) form.elements.signature.value = configData.site.signature || '';
    if (form.elements.bio) form.elements.bio.value = configData.site.bio || '';
}

function initForms() {
    // 网站信息表单
    document.getElementById('site-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);

        try {
            const res = await fetch(`${API_BASE}/api/config/site`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
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
            url: formData.get('url') || 'https://api.vvhan.com/api/weather',
            city: formData.get('city') || '',
            enabled: formData.get('enabled') === 'on'
        };

        try {
            const res = await fetch(`${API_BASE}/api/config/apis`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ weather: weatherConfig })
            });
            const result = await res.json();
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
            let res;
            if (id) {
                res = await fetch(`${API_BASE}/api/schedule/courses/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(course)
                });
            } else {
                res = await fetch(`${API_BASE}/api/schedule/courses`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(course)
                });
            }
            const result = await res.json();
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
            let res;
            if (id) {
                res = await fetch(`${API_BASE}/api/schedule/events/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(event)
                });
            } else {
                res = await fetch(`${API_BASE}/api/schedule/events`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(event)
                });
            }
            const result = await res.json();
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
            let res;
            if (id) {
                res = await fetch(`${API_BASE}/api/activities/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(activity)
                });
            } else {
                res = await fetch(`${API_BASE}/api/activities`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(activity)
                });
            }
            const result = await res.json();
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
    const weather = configData.apis.weather || { url: 'https://wttr.in', enabled: true, city: '' };
    document.getElementById('weather-url').value = weather.url || 'https://wttr.in';
    document.getElementById('weather-city').value = weather.city || '';
    document.getElementById('weather-enabled').checked = weather.enabled !== false;
}

async function toggleApi(index) {
    configData.apis.anime[index].enabled = !configData.apis.anime[index].enabled;
    
    try {
        const res = await fetch(`${API_BASE}/api/config/apis`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ anime: configData.apis.anime })
        });
        const result = await res.json();
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
        const res = await fetch(`${API_BASE}/api/config/apis`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ anime: configData.apis.anime })
        });
        const result = await res.json();
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
        const res = await fetch(`${API_BASE}/api/config/apis`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ anime: configData.apis.anime })
        });
        const result = await res.json();
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
            const res = await fetch(`${API_BASE}/api/config/apis`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hitokoto: configData.apis.hitokoto })
            });
            const result = await res.json();
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
        const res = await fetch(`${API_BASE}/api/config/apis`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hitokoto: configData.apis.hitokoto })
        });
        const result = await res.json();
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
        const res = await fetch(`${API_BASE}/api/config/apis`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hitokoto: configData.apis.hitokoto })
        });
        const result = await res.json();
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
        const res = await fetch(`${API_BASE}/api/config/tags`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tags: configData.tags })
        });
        const result = await res.json();
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
        const res = await fetch(`${API_BASE}/api/config/tags`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tags: configData.tags })
        });
        const result = await res.json();
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
        const res = await fetch(`${API_BASE}/api/config/links`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ links: configData.links })
        });
        const result = await res.json();
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
        const res = await fetch(`${API_BASE}/api/schedule/courses/${id}`, {
            method: 'DELETE'
        });
        const result = await res.json();
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
        const res = await fetch(`${API_BASE}/api/schedule/events/${id}`, {
            method: 'DELETE'
        });
        const result = await res.json();
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
        const res = await fetch(`${API_BASE}/api/activities/${id}`, {
            method: 'DELETE'
        });
        const result = await res.json();
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
