import { test, expect } from '@playwright/test';

test.describe('Langfuse Tracing Demo', () => {
  test.setTimeout(180000);

  test('Send message and view trace in Langfuse', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const pageAgent = await context1.newPage();
    const pageLangfuse = await context2.newPage();

    console.log('📍 Step 1: 打开 Agent Builder...');
    await pageAgent.goto('http://localhost:20880');
    await pageAgent.waitForTimeout(2000);

    // 点击第一个智能体进入聊天界面
    console.log('  点击第一个智能体...');
    const firstAgent = pageAgent.locator('h3, h2').first();
    await firstAgent.waitFor({ state: 'visible', timeout: 10000 });
    await firstAgent.click();
    await pageAgent.waitForTimeout(2000);

    // 找到输入框并发送消息
    console.log('📍 Step 2: 发送测试消息...');
    const inputSelector = pageAgent.locator('input[type="text"][placeholder]').first();
    await inputSelector.waitFor({ state: 'visible', timeout: 10000 });

    const testMessage = `Langfuse 测试消息 ${new Date().toISOString()}`;
    await inputSelector.fill(testMessage);
    await pageAgent.waitForTimeout(500);

    // 点击发送按钮
    const sendButton = pageAgent.locator('button[type="submit"], button:has-text("发送"), button:has-text("Send")').first();
    if (await sendButton.isVisible()) {
      await sendButton.click();
    } else {
      await inputSelector.press('Enter');
    }

    console.log('  等待 AI 响应...');
    await pageAgent.waitForTimeout(10000);

    // 截图 Agent Builder
    await pageAgent.screenshot({ path: '/home/wremote/claude-dev/agent-builder-general/test-results/agent-builder-message.png', fullPage: true });
    console.log('  ✅ 消息已发送，截图保存');

    // 切换到 Langfuse
    console.log('📍 Step 3: 打开 Langfuse 查看追踪...');

    // 首先检查是否需要登录
    await pageLangfuse.goto('http://localhost:3000');
    await pageLangfuse.waitForTimeout(2000);

    const currentUrl = pageLangfuse.url();
    console.log('  当前 URL:', currentUrl);

    // 检查是否在登录/注册页面
    if (currentUrl.includes('sign') || currentUrl.includes('auth') || currentUrl.includes('login')) {
      console.log('  检测到需要登录，尝试注册/登录...');

      // 尝试注册
      const signUpLink = pageLangfuse.locator('a:has-text("Sign up"), a:has-text("Register")').first();
      if (await signUpLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await signUpLink.click();
        await pageLangfuse.waitForTimeout(1000);
      }

      // 填写注册表单
      const emailInput = pageLangfuse.locator('input[type="email"], input[name="email"]').first();
      const passwordInput = pageLangfuse.locator('input[type="password"]').first();

      if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        const testEmail = `demo${Date.now()}@localhost.dev`;
        const testPassword = 'DemoPass123!';

        await emailInput.fill(testEmail);
        await passwordInput.fill(testPassword);

        // 可能需要确认密码
        const confirmPassword = pageLangfuse.locator('input[type="password"]').nth(1);
        if (await confirmPassword.isVisible({ timeout: 1000 }).catch(() => false)) {
          await confirmPassword.fill(testPassword);
        }

        // 点击注册/登录按钮
        const submitBtn = pageLangfuse.locator('button[type="submit"], button:has-text("Sign"), button:has-text("Register")').first();
        await submitBtn.click();

        console.log('  等待认证完成...');
        await pageLangfuse.waitForTimeout(5000);
      }
    }

    // 截图当前状态
    await pageLangfuse.screenshot({ path: '/home/wremote/claude-dev/agent-builder-general/test-results/langfuse-current.png', fullPage: true });

    console.log('\n📋 演示完成！');
    console.log('  - Agent Builder 截图: test-results/agent-builder-message.png');
    console.log('  - Langfuse 截图: test-results/langfuse-current.png');
    console.log('\n💡 提示: 请在浏览器中手动完成 Langfuse 登录/注册后查看追踪链路');
    console.log('   Langfuse 地址: http://localhost:3000');

    // 保持浏览器打开 5 分钟
    console.log('\n⏳ 浏览器将保持打开 5 分钟，按 Ctrl+C 可提前结束...');
    await pageAgent.waitForTimeout(300000);

    await context1.close();
    await context2.close();
  });
});
