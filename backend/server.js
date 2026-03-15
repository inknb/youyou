const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

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

// ========== API 路由 ==========

// 获取所有配置
app.get('/api/config', (req, res) => {
  const config = readConfig();
  if (config) {
    res.json({ success: true, data: config });
  } else {
    res.status(500).json({ success: false, message: '读取配置失败' });
  }
});

// 更新网站基本信息
app.post('/api/config/site', (req, res) => {
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
app.post('/api/config/apis', (req, res) => {
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
app.post('/api/config/tags', (req, res) => {
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
app.post('/api/config/links', (req, res) => {
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
app.post('/api/schedule/courses', (req, res) => {
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
app.put('/api/schedule/courses/:id', (req, res) => {
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
app.delete('/api/schedule/courses/:id', (req, res) => {
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
app.post('/api/schedule/events', (req, res) => {
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
app.put('/api/schedule/events/:id', (req, res) => {
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
app.delete('/api/schedule/events/:id', (req, res) => {
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
app.post('/api/activities', (req, res) => {
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
app.put('/api/activities/:id', (req, res) => {
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
app.delete('/api/activities/:id', (req, res) => {
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

// ========== 天气 API 代理 ==========
app.get('/api/weather', async (req, res) => {
  const config = readConfig();
  if (!config || !config.apis?.weather?.enabled) {
    return res.status(400).json({ success: false, message: '天气 API 未启用' });
  }

  const weatherConfig = config.apis.weather;
  let weatherUrl = weatherConfig.url || 'https://wttr.in';

  try {
    // 如果配置的是 wttr.in
    if (weatherUrl.includes('wttr.in')) {
      const city = weatherConfig.city || 'Beijing';
      const format = '?format=j1'; // 返回 JSON 格式
      weatherUrl = `${weatherUrl}/${encodeURIComponent(city)}${format}`;
    } else if (weatherConfig.city && !weatherUrl.includes('?')) {
      // 其他 API，添加城市参数
      weatherUrl = `${weatherUrl}?city=${encodeURIComponent(weatherConfig.city)}`;
    }

    console.log(`[天气 API] 请求地址: ${weatherUrl}`);

    // 使用 node-fetch
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(weatherUrl, {
      headers: {
        'User-Agent': 'curl'
      },
      timeout: 10000
    });

    console.log(`[天气 API] 响应状态: ${response.status}`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`[天气 API] 响应成功`);

    // 标准化数据格式
    const standardizedData = {
      city: data.nearest_area?.[0]?.areaName?.[0]?.value || data.city || weatherConfig.city || '未知',
      temp: data.current_condition?.[0]?.temp_C || data.temp || '0',
      weather: data.current_condition?.[0]?.lang_zh?.[0]?.value ||
               data.current_condition?.[0]?.weatherDesc?.[0]?.value ||
               data.info ||
               getWeatherDescByCode(data.current_condition?.[0]?.weatherCode),
      weatherCode: data.current_condition?.[0]?.weatherCode || '',
      humidity: data.current_condition?.[0]?.humidity || '',
      wind: data.current_condition?.[0]?.windspeedKmph || ''
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
