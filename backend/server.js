const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = 3000;

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

const DATA_FILE = path.join(__dirname, 'data', 'config.json');

// 读取配置
function readConfig() {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('读取配置失败:', err);
    return null;
  }
}

// 保存配置
function writeConfig(config) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('保存配置失败:', err);
    return false;
  }
}

// MD5 加密
function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

// 生成随机 Token
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// 认证中间件
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ success: false, message: '未登录', needLogin: true });
  }

  const config = readConfig();
  if (!config || !config.admin) {
    return res.status(500).json({ success: false, message: '配置错误' });
  }

  // 验证 Token
  if (config.admin.token !== token) {
    return res.status(401).json({ success: false, message: 'Token 无效', needLogin: true });
  }

  // 检查 Token 是否过期
  if (config.admin.tokenExpiry && Date.now() > config.admin.tokenExpiry) {
    return res.status(401).json({ success: false, message: '登录已过期', needLogin: true });
  }

  next();
}

// ========== API 路由 ==========

// ========== 认证 API ==========

// 登录
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: '请输入用户名和密码' });
  }

  const config = readConfig();
  if (!config || !config.admin) {
    return res.status(500).json({ success: false, message: '配置错误' });
  }

  // 验证用户名和密码
  const passwordHash = md5(password);
  if (username !== config.admin.username || passwordHash !== config.admin.password) {
    return res.status(401).json({ success: false, message: '用户名或密码错误' });
  }

  // 生成新 Token
  const token = generateToken();
  config.admin.token = token;
  config.admin.tokenExpiry = Date.now() + TOKEN_EXPIRY;
  config.admin.lastLogin = new Date().toISOString();

  if (writeConfig(config)) {
    console.log(`[登录] 用户 ${username} 登录成功`);
    res.json({
      success: true,
      message: '登录成功',
      data: {
        token,
        username: config.admin.username,
        lastLogin: config.admin.lastLogin
      }
    });
  } else {
    res.status(500).json({ success: false, message: '保存登录状态失败' });
  }
});

// 验证 Token
app.get('/api/auth/verify', authMiddleware, (req, res) => {
  const config = readConfig();
  res.json({
    success: true,
    data: {
      username: config.admin.username,
      lastLogin: config.admin.lastLogin
    }
  });
});

// 登出
app.post('/api/auth/logout', authMiddleware, (req, res) => {
  const config = readConfig();
  if (config && config.admin) {
    config.admin.token = '';
    config.admin.tokenExpiry = null;
    writeConfig(config);
    console.log('[登出] 用户已登出');
  }
  res.json({ success: true, message: '已登出' });
});

// 修改密码
app.post('/api/auth/change-password', authMiddleware, (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ success: false, message: '请输入旧密码和新密码' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, message: '新密码至少需要6个字符' });
  }

  const config = readConfig();
  if (!config || !config.admin) {
    return res.status(500).json({ success: false, message: '配置错误' });
  }

  // 验证旧密码
  const oldPasswordHash = md5(oldPassword);
  if (oldPasswordHash !== config.admin.password) {
    return res.status(401).json({ success: false, message: '旧密码错误' });
  }

  // 更新密码
  config.admin.password = md5(newPassword);
  // 清除 Token，强制重新登录
  config.admin.token = '';
  config.admin.tokenExpiry = null;

  if (writeConfig(config)) {
    console.log('[密码] 密码已修改');
    res.json({ success: true, message: '密码已修改，请重新登录', needRelogin: true });
  } else {
    res.status(500).json({ success: false, message: '保存失败' });
  }
});

// 修改账户信息（用户名和密码）
app.post('/api/auth/update-account', authMiddleware, (req, res) => {
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

  const config = readConfig();
  if (!config || !config.admin) {
    return res.status(500).json({ success: false, message: '配置错误' });
  }

  // 验证当前密码
  const oldPasswordHash = md5(oldPassword);
  if (oldPasswordHash !== config.admin.password) {
    return res.status(401).json({ success: false, message: '当前密码错误' });
  }

  // 更新用户名
  if (username && username !== config.admin.username) {
    config.admin.username = username;
    console.log(`[账户] 用户名已修改为: ${username}`);
  }

  // 更新密码（如果提供了新密码）
  let needRelogin = false;
  if (newPassword) {
    config.admin.password = md5(newPassword);
    // 清除 Token，强制重新登录
    config.admin.token = '';
    config.admin.tokenExpiry = null;
    needRelogin = true;
    console.log('[账户] 密码已修改');
  }

  if (writeConfig(config)) {
    res.json({
      success: true,
      message: needRelogin ? '账户信息已更新，请重新登录' : '账户信息已更新',
      needRelogin,
      data: {
        username: config.admin.username
      }
    });
  } else {
    res.status(500).json({ success: false, message: '保存失败' });
  }
});

// ========== 公开 API（无需认证）==========

// 获取前台配置（不包含敏感信息）
app.get('/api/config', (req, res) => {
  const config = readConfig();
  if (config) {
    // 过滤敏感信息
    const publicConfig = {
      site: config.site,
      apis: {
        anime: config.apis?.anime || [],
        hitokoto: config.apis?.hitokoto || [],
        qqInfo: config.apis?.qqInfo,
        weather: config.apis?.weather
      },
      tags: config.tags,
      links: config.links,
      schedule: config.schedule,
      widgets: config.widgets,
      activities: config.activities
    };
    res.json({ success: true, data: publicConfig });
  } else {
    res.status(500).json({ success: false, message: '读取配置失败' });
  }
});

// ========== 后台管理 API（需要认证）==========

// 更新网站基本信息
app.post('/api/config/site', authMiddleware, (req, res) => {
  const config = readConfig();
  if (!config) return res.status(500).json({ success: false, message: '读取配置失败' });
  
  config.site = { ...config.site, ...req.body };
  if (writeConfig(config)) {
    res.json({ success: true, message: '网站信息已更新' });
  } else {
    res.status(500).json({ success: false, message: '保存失败' });
  }
});

// 更新 API 配置
app.post('/api/config/apis', authMiddleware, (req, res) => {
  const config = readConfig();
  if (!config) return res.status(500).json({ success: false, message: '读取配置失败' });
  
  config.apis = { ...config.apis, ...req.body };
  if (writeConfig(config)) {
    res.json({ success: true, message: 'API配置已更新' });
  } else {
    res.status(500).json({ success: false, message: '保存失败' });
  }
});

// 更新标签
app.post('/api/config/tags', authMiddleware, (req, res) => {
  const config = readConfig();
  if (!config) return res.status(500).json({ success: false, message: '读取配置失败' });
  
  config.tags = req.body.tags;
  if (writeConfig(config)) {
    res.json({ success: true, message: '标签已更新' });
  } else {
    res.status(500).json({ success: false, message: '保存失败' });
  }
});

// 更新外链
app.post('/api/config/links', authMiddleware, (req, res) => {
  const config = readConfig();
  if (!config) return res.status(500).json({ success: false, message: '读取配置失败' });
  
  config.links = req.body.links;
  if (writeConfig(config)) {
    res.json({ success: true, message: '外链已更新' });
  } else {
    res.status(500).json({ success: false, message: '保存失败' });
  }
});

// ========== 日程管理 API ==========

// 获取所有日程
app.get('/api/schedule', (req, res) => {
  const config = readConfig();
  if (config) {
    res.json({ 
      success: true, 
      data: {
        courses: config.schedule.courses,
        events: config.schedule.events
      }
    });
  } else {
    res.status(500).json({ success: false, message: '读取失败' });
  }
});

// 添加课程
app.post('/api/schedule/courses', authMiddleware, (req, res) => {
  const config = readConfig();
  if (!config) return res.status(500).json({ success: false, message: '读取配置失败' });

  // 删除请求体中的 id 字段，强制生成新 ID
  const { id, ...courseData } = req.body;
  const newCourse = {
    id: Date.now(),
    ...courseData
  };
  config.schedule.courses.push(newCourse);

  if (writeConfig(config)) {
    res.json({ success: true, message: '课程已添加', data: newCourse });
  } else {
    res.status(500).json({ success: false, message: '保存失败' });
  }
});

// 更新课程
app.put('/api/schedule/courses/:id', authMiddleware, (req, res) => {
  const config = readConfig();
  if (!config) return res.status(500).json({ success: false, message: '读取配置失败' });

  const targetId = req.params.id;
  const index = config.schedule.courses.findIndex(c => String(c.id) === String(targetId));

  if (index === -1) {
    return res.status(404).json({ success: false, message: '课程不存在' });
  }

  config.schedule.courses[index] = { ...config.schedule.courses[index], ...req.body };

  if (writeConfig(config)) {
    res.json({ success: true, message: '课程已更新' });
  } else {
    res.status(500).json({ success: false, message: '保存失败' });
  }
});

// 删除课程
app.delete('/api/schedule/courses/:id', authMiddleware, (req, res) => {
  const config = readConfig();
  if (!config) return res.status(500).json({ success: false, message: '读取配置失败' });

  const targetId = req.params.id;
  config.schedule.courses = config.schedule.courses.filter(c => String(c.id) !== String(targetId));

  if (writeConfig(config)) {
    res.json({ success: true, message: '课程已删除' });
  } else {
    res.status(500).json({ success: false, message: '保存失败' });
  }
});

// 添加日程安排
app.post('/api/schedule/events', authMiddleware, (req, res) => {
  const config = readConfig();
  if (!config) return res.status(500).json({ success: false, message: '读取配置失败' });

  // 删除请求体中的 id 字段，强制生成新 ID
  const { id, ...eventData } = req.body;
  const newEvent = {
    id: Date.now(),
    ...eventData
  };
  config.schedule.events.push(newEvent);

  if (writeConfig(config)) {
    res.json({ success: true, message: '日程已添加', data: newEvent });
  } else {
    res.status(500).json({ success: false, message: '保存失败' });
  }
});

// 更新日程
app.put('/api/schedule/events/:id', authMiddleware, (req, res) => {
  const config = readConfig();
  if (!config) return res.status(500).json({ success: false, message: '读取配置失败' });

  const targetId = req.params.id;
  const index = config.schedule.events.findIndex(e => String(e.id) === String(targetId));

  if (index === -1) {
    return res.status(404).json({ success: false, message: '日程不存在' });
  }

  config.schedule.events[index] = { ...config.schedule.events[index], ...req.body };

  if (writeConfig(config)) {
    res.json({ success: true, message: '日程已更新' });
  } else {
    res.status(500).json({ success: false, message: '保存失败' });
  }
});

// 删除日程
app.delete('/api/schedule/events/:id', authMiddleware, (req, res) => {
  const config = readConfig();
  if (!config) return res.status(500).json({ success: false, message: '读取配置失败' });

  const targetId = req.params.id;
  config.schedule.events = config.schedule.events.filter(e => String(e.id) !== String(targetId));

  if (writeConfig(config)) {
    res.json({ success: true, message: '日程已删除' });
  } else {
    res.status(500).json({ success: false, message: '保存失败' });
  }
});

// ========== 动态管理 API ==========

// 获取所有动态
app.get('/api/activities', (req, res) => {
  const config = readConfig();
  if (config) {
    res.json({ success: true, data: config.activities || [] });
  } else {
    res.status(500).json({ success: false, message: '读取配置失败' });
  }
});

// 添加动态
app.post('/api/activities', authMiddleware, (req, res) => {
  const config = readConfig();
  if (!config) return res.status(500).json({ success: false, message: '读取配置失败' });

  // 删除请求体中的 id 字段，强制生成新 ID
  const { id, ...activityData } = req.body;
  const newActivity = {
    id: Date.now(),
    ...activityData
  };

  if (!config.activities) {
    config.activities = [];
  }
  config.activities.unshift(newActivity); // 加到最前面

  if (writeConfig(config)) {
    res.json({ success: true, message: '动态已添加', data: newActivity });
  } else {
    res.status(500).json({ success: false, message: '保存失败' });
  }
});

// 更新动态
app.put('/api/activities/:id', authMiddleware, (req, res) => {
  const config = readConfig();
  if (!config) return res.status(500).json({ success: false, message: '读取配置失败' });

  if (!config.activities) {
    config.activities = [];
  }

  const targetId = req.params.id;
  const index = config.activities.findIndex(a => String(a.id) === String(targetId));

  if (index === -1) {
    return res.status(404).json({ success: false, message: '动态不存在' });
  }

  config.activities[index] = { ...config.activities[index], ...req.body };

  if (writeConfig(config)) {
    res.json({ success: true, message: '动态已更新' });
  } else {
    res.status(500).json({ success: false, message: '保存失败' });
  }
});

// 删除动态
app.delete('/api/activities/:id', authMiddleware, (req, res) => {
  const config = readConfig();
  if (!config) return res.status(500).json({ success: false, message: '读取配置失败' });

  if (!config.activities) {
    config.activities = [];
  }

  const targetId = req.params.id;
  const originalLength = config.activities.length;
  config.activities = config.activities.filter(a => String(a.id) !== String(targetId));

  if (config.activities.length === originalLength) {
    return res.status(404).json({ success: false, message: '动态不存在' });
  }

  if (writeConfig(config)) {
    res.json({ success: true, message: '动态已删除' });
  } else {
    res.status(500).json({ success: false, message: '保存失败' });
  }
});

// 根据天气代码获取中文描述
function getWeatherDescByCode(code) {
  if (!code) return null;
  const codeNum = parseInt(code);

  // 天气代码映射表（基于 wttr.in）
  const weatherMap = {
    113: '晴',
    116: '多云',
    119: '多云',
    122: '阴',
    143: '雾',
    176: '小雨',
    179: '雨夹雪',
    182: '阵雪',
    185: '阵雪',
    200: '雷阵雨',
    227: '小雪',
    230: '大雪',
    233: '大雪',
    236: '暴雪',
    248: '雾',
    260: '雨夹雪',
    263: '小雨',
    266: '雨夹雪',
    281: '阵雪',
    284: '大雪',
    293: '小雨',
    296: '小雨',
    299: '小雨',
    302: '小雨',
    305: '雨夹雪',
    308: '中雨',
    311: '中雨',
    314: '中雨',
    317: '大雨',
    320: '大雨',
    323: '大雨',
    326: '冰雹',
    329: '暴雨',
    332: '暴雨',
    335: '暴雪',
    338: '暴雪',
    350: '阵雪',
    353: '小雨',
    356: '大雨',
    359: '暴雨',
    362: '雨夹雪',
    365: '阵雪',
    368: '大雪',
    371: '暴雪',
    374: '暴雪',
    377: '暴雨',
    386: '雷阵雨',
    389: '雷阵雨',
    392: '雷阵雨',
    395: '雷暴',
    398: '雷暴'
  };

  return weatherMap[codeNum] || null;
}

// 获取用户真实IP
function getClientIP(req) {
  let ip = req.headers['x-forwarded-for'] ||
            req.headers['x-real-ip'] ||
            req.connection?.remoteAddress ||
            req.socket?.remoteAddress ||
            req.ip || '';

  // 处理多个IP的情况（取第一个）
  if (ip.includes(',')) {
    ip = ip.split(',')[0].trim();
  }

  // 处理IPv6映射的IPv4地址
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }

  // 本地开发时返回空，让wttr.in自动检测
  if (ip === '::1' || ip === '127.0.0.1' || ip === 'localhost') {
    return '';
  }

  return ip;
}

// ========== 天气 API 代理 ==========
app.get('/api/weather', async (req, res) => {
  const config = readConfig();
  if (!config || !config.apis?.weather?.enabled) {
    return res.status(400).json({ success: false, message: '天气 API 未启用' });
  }

  const weatherConfig = config.apis.weather;
  const weatherUrl = weatherConfig.url || 'https://uapis.cn/api/v1/misc/weather';
  const city = weatherConfig.city || req.query.city || '';

  // 构建 URL
  let url = weatherUrl;
  if (city) {
    url = `${weatherUrl}?city=${encodeURIComponent(city)}`;
  } else {
    // 不传 city 参数，让 API 自动根据 IP 定位
    // uapis.cn 会自动根据请求 IP 定位
  }

  try {
    console.log(`[天气 API] 请求地址: ${url}`);

    // 使用 node-fetch
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(url, {
      timeout: 10000
    });

    console.log(`[天气 API] 响应状态: ${response.status}`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[天气 API] 响应成功', data);

    // uapis.cn 返回格式
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
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/admin', express.static(path.join(__dirname, '../admin')));

// 启动服务器
const server = app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`前台页面: http://localhost:${PORT}`);
  console.log(`后台管理: http://localhost:${PORT}/admin`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`端口 ${PORT} 已被占用，请关闭其他程序或修改端口号`);
  } else {
    console.error('服务器启动失败:', err.message);
  }
  process.exit(1);
});
