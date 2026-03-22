# 黄金原则 (Golden Principles)

> 本文档定义了 Agent Builder 项目中所有智能体（包括 Claude Code）必须遵守的核心工作原则。

---

## 1. 无文档不执行 (No Documentation, No Execution)

**原则**: 任何复杂需求必须先有执行计划，再开始写代码。

**执行标准**:
- 复杂需求（涉及 3+ 文件或架构变更）必须在 `docs/exec-plans/active/` 下生成执行计划
- 计划应包含：目标、步骤、风险评估、验收标准
- 完成后计划移入 `docs/exec-plans/completed/`

**例外**: 简单的 bug 修复、文档更新、单文件修改

---

## 2. 闭环反馈 (Closed-Loop Feedback)

**原则**: 每个错误都是改进系统的机会。

**执行标准**:
- 遇到 Bug、编译失败、测试失败时，必须记录根因
- 将教训提炼为规则，补充到以下位置：
  - 代码模式 → `docs/references/coding-patterns.md`
  - 调试经验 → `docs/references/troubleshooting.md`
  - 架构约束 → `docs/design-docs/architecture-overview.md`
- 避免在同一类问题上犯二次错误

---

## 3. 严格边界 (Strict Boundaries)

**原则**: 维持项目的"品味"和风格一致性。

**执行标准**:
- 新代码必须遵循现有分层架构（Frontend → Backend API → Core Services）
- 优先使用已有内部实现，不随意引入新的第三方库封装
- 命名风格与现有代码保持一致
- API 设计遵循 RESTful 规范，保持向后兼容

**禁止行为**:
- 在根目录创建新的临时脚本（应放入 `scripts/` 或 `tests/`）
- 引入与现有功能重复的依赖包
- 修改核心接口签名而不更新所有调用方

---

## 4. 流式输出不可破坏 (Streaming is Sacred)

**原则**: 流式输出是调试对话的核心体验，任何代码修改都不能破坏它。

**执行标准**:
- 打字机效果必须保持流畅（逐字符流式显示）
- 思考过程（thinking）必须实时更新
- 工具调用（tool_call/tool_result）必须实时展示
- 技能加载状态必须实时反馈
- 性能指标必须准确统计

**修改后端流式逻辑时**:
- 必须先阅读 `docs/design-docs/streaming-protocol.md`
- 必须运行流式输出测试验证

---

## 5. 测试先行验证 (Test Before Trust)

**原则**: 修改代码后必须验证系统正常运行。

**执行标准**:
- 后端代码修改后必须重启服务验证
- 前端代码修改后必须清除 `.next` 缓存重启
- API 变更必须用 curl 或 Playwright 验证
- 流式输出变更必须用 SSE 测试脚本验证

**测试前检查清单**:
| 检查项 | 命令 |
|--------|------|
| 后端服务 | `curl http://localhost:20881/api/agents` |
| 前端服务 | 浏览器访问 `http://localhost:20880` |
| 流式输出 | `python tests/test_streaming_output.py` |

---

## 6. 文档即代码 (Docs as Code)

**原则**: 文档与代码同等重要，必须同步维护。

**执行标准**:
- API 变更必须更新 `docs/references/api-reference.md`
- 新功能必须更新 `CLAUDE.md` 中的导航链接
- 架构变更必须更新 `docs/design-docs/architecture-overview.md`
- 过时文档必须删除或归档

---

---

## 7. Python 虚拟环境强制使用 (Virtual Environment Mandatory)

**原则**: 所有 Python 操作必须使用项目虚拟环境，确保依赖隔离和一致性。

**执行标准**:
- Python 脚本执行：`.venv/bin/python script.py`
- 包安装：`.venv/bin/pip install package`
- 或先激活虚拟环境：`source .venv/bin/activate`

**禁止行为**:
- 直接使用 `python` 或 `pip` 命令（可能调用系统级 Python）
- 在虚拟环境外安装任何依赖

**原因**:
- 系统级安装可能导致版本冲突
- 虚拟环境确保开发/生产环境一致性
- 避免污染系统 Python 环境

---

## 修订历史

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-03-17 | 1.0 | 初始版本，确立 6 条核心原则 |
| 2026-03-22 | 1.1 | 新增第 7 条：Python 虚拟环境强制使用原则 |
