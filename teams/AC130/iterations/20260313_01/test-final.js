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

  // 监听网络请求
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('/chat') || url.includes('/stream')) {
      console.log(`Network: ${response.status()} ${url}`);
    }
  });

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

    // 查找聊天卡片内的输入框
    const chatCard = page.locator('[data-chat-card="true"]');
    const inputElement = chatCard.locator('input[type="text"]').first();
    
    // 等待输入框可见
    await inputElement.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✅ 找到聊天输入框');

    // 输入消息
    await inputElement.fill(message);
    console.log(`已输入消息: ${message}`);
    await sleep(500);

    // 截图 - 发送前
    await page.screenshot({ path: `${SCREENSHOT_DIR}/${testName}-before-send.png`, fullPage: true });

    // 查找发送按钮
    const sendButton = chatCard.locator('button:has-text("发送")').first();
    await sendButton.click();
    console.log('已点击发送按钮');

    // 等待响应
    console.log('等待响应 (30秒)...');
    
    let respWaitCount = 0;
    let responseDetected = false;
    
    while (respWaitCount < 30 && !responseDetected) {
      await sleep(1000);
      respWaitCount++;
      
      // 检查消息
      const messages = page.locator('[class*="message"]');
      const msgCount = await messages.count();
      
      if (msgCount > 0) {
        const lastMessage = messages.last();
        const text = await lastMessage.textContent();
        if (text && text.trim().length > 30) {
          console.log(`✅ 检测到完整响应 (${text.length} 字符)`);
          responseDetected = true;
        }
      }
      
      // 检查是否停止加载
      const loaders = page.locator('.animate-spin');
      if (await loaders.count() === 0 && msgCount > 0) {
        console.log('加载完成');
        // 再等一下确保内容完全加载
        await sleep(2000);
        responseDetected = true;
      }
    }

    // 截图 - 响应后
    await page.screenshot({ path: `${SCREENSHOT_DIR}/${testName}-after-response.png`, fullPage: true });
    console.log('截图保存: after-response');

    // 分析页面内容
    const bodyText = await page.textContent('body');
    console.log('\n=== 页面文本分析 ===');
    
    const hasThinking = bodyText.includes('思考过程') || bodyText.includes('thinking');
    const hasTool = bodyText.includes('工具调用') || bodyText.includes('tool_call');
    
    console.log(`包含思考过程: ${hasThinking ? '✅' : '❌'}`);
    console.log(`包含工具调用: ${hasTool ? '✅' : '❌'}`);

    // 查找消息
    const messages = page.locator('[class*="message"]');
    const messageCount = await messages.count();
    console.log(`\n找到 ${messageCount} 个消息元素`);

    for (let i = 0; i < Math.min(messageCount, 5); i++) {
      const msg = messages.nth(i);
      const text = await msg.textContent();
      const className = await msg.getAttribute('class');
      const role = await msg.getAttribute('data-role');
      const preview = text ? text.substring(0, 200).replace(/\n/g, ' ') : '(空)';
      console.log(`[${i}] role=${role}, ${preview}...`);
    }

    // 检查思考过程区域
    const thinkingElements = page.locator('[class*="thinking"]');
    const thinkingCount = await thinkingElements.count();
    console.log(`\n找到 ${thinkingCount} 个思考过程元素`);
    
    if (thinkingCount > 0) {
      for (let i = 0; i < thinkingCount; i++) {
        const el = thinkingElements.nth(i);
        const text = await el.textContent();
        console.log(`思考过程 ${i + 1}: ${text?.substring(0, 200) || '(空)'}`);
      }
    }

    // 检查工具调用
    const toolElements = page.locator('[class*="tool-call"], [class*="tool_call"], [class*="ToolCall"]');
    const toolCount = await toolElements.count();
    console.log(`\n找到 ${toolCount} 个工具调用元素`);
    
    if (toolCount > 0) {
      for (let i = 0; i < toolCount; i++) {
        const el = toolElements.nth(i);
        const text = await el.textContent();
        console.log(`工具调用 ${i + 1}: ${text?.substring(0, 200) || '(空)'}`);
      }
    }

    return {
      testName,
      message,
      hasThinking,
      hasTool,
      messageCount,
      thinkingCount,
      toolCount,
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
  console.log('AC130 问题复现测试 - Final Version');
  console.log(`截图目录: ${SCREENSHOT_DIR}`);

  const results = [];

  // 测试用例1: 冷笑话
  results.push(await runTest('test01-cold-joke', '讲一个冷笑话'));

  // 测试用例2: 数学计算
  results.push(await runTest('test02-math', '3294/919+213'));

  // 测试用例3: BTC价格
  results.push(await runTest('test03-btc', 'BTC的最新价格'));

  // 输出汇总
  console.log('\n' + '='.repeat(60));
  console.log('测试汇总');
  console.log('='.repeat(60));

  results.forEach((result, index) => {
    console.log(`\n测试 ${index + 1}: ${result.testName}`);
    console.log(`  消息: ${result.message}`);
    if (result.success) {
      console.log(`  消息数量: ${result.messageCount}`);
      console.log(`  思考过程: ${result.hasThinking ? '✅ 有' : '❌ 无'}`);
      console.log(`  工具调用: ${result.hasTool ? '✅ 有' : '❌ 无'}`);
    } else {
      console.log(`  状态: ❌ 失败 - ${result.error}`);
    }
  });

  return results;
}

main().then(results => {
  console.log('\n测试完成');
  process.exit(0);
}).catch(error => {
  console.error('测试失败:', error);
  process.exit(1);
});
