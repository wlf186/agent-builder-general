# Playwright 测试指南

> 本文档提供 Agent Builder 的 UAT 测试规范和最佳实践。

---

## ⛔⛔⛔ 绝对红线

### 远程 X11 环境禁止使用 Playwright Test Runner

> **这是一条不可违反的规则，没有任何例外。**

| 场景 | ✅ 正确 | ❌ 禁止 |
|------|--------|--------|
| **Headed + 远程 X11** | `node demo.mjs` | `npx playwright test` |
| **Headless / CI** | `npx playwright test` | - |

**原因**：Test Runner 会自动管理浏览器生命周期，在远程 X11 环境中会导致浏览器意外关闭（"Target page, context or browser has been closed"）。

**项目中受影响的文件**：48 个 `.spec.ts` 文件都使用 Test Runner，**全部禁止在 headed 远程演示中使用**。

### 🛡️ 自动保护机制

项目已在 `playwright.config.ts` 中配置 `globalSetup`，运行任何 `.spec.ts` 测试时会自动检查：

```
⛔⛔⛔ 绝对红线：远程 X11 环境禁止使用 Playwright Test Runner ⛔⛔⛔

检测到远程显示器: DISPLAY=100.82.215.93:0

原因: Test Runner 会自动关闭浏览器，在远程 X11 中会导致连接断裂

解决方案:
  ❌ npx playwright test xxx.spec.ts --headed
  ✅ node xxx.mjs  (直接运行脚本)
```

**无需记忆**：系统会自动拦截并给出明确提示。

### 执行前环境检查（可选）

如需手动确认环境类型：

```bash
cd /home/wremote/claude-dev/agent-builder-general/.claude/skills/routine-uat-demo/scripts
node check-display.mjs
```

输出说明：
- `✅ 本地显示器` → 安全，可以使用任何方式
- `⚠️ 远程显示器` → **必须用** `node xxx.mjs`，**禁止** `npx playwright test`
- `❌ 无显示器` → 禁止 headed 模式

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

### 正确的选择器
```typescript
// ✅ 正确：选中右侧聊天输入框（input type="text"）
const chatInput = page.locator('input[type="text"][placeholder]').first();

// 或者通过 placeholder 内容定位
const chatInput = page.locator('input[placeholder*="输入消息"], input[placeholder*="message"]').first();
```

### 错误的选择器
```typescript
// ❌ 错误：选中左侧人设编辑框（textarea）
const chatInput = page.locator('textarea').first();
```

---

## ⛔ 绝对红线：远程 X11 环境禁止使用 Playwright Test Runner

> ⚠️ **严重警告**：在远程 X11 环境中运行 headed 模式演示时，**禁止使用 `npx playwright test`**，必须使用 `node xxx.mjs` 直接运行脚本。

### 问题现象

运行 `npx playwright test xxx.spec.ts --headed` 时，浏览器会在测试过程中意外关闭：

```
Error: locator.click: Target page, context or browser has been closed
```

### 根本原因

| 问题 | 说明 |
|------|------|
| **框架托管生命周期** | Playwright Test Runner 自动管理浏览器生命周期，在测试结束/超时/错误时关闭浏览器 |
| **远程 X11 脆弱性** | 远程 X11 连接对浏览器关闭事件敏感，框架自动关闭可能导致连接断裂 |
| **时序问题** | 框架可能在操作进行中触发关闭，导致 "browser has been closed" 错误 |

### 正确做法：使用 Node 脚本直接运行

```bash
# ✅ 正确：直接运行 Node 脚本
node demo.mjs

# ❌ 错误：使用 Playwright Test Runner
npx playwright test demo.spec.ts --headed
```

### Node 脚本模板（远程 X11 兼容）

```javascript
import { chromium } from 'playwright';

(async () => {
  // 1. 检查 DISPLAY
  const display = process.env.DISPLAY || '';
  if (!display) {
    console.error('未检测到 DISPLAY 环境变量');
    process.exit(1);
  }

  // 2. 启动浏览器（关键配置）
  const browser = await chromium.launch({
    headless: false,
    slowMo: 100,                              // 减慢操作，提高稳定性
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      `--display=${display}`                  // 指定显示器
    ]
  });

  // 3. 使用默认分辨率（X11 兼容）
  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();

  try {
    // 测试逻辑...
    await page.goto('http://localhost:20880');
    await page.waitForLoadState('networkidle');

    // 4. 触发重绘（X11 远程投屏必做）
    await page.evaluate(() => window.scrollTo(0, 0));

    // 更多操作...

  } finally {
    // 5. 手动清理（精确控制）
    await page.close();
    await context.close();
    await browser.close();
  }
})();
```

### 关键差异对比

| 项目 | Node 脚本 (✅) | Playwright Test (❌) |
|------|---------------|---------------------|
| 运行方式 | `node demo.mjs` | `npx playwright test` |
| 浏览器控制 | 手动 `chromium.launch()` | 框架自动管理 |
| viewport | `{ viewport: null }` 默认 | 框架默认固定尺寸 |
| slowMo | 设置 `slowMo: 100` | 无 |
| 浏览器关闭 | 手动 `cleanup()` 精确控制 | 框架自动（可能过早） |
| 生命周期 | 完全可控 | 框架托管 |

---

## Headed 模式必做事项

> ⚠️ **X11 远程投屏渲染问题** - 通过 X11/VNC 远程投屏运行 headed 模式时，初始渲染可能出现屏幕内容断裂（大部分内容被遮盖）。

**解决方案**：在 `page.waitForLoadState('networkidle')` 之后，必须触发一次滚动重绘：

```typescript
// 修复 X11 远程投屏渲染问题：触发浏览器重绘
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(100);
```

**技术原理**：X11 远程投屏时，浏览器初始渲染可能与远程显示同步出现问题。`scrollTo` 操作会触发浏览器的 full repaint，强制将正确内容同步到 X11 显示缓冲区。

---

## 标准测试模板

```typescript
test('智能体聊天测试', async ({ page }) => {
  // 1. 访问主页
  await page.goto('http://localhost:20880');
  await page.waitForLoadState('networkidle');

  // 1.1 修复 X11 远程投屏渲染问题（headed 模式必做）
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(100);

  // 2. 选择智能体
  await page.locator('h3:has-text("test3")').first().click();
  await page.waitForTimeout(2000);

  // 3. 定位正确的输入框（关键！）
  const chatInput = page.locator('input[type="text"][placeholder]').first();
  await expect(chatInput).toBeVisible();

  // 4. 输入消息
  await chatInput.fill('你好');
  await page.waitForTimeout(500);

  // 5. 发送消息
  await chatInput.press('Enter');

  // 6. 等待并验证响应
  await page.waitForTimeout(5000);

  // 7. 验证响应内容（不是空字符串）
  const pageContent = await page.textContent('body');
  const hasValidResponse = pageContent?.includes('你好') ||
                          pageContent?.includes('高兴') ||
                          pageContent?.includes('帮助');
  expect(hasValidResponse).toBeTruthy();
});
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

## 常见问题排查

| 问题现象 | 可能原因 | 排查方法 |
|----------|----------|----------|
| API 返回参数错误 | 后端未重启加载新代码 | 重启后端服务 |
| 空响应 | LLM 调用失败 | 检查模型服务配置 |
| 选择器找不到元素 | 使用了错误的选择器 | 使用 `input[type="text"]` |
| 消息发送后无响应 | 输入到了人设编辑框 | 检查截图确认输入位置 |
| 静态资源 404 | Next.js 缓存不一致 | 清除 `.next` 目录重启 |
