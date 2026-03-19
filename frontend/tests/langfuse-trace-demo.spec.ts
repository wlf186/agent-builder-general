import { test, expect } from '@playwright/test';

test.describe('Langfuse Tracing Demo', () => {
  test.setTimeout(300000);

  test('Send message and view trace in Langfuse', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const pageAgent = await context1.newPage();
    const pageLangfuse = await context2.newPage();

    // ========== Step 1: Agent Builder 发送消息 ==========
    console.log('\n📍 Step 1: 打开 Agent Builder...');
    await pageAgent.goto('http://localhost:20880');
    await pageAgent.waitForTimeout(2000);

    console.log('  点击第一个智能体...');
    const firstAgent = pageAgent.locator('h3, h2').first();
    await firstAgent.waitFor({ state: 'visible', timeout: 10000 });
    await firstAgent.click();
    await pageAgent.waitForTimeout(2000);

    console.log('\n📍 Step 2: 发送测试消息（会触发 Langfuse 追踪）...');
    const inputSelector = pageAgent.locator('input[type="text"][placeholder]').first();
    await inputSelector.waitFor({ state: 'visible', timeout: 10000 });

    const testMessage = `计算 123 + 456 等于多少？`;
    await inputSelector.fill(testMessage);
    await pageAgent.waitForTimeout(500);

    const sendButton = pageAgent.locator('button[type="submit"], button:has-text("发送")').first();
    if (await sendButton.isVisible()) {
      await sendButton.click();
    } else {
      await inputSelector.press('Enter');
    }

    console.log('  等待 AI 响应...');
    await pageAgent.waitForTimeout(15000);

    await pageAgent.screenshot({ path: '/home/wremote/claude-dev/agent-builder-general/test-results/demo-agent-response.png', fullPage: true });
    console.log('  ✅ 消息已发送，截图保存');

    // ========== Step 2: Langfuse 查看追踪 ==========
    console.log('\n📍 Step 3: 打开 Langfuse 查看追踪...');

    // 登录 Langfuse
    await pageLangfuse.goto('http://localhost:3000/auth/sign-in');
    await pageLangfuse.waitForTimeout(2000);

    const emailInput = pageLangfuse.locator('input[type="email"]').first();
    const passwordInput = pageLangfuse.locator('input[type="password"]').first();

    await emailInput.fill('demo@agent-builder.local');
    await passwordInput.fill('Demo@123456');

    await pageLangfuse.locator('button[type="submit"]').first().click();
    console.log('  登录 Langfuse...');
    await pageLangfuse.waitForTimeout(5000);

    // 导航到 Traces 页面
    console.log('  导航到 Traces 页面...');
    await pageLangfuse.goto('http://localhost:3000/traces');
    await pageLangfuse.waitForTimeout(3000);

    await pageLangfuse.screenshot({ path: '/home/wremote/claude-dev/agent-builder-general/test-results/demo-langfuse-traces.png', fullPage: true });

    console.log('\n📋 演示完成！');
    console.log('  - Agent 响应截图: test-results/demo-agent-response.png');
    console.log('  - Langfuse Traces: test-results/demo-langfuse-traces.png');

    // 保持浏览器打开 5 分钟
    console.log('\n⏳ 浏览器保持打开 5 分钟，可手动查看追踪详情...');
    await pageAgent.waitForTimeout(300000);

    await context1.close();
    await context2.close();
  });
});
