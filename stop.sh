#!/bin/bash

# Agent Builder 系统停止脚本
# 用法: ./stop.sh [--force]

set -e
cd /home/wremote/claude-dev/agent-builder-general

# 参数解析
FORCE_MODE=false
for arg in "$@"; do
    case $arg in
        --force|-f) FORCE_MODE=true ;;
    esac
done

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

# 停止进程（支持强制模式）
stop_process() {
    local pid=$1
    local name=$2
    if kill -0 $pid 2>/dev/null; then
        kill $pid 2>/dev/null || true
        sleep 1
        # 检查是否还在运行
        if kill -0 $pid 2>/dev/null; then
            if [ "$FORCE_MODE" = true ]; then
                log_warn "$name 未响应 SIGTERM，强制终止 (PID: $pid)"
                kill -9 $pid 2>/dev/null || true
            else
                log_warn "$name 未响应 SIGTERM (使用 --force 强制终止)"
            fi
        fi
        log_info "$name 已停止 (PID: $pid)"
    else
        log_warn "$name 进程不存在 (PID: $pid)"
    fi
}

# 通过端口清理进程
cleanup_port() {
    local port=$1
    local pid=$(lsof -t -i :$port 2>/dev/null || true)
    if [ -n "$pid" ]; then
        kill $pid 2>/dev/null || true
        sleep 1
        # 检查是否还在运行
        if lsof -i :$port > /dev/null 2>&1; then
            if [ "$FORCE_MODE" = true ]; then
                pid=$(lsof -t -i :$port 2>/dev/null || true)
                kill -9 $pid 2>/dev/null || true
                log_info "强制清理端口 $port (PID: $pid)"
            else
                log_warn "端口 $port 进程未响应 (使用 --force 强制终止)"
            fi
        else
            log_info "清理端口 $port 的进程 (PID: $pid)"
        fi
    fi
}

echo ""
echo "========================================"
echo "   Agent Builder 系统停止"
if [ "$FORCE_MODE" = true ]; then
    echo "   [强制模式: 已启用]"
fi
echo "========================================"

# 停止后端
if [ -f backend.pid ]; then
    stop_process $(cat backend.pid) "后端"
    rm -f backend.pid
else
    log_warn "backend.pid 不存在"
fi

# 停止前端
if [ -f frontend.pid ]; then
    stop_process $(cat frontend.pid) "前端"
    rm -f frontend.pid
else
    log_warn "frontend.pid 不存在"
fi

# 额外清理：通过端口查找并杀掉进程
for port in 20880 20881; do
    cleanup_port $port
done

# 停止文档站点
if [ -f docs-site.pid ]; then
    stop_process $(cat docs-site.pid) "文档站点"
    rm -f docs-site.pid
fi

# 额外清理：通过端口查找并杀掉 docs-site 进程
cleanup_port 4173

# 停止 Langfuse 可观测性服务
echo ""
log_info "停止 Langfuse 可观测性服务..."
if [ -f "docker-compose.langfuse.yml" ]; then
    if docker compose version &> /dev/null; then
        docker compose -f docker-compose.langfuse.yml down 2>/dev/null || true
    elif command -v docker-compose &> /dev/null; then
        docker-compose -f docker-compose.langfuse.yml down 2>/dev/null || true
    fi
    log_info "Langfuse 服务已停止"
else
    log_warn "docker-compose.langfuse.yml 不存在，跳过 Langfuse 停止"
fi

echo ""
log_info "系统已完全停止"
echo "========================================"
