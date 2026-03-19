#!/bin/bash
# Langfuse 服务管理脚本

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目根目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

# Docker Compose 文件
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.langfuse.yml"

# 检查 Docker 或 Podman
check_container_runtime() {
    if command -v docker &> /dev/null; then
        RUNTIME="docker"
    elif command -v podman &> /dev/null; then
        RUNTIME="podman"
    else
        echo -e "${RED}错误: 未找到 Docker 或 Podman${NC}"
        exit 1
    fi
    echo -e "${GREEN}使用容器运行时: $RUNTIME${NC}"
}

# 启动服务
start_services() {
    echo -e "${BLUE}启动 Langfuse 服务...${NC}"
    check_container_runtime

    if [ ! -f "$COMPOSE_FILE" ]; then
        echo -e "${RED}错误: 找不到 $COMPOSE_FILE${NC}"
        exit 1
    fi

    $RUNTIME compose -f "$COMPOSE_FILE" up -d

    echo -e "${GREEN}Langfuse 服务正在启动...${NC}"
    echo -e "${YELLOW}请等待 2-3 分钟，然后访问: http://localhost:3000${NC}"
    echo ""
    echo "查看日志: $0 logs"
    echo "检查状态: $0 status"
}

# 停止服务
stop_services() {
    echo -e "${BLUE}停止 Langfuse 服务...${NC}"
    check_container_runtime
    $RUNTIME compose -f "$COMPOSE_FILE" down
    echo -e "${GREEN}Langfuse 服务已停止${NC}"
}

# 查看日志
show_logs() {
    check_container_runtime
    local service="${1:-}"
    if [ -n "$service" ]; then
        $RUNTIME compose -f "$COMPOSE_FILE" logs -f "$service"
    else
        $RUNTIME compose -f "$COMPOSE_FILE" logs -f
    fi
}

# 查看状态
show_status() {
    echo -e "${BLUE}Langfuse 服务状态:${NC}"
    echo ""
    check_container_runtime
    $RUNTIME compose -f "$COMPOSE_FILE" ps

    echo ""
    echo -e "${BLUE}健康检查:${NC}"
    echo -n "Web UI: "
    if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ 正常${NC}"
    else
        echo -e "${RED}✗ 不可用${NC}"
    fi
}

# 重启服务
restart_services() {
    echo -e "${BLUE}重启 Langfuse 服务...${NC}"
    stop_services
    sleep 2
    start_services
}

# 清理数据
clean_data() {
    echo -e "${RED}警告: 此操作将删除所有 Langfuse 数据！${NC}"
    read -p "确认删除? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "取消操作"
        exit 0
    fi

    check_container_runtime
    $RUNTIME compose -f "$COMPOSE_FILE" down -v
    echo -e "${GREEN}数据已清理${NC}"
}

# 初始化配置
init_config() {
    echo -e "${BLUE}初始化 Langfuse 配置...${NC}"

    if [ -f ".env.langfuse" ]; then
        echo -e "${YELLOW}.env.langfuse 已存在${NC}"
        read -p "是否覆盖? (yes/no): " confirm
        if [ "$confirm" != "yes" ]; then
            exit 0
        fi
    fi

    cp .env.langfuse.example .env.langfuse
    echo -e "${GREEN}配置文件已创建: .env.langfuse${NC}"
    echo ""
    echo -e "${YELLOW}下一步:${NC}"
    echo "1. 编辑 .env.langfuse 配置 API Keys"
    echo "2. 运行: $0 start"
}

# 显示帮助
show_help() {
    cat << EOF
Langfuse 服务管理脚本

用法: $0 [命令]

命令:
  start       启动 Langfuse 服务
  stop        停止 Langfuse 服务
  restart     重启 Langfuse 服务
  status      查看服务状态
  logs        查看服务日志 (可指定服务名: logs langfuse-web)
  clean       清理所有数据 (危险!)
  init        初始化配置文件
  help        显示此帮助信息

首次使用:
  1. $0 init    # 创建配置文件
  2. 编辑 .env.langfuse
  3. $0 start   # 启动服务
  4. 访问 http://localhost:3000

服务端口:
  - 3000: Langfuse Web UI
  - 5432: PostgreSQL
  - 8123: ClickHouse HTTP
  - 9000: ClickHouse Native
  - 6379: Redis
  - 9000: MinIO API
  - 9001: MinIO Console

EOF
}

# 主函数
main() {
    case "${1:-help}" in
        start)
            start_services
            ;;
        stop)
            stop_services
            ;;
        restart)
            restart_services
            ;;
        status)
            show_status
            ;;
        logs)
            show_logs "${2:-}"
            ;;
        clean)
            clean_data
            ;;
        init)
            init_config
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            echo -e "${RED}未知命令: $1${NC}"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

main "$@"
