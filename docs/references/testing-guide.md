# Playwright 测试指南

> 本文档提供 Agent Builder 的 UAT 测试规范和最佳实践。

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
