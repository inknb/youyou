# 悠悠个人主页

一个简洁美观、功能完整的个人主页系统，采用 Flutter/Material Design 风格设计，提供前台展示与后台管理功能，支持 JSON 文件存储和 MySQL 数据库双模式。

## 功能特性

### 前台展示

- **随机二次元图片** - 支持多 API 源自动切换与优先级配置
- **头像展示** - 支持自定义头像或 QQ 头像 API 自动获取
- **QQ 信息展示** - 自动获取昵称、个性签名
- **每日一言** - 多 API 源随机展示励志语句
- **个人标签** - 展示兴趣爱好标签
- **外链入口** - 社交媒体与项目链接
- **日程提醒** - 实时显示当前课程或个人日程
- **天气显示** - 基于 IP 自动定位或手动配置城市
- **Sakana 挂件** - 桌面宠物装饰（移动端自动隐藏）

### 后台管理

访问 `/admin` 路径进入管理后台（需登录），功能包括：

- **网站信息配置** - 标题、昵称、简介、自定义头像、Favicon 等
- **API 管理** - 图片 API、一言 API、天气 API 的启用/禁用与优先级
- **标签管理** - 添加/删除个人兴趣标签
- **外链管理** - 自定义社交链接与图标
- **日程管理** - 课程表与个人日程的增删改
- **动态管理** - 发布与管理首页动态
- **账户设置** - 修改管理员用户名与密码

### 安装向导

访问 `/install` 路径进入安装向导，支持：

- **环境检测** - 自动检测运行环境
- **模式选择** - JSON 文件存储或 MySQL 数据库
- **数据库配置** - MySQL 连接测试与初始化
- **管理员创建** - 初始管理员账户设置
- **安装锁定** - 防止重复安装

## 快速开始

### 环境要求

- Node.js 14.x 或更高版本
- npm 或 yarn
- MySQL 5.7+（可选，推荐生产环境使用）

### 方式一：直接运行

```bash
# 安装依赖
cd backend
npm install

# 启动服务
npm start
```

服务默认运行在 `http://localhost:3000`

### 方式二：安装向导

1. 启动服务后访问 `http://localhost:3000/install`
2. 选择存储模式（JSON 或 MySQL）
3. 按向导完成配置
4. 访问前台或后台开始使用

### 默认账号

JSON 模式默认管理员账号（可在 `backend/data/config.json` 中修改）：
- 用户名：`admin`
- 密码：`123456`

## 项目结构

```
.
├── backend/                   # 后端服务
│   ├── server.js             # Express 服务器入口
│   ├── db.js                 # 数据库连接管理
│   ├── models/
│   │   └── dataStore.js      # 统一数据访问层
│   ├── routes/
│   │   └── install.js        # 安装向导路由
│   ├── data/
│   │   ├── config.json       # JSON 模式数据存储
│   │   └── schema.sql        # MySQL 数据库结构
│   ├── scripts/
│   │   └── migrate.js        # JSON 到 MySQL 数据迁移
│   └── package.json
├── frontend/                 # 前台页面
│   ├── index.html           # 主页结构
│   ├── style.css            # 前台样式
│   └── app.js               # 前台逻辑
├── admin/                    # 后台管理
│   ├── index.html           # 管理页面结构
│   └── admin.js             # 管理逻辑
├── install/                  # 安装向导
│   ├── index.html           # 安装页面
│   ├── style.css            # 安装页面样式
│   └── install.js           # 安装逻辑
├── deploy/                   # 部署脚本
│   ├── bt-deploy.sh         # 宝塔完整部署脚本
│   ├── bt-quick-deploy.sh   # 宝塔快速部署脚本
│   └── README.md            # 部署说明
└── README.md
```

## 配置说明

### 存储模式

| 模式 | 说明 | 适用场景 |
|------|------|---------|
| JSON | 数据存储于 JSON 文件 | 开发测试、小型站点 |
| MySQL | 数据存储于 MySQL 数据库 | 生产环境、大型站点 |

### 环境变量

创建 `backend/.env` 文件配置 MySQL 连接：

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=personal_homepage
DB_PREFIX=hp_
```

### 日程类型

| 类型标识 | 说明 |
|---------|------|
| course | 课程 |
| hobby | 兴趣爱好 |
| project | 项目开发 |
| study | 学习 |
| other | 其他 |

### Sakana 角色

- `chisato` - 千束（右下角）
- `takina` - 泷奈（左下角）

## 部署指南

### 宝塔面板部署

项目提供了宝塔面板一键部署脚本：

```bash
# 下载部署脚本
wget https://your-domain/deploy/bt-quick-deploy.sh

# 执行部署
chmod +x bt-quick-deploy.sh
./bt-quick-deploy.sh
```

详细部署说明请参考 [deploy/README.md](deploy/README.md)

### PM2 进程管理

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
cd backend
pm2 start server.js --name "personal-homepage"

# 设置开机自启
pm2 save
pm2 startup
```

### Nginx 反向代理

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | 原生 HTML/CSS/JavaScript |
| 后端 | Node.js + Express |
| 数据存储 | JSON 文件 / MySQL |
| 认证 | Token + MD5 加密 |
| 挂件 | Sakana Widget 2.3.0 |
| 设计风格 | Flutter / Material Design |

## API 接口

### 公开接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/config` | 获取前台配置 |
| GET | `/api/schedule` | 获取日程数据 |
| GET | `/api/activities` | 获取动态列表 |
| GET | `/api/weather` | 获取天气信息 |

### 认证接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 管理员登录 |
| GET | `/api/auth/verify` | 验证 Token |
| POST | `/api/auth/logout` | 退出登录 |
| POST | `/api/auth/update-account` | 更新账户信息 |

### 配置接口（需认证）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/config/site` | 更新网站信息 |
| POST | `/api/config/apis` | 更新 API 配置 |
| POST | `/api/config/tags` | 更新标签 |
| POST | `/api/config/links` | 更新外链 |

### 日程接口（需认证）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/schedule/courses` | 添加课程 |
| PUT | `/api/schedule/courses/:id` | 更新课程 |
| DELETE | `/api/schedule/courses/:id` | 删除课程 |
| POST | `/api/schedule/events` | 添加日程 |
| PUT | `/api/schedule/events/:id` | 更新日程 |
| DELETE | `/api/schedule/events/:id` | 删除日程 |

### 动态接口（需认证）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/activities` | 添加动态 |
| PUT | `/api/activities/:id` | 更新动态 |
| DELETE | `/api/activities/:id` | 删除动态 |

## 响应式设计

- 支持桌面端、平板、手机多端适配
- 移动端自动隐藏装饰性挂件
- 布局自动适应屏幕尺寸
- 统一的 Flutter/Material Design 风格

## 更新日志

### v2.0.0

- 新增 Web 安装向导系统
- 新增 MySQL 数据库支持（双模式）
- 新增自定义头像功能
- 新增宝塔面板一键部署脚本
- 优化 UI 风格，统一采用 Flutter/Material Design
- 修复若干已知问题

## 许可证

MIT License

## 作者

悠悠
