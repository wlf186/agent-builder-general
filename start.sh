#!/bin/bash

# Agent Builder 系统启动脚本
# 用法: ./start.sh [--skip-deps] [--force] [--force-langfuse]
#   --skip-deps       跳过依赖检查
#   --force           强制重启占用端口的服务（不含 Langfuse）
#   --force-langfuse  强制重启 Langfuse 服务

set -e
cd "$(dirname "$0")"

BACKEND_PORT=20881
FRONTEND_PORT=20880

# 参数标志
FORCE_MODE=false
FORCE_LANGFUSE=false

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

# 强制释放端口（杀掉占用进程）
force_release_port() {
    local port=$1
    local pid=$(lsof -t -i :$port 2>/dev/null || true)
    if [ -n "$pid" ]; then
        log_warn "强制释放端口 $port (PID: $pid)"
        kill -9 $pid 2>/dev/null || true
        sleep 1  # 等待端口释放
        if check_port $port; then
            log_error "无法释放端口 $port"
            return 1
        fi
        log_info "端口 $port 已释放"
    fi
    return 0
}

# 等待服务启动
# 用法: wait_for_service <port> <name> [manifest_file]
#   - port: 服务端口
#   - name: 服务名称（用于日志）
#   - manifest_file: (可选) 构建产物路径，仅前端需要
wait_for_service() {
    local port=$1
    local name=$2
    local manifest_file=$3  # 可选，仅前端需要
    local max_wait=30
    local count=0

    while [ $count -lt $max_wait ]; do
        # 如果指定了 manifest_file，先检查构建产物
        if [ -n "$manifest_file" ]; then
            if [ ! -f "$manifest_file" ]; then
                sleep 1
                ((count++))
                continue
            fi
        fi
        # 检查 HTTP 响应
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
        if [ "$FORCE_MODE" = true ]; then
            force_release_port $BACKEND_PORT || exit 1
        else
            log_warn "后端端口 $BACKEND_PORT 已被占用 (使用 --force 强制重启)"
            return 0
        fi
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

# 启动 Langfuse 可观测性服务
start_langfuse() {
    log_info "启动 Langfuse 可观测性服务..."

    LANGFUSE_PORT=3000

    # 检查容器编排工具是否可用 (优先级: podman-compose > docker compose > docker-compose)
    local compose_cmd=""
    if command -v podman-compose &> /dev/null; then
        compose_cmd="podman-compose"
    elif docker compose version &> /dev/null 2>&1; then
        compose_cmd="docker compose"
    elif command -v docker-compose &> /dev/null; then
        compose_cmd="docker-compose"
    fi

    if [ -z "$compose_cmd" ]; then
        log_warn "容器编排工具不可用 (podman-compose/docker-compose)，跳过 Langfuse 启动"
        log_warn "如需启用可观测性，请先安装 podman-compose 或 docker-compose"
        return 0
    fi

    # 检查端口
    if check_port $LANGFUSE_PORT; then
        if [ "$FORCE_LANGFUSE" = true ]; then
            # Langfuse 是容器服务，需要用 compose 停止
            log_warn "Langfuse 端口 $LANGFUSE_PORT 已被占用，尝试停止容器..."
            $compose_cmd -f docker-compose.langfuse.yml down 2>/dev/null || true
            sleep 2
        else
            log_warn "Langfuse 端口 $LANGFUSE_PORT 已被占用 (使用 --force-langfuse 强制重启)"
            return 0
        fi
    fi

    # 检查 docker-compose.langfuse.yml 是否存在
    if [ ! -f "docker-compose.langfuse.yml" ]; then
        log_warn "docker-compose.langfuse.yml 不存在，跳过 Langfuse 启动"
        return 0
    fi

    # 启动 Langfuse 服务
    log_info "使用 $compose_cmd 启动 Langfuse..."
    $compose_cmd -f docker-compose.langfuse.yml up -d

    log_info "Langfuse 服务启动中..."
    sleep 5  # 等待服务初始化

    # 检查服务是否启动
    if check_port $LANGFUSE_PORT; then
        log_info "Langfuse 启动成功 (http://localhost:$LANGFUSE_PORT)"
    else
        log_warn "Langfuse 启动可能需要更长时间，请稍后访问 http://localhost:$LANGFUSE_PORT"
    fi
}

# 启动文档站点 (VitePress)
start_docs_site() {
    log_info "启动文档站点..."

    DOCS_SITE_PORT=4173

    # 检查端口
    if check_port $DOCS_SITE_PORT; then
        if [ "$FORCE_MODE" = true ]; then
            force_release_port $DOCS_SITE_PORT || return 1
        else
            log_warn "文档站点端口 $DOCS_SITE_PORT 已被占用 (使用 --force 强制重启)"
            return 0
        fi
    fi

    # 检查 docs-site 目录是否存在
    if [ ! -d "docs-site" ]; then
        log_warn "docs-site 目录不存在，跳过文档站点启动"
        return 0
    fi

    cd docs-site

    # 检查依赖
    if [ ! -d "node_modules" ]; then
        if [ "$1" == "--skip-deps" ]; then
            log_warn "docs-site node_modules 不存在且指定了 --skip-deps，跳过文档站点启动"
            cd ..
            return 0
        fi
        log_info "安装文档站点依赖..."
        npm install --silent
    fi

    # 构建检查
    if [ ! -d ".vitepress/dist" ]; then
        log_info "构建文档站点..."
        npm run build
    fi

    # 启动文档站点
    nohup npm run preview -- --port $DOCS_SITE_PORT > ../docs-site.log 2>&1 &
    echo $! > ../docs-site.pid
    log_info "文档站点 PID: $(cat ../docs-site.pid)"

    cd ..

    # 等待启动
    if wait_for_service $DOCS_SITE_PORT "文档站点"; then
        log_info "文档站点启动成功 (http://localhost:$DOCS_SITE_PORT)"
    else
        log_warn "文档站点启动超时，请检查 docs-site.log"
    fi
}

# 清除前端缓存
clear_frontend_cache() {
    if [ -d "frontend/.next" ]; then
        log_info "清除前端缓存 (frontend/.next)..."
        rm -rf frontend/.next
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
        if [ "$FORCE_MODE" = true ]; then
            force_release_port $FRONTEND_PORT || { cd ..; return 1; }
        else
            log_warn "前端端口 $FRONTEND_PORT 已被占用 (使用 --force 强制重启)"
            cd ..
            return 0
        fi
    fi

    # 启动前端
    nohup npm run dev > ../frontend.log 2>&1 &
    echo $! > ../frontend.pid
    log_info "前端 PID: $(cat ../frontend.pid)"

    cd ..

    # 等待启动（前端需要等待 Next.js 构建完成）
    if wait_for_service $FRONTEND_PORT "前端" "frontend/.next/server/pages-manifest.json"; then
        log_info "前端启动成功 (http://localhost:$FRONTEND_PORT)"
    else
        log_error "前端启动超时，请检查 frontend.log"
        exit 1
    fi
}

# 主流程
main() {
    # 解析参数
    SKIP_DEPS=false
    for arg in "$@"; do
        case $arg in
            --skip-deps) SKIP_DEPS=true ;;
            --force) FORCE_MODE=true ;;
            --force-langfuse) FORCE_LANGFUSE=true ;;
        esac
    done

    echo ""
    echo "========================================"
    echo "   Agent Builder 系统启动"
    if [ "$FORCE_MODE" = true ] || [ "$FORCE_LANGFUSE" = true ]; then
        echo "   [强制模式: --force=$FORCE_MODE, --force-langfuse=$FORCE_LANGFUSE]"
    fi
    echo "========================================"
    echo ""

    start_langfuse
    echo ""
    start_backend
    echo ""
    if [ "$SKIP_DEPS" = true ]; then
        start_docs_site --skip-deps
    else
        start_docs_site
    fi
    echo ""
    clear_frontend_cache
    echo ""
    if [ "$SKIP_DEPS" = true ]; then
        start_frontend --skip-deps
    else
        start_frontend
    fi

    echo ""
    echo "========================================"
    log_info "系统启动完成!"
    echo ""
    echo "  前端: http://localhost:$FRONTEND_PORT"
    echo "  后端: http://localhost:$BACKEND_PORT"
    echo "  文档站点: http://localhost:4173"
    echo "  Langfuse (可观测性): http://localhost:3000"
    echo ""
    echo "  停止服务: ./stop.sh"
    echo "  查看日志: tail -f backend.log | frontend.log | docs-site.log"
    echo "========================================"
}

main "$@"
