# CLAUDE.md

Agent Builder - 通用 AI 智能体构建平台。支持多 LLM、MCP 工具集成、技能系统、流式对话、RAG 知识库。

---

## 快速启动

```bash
./start.sh          # 启动前后端服务
./stop.sh           # 停止服务
./start.sh --skip-deps  # 跳过依赖检查
```

**端口**: 前端 20880 | 后端 20881 | MCP SSE 20882

---

## 核心约束（必须遵守）

> ⚠️ **流式输出不可破坏** - 打字机效果、thinking/tool_call 实时展示是核心体验，任何修改都不能破坏。

> ⚠️ **Python 虚拟环境强制使用** - 运行任何 Python 脚本或 pip 安装时，必须使用项目根目录的 `.venv` 虚拟环境，禁止使用系统级 Python/pip。

**正确用法**:
```bash
.venv/bin/python script.py        # 运行 Python 脚本
.venv/bin/pip install package     # 安装 Python 包
```

> ⚠️ **重启服务前清除前端缓存** - 每次执行 `./stop.sh && ./start.sh` 前，必须先清除 Next.js 缓存，否则可能加载旧代码：
> ```bash
> rm -rf frontend/.next && ./stop.sh && ./start.sh --skip-deps
> ```

> ⛔ **Playwright 一律使用 playwright-cli，禁止 Test Runner** - 自 2026-03-27 起，所有新增/修改的 Playwright 脚本（headed 和 headless 均适用）必须使用项目内置的 `playwright-cli` 技能编写和执行。禁止使用 `npx playwright test` 及 Test Runner 框架（`@playwright/test` 的 `test()`/`expect()` API）。详见 [testing-guide.md](docs/references/testing-guide.md)。

---

## 凭证安全

> ⚠️ **禁止明文存储凭证** - 所有 Token/密钥必须使用环境变量，绝不写入代码或 git config。

| 凭证 | 环境变量 | 用途 |
|------|----------|------|
| GitHub PAT | `$CCGHTK` | Git push/PR 操作 |
| Langfuse Keys | `$LANGFUSE_PUBLIC_KEY` / `$LANGFUSE_SECRET_KEY` | 可观测性追踪 |

**Git 远程配置**: HTTPS URL，推送时使用 `$CCGHTK`：
```bash
git push https://${CCGHTK}@github.com/wlf186/agent-builder-general.git main
```

---

## 开发提示

**Playwright**:
- **一律使用 playwright-cli 技能**，禁止 Test Runner
- **X11 渲染问题**: `waitForLoadState('networkidle')` 后执行 `await page.evaluate(() => window.scrollTo(0, 0))` 触发重绘

详见 [docs/references/testing-guide.md](docs/references/testing-guide.md)

---

## 文档索引

| 用途 | 文档 |
|------|------|
| 黄金原则 | [docs/design-docs/core-beliefs.md](docs/design-docs/core-beliefs.md) |
| 项目结构 | [docs/references/project-structure.md](docs/references/project-structure.md) |
| API 参考 | [docs/references/api-reference.md](docs/references/api-reference.md) |
| 流式协议 | [docs/design-docs/streaming-protocol.md](docs/design-docs/streaming-protocol.md) |
| 测试指南 | [docs/references/testing-guide.md](docs/references/testing-guide.md) |

---

## 文档维护规则

| 内容类型 | 放置位置 | 示例 |
|----------|----------|------|
| 必须遵守的约束 | CLAUDE.md 核心约束 | 流式不可破坏、venv 使用 |
| 高频命令/端口 | CLAUDE.md 快速启动 | ./start.sh、端口信息 |
| 安全相关规则 | CLAUDE.md 凭证安全 | 禁止明文凭证 |
| 文件/目录描述 | docs/references/project-structure.md | 组件表、目录树 |
| 设计原则/流程 | docs/design-docs/ | core-beliefs.md |
| API/技术参考 | docs/references/ | api-reference.md |

**添加新内容时**: 先判断类型，再决定放 CLAUDE.md 还是 docs/。
