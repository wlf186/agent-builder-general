const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:20880';
const SCREENSHOT_DIR = '/work/agent-builder-general/teams/AC130/iterations/20260313_01';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest(testName, message) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`测试用例: ${testName}`);
  console.log(`消息: ${message}`);
  console.log('='.repeat(60));

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
    await sleep(3000);

    // 等待环境初始化完成
    console.log('等待环境初始化完成...');
    let envReady = false;
    let waitCount2 = 0;
    while (!envReady && waitCount < 60) {
      await sleep(1000);
      waitCount2++;
      
      // 检查是否还有"环境初始化中"的提示
      const initializingText = await page.textContent('body');
      const hasInitializing = initializingText.includes('环境初始化中') || 
                              initializingText.includes('Environment initializing');
      
      // 检查是否有加载动画
      const loaders = page.locator('.animate-spin');
      const loaderCount = await loaders.count();
      
      if (!hasInitializing && loaderCount === 0) {
        console.log('✅ 环境初始化完成');
        envReady = true;
      } else {
        if (waitCount % 5 === 0) {
          console.log(`等待中... (${waitCount}s)`);
        }
      }
    }

    if (!envReady) {
      console.log('⚠ 环境初始化超时，继续测试...');
    }

    // 截图 - 环境就绪后的视图
    await page.screenshot({ path: `${SCREENSHOT_DIR}/${testName}-env-ready.png`, fullPage: true });

    // 查找所有 textarea 元素
    const textareas = page.locator('textarea');
    const textareaCount = await textareas.count();
    console.log(`找到 ${textareaCount} 个 textarea 元素`);

    // 查找输入框 - 聊天输入框
    let inputElement = null;

    if (textareaCount > 0) {
      // 从后往前找（聊天输入框通常在底部）
      for (let i = textareaCount - 1; i >= 0; i--) {
        const ta = textareas.nth(i);
        const placeholder = await ta.getAttribute('placeholder');
        const isVisible = await ta.isVisible();
        const isEnabled = await ta.isEnabled();
        const parentClass = await ta.evaluate(el => el.parentElement?.className || '');
        
        console.log(`Textarea ${i}: placeholder="${placeholder}", visible=${isVisible}, enabled=${isEnabled}, parentClass="${parentClass.substring(0, 100)}"`);
        
        // 聊天输入框通常在聊天卡片内（data-chat-card="true"）
        if (isVisible && isEnabled) {
          const inChatCard = parentClass.includes('chat') || 
                            await ta.evaluate(el => {
                              let p = el.parentElement;
                              while (p) {
                                if (p.getAttribute('data-chat-card') === 'true') return true;
                                p = p.parentElement;
                              }
                              return false;
                            });
          
          if (inChatCard || !placeholder || placeholder === '' || placeholder.includes('输入')) {
            inputElement = ta;
            console.log(`选择 textarea ${i} 作为输入框`);
            break;
          }
        }
      }
    }

    if (!inputElement) {
      console.log('⚠ 未找到聊天输入框，使用最后一个 textarea');
      if (textareaCount > 0) {
        inputElement = textareas.nth(textareaCount - 1);
      } else {
        throw new Error('未找到任何 textarea');
      }
    }

    console.log(`✅ 找到输入框`);

    // 输入消息
    await inputElement.click();
    await sleep(200);
    await inputElement.fill(message);
    console.log(`已输入消息: ${message}`);
    await sleep(500);

    // 截图 - 发送前
    await page.screenshot({ path: `${SCREENSHOT_DIR}/${testName}-before-send.png`, fullPage: true });

    // 查找发送按钮 - 在聊天卡片内
    const chatCard = page.locator('[data-chat-card="true"]');
    if (await chatCard.count() > 0) {
      const sendButtons = chatCard.locator('button');
      const btnCount = await sendButtons.count();
      console.log(`聊天卡片内有 ${btnCount} 个按钮`);
      
      let sent = false;
      for (let i = 0; i < btnCount; i++) {
        const btn = sendButtons.nth(i);
        const text = await btn.textContent();
        const title = await btn.getAttribute('title');
        const ariaLabel = await btn.getAttribute('aria-label');
        
        const buttonText = (text || '').trim();
        const isSendButton = buttonText.includes('发送') || 
                            buttonText.toLowerCase().includes('send') ||
                            (title && (title.includes('发送') || title.toLowerCase().includes('send'))) ||
                            (ariaLabel && (ariaLabel.includes('发送') || ariaLabel.toLowerCase().includes('send')));
        
        if (isSendButton) {
          console.log(`找到发送按钮: "${buttonText}"`);
          await btn.click();
          sent = true;
          break;
        }
      }

      if (!sent) {
        console.log('尝试按 Shift+Enter 键...');
        await inputElement.press('Shift+Enter');
      }
    } else {
      // 找不到聊天卡片，直接按 Enter
      console.log('找不到聊天卡片，尝试按 Enter 键...');
      await inputElement.press('Enter');
    }

    // 等待响应
    console.log('等待响应 (30秒)...');
    
    let waitCount2 = 0;
    let lastMessageCount = 0;
    let responseDetected = false;
    
    while (waitCount2 < 30 && !responseDetected) {
      await sleep(1000);
      waitCount2++;
      
      // 检查消息数量
      const messages = page.locator('[class*="message"]');
      const count2 = await messages.count();
      if (count > lastMessageCount) {
        console.log(`检测到新消息 (总${count}条)`);
        lastMessageCount = count;
      }
      
      // 检查是否有完整响应
      if (count > 0) {
        const lastMessage = messages.last();
        const text = await lastMessage.textContent();
        if (text && text.trim().length > 50) {
          console.log(`✅ 检测到完整响应 (${text.length} 字符)`);
          responseDetected = true;
        }
      }
      
      // 检查是否停止加载
      const loaders = page.locator('.animate-spin, [class*="loading"]');
      if (await loaders.count() === 0 && count > 0) {
        console.log('加载完成');
        responseDetected = true;
      }
    }

    // 截图 - 响应后
    await page.screenshot({ path: `${SCREENSHOT_DIR}/${testName}-after-response.png`, fullPage: true });
    console.log('截图保存: after-response');

    // 分析页面内容
    const allText = await page.textContent('body');
    console.log('\n=== 页面文本分析 ===');
    
    const hasThinking = allText.includes('思考过程') || allText.includes('thinking');
    const hasTool = allText.includes('工具调用') || allText.includes('tool_call');
    
    console.log(`包含思考过程: ${hasThinking ? '✅' : '❌'}`);
    console.log(`包含工具调用: ${hasTool ? '✅' : '❌'}`);

    // 查找消息
    const messages = page.locator('[class*="message"]');
    const messageCount = await messages.count();
    console.log(`\n找到 ${messageCount} 个消息元素`);

    for (let i = 0; i < Math.min(messageCount, 3); i++) {
      const msg = messages.nth(i);
      const text = await msg.textContent();
      const preview = text ? text.substring(0, 150).replace(/\n/g, ' ') : '(空)';
      console.log(`[${i}] ${preview}...`);
    }

    return {
      testName,
      message,
      hasThinking,
      hasTool,
      messageCount,
      success: true
    };

  } catch (error) {
    console.error(`测试执行出错: ${error.message}`);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/${testName}-error.png`, fullPage: true });
    return {
      testName,
      message,
      error: error.message,
      success: false
    };
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log('AC130 问题复现测试 V7');
  console.log(`截图目录: ${SCREENSHOT_DIR}`);

  const results = [];

  // 测试用例1: 冷笑话
  results.push(await runTest('test01-cold-joke', '讲一个冷笑话'));

  return results;
}

main().then(results => {
  console.log('\n测试完成');
  process.exit(0);
}).catch(error => {
  console.error('测试失败:', error);
  process.exit(1);
});
