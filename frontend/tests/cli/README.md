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
