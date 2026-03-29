# Playwright 测试指南

> 本文档提供 Agent Builder 的浏览器自动化测试规范和最佳实践。

---

## ⛔⛔⛔ 绝对红线：禁止使用 Playwright Test Runner

> **自 2026-03-27 起，这是一条不可违反的规则，没有任何例外。**

### 规则

所有新增/修改的 Playwright 脚本（无论 headed 还是 headless）**一律使用项目内置的 `playwright-cli` 技能**编写和执行。

| 场景 | ✅ 正确 | ❌ 禁止 |
|------|--------|--------|
| **所有场景** | `playwright-cli open` / `playwright-cli click e3` ... | `npx playwright test` |
| **编写脚本** | 使用 playwright-cli 交互式命令 | 使用 `@playwright/test` 的 `test()`/`expect()` API |
| **新增文件** | 无需创建 `.spec.ts` 文件 | 创建新的 `.spec.ts` 文件 |

### 原因

1. **Test Runner 自动管理浏览器生命周期**，在远程 X11 环境中会导致浏览器意外关闭（"Target page, context or browser has been closed"）
2. **`playwright-cli` 是交互式命令行工具**，浏览器生命周期由用户手动控制，不存在上述问题
3. **playwright-cli 更适合 AI 辅助测试**：逐步操控浏览器，出错了可以当场 snapshot 查看、调整、继续

### 快速上手

```bash
# Headless 模式（默认）
playwright-cli open http://localhost:20880

# Headed 模式（需要 X11/Display 环境，必须显式指定 --headed）
playwright-cli open http://localhost:20880 --headed

# 查看页面快照（获取元素引用编号）
playwright-cli snapshot

# 通过引用编号交互
playwright-cli click e3
playwright-cli fill e5 "你好"
playwright-cli press Enter

# 关闭浏览器
playwright-cli close
```

### Headed 模式注意事项

> playwright-cli **不会自动检测 DISPLAY 环境变量**，即使 `echo $DISPLAY` 有值，不加 `--headed` 仍以 headless 模式启动。

| 要点 | 说明 |
|------|------|
| 启动参数 | 必须加 `--headed`：`playwright-cli open <url> --headed` |
| 可用浏览器 | `msedge`（系统已安装，默认）；`chrome` 未安装，`--browser=chrome` 会报错 |
| X11 渲染 | 首次渲染可能断裂，执行 `playwright-cli eval "window.scrollTo(0, 0)"` 触发重绘 |
| Claude Code 沙箱 | playwright-cli 需要绕过沙箱（Claude 执行时自动处理），否则报 `bwrap: Operation not permitted` |

详细命令参考：在对话中使用 `/playwright-cli` 技能。

---

## 测试前检查清单

| 检查项 | 命令/方法 | 预期结果 |
|--------|-----------|----------|
| 后端服务运行 | `curl http://localhost:20881/api/agents` | 返回 agent 列表 JSON |
| 前端服务运行 | 浏览器访问 `http://localhost:20880` | 页面正常加载 |
| 后端代码已更新 | 重启后端服务 | `kill $(cat backend.pid) && python backend.py` |
| API 响应正常 | `curl -X POST .../chat/stream` | 返回流式 content 事件 |

---

## UI 布局说明

```
┌─────────────────────────────────────────────────────────────────────┐
│                         页面布局示意                                 │
├────────────────────────────┬────────────────────────────────────────┤
│     左侧：配置面板          │       右侧：调试对话面板               │
│                            │                                        │
│  ┌──────────────────────┐  │  ┌──────────────────────────────────┐  │
│  │ 人设与提示词         │  │  │    聊天消息列表                  │  │
│  │ ❌ 错误的测试位置    │  │  │    - 用户消息气泡                │  │
│  └──────────────────────┘  │  │    - AI 回复气泡                │  │
│                            │  │                                  │  │
│  ┌──────────────────────┐  │  ├──────────────────────────────────┤  │
│  │ 模型设置             │  │  │ ┌──────────────────────────────┐ │  │
│  │ MCP服务              │  │  │ │ <input type="text">          │ │  │
│  │ 技能配置             │  │  │ │ ✅ 正确的测试位置            │ │  │
│  └──────────────────────┘  │  │ └──────────────────────────────┘ │  │
│                            │  └──────────────────────────────────┘  │
└────────────────────────────┴────────────────────────────────────────┘
```

---

## Playwright 选择器

### 通过 snapshot 交互

使用 `playwright-cli` 时，通过 `snapshot` 命令获取页面元素引用编号（如 `e3`、`e5`），然后直接用编号交互：

```bash
playwright-cli snapshot
# 查看输出中的 [e5] input "输入消息" 等引用编号
playwright-cli click e3
playwright-cli fill e5 "你好"
```

---

## Headed 模式 X11 渲染问题

通过 X11/VNC 远程投屏运行 headed 模式时，初始渲染可能出现屏幕内容断裂。

**解决方案**：页面加载后通过 playwright-cli 执行 eval 触发重绘：

```bash
playwright-cli eval "window.scrollTo(0, 0)"
```

---

## 验收标准

### 正常回复特征
1. ✅ 内容与用户输入**相关**
2. ✅ 内容**完整**（不是截断的片段）
3. ✅ 内容**有意义**（不是乱码或错误信息）
4. ✅ 流式输出**流畅**（打字机效果，逐字符显示）

### 异常回复特征
1. ❌ 空字符串或完全无内容
2. ❌ 错误信息如 `"处理请求时发生错误"`
3. ❌ 内容与输入完全不相关
4. ❌ 截断或乱码

---

## Playwright CLI 指令文件

除了交互式 playwright-cli 命令，项目还支持通过 **Markdown 指令文件** + Claude + playwright-cli 执行预定义的测试流程。

### 使用方式

告诉 Claude 执行某个指令文件：
```
运行 frontend/tests/cli/simple/debug-kb.md 测试
```

Claude 会读取指令文件并通过 playwright-cli 逐步执行。

### 指令文件位置

- `frontend/tests/cli/simple/` — 简单测试（导航 + 截图 + 基本验证）
- `frontend/tests/cli/medium/` — 中等测试（多步工作流 + 断言 + run-code）
- `frontend/tests/cli/complex/` — 复杂测试（多页面 + 事件监听 + 多测试用例）

### 指令文件格式

每个 `.md` 文件对应一个原始 `.spec.ts` 测试脚本，遵循统一模板：

```markdown
# [测试名称]

> 来源: `frontend/tests/[原始文件名].spec.ts`
> 复杂度: simple | medium | complex

## 前置条件
- 服务已启动 (localhost:20880)

## 步骤
1. [操作描述]

## 验证
- [预期结果]
```

### 何时使用 CLI 指令文件

- 开发中快速验证功能
- 一次性 UAT 测试
- 需要人工判断的探索性测试

### 何时使用 .spec.ts

- CI/CD 自动化回归
- 需要严格可复现结果
- 大规模并行测试

---

## 常见问题排查

| 问题现象 | 可能原因 | 排查方法 |
|----------|----------|----------|
| `bwrap: Operation not permitted` | Claude Code 沙箱限制浏览器进程 | 确保命令绕过沙箱执行 |
| `Chromium 'chrome' is not found` | 系统未安装 Chrome | 使用默认 `msedge` 或安装 Chrome |
| headed 模式实际以 headless 启动 | 未加 `--headed` 参数 | 加 `--headed` 参数 |
| X11 远程投屏页面渲染断裂 | 首次渲染未触发重绘 | `playwright-cli eval "window.scrollTo(0, 0)"` |
| API 返回参数错误 | 后端未重启加载新代码 | 重启后端服务 |
| 空响应 | LLM 调用失败 | 检查模型服务配置 |
| 选择器找不到元素 | 使用了错误的选择器 | 使用 `input[type="text"]` |
| 消息发送后无响应 | 输入到了人设编辑框 | 检查截图确认输入位置 |
| 静态资源 404 | Next.js 缓存不一致 | 清除 `.next` 目录重启 |
