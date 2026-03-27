# Playwright CLI 指令文件迁移 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将约 60 个 headless `.spec.ts` 测试脚本改造成 Markdown 指令文件，由 Claude 通过 playwright-cli skill 执行。

**Architecture:** 每个 `.spec.ts` 文件对应一个 `.md` 指令文件，存放于 `frontend/tests/cli/` 下按类别分目录。指令文件用自然语言描述步骤，Claude 读后通过 playwright-cli 的 snapshot + 元素引用交互式执行。Simple 脚本纯指令，Medium 脚本用 `run-code` 补充复杂逻辑，Complex 脚本拆分为多个子指令文件。

**Tech Stack:** playwright-cli (Playwright 内置 CLI skill), Markdown

---

## 文件结构

```
frontend/tests/cli/
  README.md                          — 使用说明文档
  simple/                            — Simple 级脚本 (<50 行)
    simple-uat.md                    — 健康检查
    debug-kb.md                      — 知识库页面调试
    test001-routine.md               — 例行检查
    demo-docs-nav.md                 — 文档站导航
    verify-agents.md                 — 智能体列表验证
    cold-jokes-test.md               — 冷笑话 API 测试
    routine-check.md                 — 例行检查
  medium/                            — Medium 级脚本 (50-150 行)
    rag-simple-test.md               — RAG 简单验收
    rag-quick-uat.md                 — RAG 快速 UAT
    uat-simple.md                    — 简化 UAT
    langfuse-register.md             — Langfuse 注册
    langfuse-trace-demo.md           — Langfuse Trace 演示
    cold-jokes-uat.md                — 冷笑话 UAT
    uat-rapid-messaging.md           — 快速消息 UAT
    demo-3-rounds.md                 — 三轮对话演示
    iteration-demo.md                — 迭代演示
    demo-streaming-fix.md            — 流式修复演示
    langfuse-create-key.md           — Langfuse 创建 Key
    langfuse-demo.md                 — Langfuse 演示
    langfuse-login-demo.md           — Langfuse 登录演示 (headed)
    final-demo.md                    — 最终演示
    coingecko-demo.md                — CoinGecko 演示
    coingecko-demo-pause.md          — CoinGecko 暂停演示
    langfuse-full-demo.md            — Langfuse 完整演示
    coingecko-test.md                — CoinGecko 测试
    langfuse-setup.md                — Langfuse 设置
    uat-condacheck.md                — Conda 检查 UAT
    uat-corrected.md                 — 修正 UAT
    resource-links-demo.md           — 资源链接演示 (headed)
    routine-uat-demo.md              — 例行 UAT 演示 (headed)
  complex/                           — Complex 级脚本 (>150 行)，拆分为子文件
    rag-demo.md                      — RAG 完整演示
    rag-uat-official.md              — RAG 官方 UAT
    rag-uat-full.md                  — RAG 完整 UAT
    simple-uat-rag.md                — 简单 UAT RAG
    final-uat-rag.md                 — 最终 UAT RAG
    rag-acceptance-demo.md           — RAG 验收演示
    iteration-2603121500.md          — 迭代 2603121500
    iteration-2603121100.md          — 迭代 2603121100
    iteration-2603121000-uat.md      — 迭代 2603121000 UAT
    iteration-202603150000-uat.md    — 迭代 202603150000 UAT
    iteration-2603131500.md          — 迭代 2603131500
    iteration-2603121000.md          — 迭代 2603121000
    iteration-2603131000.md          — 迭代 2603131000
    iteration-2603111255.md          — 迭代 2603111255
    history-conversation.md          — 对话历史 (拆分为子指令)
    knowledge-base-uat.md            — 知识库 UAT
    uat-full-acceptance.md           — 完整验收 UAT
    uat-test3-empty-response.md      — 空响应测试 UAT
    rag-uat-final.md                 — RAG 最终 UAT
    uat-rag-iteration-202603170949.md — RAG 迭代 UAT
    uat-debug-log-export.md          — 调试日志导出 UAT
    uat-rag-knowledge-base.md        — RAG 知识库 UAT
    langfuse-uat.md                  — Langfuse UAT
    uat-walkthrough.md               — UAT Walkthrough
    uat-log-export.md                — 日志导出 UAT
    uat-final.md                     — 最终 UAT
    verify-message-dedup.md          — 消息去重验证
    demo-streaming.md                — 流式演示
    chat-uat-rag.md                  — Chat UAT RAG
    demo-pdf-upload.md               — PDF 上传演示 (headed)
    uat-real.md                      — 真实 UAT
    uat-streaming-fix.md             — 流式修复 UAT
    uat_regression_v13.md            — 回归测试 v13
```

## 不迁移的文件

以下文件**不纳入迁移范围**，保持原样：

- `frontend/tests/global-setup.ts` — 框架配置
- `frontend/tests/demo-3-rounds.spec.ts` — headed 模式 (`headless: false`)
- `frontend/tests/demo-pdf-upload.spec.ts` — headed 模式
- `frontend/tests/langfuse-login-demo.spec.ts` — headed 模式
- `frontend/tests/resource-links-demo.spec.ts` — headed 模式
- `frontend/tests/routine-uat-demo.spec.ts` — headed 模式
- `tests/debug-url.spec.ts` — 调试工具
- `tests/uat_mcp_tool_priority.spec.ts` — 独立 headless:true 测试

---

## 指令文件模板

每个指令文件遵循统一格式：

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

---

## Task 1: 创建目录结构和 README

**Files:**
- Create: `frontend/tests/cli/README.md`

- [ ] **Step 1: 创建目录结构**

Run:
```bash
mkdir -p frontend/tests/cli/simple frontend/tests/cli/medium frontend/tests/cli/complex
```

- [ ] **Step 2: 创建 README.md**

Create `frontend/tests/cli/README.md`:

```markdown
# Playwright CLI 指令文件

通过 Claude + playwright-cli skill 执行的浏览器自动化测试指令。

## 使用方式

告诉 Claude 执行某个指令文件：
```
运行 frontend/tests/cli/simple/debug-kb.md 测试
```

Claude 会：
1. 读取 Markdown 指令文件
2. 通过 playwright-cli skill 打开浏览器
3. 按步骤执行（snapshot → 交互 → 验证）
4. 返回测试结果和截图

## 目录结构

- `simple/` — 简单测试（导航 + 截图 + 基本验证）
- `medium/` — 中等测试（多步工作流 + 断言 + run-code）
- `complex/` — 复杂测试（多页面 + 事件监听 + 拆分子指令）

## 与 .spec.ts 的关系

每个 .md 文件对应一个原始 .spec.ts 文件（在文件头部标注来源）。
这些指令文件是 .spec.ts 的替代，不替代 CI/CD 中的自动化测试。
```

- [ ] **Step 3: Commit**

```bash
git add frontend/tests/cli/README.md
git commit -m "feat: add playwright-cli instruction file directory structure"
```

---

## Task 2: 迁移 Simple 脚本（7 个）

每个脚本：读原始 `.spec.ts` → 写对应 `.md` → commit。

### Task 2.1: simple-uat.md

**Files:**
- Create: `frontend/tests/cli/simple/simple-uat.md`
- Source: `frontend/tests/simple-uat.spec.ts` (8 行)

- [ ] **Step 1: 创建 simple-uat.md**

```markdown
# 健康检查

> 来源: `frontend/tests/simple-uat.spec.ts`
> 复杂度: simple

## 前置条件
- 服务已启动 (localhost:20880)

## 步骤
1. 打开 http://localhost:20880
2. 等待页面加载完成（networkidle）
3. 截图保存到 test-results/cli/simple-uat.png

## 验证
- 页面 body 可见
- 无错误提示
```

### Task 2.2: debug-kb.md

**Files:**
- Create: `frontend/tests/cli/simple/debug-kb.md`
- Source: `frontend/tests/debug-kb.spec.ts` (28 行)

- [ ] **Step 1: 创建 debug-kb.md**

```markdown
# 知识库页面调试

> 来源: `frontend/tests/debug-kb.spec.ts`
> 复杂度: simple

## 前置条件
- 服务已启动 (localhost:20880)

## 步骤
1. 打开 http://localhost:20880/knowledge-bases
2. 等待页面加载完成
3. 截图保存到 test-results/cli/debug-kb-page.png
4. snapshot 查看所有按钮元素，列出每个按钮的文本内容
5. 检查是否存在"创建知识库"按钮

## 验证
- 列出所有按钮及其文本
- 报告"创建知识库"按钮是否存在
```

### Task 2.3: test001-routine.md

**Files:**
- Create: `frontend/tests/cli/simple/test001-routine.md`
- Source: `frontend/tests/test001-routine.spec.ts` (37 行)

- [ ] **Step 1: 读取原始文件确认内容**

Run: `head -40 frontend/tests/test001-routine.spec.ts`

- [ ] **Step 2: 创建 test001-routine.md**

根据原始文件内容编写指令文件，遵循模板格式。

### Task 2.4: demo-docs-nav.md

**Files:**
- Create: `frontend/tests/cli/simple/demo-docs-nav.md`
- Source: `frontend/tests/demo-docs-nav.spec.ts` (38 行)

- [ ] **Step 1: 创建 demo-docs-nav.md**

```markdown
# 文档站导航演示

> 来源: `frontend/tests/demo-docs-nav.spec.ts`
> 复杂度: simple

## 前置条件
- 文档站已启动 (localhost:5173)

## 步骤
1. 打开 http://localhost:5173/en/
2. 等待页面加载
3. 截图保存到 test-results/cli/docs-nav-01-home.png
4. snapshot 找到 "Get Started" 按钮，点击它
5. 等待页面加载，截图保存到 test-results/cli/docs-nav-02-get-started.png
6. 返回首页 http://localhost:5173/en/
7. snapshot 找到 "Core Features" 按钮，点击它
8. 等待页面加载，截图保存到 test-results/cli/docs-nav-03-core-features.png

## 验证
- "Get Started" 点击后跳转到正确的文档页
- "Core Features" 点击后跳转到正确的文档页
- 两个截图都成功保存
```

### Task 2.5: verify-agents.md

**Files:**
- Create: `frontend/tests/cli/simple/verify-agents.md`
- Source: `frontend/tests/verify-agents.spec.ts` (40 行)

- [ ] **Step 1: 创建 verify-agents.md**

```markdown
# 智能体列表验证

> 来源: `frontend/tests/verify-agents.spec.ts`
> 复杂度: simple

## 前置条件
- 服务已启动 (localhost:20880)

## 步骤
1. 打开 http://localhost:20880
2. 等待页面加载完成
3. 等待 3 秒让智能体卡片加载
4. snapshot 获取页面所有 h3 元素文本
5. 截图保存到 test-results/cli/verify-agents.png

## 验证
- 页面中应包含以下智能体名称: test3, test-model-check, finance-sub, main-agent
- 页面中不应包含: test001, test-iteration-2603111255, test007, test2
- 页面中应有"智能体人设"标题
```

### Task 2.6: cold-jokes-test.md

**Files:**
- Create: `frontend/tests/cli/simple/cold-jokes-test.md`
- Source: `frontend/tests/cold-jokes-test.spec.ts` (41 行)

- [ ] **Step 1: 读取原始文件确认内容**

Run: `cat frontend/tests/cold-jokes-test.spec.ts`

- [ ] **Step 2: 创建 cold-jokes-test.md**

根据原始文件内容编写指令文件。

### Task 2.7: routine-check.md

**Files:**
- Create: `frontend/tests/cli/simple/routine-check.md`
- Source: `frontend/tests/routine-check.spec.ts` (50 行)

- [ ] **Step 1: 读取原始文件确认内容**

Run: `cat frontend/tests/routine-check.spec.ts`

- [ ] **Step 2: 创建 routine-check.md**

根据原始文件内容编写指令文件。

- [ ] **Step 3: Commit Simple 脚本**

```bash
git add frontend/tests/cli/simple/
git commit -m "feat: migrate 7 simple Playwright scripts to CLI instruction files"
```

---

## Task 3: 迁移 Medium 脚本（15 个）

每个脚本：读原始 `.spec.ts` → 写对应 `.md`（含 `run-code` 块）→ commit。

### Medium 脚本列表

| # | 目标文件 | 来源 | 行数 |
|---|----------|------|------|
| 3.1 | `medium/rag-simple-test.md` | `rag-simple-test.spec.ts` | 87 |
| 3.2 | `medium/rag-quick-uat.md` | `rag-quick-uat.spec.ts` | 87 |
| 3.3 | `medium/uat-simple.md` | `uat-simple.spec.ts` | 131 |
| 3.4 | `medium/langfuse-register.md` | `langfuse-register.spec.ts` | 66 |
| 3.5 | `medium/langfuse-trace-demo.md` | `langfuse-trace-demo.spec.ts` | 80 |
| 3.6 | `medium/cold-jokes-uat.md` | `cold-jokes-uat.spec.ts` | 82 |
| 3.7 | `medium/uat-rapid-messaging.md` | `uat-rapid-messaging.spec.ts` | 91 |
| 3.8 | `medium/demo-3-rounds.md` | `demo-3-rounds.spec.ts` | 93 |
| 3.9 | `medium/iteration-demo.md` | `iteration-demo.spec.ts` | 99 |
| 3.10 | `medium/demo-streaming-fix.md` | `demo-streaming-fix.spec.ts` | 105 |
| 3.11 | `medium/langfuse-create-key.md` | `langfuse-create-key.spec.ts` | 108 |
| 3.12 | `medium/langfuse-demo.md` | `langfuse-demo.spec.ts` | 111 |
| 3.13 | `medium/final-demo.md` | `final-demo.spec.ts` | 112 |
| 3.14 | `medium/coingecko-demo.md` | `coingecko-demo.spec.ts` | 114 |
| 3.15 | `medium/coingecko-demo-pause.md` | `coingecko-demo-pause.spec.ts` | 119 |

- [ ] **Step 1: 批量读取所有 Medium 原始文件**

对每个来源文件执行 `cat frontend/tests/[文件名]` 读取内容。

- [ ] **Step 2: 创建 rag-simple-test.md**（示例，其余类推）

```markdown
# RAG 简单验收测试

> 来源: `frontend/tests/rag-simple-test.spec.ts`
> 复杂度: medium

## 前置条件
- 服务已启动 (localhost:20880)

## 测试用例

### 测试 1: 行政助手

1. 打开 http://localhost:20880
2. 等待页面加载完成
3. snapshot 查看智能体卡片列表
4. 找到包含"UAT行政助手"的卡片，点击它
5. 等待 2 秒
6. snapshot 找到输入框，输入"公司有几天年假？"
7. 按 Enter 发送
8. 等待 8 秒让助手回复
9. snapshot 查看回复内容
10. 截图保存到 test-results/cli/rag-simple-admin.png

**验证**: 回复中应包含"15"或"十五"

### 测试 2: 技术支持

1. 返回首页 http://localhost:20880
2. 等待页面加载完成
3. snapshot 查看智能体卡片列表
4. 找到包含"UAT技术支持"的卡片，点击它
5. 等待 2 秒
6. snapshot 找到输入框，输入"公司有几天年假？"
7. 按 Enter 发送
8. 等待 8 秒让助手回复
9. snapshot 查看回复内容
10. 截图保存到 test-results/cli/rag-simple-tech.png

**验证**: 回复中不应包含"检索"或"retriev"（技术支持无 RAG）
```

- [ ] **Step 3: 逐个创建剩余 Medium 脚本**

对每个来源文件，读取内容后编写对应的 `.md` 指令文件。关键原则：
- 用 snapshot + 元素引用替代所有 `page.locator()` 调用
- 循环逻辑（如遍历智能体卡片找目标）由 Claude 根据 snapshot 输出判断执行
- 断言转化为"验证"章节的自然语言描述
- 截图路径统一到 `test-results/cli/` 下
- `waitForTimeout` 转化为"等待 N 秒"的步骤描述

- [ ] **Step 4: Commit Medium 脚本**

```bash
git add frontend/tests/cli/medium/
git commit -m "feat: migrate 15 medium Playwright scripts to CLI instruction files"
```

---

## Task 4: 迁移 Medium 补充脚本（5 个）

| # | 目标文件 | 来源 | 行数 |
|---|----------|------|------|
| 4.1 | `medium/langfuse-full-demo.md` | `langfuse-full-demo.spec.ts` | 125 |
| 4.2 | `medium/coingecko-test.md` | `coingecko-test.spec.ts` | 129 |
| 4.3 | `medium/langfuse-setup.md` | `langfuse-setup.spec.ts` | 131 |
| 4.4 | `medium/uat-condacheck.md` | `uat-condacheck.spec.ts` | 77 |
| 4.5 | `medium/uat-corrected.md` | `uat-corrected.spec.ts` | 196 |

注意：`uat-corrected.spec.ts` 196 行，按行数属于 Complex，但实际复杂度评估为 Medium（无多页面/hooks/事件监听），归入 medium。

另有 4 个 headed 模式的脚本也创建 medium 级指令文件（playwright-cli 默认 headed，两者兼容）：
- `medium/demo-3-rounds.md` — 已在 Task 3 中包含
- `medium/resource-links-demo.md` — 源文件 `resource-links-demo.spec.ts` 214 行，headed 模式
- `medium/langfuse-login-demo.md` — 源文件 `langfuse-login-demo.spec.ts` 114 行，headed 模式
- `medium/routine-uat-demo.md` — 源文件 `routine-uat-demo.spec.ts` 220 行，headed 模式

- [ ] **Step 1: 批量读取原始文件**
- [ ] **Step 2: 逐个创建 .md 指令文件**
- [ ] **Step 3: Commit**

```bash
git add frontend/tests/cli/medium/
git commit -m "feat: migrate remaining medium Playwright scripts to CLI instruction files"
```

---

## Task 5: 迁移 Complex 脚本（约 31 个）

Complex 脚本行数较多（150-630 行），但核心交互模式与 Medium 相同。差异在于步骤更多、验证更详细。

**策略**：不拆分子文件（除非单个脚本超过 400 行且包含明显独立场景），直接整体转化为一个 .md 文件。原因：
- 拆分后每个子文件需要独立的前置条件设置（登录、导航），增加重复
- Claude 执行时可以一次性读完整个指令文件，按步骤顺序执行
- 保持与原始文件 1:1 对应关系，方便溯源

### Complex 脚本列表（按行数排序）

| # | 目标文件 | 来源 | 行数 |
|---|----------|------|------|
| 5.1 | `complex/demo-streaming.md` | `demo-streaming.spec.ts` | 151 |
| 5.2 | `complex/uat-streaming-fix.md` | `uat-streaming-fix.spec.ts` | 154 |
| 5.3 | `complex/uat-walkthrough.md` | `uat-walkthrough.spec.ts` | 171 |
| 5.4 | `complex/langfuse-uat.md` | `langfuse-uat.spec.ts` | 182 |
| 5.5 | `complex/chat-uat-rag.md` | `chat-uat-rag.spec.ts` | 210 |
| 5.6 | `complex/uat-log-export.md` | `uat-log-export.spec.ts` | 221 |
| 5.8 | `complex/uat-final.md` | `uat-final.spec.ts` | 227 |
| 5.9 | `complex/rag-demo.md` | `rag-demo.spec.ts` | 228 |
| 5.10 | `complex/verify-message-dedup.md` | `verify-message-dedup.spec.ts` | 242 |
| 5.11 | `complex/rag-uat-official.md` | `rag-uat-official.spec.ts` | 243 |
| 5.12 | `complex/rag-uat-full.md` | `rag-uat-full.spec.ts` | 255 |
| 5.13 | `complex/simple-uat-rag.md` | `simple-uat-rag.spec.ts` | 256 |
| 5.14 | `complex/iteration-2603121000-uat.md` | `iteration-2603121000-uat.spec.ts` | 258 |
| 5.15 | `complex/final-uat-rag.md` | `final-uat-rag.spec.ts` | 272 |
| 5.16 | `complex/rag-acceptance-demo.md` | `rag-acceptance-demo.spec.ts` | 279 |
| 5.17 | `complex/iteration-2603121500.md` | `iteration-2603121500.spec.ts` | 283 |
| 5.18 | `complex/iteration-2603121100.md` | `iteration-2603121100.spec.ts` | 287 |
| 5.19 | `complex/knowledge-base-uat.md` | `knowledge-base-uat.spec.ts` | 288 |
| 5.20 | `complex/uat-full-acceptance.md` | `uat-full-acceptance.spec.ts` | 292 |
| 5.21 | `complex/uat-test3-empty-response.md` | `uat-test3-empty-response.spec.ts` | 296 |
| 5.22 | `complex/rag-uat-final.md` | `rag-uat-final.spec.ts` | 298 |
| 5.23 | `complex/iteration-202603150000-uat.md` | `iteration-202603150000-uat.spec.ts` | 340 |
| 5.24 | `complex/uat-rag-iteration-202603170949.md` | `uat-rag-iteration-202603170949.spec.ts` | 343 |
| 5.25 | `complex/uat-debug-log-export.md` | `uat-debug-log-export.spec.ts` | 370 |
| 5.26 | `complex/iteration-2603111255.md` | `iteration-2603111255.spec.ts` | 401 |
| 5.27 | `complex/uat-rag-knowledge-base.md` | `uat-rag-knowledge-base.spec.ts` | 421 |
| 5.28 | `complex/iteration-2603131500.md` | `iteration-2603131500.spec.ts` | 551 |
| 5.29 | `complex/iteration-2603121000.md` | `iteration-2603121000.spec.ts` | 571 |
| 5.30 | `complex/iteration-2603131000.md` | `iteration-2603131000.spec.ts` | 583 |
| 5.31 | `complex/history-conversation.md` | `history-conversation.spec.ts` | 629 |
| 5.32 | `complex/uat-real.md` | `uat-real.spec.ts` | 149 |
| 5.33 | `complex/demo-pdf-upload.md` | `demo-pdf-upload.spec.ts` | 148 |

注意：
- `demo-pdf-upload.spec.ts` 是 headed 模式，但仍创建指令文件（playwright-cli 默认 headed，两者兼容）
- `uat-real.spec.ts` 149 行归入 complex 因为包含多测试用例 + request 监听
- `demo-pdf-upload.spec.ts` 148 行归入 complex 因为涉及文件上传交互

- [ ] **Step 1: 分批读取原始文件**

分 4 批，每批约 8 个文件：
- 批次 A: 5.1-5.8
- 批次 B: 5.9-5.16
- 批次 C: 5.17-5.24
- 批次 D: 5.25-5.33

- [ ] **Step 2: 分批创建 .md 指令文件**

每个文件转化原则：
- 多个 `test()` 用例转化为 `### 测试用例 N` 子章节
- `beforeAll`/`beforeEach` 的逻辑合并到"前置条件"或第一个步骤
- `page.on('request', ...)` 等事件监听转化为"在后续操作中注意观察..."的说明
- `run-code` 块用于无法用 snapshot 替代的逻辑（如文件下载、API 调用验证）
- 复杂等待逻辑（如 `waitForStreamingComplete`）转化为"等待直到助手回复出现"

- [ ] **Step 3: 分批 Commit**

```bash
# 批次 A
git add frontend/tests/cli/complex/  # 5.1-5.8
git commit -m "feat: migrate complex Playwright scripts batch A (8 files)"

# 批次 B
git add frontend/tests/cli/complex/  # 5.9-5.16
git commit -m "feat: migrate complex Playwright scripts batch B (8 files)"

# 批次 C
git add frontend/tests/cli/complex/  # 5.17-5.24
git commit -m "feat: migrate complex Playwright scripts batch C (8 files)"

# 批次 D
git add frontend/tests/cli/complex/  # 5.25-5.33
git commit -m "feat: migrate complex Playwright scripts batch D (9 files)"
```

---

## Task 6: 验证 — 用 playwright-cli 执行一个 Simple 指令文件

**Files:**
- Test: `frontend/tests/cli/simple/simple-uat.md`

- [ ] **Step 1: 确保服务已启动**

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:20880`
Expected: `200`

如果未启动，运行: `./start.sh --skip-deps`

- [ ] **Step 2: 通过 playwright-cli skill 执行 simple-uat.md**

使用 playwright-cli skill：
1. `playwright-cli -s=simple-uat open http://localhost:20880`
2. `playwright-cli -s=simple-uat snapshot`
3. `playwright-cli -s=simple-uat screenshot --filename=test-results/cli/simple-uat.png`
4. `playwright-cli -s=simple-uat close`

- [ ] **Step 3: 验证截图生成**

Run: `ls -la test-results/cli/simple-uat.png`
Expected: 文件存在

- [ ] **Step 4: Commit 验证结果（如有截图）**

```bash
git add test-results/cli/simple-uat.png
git commit -m "test: add screenshot from playwright-cli simple-uat verification"
```

---

## Task 7: 更新项目文档

**Files:**
- Modify: `docs/references/testing-guide.md`

- [ ] **Step 1: 读取现有测试指南**

Run: `cat docs/references/testing-guide.md`

- [ ] **Step 2: 在测试指南中添加 CLI 指令文件章节**

在适当位置添加：

```markdown
## Playwright CLI 指令文件

除了传统的 `.spec.ts` 测试脚本，项目还支持通过 **Markdown 指令文件** + Claude + playwright-cli 执行测试。

### 使用方式

告诉 Claude：
```
运行 frontend/tests/cli/simple/debug-kb.md 测试
```

Claude 会读取指令文件并通过 playwright-cli 逐步执行。

### 指令文件位置

- `frontend/tests/cli/simple/` — 简单测试
- `frontend/tests/cli/medium/` — 中等测试
- `frontend/tests/cli/complex/` — 复杂测试

### 何时使用 CLI 指令文件

- 开发中快速验证功能
- 一次性 UAT 测试
- 需要人工判断的探索性测试

### 何时使用 .spec.ts

- CI/CD 自动化回归
- 需要严格可复现结果
- 大规模并行测试
```

- [ ] **Step 3: Commit**

```bash
git add docs/references/testing-guide.md
git commit -m "docs: add playwright-cli instruction files to testing guide"
```
