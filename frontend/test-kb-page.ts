import { test } from '@playwright/test';

test('Debug knowledge base page', async ({ page }) => {
  await page.goto('http://localhost:20880/knowledge-bases');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: '/tmp/kb-page-debug.png', fullPage: true });
  
  // 获取页面内容
  const content = await page.textContent('body');
  console.log('Page contains:', content?.substring(0, 500));
  
  // 检查按钮
  const buttons = await page.locator('button').all();
  console.log('Buttons found:', buttons.length);
  for (let i = 0; i < Math.min(buttons.length, 5); i++) {
    const text = await buttons[i].textContent();
    console.log(`Button ${i}:`, text);
  }
});
