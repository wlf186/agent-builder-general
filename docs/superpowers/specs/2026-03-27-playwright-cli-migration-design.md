# Playwright Headless 脚本迁移到 playwright-cli 指令文件

**日期**: 2026-03-27
**状态**: Draft
**目标**: 将 ~60 个 headless `.spec.ts` 测试脚本改造成 Markdown 指令文件，由 Claude 通过 playwright-cli skill 执行，消除手动编写选择器的负担。

---

## 背景

项目中有约 60 个使用默认 headless 模式的 `.spec.ts` 测试文件，分布在 `frontend/tests/` 和 `tests/` 目录。这些脚本存在以下痛点：

1. **选择器维护成本高** — 大量 fallback 选择器数组、class 模式匹配、`:has-text()` 等
2. **脚本编写繁琐** — 每个交互都需要手写 `page.locator()` + 等待逻辑
3. **脚本质量参差不齐** — 从 9 行到 630 行不等，选择器风格不统一

## 当前脚本分布

| 复杂度 | 数量 | 行数范围 | 典型特征 |
|--------|------|----------|----------|
| Simple | ~15 | < 50 行 | 导航 + 截图 + 基本验证 |
| Medium | ~30 | 50-150 行 | 多步工作流 + 断言 + 简单循环 |
| Complex | ~18 | > 150 行 | 多页面 + hooks + 事件监听 + 自定义 helper |

## 解决方案

将 TypeScript 脚本改造成 **Markdown 指令文件**，由 Claude 通过 playwright-cli skill 执行。

### 核心理念

- **选择器完全消失** — playwright-cli 的 snapshot 提供元素引用（e1, e2, e3...），不需要写任何 CSS/XPath
- **自然语言即脚本** — Markdown 格式的步骤描述，比 TypeScript 更易读易维护
- **Claude 做判断** — 循环、条件分支、断言由 Claude 根据 snapshot 输出实时判断
- **交互式调试** — 每一步都能看到 snapshot，出问题立刻定位

### 指令文件格式

```markdown
# UAT: 发送消息并验证响应

## 前置条件
- 服务已启动 (localhost:20880)

## 步骤
1. 打开 http://localhost:20880/chat
2. snapshot 查看页面，找到聊天输入框
3. 在输入框中输入 "你好，2+2等于多少？"
4. 按 Enter 发送
5. 等待 3 秒后 snapshot，检查是否出现助手回复
6. 截图保存到 test-results/uat-message.png

## 验证
- 助手回复中应包含 "4"
- 无错误提示
```

### 按复杂度的处理策略

#### Simple 脚本（~15 个）

纯指令文件，Claude 逐步执行 playwright-cli 命令（open → snapshot → fill/click → screenshot → close）。

#### Medium 脚本（~30 个）

指令文件 + `run-code` 命令处理复杂逻辑：

```markdown
## 步骤
1. 打开 http://localhost:20880
2. snapshot 查看智能体列表
3. 使用 run-code 遍历所有智能体卡片，找到名称包含 "RAG" 的，点击它：
   ```
   run-code "async page => {
     const cards = await page.locator('.agent-card').all();
     for (const card of cards) {
       const name = await card.textContent();
       if (name.includes('RAG')) { await card.click(); break; }
     }
   }"
   ```
4. 发送测试消息并验证回复
```

#### Complex 脚本（~18 个）

拆分为多个子测试指令文件，每个覆盖一个独立场景。例如 `history-conversation.spec.ts`（630 行）拆分为：

- `history-create.md` — 创建新对话
- `history-switch.md` — 切换对话
- `history-persist.md` — 对话持久化验证
- `history-continue.md` — 继续历史对话

### 指令文件存放位置

```
frontend/tests/cli/
  simple/
    debug-kb.md
    verify-agents.md
    ...
  medium/
    rag-simple-test.md
    uat-simple.md
    ...
  complex/
    history/
      history-create.md
      history-switch.md
      ...
```

## 执行流程

```
用户: "运行 frontend/tests/cli/simple/debug-kb.md"
  → Claude 读取 Markdown 指令文件
  → 调用 playwright-cli skill
  → 执行: open → snapshot → fill/click → snapshot → screenshot
  → Claude 解析每个 snapshot 输出
  → 判断是否符合预期
  → 返回测试结果（通过/失败 + 截图）
```

## 已知限制

1. **Token 消耗** — 每步需要 Claude 解析 snapshot，比直接运行 TypeScript 脚本慢且费 token
2. **非确定性** — Claude 每次可能做出略微不同的判断，不适合需要严格可复现性的场景
3. **速度** — 交互式执行比批量运行慢，不适合大规模回归测试
4. **Complex 脚本拆分** — 原本一个文件覆盖多个场景的测试需要拆成多个指令文件

## 适用场景

- 开发过程中的快速验证（"这个功能还正常吗？"）
- 一次性 UAT 测试
- 需要人工判断的探索性测试
- 演示场景（演示前快速跑一遍验证）

## 不适用场景

- CI/CD 自动化回归测试（仍应保留部分 .spec.ts）
- 需要严格可复现结果的性能测试
- 大规模并行测试

## 迁移计划

优先迁移的脚本类别（按价值排序）：

1. **RAG 相关**（~13 个）— 高频使用，选择器最复杂
2. **Langfuse 集成**（~8 个）— 外部依赖，适合交互式验证
3. **UAT 通用**（~15 个）— 数量最多，简化收益最大
4. **迭代特定**（~9 个）— 历史脚本，优先级低
5. **Feature 特定**（~8 个）— 按需迁移

不需要迁移的脚本：
- `global-setup.ts` — 框架级配置，不是测试
- `tests/debug-url.spec.ts` — 调试工具，不需要改造
