const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

// 加载环境变量
if (fs.existsSync(path.join(__dirname, '.env'))) {
    require('dotenv').config();
}

// 初始化数据库
const db = require('./db');
db.initDatabase();

// 数据访问层
const store = require('./models/dataStore');

const app = express();
const PORT = process.env.PORT || 3000;

// Token 有效期（24小时）
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000;

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 请求日志（调试用）
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

const LOCK_FILE = path.join(__dirname, 'data', 'install.lock');

// 安装锁定检查中间件（保护 API 路由）
function installLockMiddleware(req, res, next) {
  // 安装向导 API 不受限制
  if (req.path.startsWith('/api/install')) {
    return next();
  }

  // 检查是否已安装
  if (!fs.existsSync(LOCK_FILE)) {
    return res.status(503).json({
      success: false,
      message: '系统未安装，请先访问 /install 完成安装',
      needInstall: true
    });
  }

  next();
}

// 安装页面静态文件服务（必须在锁定检查之前）
app.use('/install', express.static(path.join(__dirname, '../install')));

// 安装向导 API 路由
const installRouter = require('./routes/install');
app.use('/api/install', installRouter);

// 应用安装锁定中间件（保护业务 API）
app.use('/api', installLockMiddleware);

// 认证中间件
async function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ success: false, message: '未登录', needLogin: true });
  }

  const admin = await store.getAdmin();
  if (!admin) {
    return res.status(500).json({ success: false, message: '配置错误' });
  }

  // 验证 Token
  if (admin.token !== token) {
    return res.status(401).json({ success: false, message: 'Token 无效', needLogin: true });
  }

  // 检查 Token 是否过期
  if (admin.tokenExpiry && Date.now() > admin.tokenExpiry) {
    return res.status(401).json({ success: false, message: '登录已过期', needLogin: true });
  }

  next();
}

// ========== API 路由 ==========

// ========== 认证 API ==========

// 登录
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: '请输入用户名和密码' });
  }

  const admin = await store.getAdmin();
  if (!admin) {
    return res.status(500).json({ success: false, message: '配置错误' });
  }

  // 验证用户名和密码
  const passwordHash = store.md5(password);
  if (username !== admin.username || passwordHash !== admin.password) {
    return res.status(401).json({ success: false, message: '用户名或密码错误' });
  }

  // 生成新 Token
  const token = store.generateToken();
  const updateData = {
    token,
    tokenExpiry: Date.now() + TOKEN_EXPIRY,
    lastLogin: new Date().toISOString()
  };

  if (await store.updateAdmin(updateData)) {
    console.log(`[登录] 用户 ${username} 登录成功`);
    res.json({
      success: true,
      message: '登录成功',
      data: {
        token,
        username: admin.username,
        lastLogin: updateData.lastLogin
      }
    });
  } else {
    res.status(500).json({ success: false, message: '保存登录状态失败' });
  }
});

// 验证 Token
app.get('/api/auth/verify', authMiddleware, async (req, res) => {
  const admin = await store.getAdmin();
  res.json({
    success: true,
    data: {
      username: admin.username,
      lastLogin: admin.lastLogin
    }
  });
});

// 登出
app.post('/api/auth/logout', authMiddleware, async (req, res) => {
  await store.updateAdmin({ token: '', tokenExpiry: null });
  console.log('[登出] 用户已登出');
  res.json({ success: true, message: '已登出' });
});

// 修改密码
app.post('/api/auth/change-password', authMiddleware, async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ success: false, message: '请输入旧密码和新密码' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, message: '新密码至少需要6个字符' });
  }

  const admin = await store.getAdmin();
  if (!admin) {
    return res.status(500).json({ success: false, message: '配置错误' });
  }

  // 验证旧密码
  const oldPasswordHash = store.md5(oldPassword);
  if (oldPasswordHash !== admin.password) {
    return res.status(401).json({ success: false, message: '旧密码错误' });
  }

  // 更新密码
  const newPasswordHash = store.md5(newPassword);
  if (await store.updateAdmin({ password: newPasswordHash, token: '', tokenExpiry: null })) {
    console.log('[密码] 密码已修改');
    res.json({ success: true, message: '密码已修改，请重新登录', needRelogin: true });
  } else {
    res.status(500).json({ success: false, message: '保存失败' });
  }
});

// 修改账户信息（用户名和密码）
app.post('/api/auth/update-account', authMiddleware, async (req, res) => {
  const { username, oldPassword, newPassword } = req.body;

  if (!oldPassword) {
    return res.status(400).json({ success: false, message: '请输入当前密码' });
  }

  if (username && username.length < 3) {
    return res.status(400).json({ success: false, message: '用户名至少需要3个字符' });
  }

  if (newPassword && newPassword.length < 6) {
    return res.status(400).json({ success: false, message: '新密码至少需要6个字符' });
  }

  const admin = await store.getAdmin();
  if (!admin) {
    return res.status(500).json({ success: false, message: '配置错误' });
  }

  // 验证当前密码
  const oldPasswordHash = store.md5(oldPassword);
  if (oldPasswordHash !== admin.password) {
    return res.status(401).json({ success: false, message: '当前密码错误' });
  }

  const updateData = {};

  // 更新用户名
  if (username && username !== admin.username) {
    updateData.username = username;
    console.log(`[账户] 用户名已修改为: ${username}`);
  }

  // 更新密码（如果提供了新密码）
  let needRelogin = false;
  if (newPassword) {
    updateData.password = store.md5(newPassword);
    updateData.token = '';
    updateData.tokenExpiry = null;
    needRelogin = true;
    console.log('[账户] 密码已修改');
  }

  if (await store.updateAdmin(updateData)) {
    res.json({
      success: true,
      message: needRelogin ? '账户信息已更新，请重新登录' : '账户信息已更新',
      needRelogin,
      data: {
        username: username || admin.username
      }
    });
  } else {
    res.status(500).json({ success: false, message: '保存失败' });
  }
});

// ========== 公开 API（无需认证）==========

// 获取前台配置（不包含敏感信息）
app.get('/api/config', async (req, res) => {
  const config = await store.getPublicConfig();
  if (config) {
    res.json({ success: true, data: config });
  } else {
    res.status(500).json({ success: false, message: '读取配置失败' });
  }
});

// ========== 后台管理 API（需要认证）==========

// 更新网站基本信息
app.post('/api/config/site', authMiddleware, async (req, res) => {
  if (await store.updateSiteConfig(req.body)) {
    res.json({ success: true, message: '网站信息已更新' });
  } else {
    res.status(500).json({ success: false, message: '保存失败' });
  }
});

// 更新 API 配置
app.post('/api/config/apis', authMiddleware, async (req, res) => {
  if (await store.updateApis(req.body)) {
    res.json({ success: true, message: 'API配置已更新' });
  } else {
    res.status(500).json({ success: false, message: '保存失败' });
  }
});

// 更新标签
app.post('/api/config/tags', authMiddleware, async (req, res) => {
  if (await store.updateTags(req.body.tags)) {
    res.json({ success: true, message: '标签已更新' });
  } else {
    res.status(500).json({ success: false, message: '保存失败' });
  }
});

// 更新外链
app.post('/api/config/links', authMiddleware, async (req, res) => {
  if (await store.updateLinks(req.body.links)) {
    res.json({ success: true, message: '外链已更新' });
  } else {
    res.status(500).json({ success: false, message: '保存失败' });
  }
});

// ========== 日程管理 API ==========

// 获取所有日程
app.get('/api/schedule', async (req, res) => {
  const schedule = await store.getSchedule();
  if (schedule) {
    res.json({
      success: true,
      data: schedule
    });
  } else {
    res.status(500).json({ success: false, message: '读取失败' });
  }
});

// 添加课程
app.post('/api/schedule/courses', authMiddleware, async (req, res) => {
  const { id, ...courseData } = req.body;
  const newCourse = await store.addCourse(courseData);

  if (newCourse) {
    res.json({ success: true, message: '课程已添加', data: newCourse });
  } else {
    res.status(500).json({ success: false, message: '保存失败' });
  }
});

// 更新课程
app.put('/api/schedule/courses/:id', authMiddleware, async (req, res) => {
  const targetId = req.params.id;
  const updated = await store.updateCourse(targetId, req.body);

  if (updated) {
    res.json({ success: true, message: '课程已更新' });
  } else {
    res.status(404).json({ success: false, message: '课程不存在或保存失败' });
  }
});

// 删除课程
app.delete('/api/schedule/courses/:id', authMiddleware, async (req, res) => {
  if (await store.deleteCourse(req.params.id)) {
    res.json({ success: true, message: '课程已删除' });
  } else {
    res.status(500).json({ success: false, message: '保存失败' });
  }
});

// 添加日程安排
app.post('/api/schedule/events', authMiddleware, async (req, res) => {
  const { id, ...eventData } = req.body;
  const newEvent = await store.addEvent(eventData);

  if (newEvent) {
    res.json({ success: true, message: '日程已添加', data: newEvent });
  } else {
    res.status(500).json({ success: false, message: '保存失败' });
  }
});

// 更新日程
app.put('/api/schedule/events/:id', authMiddleware, async (req, res) => {
  const updated = await store.updateEvent(req.params.id, req.body);

  if (updated) {
    res.json({ success: true, message: '日程已更新' });
  } else {
    res.status(404).json({ success: false, message: '日程不存在或保存失败' });
  }
});

// 删除日程
app.delete('/api/schedule/events/:id', authMiddleware, async (req, res) => {
  if (await store.deleteEvent(req.params.id)) {
    res.json({ success: true, message: '日程已删除' });
  } else {
    res.status(500).json({ success: false, message: '保存失败' });
  }
});

// ========== 动态管理 API ==========

// 获取所有动态
app.get('/api/activities', async (req, res) => {
  const activities = await store.getActivities();
  res.json({ success: true, data: activities || [] });
});

// 添加动态
app.post('/api/activities', authMiddleware, async (req, res) => {
  const { id, ...activityData } = req.body;
  const newActivity = await store.addActivity(activityData);

  if (newActivity) {
    res.json({ success: true, message: '动态已添加', data: newActivity });
  } else {
    res.status(500).json({ success: false, message: '保存失败' });
  }
});

// 更新动态
app.put('/api/activities/:id', authMiddleware, async (req, res) => {
  const updated = await store.updateActivity(req.params.id, req.body);

  if (updated) {
    res.json({ success: true, message: '动态已更新' });
  } else {
    res.status(404).json({ success: false, message: '动态不存在或保存失败' });
  }
});

// 删除动态
app.delete('/api/activities/:id', authMiddleware, async (req, res) => {
  if (await store.deleteActivity(req.params.id)) {
    res.json({ success: true, message: '动态已删除' });
  } else {
    res.status(500).json({ success: false, message: '保存失败' });
  }
});

// ========== 天气 API 代理 ==========
app.get('/api/weather', async (req, res) => {
  const apis = await store.getApis();

  if (!apis || !apis.weather?.enabled) {
    return res.status(400).json({ success: false, message: '天气 API 未启用' });
  }

  const weatherConfig = apis.weather;
  const weatherUrl = weatherConfig.url || 'https://uapis.cn/api/v1/misc/weather';
  const city = weatherConfig.city || req.query.city || '';

  let url = weatherUrl;
  if (city) {
    url = `${weatherUrl}?city=${encodeURIComponent(city)}`;
  }

  try {
    console.log(`[天气 API] 请求地址: ${url}`);

    const fetch = (await import('node-fetch')).default;
    const response = await fetch(url, { timeout: 10000 });

    console.log(`[天气 API] 响应状态: ${response.status}`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[天气 API] 响应成功', data);

    if (!data.city || !data.weather) {
      throw new Error('API 返回格式错误');
    }

    const standardizedData = {
      city: data.city,
      temp: data.temperature,
      weather: data.weather,
      weatherCode: data.weather_icon,
      humidity: data.humidity,
      wind: data.wind_direction + data.wind_power
    };

    res.json({ success: true, data: standardizedData });
  } catch (err) {
    console.error('[天气 API] 错误:', err);
    res.status(500).json({
      success: false,
      message: '获取天气失败: ' + err.message
    });
  }
});

// ========== 静态文件服务（放在 API 路由之后）==========
// 安装页面重定向（未安装时）
app.get('/', (req, res, next) => {
  if (!fs.existsSync(LOCK_FILE) && req.accepts('html')) {
    return res.redirect('/install');
  }
  next();
});

app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/admin', express.static(path.join(__dirname, '../admin')));

// 获取当前数据存储模式 API
app.get('/api/system/info', (req, res) => {
  res.json({
    success: true,
    data: {
      mode: db.getMode(),
      isMySQL: db.isMySQL()
    }
  });
});

// 启动服务器
const server = app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`前台页面: http://localhost:${PORT}`);
  console.log(`后台管理: http://localhost:${PORT}/admin`);
  console.log(`数据存储模式: ${db.getMode().toUpperCase()}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`端口 ${PORT} 已被占用，请关闭其他程序或修改端口号`);
  } else {
    console.error('服务器启动失败:', err.message);
  }
  process.exit(1);
});

// 优雅关闭
process.on('SIGTERM', async () => {
  console.log('收到 SIGTERM 信号，正在关闭...');
  await db.close();
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('收到 SIGINT 信号，正在关闭...');
  await db.close();
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});
