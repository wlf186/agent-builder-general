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

  // 监听控制台消息
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`Browser console error: ${msg.text()}`);
    }
  });

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

    // 直接导航到智能体对话页面
    console.log('导航到 test 智能体页面...');
    await page.goto(`${BASE_URL}/agents/test`, { waitUntil: 'networkidle' });
    await sleep(3000);

    // 打印页面标题确认页面加载
    const title = await page.title();
    console.log(`页面标题: ${title}`);

    // 查找输入框 - 尝试多种选择器
    const inputSelectors = [
      'textarea',
      'input[type="text"]',
      '[contenteditable="true"]',
      'div[role="textbox"]',
      'input[placeholder*="发送"]',
      'textarea[placeholder*="发送"]',
    ];

    let inputElement = null;
    for (const selector of inputSelectors) {
      try {
        const element = page.locator(selector).first();
        const count = await element.count();
        console.log(`选择器 "${selector}" 找到 ${count} 个元素`);
        if (count > 0) {
          const isVisible = await element.isVisible({ timeout: 1000 });
          console.log(`  可见性: ${isVisible}`);
          if (isVisible) {
            inputElement = element;
            break;
          }
        }
      } catch (e) {
        console.log(`选择器 "${selector}" 出错: ${e.message}`);
      }
    }

    if (!inputElement) {
      console.log('⚠ 未找到输入框');
      // 截图调试
      await page.screenshot({ path: `${SCREENSHOT_DIR}/${testName}-debug-no-input.png` });
      throw new Error('未找到输入框');
    }

    console.log('✅ 找到输入框');

    // 输入消息
    await inputElement.fill(message);
    console.log(`已输入消息: ${message}`);
    await sleep(500);

    // 截图 - 发送前
    await page.screenshot({ path: `${SCREENSHOT_DIR}/${testName}-before-send.png`, fullPage: true });

    // 查找发送按钮
    const sendButtonSelectors = [
      'button:has-text("发送")',
      'button[type="submit"]',
      'button[aria-label*="发送"]',
    ];

    let sent = false;
    for (const selector of sendButtonSelectors) {
      try {
        const button = page.locator(selector).first();
        if (await button.isVisible({ timeout: 1000 })) {
          await button.click();
          console.log(`已点击发送按钮 (${selector})`);
          sent = true;
          break;
        }
      } catch (e) {
        // 继续尝试
      }
    }

    if (!sent) {
      // 尝试按回车键
      console.log('尝试按回车键...');
      await inputElement.press('Enter');
      await sleep(500);
    }

    // 等待响应 - 使用更长的等待时间
    console.log('等待响应 (20秒)...');
    await sleep(20000);

    // 截图 - 响应后
    await page.screenshot({ path: `${SCREENSHOT_DIR}/${testName}-after-response.png`, fullPage: true });

    // 获取页面的完整文本内容
    const pageText = await page.textContent('body');
    console.log('\n=== 页面文本内容 (前2000字符) ===');
    console.log(pageText?.substring(0, 2000) || '无内容');

    // 检查是否有任何消息
    const messageSelectors = [
      '[class*="message"]',
      '[class*="Message"]',
      '.prose',
      'article',
      '[class*="chat"]',
    ];

    let messageContent = null;
    for (const selector of messageSelectors) {
      try {
        const messages = page.locator(selector);
        const count = await messages.count();
        console.log(`选择器 "${selector}" 找到 ${count} 个元素`);
        if (count > 0) {
          const text = await messages.allTextContents();
          console.log(`  内容预览: ${JSON.stringify(text).substring(0, 200)}`);
          if (text && text.length > 0) {
            messageContent = text;
            break;
          }
        }
      } catch (e) {
        // 继续尝试
      }
    }

    return {
      testName,
      message,
      pageTextPreview: pageText?.substring(0, 1000),
      messageContent,
      screenshotAfter: `${SCREENSHOT_DIR}/${testName}-after-response.png`
    };

  } catch (error) {
    console.error(`测试执行出错: ${error.message}`);
    // 出错时也截图
    await page.screenshot({ path: `${SCREENSHOT_DIR}/${testName}-error.png`, fullPage: true });
    return {
      testName,
      message,
      error: error.message,
      errorScreenshot: `${SCREENSHOT_DIR}/${testName}-error.png`
    };
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log('AC130 问题复现测试 V2');
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
