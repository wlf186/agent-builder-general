const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:20880';
const SCREENSHOT_DIR = '/work/agent-builder-general/teams/AC130/iterations/20260313_01';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('AC130 调试模式 V8 - 检查页面结构');
  
  const browser = await chromium.launch({ headless: true });
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

    // 截图
    await page.screenshot({ path: `${SCREENSHOT_DIR}/debug-page-structure.png`, fullPage: true });

    // 打印页面结构
    console.log('\n=== 页面结构分析 ===');
    
    // 检查聊天卡片
    const chatCard = page.locator('[data-chat-card="true"]');
    const chatCardCount = await chatCard.count();
    console.log(`聊天卡片数量: ${chatCardCount}`);
    
    if (chatCardCount > 0) {
      const isVisible = await chatCard.isVisible();
      console.log(`聊天卡片可见: ${isVisible}`);
      
      if (isVisible) {
        // 查找聊天卡片内的所有输入元素
        const textareas = chatCard.locator('textarea');
        const taCount = await textareas.count();
        console.log(`聊天卡片内 textarea 数量: ${taCount}`);
        
        const inputs = chatCard.locator('input[type="text"]');
        const inputCount = await inputs.count();
        console.log(`聊天卡片内 input[type="text"] 数量: ${inputCount}`);
        
        const editable = chatCard.locator('[contenteditable="true"]');
        const editableCount = await editable.count();
        console.log(`聊天卡片内 contenteditable 数量: ${editableCount}`);
        
        // 查找所有按钮
        const buttons = chatCard.locator('button');
        const btnCount = await buttons.count();
        console.log(`聊天卡片内按钮数量: ${btnCount}`);
        
        for (let i = 0; i < Math.min(btnCount, 10); i++) {
          const btn = buttons.nth(i);
          const text = await btn.textContent();
          console.log(`  按钮 ${i}: "${(text || '').trim()}"`);
        }
        
        // 如果找到 textarea，打印其属性
        if (taCount > 0) {
          for (let i = 0; i < taCount; i++) {
            const ta = textareas.nth(i);
            const placeholder = await ta.getAttribute('placeholder');
            const className = await ta.getAttribute('class');
            console.log(`  Textarea ${i}: placeholder="${placeholder}", class="${className}"`);
          }
        }
        
        // 如果找到 contenteditable，打印其属性
        if (editableCount > 0) {
          for (let i = 0; i < editableCount; i++) {
            const ed = editable.nth(i);
            const className = await ed.getAttribute('class');
            const role = await ed.getAttribute('role');
            console.log(`  ContentEditable ${i}: class="${className}", role="${role}"`);
          }
        }
      }
    } else {
      console.log('⚠ 未找到聊天卡片');
      
      // 检查是否有"环境初始化中"的提示
      const bodyText = await page.textContent('body');
      if (bodyText.includes('环境初始化中')) {
        console.log('页面显示"环境初始化中"');
      }
      
      // 检查所有卡片
      const allCards = page.locator('[class*="card"]');
      const cardCount = await allCards.count();
      console.log(`页面共有 ${cardCount} 个卡片元素`);
    }
    
    // 检查整个页面的输入元素
    const allTextareas = page.locator('textarea');
    const allTaCount = await allTextareas.count();
    console.log(`\n整个页面 textarea 数量: ${allTaCount}`);
    
    for (let i = 0; i < allTaCount; i++) {
      const ta = allTextareas.nth(i);
      const placeholder = await ta.getAttribute('placeholder');
      const inChatCard = await ta.evaluate(el => {
        let p = el.parentElement;
        while (p) {
          if (p.getAttribute('data-chat-card') === 'true') return true;
          p = p.parentElement;
        }
        return false;
      });
      console.log(`  Textarea ${i}: placeholder="${placeholder}", inChatCard=${inChatCard}`);
    }

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
