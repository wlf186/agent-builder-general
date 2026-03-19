import { test, expect } from '@playwright/test';

test.describe('Langfuse Registration', () => {
  test.setTimeout(60000);

  test('Register Langfuse account', async ({ page }) => {
    console.log('📍 打开 Langfuse 注册页面...');
    await page.goto('http://localhost:3000/en/auth/sign-up');
    await page.waitForTimeout(2000);

    // 截图查看当前页面
    await page.screenshot({ path: '/home/wremote/claude-dev/agent-builder-general/test-results/langfuse-signup-page.png' });

    // 查找表单字段
    const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const nameInput = page.locator('input[name="name"], input[placeholder*="name"], input[placeholder*="Name"]').first();

    // 填写注册信息
    const testEmail = 'demo@agent-builder.local';
    const testPassword = 'Demo@123456';
    const testName = 'Demo User';

    console.log('  填写注册表单...');

    if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nameInput.fill(testName);
      console.log('  ✓ 填写姓名');
    }

    await emailInput.fill(testEmail);
    console.log('  ✓ 填写邮箱:', testEmail);

    // 可能有多个密码输入框
    const passwordInputs = await page.locator('input[type="password"]').all();
    for (const input of passwordInputs) {
      await input.fill(testPassword);
    }
    console.log('  ✓ 填写密码');

    // 点击注册按钮
    const submitBtn = page.locator('button[type="submit"], button:has-text("Sign up"), button:has-text("Create"), button:has-text("Register")').first();
    await submitBtn.click();
    console.log('  点击注册按钮...');

    // 等待注册完成
    await page.waitForTimeout(5000);

    // 截图结果
    const currentUrl = page.url();
    console.log('  当前 URL:', currentUrl);
    await page.screenshot({ path: '/home/wremote/claude-dev/agent-builder-general/test-results/langfuse-after-register.png', fullPage: true });

    if (currentUrl.includes('onboarding') || !currentUrl.includes('auth')) {
      console.log('\n✅ 注册成功！');
      console.log('  邮箱:', testEmail);
      console.log('  密码:', testPassword);
    } else {
      console.log('\n⚠️ 可能需要额外步骤');
    }

    // 保持浏览器打开
    console.log('\n⏳ 浏览器保持打开 60 秒...');
    await page.waitForTimeout(60000);
  });
});
