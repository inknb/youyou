/**
 * 悠悠个人主页 - 安装向导前端逻辑
 */

// API 基础路径
const API_BASE = '/api/install';

// 当前步骤
let currentStep = 1;

// 存储模式：'json' 或 'mysql'
let storageMode = 'json';

// 环境检测结果缓存
let envCheckResult = null;

// 数据库连接测试结果
let dbTestResult = false;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    // 检查安装锁定状态
    checkInstallLock();
});

/**
 * 检查安装锁定状态
 */
async function checkInstallLock() {
    try {
        const response = await fetch(`${API_BASE}/status`);
        const data = await response.json();

        if (data.success && data.data.locked) {
            // 已安装，显示锁定提示
            document.getElementById('lock-notice').style.display = 'block';
            document.querySelector('.step-indicator').style.display = 'none';
            // 隐藏所有步骤面板
            document.querySelectorAll('.step-panel').forEach(panel => {
                panel.style.display = 'none';
            });
        } else {
            // 未安装，开始第一步
            // 默认选中 JSON 模式
            selectMode('json');
        }
    } catch (error) {
        console.error('检查安装状态失败:', error);
        showToast('无法连接到服务器，请检查服务是否正常运行', 'error');
    }
}

/**
 * 选择存储模式
 */
function selectMode(mode) {
    storageMode = mode;

    // 更新选中状态
    document.querySelectorAll('.mode-card').forEach(card => {
        card.classList.remove('selected');
    });
    document.querySelector(`.mode-card[data-mode="${mode}"]`).classList.add('selected');

    // 更新配置描述
    const configDesc = document.getElementById('config-desc');
    if (mode === 'mysql') {
        configDesc.textContent = '请设置管理员账号信息并配置数据库连接';
    } else {
        configDesc.textContent = '请设置管理员账号信息';
    }
}

/**
 * 环境检测
 */
async function checkEnvironment() {
    const checkList = document.getElementById('env-check-list');
    checkList.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-sub);">正在检测环境...</div>';

    try {
        const response = await fetch(`${API_BASE}/check-env`);
        const data = await response.json();

        if (data.success) {
            envCheckResult = data.data;
            renderEnvCheckList(data.data);
        } else {
            checkList.innerHTML = `<div class="test-result error show">${data.message || '环境检测失败'}</div>`;
        }
    } catch (error) {
        console.error('环境检测失败:', error);
        checkList.innerHTML = `<div class="test-result error show">环境检测请求失败: ${error.message}</div>`;
    }
}

/**
 * 渲染环境检测结果
 */
function renderEnvCheckList(data) {
    const checkList = document.getElementById('env-check-list');
    const items = [];

    // Node.js 版本
    items.push(createEnvCheckItem(
        'Node.js 版本',
        data.nodeVersion || '未知',
        data.nodeVersionValid ? 'success' : 'error',
        data.nodeVersionValid ? '满足要求' : '需要 Node.js 14.x 或更高版本'
    ));

    // npm 版本
    items.push(createEnvCheckItem(
        'npm 版本',
        data.npmVersion || '未知',
        'success',
        '已安装'
    ));

    // 如果是 MySQL 模式，检查 MySQL 驱动
    if (storageMode === 'mysql') {
        items.push(createEnvCheckItem(
            'MySQL 驱动',
            data.mysqlDriver || 'mysql2',
            data.mysqlDriverInstalled ? 'success' : 'error',
            data.mysqlDriverInstalled ? '已安装' : '未安装'
        ));
    }

    // 数据目录权限
    items.push(createEnvCheckItem(
        '数据目录',
        'backend/data/',
        data.dataDirWritable ? 'success' : 'error',
        data.dataDirWritable ? '可写' : '不可写'
    ));

    checkList.innerHTML = items.join('');

    // 检查是否可以继续
    let canContinue = data.nodeVersionValid && data.dataDirWritable;

    // MySQL 模式需要检查驱动
    if (storageMode === 'mysql') {
        canContinue = canContinue && data.mysqlDriverInstalled;
    }

    document.getElementById('btn-step-2').disabled = !canContinue;

    if (!canContinue) {
        showToast('存在环境问题，请先解决后再继续安装', 'error');
    }
}

/**
 * 创建环境检测项
 */
function createEnvCheckItem(name, value, status, statusText) {
    const icons = {
        success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>',
        error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
        warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>'
    };

    return `
        <div class="env-check-item ${status}">
            <div class="env-check-label">
                <span class="env-check-name">${name}</span>
                <span class="env-check-value">${value}</span>
            </div>
            <div class="env-status ${status}">
                ${icons[status]}
                <span>${statusText}</span>
            </div>
        </div>
    `;
}

/**
 * 测试数据库连接
 */
async function testDbConnection() {
    const formData = getDbFormData();
    const resultDiv = document.getElementById('db-test-result');

    // 验证必填字段
    if (!formData.host || !formData.database || !formData.user) {
        showToast('请填写完整的数据库连接信息', 'error');
        return;
    }

    resultDiv.className = 'test-result';
    resultDiv.textContent = '正在测试连接...';
    resultDiv.classList.add('show');

    try {
        const response = await fetch(`${API_BASE}/test-db`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (data.success) {
            resultDiv.className = 'test-result success show';
            resultDiv.textContent = data.message || '数据库连接成功!';
            dbTestResult = true;
            showToast('数据库连接成功', 'success');
        } else {
            resultDiv.className = 'test-result error show';
            resultDiv.textContent = data.message || '连接失败';
            dbTestResult = false;
        }
    } catch (error) {
        resultDiv.className = 'test-result error show';
        resultDiv.textContent = `连接测试失败: ${error.message}`;
        dbTestResult = false;
    }
}

/**
 * 获取数据库表单数据
 */
function getDbFormData() {
    return {
        host: document.getElementById('db-host').value.trim(),
        port: parseInt(document.getElementById('db-port').value) || 3306,
        database: document.getElementById('db-name').value.trim(),
        user: document.getElementById('db-user').value.trim(),
        password: document.getElementById('db-password').value,
        prefix: document.getElementById('db-prefix').value.trim()
    };
}

/**
 * 获取管理员表单数据
 */
function getAdminFormData() {
    return {
        username: document.getElementById('admin-username').value.trim(),
        email: document.getElementById('admin-email').value.trim(),
        password: document.getElementById('admin-password').value,
        confirmPassword: document.getElementById('admin-confirm-password').value
    };
}

/**
 * 验证步骤数据
 */
function validateStep(step) {
    if (step === 2) {
        return true;
    }

    if (step === 3) {
        // 验证管理员信息
        const adminData = getAdminFormData();
        if (!adminData.username || adminData.username.length < 3) {
            showToast('用户名至少需要3个字符', 'error');
            document.getElementById('admin-username').focus();
            return false;
        }
        if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(adminData.username)) {
            showToast('用户名只能包含字母、数字、下划线和中文', 'error');
            return false;
        }
        if (!adminData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminData.email)) {
            showToast('请输入有效的邮箱地址', 'error');
            document.getElementById('admin-email').focus();
            return false;
        }
        if (!adminData.password || adminData.password.length < 6) {
            showToast('密码至少需要6个字符', 'error');
            document.getElementById('admin-password').focus();
            return false;
        }
        if (adminData.password !== adminData.confirmPassword) {
            showToast('两次输入的密码不一致', 'error');
            document.getElementById('admin-confirm-password').focus();
            return false;
        }

        // MySQL 模式验证数据库配置
        if (storageMode === 'mysql') {
            const dbData = getDbFormData();
            if (!dbData.host || !dbData.database || !dbData.user) {
                showToast('请填写完整的数据库连接信息', 'error');
                return false;
            }
            if (!dbTestResult) {
                showToast('请先测试数据库连接', 'warning');
                return false;
            }
        }

        return true;
    }

    return true;
}

/**
 * 跳转到指定步骤
 */
function goToStep(step) {
    // 验证当前步骤
    if (step > currentStep && !validateStep(currentStep)) {
        return;
    }

    // 特殊处理：步骤2需要执行环境检测
    if (step === 2) {
        checkEnvironment();
    }

    // 步骤3：显示/隐藏数据库配置区域
    if (step === 3) {
        const dbSection = document.getElementById('db-config-section');
        if (storageMode === 'mysql') {
            dbSection.classList.remove('hidden');
        } else {
            dbSection.classList.add('hidden');
        }
    }

    // 更新步骤指示器
    document.querySelectorAll('.step-item').forEach(item => {
        const itemStep = parseInt(item.dataset.step);
        item.classList.remove('active', 'completed');
        if (itemStep < step) {
            item.classList.add('completed');
        } else if (itemStep === step) {
            item.classList.add('active');
        }
    });

    // 切换面板
    document.querySelectorAll('.step-panel').forEach(panel => {
        panel.classList.remove('active');
    });
    document.getElementById(`step-${step}`).classList.add('active');

    currentStep = step;
}

/**
 * 开始安装
 */
async function startInstall() {
    if (!validateStep(3)) {
        return;
    }

    // 切换到步骤4
    goToStep(4);

    // 显示安装进度
    document.getElementById('install-progress').style.display = 'block';
    document.getElementById('install-complete').style.display = 'none';

    // 根据模式显示/隐藏数据库步骤
    const databaseStep = document.getElementById('step-database');
    if (storageMode === 'json') {
        databaseStep.style.display = 'none';
    } else {
        databaseStep.style.display = 'flex';
    }

    const adminData = getAdminFormData();

    const installData = {
        mode: storageMode,
        admin: {
            username: adminData.username,
            email: adminData.email,
            password: adminData.password
        }
    };

    // MySQL 模式添加数据库配置
    if (storageMode === 'mysql') {
        installData.database = getDbFormData();
    }

    try {
        // 步骤1: 生成配置文件
        await updateProgress('env', 'active', '进行中');
        await executeInstallStep('config', installData);
        await updateProgress('env', 'success', '完成');

        let progressPercent = storageMode === 'mysql' ? 20 : 33;

        // 步骤2: 初始化数据库（仅 MySQL 模式）
        if (storageMode === 'mysql') {
            updateProgressBar(progressPercent);
            await updateProgress('database', 'active', '进行中');
            await executeInstallStep('database', installData);
            await updateProgress('database', 'success', '完成');
            progressPercent += 20;
        }

        // 步骤3: 创建管理员账号
        updateProgressBar(progressPercent);
        const adminStep = storageMode === 'mysql' ? 'admin' : 'database';
        await updateProgress(adminStep, 'active', '进行中');
        await executeInstallStep('admin', installData);
        await updateProgress(adminStep, 'success', '完成');
        progressPercent += storageMode === 'mysql' ? 20 : 33;

        // 步骤4: 锁定安装
        updateProgressBar(progressPercent);
        const lockStep = storageMode === 'mysql' ? 'lock' : 'admin';
        await updateProgress(lockStep, 'active', '进行中');
        await executeInstallStep('lock', installData);
        await updateProgress(lockStep, 'success', '完成');
        updateProgressBar(100);

        // 显示完成界面
        setTimeout(() => {
            showInstallComplete(adminData, storageMode);
        }, 500);

    } catch (error) {
        console.error('安装失败:', error);
        showToast(`安装失败: ${error.message}`, 'error');
    }
}

/**
 * 执行安装步骤
 */
async function executeInstallStep(step, data) {
    const response = await fetch(`${API_BASE}/execute/${step}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    const result = await response.json();

    if (!result.success) {
        throw new Error(result.message || `${step} 步骤失败`);
    }

    return result;
}

/**
 * 更新进度状态
 */
async function updateProgress(step, status, statusText) {
    const stepEl = document.querySelector(`.progress-step[data-step="${step}"]`);
    if (stepEl) {
        stepEl.classList.remove('active', 'success', 'error');
        if (status) {
            stepEl.classList.add(status);
        }
        const statusEl = stepEl.querySelector('.step-status');
        if (statusEl) {
            statusEl.textContent = statusText;
        }
    }
    // 添加小延迟让用户看到进度
    await new Promise(resolve => setTimeout(resolve, 300));
}

/**
 * 更新进度条
 */
function updateProgressBar(percent) {
    document.getElementById('progress-fill').style.width = `${percent}%`;
}

/**
 * 显示安装完成界面
 */
function showInstallComplete(adminData, mode) {
    document.getElementById('install-progress').style.display = 'none';
    document.getElementById('install-complete').style.display = 'block';

    // 更新信息
    document.getElementById('info-admin-username').textContent = adminData.username;
    document.getElementById('info-storage-mode').textContent = mode === 'mysql' ? 'MySQL 数据库' : 'JSON 文件';

    // 更新步骤指示器
    document.querySelectorAll('.step-item').forEach(item => {
        item.classList.remove('active');
        item.classList.add('completed');
    });
}

/**
 * 显示 Toast 提示
 */
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
