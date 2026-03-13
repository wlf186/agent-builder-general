#!/bin/bash
# Agent Builder 后端服务启动脚本
# 确保使用虚拟环境中的Python和依赖

set -e

# 项目目录
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# 虚拟环境路径
VENV_DIR="$PROJECT_DIR/.venv"
VENV_PYTHON="$VENV_DIR/bin/python"

echo "=========================================="
echo "  Agent Builder 后端服务"
echo "=========================================="

# 检查虚拟环境是否存在
if [ ! -d "$VENV_DIR" ]; then
    echo "❌ 错误: 虚拟环境不存在"
    echo "   请先运行: python3 -m venv .venv"
    echo "   然后运行: pip install -r requirements.txt"
    exit 1
fi

# 检查虚拟环境中的Python是否可用
if [ ! -f "$VENV_PYTHON" ]; then
    echo "❌ 错误: 虚拟环境中的Python不可用: $VENV_PYTHON"
    exit 1
fi

# 检查MCP库是否安装
echo ""
echo "📦 检查依赖库..."
if "$VENV_PYTHON" -c "import mcp" 2>/dev/null; then
    VERSION=$("$VENV_PYTHON" -c "import importlib.metadata; print(importlib.metadata.version('mcp'))" 2>/dev/null || echo "未知")
    echo "  ✓ MCP 库已安装 (版本 $VERSION)"
else
    echo "  ✗ 警告: MCP 库未安装"
    echo "    远程 MCP 服务（如 CoinGecko）将不可用"
    echo "    修复方法: $VENV_PYTHON -m pip install mcp"
    echo ""
    read -p "是否继续启动？(y/N): " confirm
    if [[ ! $confirm =~ ^[Yy]$ ]]; then
        echo "启动已取消"
        exit 0
    fi
fi

echo ""
echo "🚀 启动后端服务..."
echo "  Python: $VENV_PYTHON"
echo "  端口: 20881"
echo ""

# 使用虚拟环境中的Python启动后端
exec "$VENV_PYTHON" backend.py
