const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    console.log('1. 访问首页...');
    await page.goto('http://localhost:20880/', { timeout: 10000 });
    await page.waitForTimeout(2000);
    
    console.log('2. 点击第一个 Agent 卡片...');
    const agentCards = await page.$$('.agent-card');
    if (agentCards.length > 0) {
      await agentCards[0].click();
      await page.waitForTimeout(2000);
    } else {
      console.log('没有找到 Agent 卡片，尝试其他选择器...');
      // 尝试其他方式找到 Agent
      const cards = await page.$$('[class*="cursor-pointer"]');
      if (cards.length > 0) {
        await cards[0].click();
        await page.waitForTimeout(2000);
      }
    }
    
    console.log('3. 截图...');
    await page.screenshot({ path: '/tmp/planning_mode_test.png', fullPage: true });
    
    // 检查是否有规划模式选择器
    const planningModeSelector = await page.$('input[name="planningMode"]');
    if (planningModeSelector) {
      console.log('✓ 找到规划模式选择器');
    } else {
      console.log('✗ 未找到规划模式选择器');
    }
    
    console.log('测试完成！');
  } catch (error) {
    console.error('测试错误:', error.message);
    await page.screenshot({ path: '/tmp/planning_mode_error.png', fullPage: true });
  } finally {
    await browser.close();
  }
})();
