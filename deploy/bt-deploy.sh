#!/bin/bash
#
# 悠悠个人主页 - 宝塔面板一键部署脚本
# 使用方法: bash bt-deploy.sh
#
# 前提条件：
# 1. 已安装宝塔面板
# 2. 已安装 Node版本管理器 (并通过它安装了 Node.js 16+)
# 3. 已安装 PM2管理器
# 4. (可选) 已安装 MySQL，如需使用数据库模式
#

set -e

# ==================== 配置区域 ====================

# 项目名称
PROJECT_NAME="youyou-homepage"

# 安装目录
INSTALL_DIR="/www/wwwroot/${PROJECT_NAME}"

# 端口
PORT=3000

# 域名（请修改为你的域名）
DOMAIN="yourdomain.com"

# 存储模式: json 或 mysql
STORAGE_MODE="json"

# MySQL 配置（仅 mysql 模式需要）
MYSQL_HOST="localhost"
MYSQL_PORT=3306
MYSQL_USER=""
MYSQL_PASSWORD=""
MYSQL_DATABASE="youyou_homepage"

# ==================== 颜色定义 ====================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ==================== 工具函数 ====================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_command() {
    if ! command -v $1 &> /dev/null; then
        return 1
    fi
    return 0
}

# ==================== 环境检查 ====================

check_environment() {
    log_info "检查服务器环境..."

    # 检查 Node.js
    if ! check_command node; then
        log_error "Node.js 未安装！"
        log_info "请在宝塔面板 -> 软件商店 -> 安装 'Node版本管理器'，然后通过它安装 Node.js"
        exit 1
    fi

    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 14 ]; then
        log_error "Node.js 版本过低 (当前: $(node -v))，需要 14.x 或更高版本"
        exit 1
    fi
    log_success "Node.js 版本: $(node -v)"

    # 检查 npm
    if ! check_command npm; then
        log_error "npm 未安装！"
        exit 1
    fi
    log_success "npm 版本: $(npm -v)"

    # 检查 PM2
    if ! check_command pm2; then
        log_warning "PM2 未安装，正在安装..."
        npm install -g pm2
        if [ $? -ne 0 ]; then
            log_error "PM2 安装失败！请在宝塔面板安装 'PM2管理器'"
            exit 1
        fi
    fi
    log_success "PM2 版本: $(pm2 -v)"

    # 检查 MySQL（如果需要）
    if [ "$STORAGE_MODE" == "mysql" ]; then
        if ! check_command mysql; then
            log_warning "MySQL 客户端未找到，如果使用数据库模式请确保 MySQL 已安装"
        fi
    fi

    log_success "环境检查通过！"
}

# ==================== 创建目录结构 ====================

create_directories() {
    log_info "创建项目目录..."

    # 创建主目录
    mkdir -p "$INSTALL_DIR"

    # 创建子目录
    mkdir -p "$INSTALL_DIR/backend/data"
    mkdir -p "$INSTALL_DIR/backend/routes"
    mkdir -p "$INSTALL_DIR/backend/models"
    mkdir -p "$INSTALL_DIR/frontend"
    mkdir -p "$INSTALL_DIR/admin"
    mkdir -p "$INSTALL_DIR/install"
    mkdir -p "$INSTALL_DIR/logs"

    # 设置权限
    chmod -R 755 "$INSTALL_DIR"
    chown -R www:www "$INSTALL_DIR"

    log_success "目录创建完成: $INSTALL_DIR"
}

# ==================== 复制项目文件 ====================

copy_files() {
    log_info "复制项目文件..."

    # 获取脚本所在目录
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

    # 复制后端文件
    if [ -d "$PROJECT_ROOT/backend" ]; then
        cp -r "$PROJECT_ROOT/backend/server.js" "$INSTALL_DIR/backend/"
        cp -r "$PROJECT_ROOT/backend/db.js" "$INSTALL_DIR/backend/"
        cp -r "$PROJECT_ROOT/backend/package.json" "$INSTALL_DIR/backend/"
        cp -r "$PROJECT_ROOT/backend/routes/"* "$INSTALL_DIR/backend/routes/" 2>/dev/null || true
        cp -r "$PROJECT_ROOT/backend/models/"* "$INSTALL_DIR/backend/models/" 2>/dev/null || true
        cp -r "$PROJECT_ROOT/backend/data/"* "$INSTALL_DIR/backend/data/" 2>/dev/null || true
    else
        log_error "找不到后端文件目录"
        exit 1
    fi

    # 复制前端文件
    if [ -d "$PROJECT_ROOT/frontend" ]; then
        cp -r "$PROJECT_ROOT/frontend/"* "$INSTALL_DIR/frontend/"
    fi

    # 复制管理后台文件
    if [ -d "$PROJECT_ROOT/admin" ]; then
        cp -r "$PROJECT_ROOT/admin/"* "$INSTALL_DIR/admin/"
    fi

    # 复制安装向导文件
    if [ -d "$PROJECT_ROOT/install" ]; then
        cp -r "$PROJECT_ROOT/install/"* "$INSTALL_DIR/install/"
    fi

    log_success "项目文件复制完成"
}

# ==================== 安装依赖 ====================

install_dependencies() {
    log_info "安装项目依赖..."

    cd "$INSTALL_DIR/backend"

    # 设置 npm 淘宝镜像
    npm config set registry https://registry.npmmirror.com

    # 安装依赖
    npm install --production

    if [ $? -ne 0 ]; then
        log_error "依赖安装失败！"
        exit 1
    fi

    log_success "依赖安装完成"
}

# ==================== 生成环境配置 ====================

generate_env() {
    log_info "生成环境配置文件..."

    cd "$INSTALL_DIR/backend"

    # 生成随机密钥
    SESSION_SECRET=$(openssl rand -hex 32)

    if [ "$STORAGE_MODE" == "mysql" ]; then
        cat > .env << EOF
# 悠悠个人主页环境配置文件
# 由部署脚本自动生成

# 服务器配置
PORT=${PORT}
NODE_ENV=production

# 数据库配置
DB_HOST=${MYSQL_HOST}
DB_PORT=${MYSQL_PORT}
DB_USER=${MYSQL_USER}
DB_PASSWORD=${MYSQL_PASSWORD}
DB_NAME=${MYSQL_DATABASE}
DB_PREFIX=
DB_CHARSET=utf8mb4

# 存储模式
STORAGE_MODE=mysql

# 安全配置
SESSION_SECRET=${SESSION_SECRET}

# 安装状态
INSTALL_LOCK=false
INSTALL_TIME=$(date -Iseconds)
EOF
    else
        cat > .env << EOF
# 悠悠个人主页环境配置文件
# 由部署脚本自动生成

# 服务器配置
PORT=${PORT}
NODE_ENV=production

# 存储模式
STORAGE_MODE=json

# 安全配置
SESSION_SECRET=${SESSION_SECRET}

# 安装状态
INSTALL_LOCK=false
INSTALL_TIME=$(date -Iseconds)
EOF
    fi

    log_success "配置文件生成完成"
}

# ==================== 创建 MySQL 数据库 ====================

create_mysql_database() {
    if [ "$STORAGE_MODE" == "mysql" ] && [ -n "$MYSQL_USER" ] && [ -n "$MYSQL_PASSWORD" ]; then
        log_info "创建 MySQL 数据库..."

        mysql -u root -p"${MYSQL_ROOT_PASSWORD:-}" -e "CREATE DATABASE IF NOT EXISTS \`${MYSQL_DATABASE}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null || {
            log_warning "无法自动创建数据库，请手动创建或确保数据库已存在"
        }

        log_success "数据库准备完成"
    fi
}

# ==================== 配置 PM2 ====================

setup_pm2() {
    log_info "配置 PM2 进程守护..."

    cd "$INSTALL_DIR/backend"

    # 停止旧进程（如果存在）
    pm2 delete $PROJECT_NAME 2>/dev/null || true

    # 启动新进程
    pm2 start server.js --name $PROJECT_NAME

    # 保存 PM2 配置
    pm2 save

    # 设置开机自启
    pm2 startup | tail -n 1 | bash 2>/dev/null || true

    log_success "PM2 配置完成"
}

# ==================== 配置 Nginx ====================

setup_nginx() {
    log_info "配置 Nginx 反向代理..."

    NGINX_CONF="/www/server/panel/vhost/nginx/${DOMAIN}.conf"

    if [ ! -f "$NGINX_CONF" ]; then
        log_warning "未找到域名配置文件，请先在宝塔面板添加网站"
        log_info "手动配置方法："
        log_info "1. 宝塔面板 -> 网站 -> 点击站点 -> 反向代理 -> 添加反向代理"
        log_info "2. 目标URL: http://127.0.0.1:${PORT}"
        return
    fi

    # 检查是否已配置反向代理
    if grep -q "proxy_pass http://127.0.0.1:${PORT}" "$NGINX_CONF"; then
        log_success "Nginx 反向代理已配置"
        return
    fi

    # 添加反向代理配置
    PROXY_CONF="
    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_cache_bypass \$http_upgrade;
    }
"

    # 在 server 块中插入配置（简化处理，实际需要更复杂的逻辑）
    log_warning "请手动在 Nginx 配置中添加以下内容："
    echo "$PROXY_CONF"

    # 重载 Nginx
    # nginx -t && nginx -s reload

    log_info "Nginx 配置完成，请手动重载: nginx -s reload"
}

# ==================== 设置防火墙 ====================

setup_firewall() {
    log_info "检查防火墙设置..."

    # 如果使用宝塔防火墙
    if [ -f "/www/server/panel/data/firewall.db" ]; then
        log_info "如需直接访问端口 ${PORT}，请在宝塔面板 -> 安全 -> 防火墙中放行"
    fi

    log_info "建议使用 Nginx 反向代理，无需放行 ${PORT} 端口"
}

# ==================== 显示完成信息 ====================

show_complete() {
    echo ""
    echo "=========================================="
    echo -e "${GREEN}        部署完成！${NC}"
    echo "=========================================="
    echo ""
    echo "项目名称: $PROJECT_NAME"
    echo "安装目录: $INSTALL_DIR"
    echo "运行端口: $PORT"
    echo "存储模式: $STORAGE_MODE"
    echo ""
    echo "访问地址:"
    echo "  - 前台: http://${DOMAIN}"
    echo "  - 后台: http://${DOMAIN}/admin"
    echo "  - 安装: http://${DOMAIN}/install"
    echo ""
    echo "常用命令:"
    echo "  - 查看状态: pm2 status $PROJECT_NAME"
    echo "  - 查看日志: pm2 logs $PROJECT_NAME"
    echo "  - 重启服务: pm2 restart $PROJECT_NAME"
    echo "  - 停止服务: pm2 stop $PROJECT_NAME"
    echo ""
    echo "下一步操作:"
    echo "  1. 访问 http://${DOMAIN}/install 完成安装向导"
    echo "  2. 配置 SSL 证书（推荐）"
    echo "  3. 删除安装目录以增强安全性（可选）"
    echo ""
    log_success "部署脚本执行完毕！"
}

# ==================== 主函数 ====================

main() {
    echo ""
    echo "=========================================="
    echo "   悠悠个人主页 - 宝塔一键部署脚本"
    echo "=========================================="
    echo ""

    # 检查是否为 root 用户
    if [ "$EUID" -ne 0 ]; then
        log_warning "建议使用 root 用户执行此脚本"
    fi

    # 执行部署步骤
    check_environment
    create_directories
    copy_files
    install_dependencies
    generate_env
    create_mysql_database
    setup_pm2
    setup_nginx
    setup_firewall
    show_complete
}

# 运行主函数
main "$@"
