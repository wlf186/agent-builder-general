/**
 * 资源链接跳转测试 - Headed 模式演示
 * 测试系统主页的"用户手册"和"Langfuse"链接是否能成功跳转
 */

import { test, expect } from '@playwright/test';

// 使用 headed 模式
test.use({
  headless: false,
  slowMo: 300,
});

const FRONTEND_URL = 'http://localhost:20880';

test.describe('资源链接跳转测试', () => {

  test('检查主页链接是否存在', async ({ page }) => {
    console.log('\n=== 检查主页链接是否存在 ===');

    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');

    // 修复 X11 远程投屏渲染问题：触发浏览器重绘
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(100);

    // 截图主页
    await page.screenshot({ path: 'test-results/home-page-check.png', fullPage: true });
    console.log('✓ 已保存主页截图');

    // 查找用户手册链接
    const userManualLink = page.locator('a[href="/docs"]');
    const isUserManualVisible = await userManualLink.isVisible();
    console.log(`用户手册链接可见: ${isUserManualVisible}`);

    if (isUserManualVisible) {
      const userManualHref = await userManualLink.getAttribute('href');
      const userManualTarget = await userManualLink.getAttribute('target');
      console.log(`  href: ${userManualHref}`);
      console.log(`  target: ${userManualTarget}`);
    }

    // 查找 Langfuse 链接
    const langfuseLink = page.locator('a[href="/langfuse"]');
    const isLangfuseVisible = await langfuseLink.isVisible();
    console.log(`Langfuse 链接可见: ${isLangfuseVisible}`);

    if (isLangfuseVisible) {
      const langfuseHref = await langfuseLink.getAttribute('href');
      const langfuseTarget = await langfuseLink.getAttribute('target');
      console.log(`  href: ${langfuseHref}`);
      console.log(`  target: ${langfuseTarget}`);
    }

    expect(isUserManualVisible).toBeTruthy();
    expect(isLangfuseVisible).toBeTruthy();
  });

  test('直接访问 /docs 路径验证代理', async ({ page }) => {
    console.log('\n=== 测试 /docs 路径（用户手册）===');

    // 直接访问 /docs 路径
    const docsUrl = `${FRONTEND_URL}/docs`;
    console.log(`访问: ${docsUrl}`);

    try {
      const response = await page.goto(docsUrl, { waitUntil: 'networkidle', timeout: 30000 });

      if (response) {
        console.log(`HTTP 状态码: ${response.status()}`);
        console.log(`最终 URL: ${page.url()}`);
        console.log(`页面标题: ${await page.title()}`);

        // 截图
        await page.screenshot({ path: 'test-results/docs-page-result.png', fullPage: true });
        console.log('✓ 已保存截图');

        const status = response.status();
        if (status === 200 || status === 304) {
          console.log('✅ /docs 代理工作正常');
        } else if (status === 404) {
          console.log('❌ /docs 返回 404 - 代理目标可能未启动');
        } else {
          console.log(`⚠️ /docs 返回状态码 ${status}`);
        }
      }
    } catch (error) {
      console.log(`❌ 访问 /docs 失败: ${error}`);
      await page.screenshot({ path: 'test-results/docs-page-error.png', fullPage: true });
    }

    // 等待一下便于观察
    await page.waitForTimeout(2000);
  });

  test('直接访问 /langfuse 路径验证代理', async ({ page }) => {
    console.log('\n=== 测试 /langfuse 路径 ===');

    const langfuseUrl = `${FRONTEND_URL}/langfuse`;
    console.log(`访问: ${langfuseUrl}`);

    try {
      const response = await page.goto(langfuseUrl, { waitUntil: 'networkidle', timeout: 30000 });

      if (response) {
        console.log(`HTTP 状态码: ${response.status()}`);
        console.log(`最终 URL: ${page.url()}`);
        console.log(`页面标题: ${await page.title()}`);

        // 截图
        await page.screenshot({ path: 'test-results/langfuse-page-result.png', fullPage: true });
        console.log('✓ 已保存截图');

        const status = response.status();
        const bodyText = await page.locator('body').textContent();

        if (status === 200 || status === 304) {
          // 检查是否是真正的 Langfuse 页面
          if (bodyText?.includes('Langfuse') || bodyText?.includes('Observability')) {
            console.log('✅ /langfuse 代理工作正常 - Langfuse 页面已加载');
          } else {
            console.log('⚠️ /langfuse 返回 200，但内容可能不是 Langfuse');
          }
        } else if (status === 404) {
          console.log('❌ /langfuse 返回 404 - 代理目标可能未启动');
        } else if (status === 502 || status === 503 || status === 504) {
          console.log(`❌ /langfuse 返回 ${status} - 代理目标服务不可用`);
        } else {
          console.log(`⚠️ /langfuse 返回状态码 ${status}`);
        }
      }
    } catch (error) {
      console.log(`❌ 访问 /langfuse 失败: ${error}`);
      await page.screenshot({ path: 'test-results/langfuse-page-error.png', fullPage: true });
    }

    // 等待一下便于观察
    await page.waitForTimeout(2000);
  });

  test('完整演示：点击链接测试', async ({ page, context }) => {
    console.log('\n========================================');
    console.log('完整演示：点击资源链接测试');
    console.log('========================================\n');

    // 1. 访问主页
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    console.log('1. 已加载主页');

    // 2. 测试点击用户手册链接
    console.log('\n--- 测试点击用户手册链接 ---');
    const userManualLink = page.locator('a[href="/docs"]');

    if (await userManualLink.isVisible()) {
      // 监听新页面事件
      const pagePromise = context.waitForEvent('page');

      await userManualLink.click();
      console.log('2. 已点击用户手册链接');

      const newPage = await pagePromise;
      await newPage.waitForLoadState('networkidle');

      console.log(`新页面 URL: ${newPage.url()}`);
      console.log(`新页面标题: ${await newPage.title()}`);

      await newPage.screenshot({ path: 'test-results/docs-click-result.png', fullPage: true });

      // 保持打开 3 秒便于观察
      await newPage.waitForTimeout(3000);
      await newPage.close();
      console.log('✓ 用户手册测试完成');
    } else {
      console.log('❌ 未找到用户手册链接');
    }

    // 3. 测试点击 Langfuse 链接
    console.log('\n--- 测试点击 Langfuse 链接 ---');
    const langfuseLink = page.locator('a[href="http://localhost:3000"]');

    if (await langfuseLink.isVisible()) {
      const pagePromise = context.waitForEvent('page');

      await langfuseLink.click();
      console.log('3. 已点击 Langfuse 链接');

      const newPage = await pagePromise;

      try {
        await newPage.waitForLoadState('networkidle', { timeout: 30000 });
      } catch (e) {
        console.log('⚠️ Langfuse 页面加载超时');
      }

      console.log(`新页面 URL: ${newPage.url()}`);
      console.log(`新页面标题: ${await newPage.title()}`);

      await newPage.screenshot({ path: 'test-results/langfuse-click-result.png', fullPage: true });

      // 保持打开 3 秒便于观察
      await newPage.waitForTimeout(3000);
      await newPage.close();
      console.log('✓ Langfuse 测试完成');
    } else {
      console.log('❌ 未找到 Langfuse 链接');
    }

    console.log('\n========================================');
    console.log('演示完成');
    console.log('========================================\n');
  });
});
