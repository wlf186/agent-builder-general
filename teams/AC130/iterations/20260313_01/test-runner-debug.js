const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:20880';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('AC130 调试模式 - 检查页面结构');
  
  const browser = await chromium.launch({ headless: false });  // 有界面模式便于观察
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 导航到主页
    console.log('导航到主页...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await sleep(2000);

    // 查找并点击 test 智能体卡片
    const textLocator = page.locator('text="test"').first();
    await textLocator.click();
    console.log('✅ 已点击 test 智能体卡片');

    // 等待页面切换到配置视图
    console.log('等待配置视图加载...');
    await sleep(5000);

    // 等待环境初始化完成
    console.log('等待环境初始化完成...');
    let envReady = false;
    let envWaitCount = 0;
    while (!envReady && envWaitCount < 60) {
      await sleep(1000);
      envWaitCount++;
      
      const bodyText = await page.textContent('body');
      const hasInitializing = bodyText.includes('环境初始化中');
      const loaders = page.locator('.animate-spin');
      const loaderCount = await loaders.count();
      
      if (!hasInitializing && loaderCount === 0) {
        console.log('✅ 环境初始化完成');
        envReady = true;
      }
    }

    // 打印页面结构
    console.log('\n=== 页面结构分析 ===');
    
    // 检查聊天卡片
    const chatCard = page.locator('[data-chat-card="true"]');
    const chatCardCount = await chatCard.count();
    console.log(`聊天卡片数量: ${chatCardCount}`);
    
    if (chatCardCount > 0) {
      const isVisible = await chatCard.isVisible();
      console.log(`聊天卡片可见: ${isVisible}`);
      
      // 查找聊天卡片内的所有元素
      const allElements = await chatCard.locator('*').all();
      console.log(`聊天卡片内元素总数: ${allElements.length}`);
      
      // 查找 textarea
      const textareas = chatCard.locator('textarea');
      const taCount = await textareas.count();
      console.log(`聊天卡片内 textarea 数量: ${taCount}`);
      
      // 查找输入相关元素
      const inputs = chatCard.locator('input');
      const inputCount = await inputs.count();
      console.log(`聊天卡片内 input 数量: ${inputCount}`);
      
      // 查找 contenteditable 元素
      const editable = chatCard.locator('[contenteditable="true"]');
      const editableCount = await editable.count();
      console.log(`聊天卡片内 contenteditable 数量: ${editableCount}`);
    }
    
    // 检查整个页面的 textarea
    const allTextareas = page.locator('textarea');
    const allTaCount = await allTextareas.count();
    console.log(`\n整个页面 textarea 数量: ${allTaCount}`);
    
    for (let i = 0; i < allTaCount; i++) {
      const ta = allTextareas.nth(i);
      const placeholder = await ta.getAttribute('placeholder');
      const parentClass = await ta.evaluate(el => el.parentElement?.className || '');
      console.log(`  Textarea ${i}: placeholder="${placeholder}", parent="${parentClass.substring(0, 50)}"`);
    }

    // 保持浏览器打开以便观察
    console.log('\n浏览器保持打开，按 Ctrl+C 退出...');
    await sleep(60000);  // 保持 60 秒

  } catch (error) {
    console.error(`出错: ${error.message}`);
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error('测试失败:', error);
  process.exit(1);
});
