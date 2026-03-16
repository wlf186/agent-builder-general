#!/bin/bash

# Agent Builder 系统启动脚本
# 用法: ./start.sh [--skip-deps]

set -e
cd /home/wremote/claude-dev/agent-builder-general

BACKEND_PORT=20881
FRONTEND_PORT=20880

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 检查端口是否被占用
check_port() {
    local port=$1
    if lsof -i :$port > /dev/null 2>&1; then
        return 0  # 端口被占用
    fi
    return 1  # 端口空闲
}

# 等待服务启动
wait_for_service() {
    local port=$1
    local name=$2
    local max_wait=15
    local count=0

    while [ $count -lt $max_wait ]; do
        if curl -s "http://localhost:$port" > /dev/null 2>&1; then
            return 0
        fi
        sleep 1
        ((count++))
    done
    return 1
}

# 启动后端
start_backend() {
    log_info "启动后端服务..."

    # 检查虚拟环境
    if [ ! -d ".venv" ]; then
        log_error "虚拟环境不存在，请先运行: python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt"
        exit 1
    fi

    # 检查端口
    if check_port $BACKEND_PORT; then
        log_warn "后端端口 $BACKEND_PORT 已被占用"
        return 0
    fi

    # 启动后端
    source .venv/bin/activate
    nohup python backend.py > backend.log 2>&1 &
    echo $! > backend.pid
    log_info "后端 PID: $(cat backend.pid)"

    # 等待启动
    if wait_for_service $BACKEND_PORT "后端"; then
        log_info "后端启动成功 (http://localhost:$BACKEND_PORT)"
    else
        log_error "后端启动超时，请检查 backend.log"
        exit 1
    fi
}

# 启动前端
start_frontend() {
    log_info "启动前端服务..."

    cd frontend

    # 检查依赖
    if [ ! -d "node_modules" ]; then
        if [ "$1" == "--skip-deps" ]; then
            log_error "node_modules 不存在且指定了 --skip-deps，请手动运行: cd frontend && npm install"
            exit 1
        fi
        log_info "安装前端依赖..."
        npm install --silent
    fi

    # 检查端口
    if check_port $FRONTEND_PORT; then
        log_warn "前端端口 $FRONTEND_PORT 已被占用"
        cd ..
        return 0
    fi

    # 启动前端
    nohup npm run dev > ../frontend.log 2>&1 &
    echo $! > ../frontend.pid
    log_info "前端 PID: $(cat ../frontend.pid)"

    cd ..

    # 等待启动
    if wait_for_service $FRONTEND_PORT "前端"; then
        log_info "前端启动成功 (http://localhost:$FRONTEND_PORT)"
    else
        log_error "前端启动超时，请检查 frontend.log"
        exit 1
    fi
}

# 主流程
main() {
    echo ""
    echo "========================================"
    echo "   Agent Builder 系统启动"
    echo "========================================"
    echo ""

    start_backend
    echo ""
    start_frontend $1

    echo ""
    echo "========================================"
    log_info "系统启动完成!"
    echo ""
    echo "  前端: http://localhost:$FRONTEND_PORT"
    echo "  后端: http://localhost:$BACKEND_PORT"
    echo ""
    echo "  停止服务: ./stop.sh"
    echo "  查看日志: tail -f backend.log | frontend.log"
    echo "========================================"
}

main $1
