# Playwright Headed模式演示指南

> 本文档基于2026-03-18例行demo调试经验总结，确保后续演示脚本能稳定运行。

---

## 黄金原则

### 1. X11远程转发兼容性（最重要）

**问题**：X11远程转发（如XQuartz）与Chromium存在兼容性问题，显式指定窗口/viewport大小会导致渲染区域不正确（页面空白或部分显示）。

**解决方案**：
```javascript
// ✅ 正确配置（X11兼容）
browser = await chromium.launch({
  headless: false,
  slowMo: 100,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled',
    `--display=${display}`
    // ❌ 不要添加 --window-size 参数
  ]
});
context = await browser.newContext({ viewport: null });  // ✅ 使用 null
page = await context.newPage();

// ❌ 错误配置（X11不兼容）
context = await browser.newContext({
  viewport: { width: 1280, height: 900 }  // ❌ 会导致渲染问题
});
```

**原因分析**：
- XQuartz不支持Chromium需要的某些X11扩展（如COMPOSITE）
- 显式指定viewport大小会触发X11渲染区域计算错误
- 使用 `viewport: null` 让浏览器使用默认分辨率，由窗口管理器决定

### 2. 显示器检测

```javascript
const display = process.env.DISPLAY || '';
if (!display) {
  console.error('❌ 未检测到DISPLAY环境变量');
  process.exit(1);
}

// 判断显示器类型
const isLocalDisplay = display.startsWith(':') || display.startsWith('unix:');
const displayType = isLocalDisplay ? '本地显示器' : '远程显示器';
console.log(`📺 显示器检测: ${displayType} (${display})`);
```

### 3. 浏览器启动参数精简

**推荐配置**：
```javascript
args: [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-blink-features=AutomationControlled',
  `--display=${display}`
]
```

**避免使用的参数**：
- `--window-size=1280,900` ❌ X11不兼容
- `--force-device-scale-factor=1` ❌ 可能导致渲染问题
- `--disable-gpu` ⚠️ 通常不需要，除非有GPU相关问题
- `--use-gl=swiftshader` ❌ 可能导致其他问题

### 4. 元素选择器优先级

1. **优先使用语义化选择器**：`getByRole()`, `getByText()`, `getByLabel()`
2. **避免使用CSS类选择器**：类名可能随UI框架更新变化
3. **使用 `.first()` 处理多个匹配**

```javascript
// ✅ 推荐
const btn = page.getByRole('button', { name: /新建|创建/ }).first();
const input = page.locator('input[type="text"][placeholder]').first();

// ❌ 避免
const btn = page.locator('.bg-blue-500.px-4.py-2');
```

### 5. 模态框和遮罩处理

当遇到模态框遮挡问题时：

```javascript
// 方法1：使用 force: true 绕过遮挡（谨慎使用）
await button.click({ force: true });

// 方法2：等待模态框关闭后再操作
await page.waitForSelector('.modal', { state: 'hidden' });

// 方法3：先处理模态框内容
const modalInput = page.locator('.modal input').first();
await modalInput.fill('内容');
```

### 6. 复杂UI操作优先使用API

对于知识库创建等复杂操作，优先使用API而非UI交互：

```javascript
// ✅ 通过API创建（更可靠）
const res = await fetch('http://localhost:20881/api/knowledge-bases', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: '知识库名称', description: '描述' })
});

// ❌ 通过UI创建（选择器复杂，易出错）
await page.click('button:has-text("新建")');
await page.fill('input', '知识库名称');
await page.click('button:has-text("创建")');
```

---

## 调试技巧

### 1. 截图分析

当测试失败时，首先查看截图：
```javascript
await page.screenshot({ path: 'debug.png', fullPage: true });
```

### 2. Console日志收集

```javascript
page.on('console', msg => {
  console.log(`[${msg.type()}] ${msg.text()}`);
});
```

### 3. 元素可见性检查

```javascript
const isVisible = await element.isVisible({ timeout: 3000 }).catch(() => false);
if (!isVisible) {
  console.log('元素不可见，检查选择器');
}
```

### 4. 使用Playwright Inspector

```bash
PWDEBUG=1 node demo.mjs
```

---

## 常见问题排查

| 问题 | 可能原因 | 解决方案 |
|------|---------|---------|
| 页面空白/部分显示 | viewport指定了大小 | 使用 `viewport: null` |
| 元素点击失败 | 模态框遮挡 | 使用 `{ force: true }` 或先处理模态框 |
| 选择器找不到元素 | UI结构变化 | 使用语义化选择器，检查截图 |
| 浏览器启动失败 | DISPLAY未设置 | 检查环境变量 |

---

## 演示脚本模板

```javascript
import { chromium } from 'playwright';

const display = process.env.DISPLAY || '';
if (!display) {
  console.error('❌ 未检测到显示器');
  process.exit(1);
}

const browser = await chromium.launch({
  headless: false,
  slowMo: 100,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled',
    `--display=${display}`
  ]
});

// 关键：使用 viewport: null
const context = await browser.newContext({ viewport: null });
const page = await context.newPage();

// ... 演示逻辑
```

---

## 参考案例

- **工作版本**：`.claude/skills/routine-uat-demo-v0/scripts/demo.mjs`
- **当前版本**：`.claude/skills/routine-uat-demo/scripts/demo.mjs`

当遇到问题时，对比这两个版本的差异，特别是浏览器启动配置。

---

*最后更新：2026-03-18*
