# 悠悠个人主页

一个功能完整的个人主页系统，提供前台展示与后台管理功能，支持日程管理、外链管理、动态发布等模块。

## 功能特性

### 前台展示

- 随机二次元图片 - 支持多 API 源自动切换与优先级配置
- QQ 信息展示 - 自动获取 QQ 头像、昵称、个性签名
- 个人标签 - 展示兴趣爱好标签
- 外链入口 - 社交媒体与项目链接
- 日程提醒 - 实时显示当前课程或个人日程
- 天气显示 - 基于 IP 自动定位或手动配置城市
- Sakana 挂件 - 桌面宠物装饰（移动端自动隐藏）

### 后台管理

访问 `/admin` 路径进入管理后台（需登录），功能包括：

- 网站信息配置 - 标题、昵称、简介、Favicon 等
- API 管理 - 图片 API、一言 API、天气 API 的启用/禁用与优先级
- 标签管理 - 添加/删除个人兴趣标签
- 外链管理 - 自定义社交链接与图标
- 日程管理 - 课程表与个人日程的增删改
- 动态管理 - 发布与管理首页动态
- 账户设置 - 修改管理员用户名与密码

## 快速开始

### 环境要求

- Node.js 14.x 或更高版本
- npm 或 yarn

### 安装依赖

```bash
cd backend
npm install
```

### 启动服务

```bash
npm start
```

服务默认运行在 `http://localhost:3000`

### 访问地址

- 前台页面：http://localhost:3000
- 后台管理：http://localhost:3000/admin

默认管理员账号（可在 `backend/data/config.json` 中修改）：
- 用户名：3199169587
- 密码：123456

## 项目结构

```
.
├── backend/                 # 后端服务
│   ├── server.js           # Express 服务器入口
│   ├── data/
│   │   └── config.json     # 配置与数据存储
│   ├── routes/             # API 路由
│   ├── views/              # 视图文件
│   └── package.json
├── frontend/               # 前台页面
│   ├── index.html         # 主页结构
│   ├── style.css          # 前台样式
│   └── app.js             # 前台逻辑
├── admin/                  # 后台管理
│   ├── index.html         # 管理页面结构
│   └── admin.js            # 管理逻辑
└── README.md
```

## 配置说明

所有配置均通过后台管理界面进行修改，数据存储于 `backend/data/config.json`。

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

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | 原生 HTML/CSS/JavaScript |
| 后端 | Node.js + Express |
| 数据存储 | JSON 文件 |
| 认证 | Token + MD5 加密 |
| 挂件 | Sakana Widget 2.3.0 |

## API 接口

### 公开接口

- `GET /api/config` - 获取前台配置
- `GET /api/schedule` - 获取日程数据
- `GET /api/activities` - 获取动态列表
- `GET /api/weather` - 获取天气信息

### 认证接口

- `POST /api/auth/login` - 管理员登录
- `GET /api/auth/verify` - 验证 Token
- `POST /api/auth/logout` - 退出登录
- `POST /api/auth/change-password` - 修改密码
- `POST /api/auth/update-account` - 更新账户信息

### 配置接口（需认证）

- `POST /api/config/site` - 更新网站信息
- `POST /api/config/apis` - 更新 API 配置
- `POST /api/config/tags` - 更新标签
- `POST /api/config/links` - 更新外链

### 日程接口（需认证）

- `POST /api/schedule/courses` - 添加课程
- `PUT /api/schedule/courses/:id` - 更新课程
- `DELETE /api/schedule/courses/:id` - 删除课程
- `POST /api/schedule/events` - 添加日程
- `PUT /api/schedule/events/:id` - 更新日程
- `DELETE /api/schedule/events/:id` - 删除日程

### 动态接口（需认证）

- `POST /api/activities` - 添加动态
- `PUT /api/activities/:id` - 更新动态
- `DELETE /api/activities/:id` - 删除动态

## 响应式设计

- 支持桌面端、平板、手机多端适配
- 移动端自动隐藏装饰性挂件
- 布局自动适应屏幕尺寸

## 后续计划

- [ ] 多用户支持
- [ ] 数据库支持（SQLite/MongoDB）
- [ ] 主题切换功能
- [ ] 访客统计
- [ ] 评论系统
- [ ] 搜索功能

## 许可证

MIT License

## 作者

悠悠
