#!/bin/bash
#
# 悠悠个人主页 - 宝塔快速安装脚本
# 适用于已上传项目文件的情况
#
# 使用方法:
# 1. 将整个项目上传到服务器，例如 /www/wwwroot/youyou-homepage
# 2. 进入项目目录: cd /www/wwwroot/youyou-homepage
# 3. 运行: bash deploy/bt-quick-deploy.sh
#

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 项目名称
PROJECT_NAME="youyou-homepage"
PORT=3000

# 获取项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"

echo -e "${BLUE}=========================================${NC}"
echo -e "${GREEN}    悠悠个人主页 - 快速安装脚本${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""
echo "项目目录: $PROJECT_ROOT"
echo "后端目录: $BACKEND_DIR"
echo "运行端口: $PORT"
echo ""

# 1. 检查环境
echo -e "${YELLOW}[1/5] 检查环境...${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}错误: Node.js 未安装${NC}"
    echo "请在宝塔面板 -> 软件商店 -> 安装 'Node版本管理器'"
    exit 1
fi

echo "  Node.js: $(node -v)"
echo "  npm: $(npm -v)"

# 2. 安装依赖
echo -e "${YELLOW}[2/5] 安装依赖...${NC}"

cd "$BACKEND_DIR"
npm config set registry https://registry.npmmirror.com
npm install --production

# 3. 设置权限
echo -e "${YELLOW}[3/5] 设置权限...${NC}"

chmod -R 755 "$BACKEND_DIR/data"
chown -R www:www "$PROJECT_ROOT" 2>/dev/null || true

# 4. 配置 PM2
echo -e "${YELLOW}[4/5] 配置 PM2...${NC}"

# 检查 PM2
if ! command -v pm2 &> /dev/null; then
    echo "  正在安装 PM2..."
    npm install -g pm2
fi

# 停止旧进程
pm2 delete $PROJECT_NAME 2>/dev/null || true

# 启动新进程
pm2 start server.js --name $PROJECT_NAME
pm2 save

echo "  PM2 进程已启动"

# 5. 显示结果
echo -e "${YELLOW}[5/5] 完成！${NC}"
echo ""

pm2 status

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}           安装完成！${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "下一步操作:"
echo ""
echo "  1. 在宝塔面板添加网站，配置 Nginx 反向代理:"
echo "     目标URL: http://127.0.0.1:${PORT}"
echo ""
echo "  2. 或手动配置 Nginx，在 server {} 块中添加:"
echo ""
echo "     location / {"
echo "         proxy_pass http://127.0.0.1:${PORT};"
echo "         proxy_http_version 1.1;"
echo "         proxy_set_header Host \$host;"
echo "         proxy_set_header X-Real-IP \$remote_addr;"
echo "         proxy_set_header Upgrade \$http_upgrade;"
echo "         proxy_set_header Connection 'upgrade';"
echo "     }"
echo ""
echo "  3. 访问网站完成安装向导"
echo ""
echo "常用命令:"
echo "  查看状态: pm2 status"
echo "  查看日志: pm2 logs $PROJECT_NAME"
echo "  重启服务: pm2 restart $PROJECT_NAME"
echo ""
