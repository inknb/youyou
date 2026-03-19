# 宝塔面板部署指南

## 一键部署说明

### 脚本功能

一键部署脚本会自动完成以下操作：
- 检查服务器环境（Node.js、npm、PM2）
- 创建项目目录
- 安装项目依赖
- 生成环境配置文件
- 配置 PM2 进程守护
- 配置 Nginx 反向代理（需要手动确认）

### 前提条件

在运行脚本前，请确保：

1. **已安装宝塔面板**（推荐 7.x 或更高版本）

2. **已安装 Node.js**
   ```
   宝塔面板 → 软件商店 → 搜索 "Node版本管理器" → 安装
   → 点击设置 → 安装 Node.js 18.x
   ```

3. **已安装 PM2 管理器**
   ```
   宝塔面板 → 软件商店 → 搜索 "PM2管理器" → 安装
   ```

4. **（可选）已安装 MySQL**
   ```
   宝塔面板 → 软件商店 → 搜索 "MySQL" → 安装
   ```

---

## 部署方式

### 方式一：快速安装（推荐）

**适用于：已上传项目文件到服务器**

1. **上传项目文件**
   - 将整个项目上传到服务器，例如：`/www/wwwroot/youyou-homepage`

2. **运行快速安装脚本**
   ```bash
   cd /www/wwwroot/youyou-homepage
   bash deploy/bt-quick-deploy.sh
   ```

3. **配置 Nginx**
   - 宝塔面板 → 网站 → 添加站点
   - 点击站点设置 → 反向代理 → 添加反向代理
   - 目标URL：`http://127.0.0.1:3000`

4. **完成安装**
   - 访问你的域名，按向导完成安装

---

### 方式二：完整部署脚本

**适用于：脚本和项目在同一服务器**

1. **修改配置**
   ```bash
   # 编辑 deploy/bt-deploy.sh
   # 修改以下变量：
   DOMAIN="yourdomain.com"        # 你的域名
   STORAGE_MODE="json"            # 或 "mysql"
   MYSQL_USER="xxx"               # MySQL 用户名（mysql 模式）
   MYSQL_PASSWORD="xxx"           # MySQL 密码
   MYSQL_DATABASE="youyou_homepage"  # 数据库名
   ```

2. **运行脚本**
   ```bash
   chmod +x deploy/bt-deploy.sh
   bash deploy/bt-deploy.sh
   ```

---

## 手动部署步骤

如果一键脚本无法正常工作，可以按以下步骤手动部署：

### 1. 上传文件

```
/www/wwwroot/youyou-homepage/
├── backend/
│   ├── server.js
│   ├── db.js
│   ├── package.json
│   ├── routes/
│   ├── models/
│   └── data/
├── frontend/
├── admin/
└── install/
```

### 2. 安装依赖

```bash
cd /www/wwwroot/youyou-homepage/backend
npm install --production
```

### 3. 设置权限

```bash
chmod -R 755 /www/wwwroot/youyou-homepage
chown -R www:www /www/wwwroot/youyou-homepage
```

### 4. 启动服务

```bash
cd /www/wwwroot/youyou-homepage/backend
pm2 start server.js --name youyou-homepage
pm2 save
```

### 5. 配置 Nginx

在宝塔面板添加网站后，配置反向代理：

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_cache_bypass $http_upgrade;
}
```

### 6. 完成安装

访问域名，按安装向导完成配置。

---

## 常见问题

### Q: 脚本提示 "Node.js 未安装"

**A:** 在宝塔面板安装 Node版本管理器，然后通过它安装 Node.js

### Q: 端口 3000 无法访问

**A:**
1. 检查 PM2 进程状态：`pm2 status`
2. 如果使用反向代理，无需开放 3000 端口
3. 如需直接访问，在宝塔安全设置中放行端口

### Q: 如何配置 HTTPS

**A:**
1. 宝塔面板 → 网站 → 点击站点 → SSL
2. 选择 Let's Encrypt 免费证书
3. 申请并部署
4. 开启 "强制HTTPS"

### Q: 如何更新项目

**A:**
```bash
cd /www/wwwroot/youyou-homepage
# 上传新文件后
pm2 restart youyou-homepage
```

### Q: 如何查看日志

**A:**
```bash
pm2 logs youyou-homepage
# 或
tail -f /www/wwwroot/youyou-homepage/logs/error.log
```

---

## 常用命令

```bash
# 查看服务状态
pm2 status

# 查看日志
pm2 logs youyou-homepage

# 重启服务
pm2 restart youyou-homepage

# 停止服务
pm2 stop youyou-homepage

# 重新加载（无停机）
pm2 reload youyou-homepage

# 查看详细信息
pm2 describe youyou-homepage
```
