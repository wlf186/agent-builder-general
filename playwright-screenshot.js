const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:20880');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/Users/wadmin/Desktop/vscode/agent-general/screenshot.png', fullPage: true });
  await browser.close();
  console.log('Screenshot saved to screenshot.png');
})();
