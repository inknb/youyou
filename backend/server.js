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

// 禁用 ETag，防止浏览器缓存 API 响应导致数据不同步
app.set('etag', false);

// 信任反向代理（仅一层 Nginx），使 req.ip 取到真实访问者 IP（用于天气定位）
// 注意：不要用 trust proxy: true，否则客户端可伪造 X-Forwarded-For 绕过登录限频
app.set('trust proxy', 1);

// Token 有效期（24小时）
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000;

// 中间件
// CORS：默认仅允许同源（不启用 cors 头）；如需跨域，用环境变量 CORS_ORIGIN 配置白名单
const corsOrigins = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
if (corsOrigins.length > 0) {
  app.use(cors({ origin: corsOrigins }));
}

// 安全响应头
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'SAMEORIGIN');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// API 响应不缓存，确保前端始终获取最新数据
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 请求日志（调试用）
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });
}

const LOCK_FILE = path.join(__dirname, 'data', 'install.lock');

// 安装锁定检查中间件（保护 API 路由）
function installLockMiddleware(req, res, next) {
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
const crypto = require('crypto');

function tokenEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

// 登录限频：同一 IP 10 分钟内最多 10 次失败
const loginAttempts = new Map();
const LOGIN_WINDOW = 10 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;

function loginRateLimit(req, res, next) {
  const ip = req.ip;
  const now = Date.now();
  const record = loginAttempts.get(ip) || { count: 0, resetAt: now + LOGIN_WINDOW };
  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + LOGIN_WINDOW;
  }
  if (record.count >= LOGIN_MAX_ATTEMPTS) {
    return res.status(429).json({ success: false, message: '尝试次数过多，请 10 分钟后再试' });
  }
  record.count++;
  loginAttempts.set(ip, record);
  next();
}

function clearLoginAttempts(ip) {
  loginAttempts.delete(ip);
}

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
  if (!tokenEqual(admin.token, token)) {
    return res.status(401).json({ success: false, message: 'Token 无效', needLogin: true });
  }

  // 检查 Token 是否过期
  if (admin.tokenExpiry && Date.now() > Number(admin.tokenExpiry)) {
    return res.status(401).json({ success: false, message: '登录已过期', needLogin: true });
  }

  next();
}

// ========== API 路由 ==========

// ========== 认证 API ==========

// 登录
app.post('/api/auth/login', loginRateLimit, async (req, res) => {
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

  clearLoginAttempts(req.ip);

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
  await store.updateAdmin({ token: null, tokenExpiry: null });
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
  if (await store.updateAdmin({ password: newPasswordHash, token: null, tokenExpiry: null })) {
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
    updateData.token = null;
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

// ========== 博客 API ==========

// 可选认证：带有效 token 时标记 req.isAdmin（后台列表需要看到草稿）
async function optionalAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    try {
      const admin = await store.getAdmin();
      if (admin && tokenEqual(admin.token, token)) {
        const expired = admin.tokenExpiry && Date.now() > Number(admin.tokenExpiry);
        if (!expired) req.isAdmin = true;
      }
    } catch (e) { /* 忽略，按匿名处理 */ }
  }
  next();
}

// 获取文章列表（匿名仅见已发布；带 token 可见全部；支持 keyword 搜索标题/摘要/正文）
app.get('/api/blog', optionalAuth, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize, 10) || 10));
  const keyword = String(req.query.keyword || '').trim().slice(0, 100);
  const data = await store.getArticles({ page, pageSize, publishedOnly: !req.isAdmin, keyword });
  res.json({ success: true, data: { ...data, page, pageSize, keyword } });
});

// 获取文章详情（草稿对匿名 404）
app.get('/api/blog/:id', optionalAuth, async (req, res) => {
  const article = await store.getArticle(req.params.id);
  if (!article || (!article.published && !req.isAdmin)) {
    return res.status(404).json({ success: false, message: '文章不存在' });
  }
  res.json({ success: true, data: article });
});

// 新建文章
app.post('/api/blog', authMiddleware, async (req, res) => {
  const newArticle = await store.addArticle(req.body);
  if (newArticle) {
    res.json({ success: true, message: '文章已发布', data: newArticle });
  } else {
    res.status(500).json({ success: false, message: '保存失败' });
  }
});

// 更新文章
app.put('/api/blog/:id', authMiddleware, async (req, res) => {
  const updated = await store.updateArticle(req.params.id, req.body);
  if (updated) {
    res.json({ success: true, message: '文章已更新' });
  } else {
    res.status(404).json({ success: false, message: '文章不存在或保存失败' });
  }
});

// 删除文章
app.delete('/api/blog/:id', authMiddleware, async (req, res) => {
  if (await store.deleteArticle(req.params.id)) {
    res.json({ success: true, message: '文章已删除' });
  } else {
    res.status(500).json({ success: false, message: '保存失败' });
  }
});

// ========== 天气 API 代理 ==========

// 判断 IP 是否为公网 IPv4（私网/回环/保留段不可定位）
function isPublicIPv4(ip) {
  const clean = String(ip || '').replace(/^::ffff:/, '').trim();
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(clean)) return false;
  const parts = clean.split('.').map(Number);
  if (parts.some(n => n < 0 || n > 255)) return false;
  const [a, b] = parts;
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
    (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127));
}

// 通过访问者 IP 定位城市（ip-api.com 免费接口，https + 24h 缓存）
const ipCityCache = new Map();
const IP_CITY_TTL = 24 * 60 * 60 * 1000;

// 天气结果缓存（10 分钟 TTL，减少外部 API 依赖延迟；容量上限 200 防止内存无限增长）
const weatherResultCache = new Map();
const WEATHER_RESULT_TTL = 10 * 60 * 1000;
const WEATHER_CACHE_MAX = 200;

// 写入天气缓存：先淘汰过期项，仍超容量则删除最旧条目
function setWeatherCache(key, data) {
  const now = Date.now();
  for (const [k, v] of weatherResultCache) {
    if (now - v.at >= WEATHER_RESULT_TTL) weatherResultCache.delete(k);
  }
  if (weatherResultCache.size >= WEATHER_CACHE_MAX) {
    const oldest = weatherResultCache.keys().next().value;
    if (oldest !== undefined) weatherResultCache.delete(oldest);
  }
  weatherResultCache.set(key, { data, at: now });
}

// 手动 city 参数白名单（中文/英文城市名，防任意字符串撑爆缓存）
function isValidCity(city) {
  return typeof city === 'string' && city.length <= 50 && /^[\u4e00-\u9fa5a-zA-Z0-9·\- ]+$/.test(city);
}

async function locateCityByIp(ip) {
  if (!isPublicIPv4(ip)) return null;

  const cached = ipCityCache.get(ip);
  if (cached && Date.now() - cached.at < IP_CITY_TTL) {
    return cached.city;
  }

  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`https://ip-api.com/json/${ip}?lang=zh-CN&fields=status,city`, { timeout: 5000 });
    if (!response.ok) return null;
    const data = await response.json();
    if (data.status !== 'success' || !data.city) return null;
    ipCityCache.set(ip, { city: data.city, at: Date.now() });
    return data.city;
  } catch (err) {
    console.warn('[天气 IP 定位] 失败:', err.message);
    return null;
  }
}

app.get('/api/weather', async (req, res) => {
  const apis = await store.getApis();

  if (!apis || !apis.weather?.enabled) {
    return res.status(400).json({ success: false, message: '天气 API 未启用' });
  }

  const weatherConfig = apis.weather;
  const weatherUrl = weatherConfig.url || 'https://uapis.cn/api/v1/misc/weather';

  // 定位优先级：手动 city 参数 > 访问者 IP 定位 > 后台配置城市 > 上游默认
  let source = 'default';
  let city = req.query.city || '';

  if (city) {
    if (!isValidCity(city)) {
      return res.status(400).json({ success: false, message: '非法的城市参数' });
    }
    source = 'manual';
  } else {
    // 仅使用服务端获取的真实访问者 IP，不接受客户端指定（防止被滥用为代理）
    const located = await locateCityByIp(req.ip);
    if (located) {
      city = located;
      source = 'ip';
    } else {
      city = weatherConfig.city || '';
      source = city ? 'config' : 'default';
    }
  }

  let url = weatherUrl;
  if (city) {
    url = `${weatherUrl}?city=${encodeURIComponent(city)}`;
  }

  // 命中缓存直接返回（10 分钟 TTL）
  const cacheKey = url;
  const cached = weatherResultCache.get(cacheKey);
  if (cached && Date.now() - cached.at < WEATHER_RESULT_TTL) {
    return res.json({ success: true, data: { ...cached.data, source } });
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
    if (process.env.NODE_ENV !== 'production') {
      console.log('[天气 API] 响应成功', data);
    }

    if (!data.city || !data.weather) {
      throw new Error('API 返回格式错误');
    }

    const standardizedData = {
      city: data.city,
      temp: data.temperature,
      weather: data.weather,
      weatherCode: data.weather_icon,
      humidity: data.humidity,
      wind: data.wind_direction + data.wind_power,
      source
    };

    setWeatherCache(cacheKey, standardizedData);
    res.json({ success: true, data: standardizedData });
  } catch (err) {
    console.error('[天气 API] 错误:', err);
    res.status(500).json({
      success: false,
      message: '获取天气失败，请稍后重试'
    });
  }
});

// ========== 网易云音乐歌单代理 ==========
const musicCache = new Map();
const MUSIC_CACHE_TTL = 10 * 60 * 1000;

app.get('/api/music/playlist', async (req, res) => {
  const id = String(req.query.id || '').trim();
  if (!/^\d{1,20}$/.test(id)) {
    return res.status(400).json({ success: false, message: '非法的歌单 ID' });
  }

  const cached = musicCache.get(id);
  if (cached && Date.now() - cached.at < MUSIC_CACHE_TTL) {
    return res.json({ success: true, data: cached.data });
  }

  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`https://music.163.com/api/playlist/detail?id=${id}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Referer': 'https://music.163.com/'
      },
      timeout: 15000
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const json = await response.json();
    if (json.code !== 200 || !json.result) throw new Error('歌单不存在或获取失败');

    const data = {
      id: json.result.id,
      name: json.result.name,
      cover: json.result.coverImgUrl || '',
      tracks: (json.result.tracks || []).map(t => ({
        id: t.id,
        name: t.name,
        artist: (t.artists || []).map(a => a.name).join(' / '),
        duration: t.duration || 0
      }))
    };
    musicCache.set(id, { data, at: Date.now() });
    res.json({ success: true, data });
  } catch (err) {
    console.error('[音乐] 获取歌单失败:', err.message);
    res.status(500).json({ success: false, message: '获取歌单失败，请检查歌单 ID' });
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

app.use(express.static(path.join(__dirname, '../frontend'), {
  // lib/ 下的第三方库几乎不变，长缓存（immutable）；其余资源每次重新验证
  etag: true,
  maxAge: 0,
  setHeaders: (res, filePath) => {
    // lib/ 第三方库与 fonts/ 字体文件几乎不变，长缓存（immutable）；其余资源每次重新验证
    if (filePath.includes(`${path.sep}lib${path.sep}`) || filePath.includes(`${path.sep}fonts${path.sep}`)) {
      res.set('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      res.set('Cache-Control', 'no-cache');
    }
  }
}));
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

// 全局错误处理（兜底所有 async 路由异常，不泄露堆栈）
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.statusCode || 500;
  if (status >= 500) {
    console.error('[服务器] 未处理异常:', err);
  }
  if (res.headersSent) return;
  res.status(status).json({ success: false, message: status >= 500 ? '服务器内部错误' : err.message });
});

// 确保博客表存在（升级现有部署时自动补表，幂等）
async function ensureArticlesTable() {
  if (!db.isMySQL()) return;
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS __PREFIX__articles (
      id INT NOT NULL AUTO_INCREMENT,
      title VARCHAR(200) NOT NULL,
      content MEDIUMTEXT NOT NULL,
      summary VARCHAR(500) DEFAULT '',
      cover VARCHAR(500) DEFAULT '',
      category VARCHAR(50) DEFAULT '未分类',
      published TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_created_at (created_at),
      KEY idx_published_created (published, created_at, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='博客文章表'`);
    console.log('[数据库] articles 表已就绪');
  } catch (err) {
    console.error('[数据库] articles 表初始化失败:', err.message);
  }
}

// 启动服务器
ensureArticlesTable().then(() => {
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
});
