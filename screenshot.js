const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // 访问当前应用
  console.log('Navigating to http://127.0.0.1:20880...');
  await page.goto('http://127.0.0.1:20880', { waitUntil: 'networkidle' });

  // 等待页面加载完成
  await page.waitForTimeout(3000);

  // 截图
  await page.screenshot({ path: '/Users/wadmin/Desktop/vscode/agent-general/data/screenshot.png', fullPage: true });

  // 获取页面内容
  const content = await page.content();
  console.log('Page loaded, body content length:', content.length);

  await browser.close();
  console.log('Screenshot saved to data/screenshot.png');
})();
