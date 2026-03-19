#!/bin/bash

# Agent Builder 系统停止脚本

set -e
cd /home/wremote/claude-dev/agent-builder-general

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

echo ""
echo "========================================"
echo "   Agent Builder 系统停止"
echo "========================================"

# 停止后端
if [ -f backend.pid ]; then
    PID=$(cat backend.pid)
    if kill -0 $PID 2>/dev/null; then
        kill $PID
        log_info "后端已停止 (PID: $PID)"
    else
        log_warn "后端进程不存在 (PID: $PID)"
    fi
    rm -f backend.pid
else
    log_warn "backend.pid 不存在"
fi

# 停止前端
if [ -f frontend.pid ]; then
    PID=$(cat frontend.pid)
    if kill -0 $PID 2>/dev/null; then
        kill $PID
        log_info "前端已停止 (PID: $PID)"
    else
        log_warn "前端进程不存在 (PID: $PID)"
    fi
    rm -f frontend.pid
else
    log_warn "frontend.pid 不存在"
fi

# 额外清理：通过端口查找并杀掉进程
for port in 20880 20881; do
    PID=$(lsof -t -i :$port 2>/dev/null || true)
    if [ -n "$PID" ]; then
        kill $PID 2>/dev/null || true
        log_info "清理端口 $port 的进程 (PID: $PID)"
    fi
done

# 停止文档站点
if [ -f docs-site.pid ]; then
    PID=$(cat docs-site.pid)
    if kill -0 $PID 2>/dev/null; then
        kill $PID
        log_info "文档站点已停止 (PID: $PID)"
    else
        log_warn "文档站点进程不存在 (PID: $PID)"
    fi
    rm -f docs-site.pid
fi

# 额外清理：通过端口查找并杀掉 docs-site 进程
PID=$(lsof -t -i :4173 2>/dev/null || true)
if [ -n "$PID" ]; then
    kill $PID 2>/dev/null || true
    log_info "清理端口 4173 的进程 (PID: $PID)"
fi

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
