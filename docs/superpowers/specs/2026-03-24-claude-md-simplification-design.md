# CLAUDE.md 精简设计

**日期**: 2026-03-24
**状态**: 待审批

---

## 背景

当前 CLAUDE.md 有 229 行，包含大量目录结构和组件描述，影响 AI 快速定位关键约束。

## 目标

1. 精简 CLAUDE.md 至 ~85 行，保留高频操作和核心约束
2. 迁移详细内容到 docs/references/project-structure.md
3. 建立文档维护规则，防止未来腐化

---

## 精简后的 CLAUDE.md 结构

```markdown
# CLAUDE.md

Agent Builder - 通用 AI 智能体构建平台。

---

## 快速启动

./start.sh | ./stop.sh | ./start.sh --skip-deps
端口: 前端 20880 | 后端 20881 | MCP SSE 20882

---

## 核心约束（必须遵守）

> ⚠️ **流式输出不可破坏** - 打字机效果是核心体验
> ⚠️ **Python 必须用 .venv** - `.venv/bin/python` 而非 `python`
> ⚠️ **重启前清除缓存** - `rm -rf frontend/.next && ./stop.sh && ./start.sh --skip-deps`

---

## 凭证安全

禁止明文存储凭证。GitHub PAT 用 `$CCGHTK`。

---

## 开发提示

**Playwright (headed 远程投屏)**:
- 选择器: `input[type="text"][placeholder]`（不是 textarea）
- `waitForLoadState('networkidle')` 后必须执行 `window.scrollTo(0,0)` 触发重绘

详见 [testing-guide.md](docs/references/testing-guide.md)

---

## 文档索引

| 用途 | 文档 |
|------|------|
| 黄金原则 | [docs/design-docs/core-beliefs.md](docs/design-docs/core-beliefs.md) |
| 项目结构 | [docs/references/project-structure.md](docs/references/project-structure.md) |
| API 参考 | [docs/references/api-reference.md](docs/references/api-reference.md) |

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
```

---

## 新建 docs/references/project-structure.md

迁移内容：
- 完整目录结构（87 行）- 带文件功能描述
- 核心组件表（30 行）- 后端/前端组件分类

---

## 实施步骤

1. 创建 `docs/references/project-structure.md`，迁移目录结构和组件表
2. 精简 `CLAUDE.md`，添加文档维护规则
3. 验证文档链接有效
