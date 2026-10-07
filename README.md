# 悠悠个人主页

一个简洁美观、功能完整的个人主页系统，采用「浅色简洁」设计风格（Light Minimal），提供前台展示、后台管理与博客功能，支持 JSON 文件存储和 MySQL 数据库双模式。

## 功能特性

### 前台展示

- **站点标识区** - 站牌式标题（两侧短横线装饰）、按时段变化的问候徽章、天气徽章悬浮于卡片上方
- **每日一言** - 霞鹜文楷艺术字，蓝灰配色，后台可配置多句随机轮换
- **随机二次元图片** - 多 API 源自动切换与优先级配置，换图按钮旋转反馈
- **个人简介** - 自定义头像（或 QQ 头像自动获取，失败自动回退内置头像）、昵称、签名、标签
- **快捷链接** - 社交链接图标，hover 显示品牌色
- **网易云音乐播放器** - 见下方音乐模块
- **最近动态** - 时间线展示
- **博客** - 文章列表与 Markdown 详情页（分类、草稿、阅读时长、上一篇/下一篇）
- **Sakana 挂件** - 桌面宠物装饰（移动端自动隐藏）

### 音乐模块（网易云黑胶会员）

- **真实播放** - 通过本机 Netease_url 解析服务（黑胶会员 Cookie 走官方加密接口）解析真实播放 URL，VIP 歌曲也能播
- **跨页连续播放** - 首页/博客页共享播放器，歌曲与进度写入 localStorage，跳转页面自动恢复
- **卡片歌词预览** - 播放器卡片内实时滚动显示当前句（点击展开完整浮层）
- **歌词浮层** - 居中毛玻璃浮层，LRC 时间轴同步高亮、自动居中滚动、翻译行（tlyric）支持
- **歌单面板** - 点封面展开，可切换曲目，当前曲目高亮 + 跳动音柱
- **自动切歌** - 曲目加载失败（版权/签名失效）自动跳过，防止静默卡死
- **点击播放** - 进入页面只恢复曲目与进度；播放必须点击播放器控件（播放按钮 / 歌单曲目 / 上一首下一首）后才开始

### 后台管理

访问 `/admin` 路径进入管理后台（需登录），功能包括：

- **网站信息配置** - 标题、昵称、简介、自定义头像、Favicon、站点起始日期、一言句子列表
- **API 管理** - 图片 API、一言 API、天气 API 的启用/禁用与优先级
- **标签管理** - 添加/删除个人兴趣标签
- **外链管理** - 自定义社交链接与图标
- **动态管理** - 发布与管理首页动态
- **博客管理** - Markdown 文章发布、分类与草稿管理
- **音乐配置** - 网易云歌单 ID 与播放器开关
- **账户设置** - 修改管理员用户名与密码

### 安装向导

访问 `/install` 路径进入安装向导，支持环境检测、模式选择（JSON/MySQL）、数据库配置、管理员创建与安装锁定。

## 快速开始

### 环境要求

- Node.js 16.17+（使用原生 fetch 与 AbortSignal.timeout）
- npm
- MySQL 5.7+（可选，推荐生产环境使用）

### 方式一：直接运行

```bash
# 安装依赖
cd backend
npm install

# 启动服务
npm start
```

服务默认运行在 `http://localhost:3000`（可用 `backend/.env` 中 `PORT` 覆盖）

### 方式二：安装向导

1. 启动服务后访问 `http://localhost:3000/install`
2. 选择存储模式（JSON 或 MySQL）
3. 按向导完成配置
4. 访问前台或后台开始使用

### 音乐功能部署（可选但推荐）

1. 准备网易云网页版登录 Cookie（黑胶会员最佳），写入 `netease_url/cookie.txt`
2. 安装解析服务依赖并启动（详见 `deploy/README.md`）
3. 后台「网站信息 → 音乐配置」填写歌单 ID 并开启

## 项目结构

```
.
├── backend/                   # 后端服务
│   ├── server.js             # Express 服务器入口（含音乐/歌词代理）
│   ├── db.js                 # 数据库连接管理
│   ├── models/
│   │   └── dataStore.js      # 统一数据访问层（JSON / MySQL 双模式）
│   ├── routes/
│   │   └── install.js        # 安装向导路由
│   ├── data/
│   │   ├── config.json       # JSON 模式数据存储
│   │   └── schema.sql        # MySQL 数据库结构
│   ├── scripts/
│   │   └── migrate.js        # JSON 到 MySQL 数据迁移
│   └── package.json
├── frontend/                 # 前台页面
│   ├── index.html           # 主页
│   ├── blog.html            # 博客页
│   ├── style.css            # 前台样式（浅色简洁主题）
│   ├── blog.css             # 博客页样式
│   ├── app.js               # 主页逻辑
│   ├── blog.js              # 博客页逻辑
│   └── music.js             # 跨页共享音乐播放器 + 歌词引擎
├── admin/                    # 后台管理
│   ├── index.html           # 管理页面（内联样式，与前台同主题）
│   └── admin.js             # 管理逻辑
├── install/                  # 安装向导
├── netease_url/              # 网易云解析服务（黑胶 Cookie 解析真实播放 URL）
│   ├── main.py              # Flask API 服务（监听 127.0.0.1:5000）
│   ├── music_api.py         # 网易云加密接口实现
│   ├── cookie.txt           # 登录 Cookie（不入库，见 .gitignore）
│   └── requirements.txt
├── deploy/                   # 部署脚本与说明
└── README.md
```

## 配置说明

### 存储模式

| 模式 | 说明 | 适用场景 |
|------|------|---------|
| JSON | 数据存储于 JSON 文件 | 开发测试、小型站点 |
| MySQL | 数据存储于 MySQL 数据库 | 生产环境、大型站点 |

### 环境变量（backend/.env）

```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=personal_homepage
DB_PREFIX=hp_
# 音乐解析服务（可选，默认 http://127.0.0.1:5000）
MUSIC_API_URL=http://127.0.0.1:5000
MUSIC_QUALITY=exhigh        # standard / exhigh / lossless / hires
# 跨域白名单（可选，逗号分隔）
CORS_ORIGIN=
```

### 音乐功能说明

- **歌单获取**：`netease_url` 用黑胶 Cookie 走官方加密接口解析单曲播放 URL（VIP 歌曲可播）；后端 `/api/music/playlist` 并行解析并缓存 10 分钟
- **音质**：默认 `exhigh`（320kbps，流式播放平衡）；黑胶会员可改 `lossless`/`hires`（文件更大，加载更慢）
- **Cookie 过期**：解析失败时前端自动跳过该曲；更新 `netease_url/cookie.txt` 后重启解析服务即可
- **播放器位置**：首页融入右列卡片流（简介卡与数据卡之间），博客页位于正文与页脚之间

### 博客文章

- **Markdown** 渲染（marked.js + DOMPurify，XSS 过滤）
- **分类**与**草稿**（草稿仅后台可见）
- 列表分页：`GET /api/blog?page=1&pageSize=10`（pageSize 上限 50）
- 详情页显示**阅读时长**（字数/400 字每分钟）与**上一篇/下一篇**导航

### Sakana 角色

- `chisato` - 千束（右下角）
- `takina` - 泷奈（左下角）

## API 接口

### 公开接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/config` | 获取前台配置 |
| GET | `/api/activities` | 获取动态列表 |
| GET | `/api/blog` | 获取文章列表（分页，匿名仅已发布） |
| GET | `/api/blog/:id` | 获取文章详情（草稿仅后台可见） |
| GET | `/api/weather` | 获取天气信息（按访问者 IP 定位，带缓存） |
| GET | `/api/music/playlist?id=` | 获取歌单（含每首曲目真实播放 URL，10 分钟缓存） |
| GET | `/api/music/lyric?id=` | 获取 LRC 歌词与翻译（10 分钟缓存） |
| GET | `/api/system/info` | 获取数据存储模式 |

### 认证接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 管理员登录（IP 限频 10 次/10 分钟） |
| GET | `/api/auth/verify` | 验证 Token |
| POST | `/api/auth/logout` | 退出登录 |
| POST | `/api/auth/change-password` | 修改密码 |
| POST | `/api/auth/update-account` | 更新账户信息 |

### 管理接口（需认证）

`/api/config/site`、`/api/config/apis`、`/api/config/tags`、`/api/config/links`、`/api/activities`（增删改）、`/api/blog`（增删改）

## 安全设计

- SQL 全参数化，表前缀白名单校验
- Token 使用 `crypto.timingSafeEqual` 恒定时间比较，24 小时过期
- 登录限频 + `trust proxy: 1`（防伪造 X-Forwarded-For 绕过）
- 前端 `escapeHtml` / `sanitizeUrl` / DOMPurify 转义链
- 天气/音乐 API 输入白名单校验，缓存容量上限防内存膨胀
- 解析服务仅监听 `127.0.0.1`，Cookie 不入 git 仓库

## 响应式设计

- 桌面双列瀑布流布局（左右列独立排列，底部自动对齐）
- 移动端单列布局，卡片顺序自适应，间距与字号针对触屏优化
- 键盘焦点可见（`:focus-visible`）、`prefers-reduced-motion` 降级

## 更新日志

### v3.x（当前）

- 全面改版为「浅色简洁」主题，统一前后台视觉语言
- 新增网易云音乐播放器（黑胶会员解析、歌单面板、跨页连续播放、进度持久化）
- 新增歌词功能（卡片歌词预览 + 歌词浮层，LRC 同步高亮、翻译行）
- 新增问候徽章、天气徽章悬浮布局、站点页脚（运行天数）
- 新增阅读时长、上一篇/下一篇博客导航、正文图片懒加载
- 优化移动端排版与触控体验
- 音乐解析服务部署文档（见 deploy/README.md）

### v2.0.0

- 新增 Web 安装向导系统
- 新增 MySQL 数据库支持（双模式）
- 新增自定义头像功能
- 新增宝塔面板一键部署脚本

## 许可证

MIT License

## 作者

悠悠
