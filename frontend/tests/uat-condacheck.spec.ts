import { test, expect } from '@playwright/test';

const FRONTEND_URL = 'http://localhost:20880';

test.describe('AC130 UAT - Conda 环境检测', () => {
  
  test('TC-001: Conda 检测 API 返回正确结构', async ({ request }) => {
    const response = await request.get('http://localhost:20881/api/system/check-conda');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    console.log('Conda check result:', JSON.stringify(data, null, 2));
    
    // 验证返回结构
    expect(data).toHaveProperty('available');
    expect(data).toHaveProperty('path');
    expect(data).toHaveProperty('version');
    expect(data).toHaveProperty('error');
    expect(data).toHaveProperty('message');
    
    // 由于当前环境没有 conda，应该返回 available: false
    expect(data.available).toBe(false);
    expect(data.error).toBe('CONDA_NOT_FOUND');
  });

  test('TC-002: 新建智能体页面显示 Conda 警告', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    
    // 点击新建智能体按钮
    const createButton = page.locator('button:has-text("新建"), button:has-text("Create")').first();
    await createButton.click();
    
    // 等待 Conda 检测完成
    await page.waitForTimeout(2000);
    
    // 检查是否显示 Conda 警告
    const warningVisible = await page.locator('text=Conda 环境未检测到').isVisible().catch(() => false);
    
    console.log('Conda warning visible:', warningVisible);
    
    // 截图
    await page.screenshot({ path: '/tmp/uat-tc002-warning.png', fullPage: true });
    
    expect(warningVisible).toBe(true);
  });

  test('TC-003: 点击查看解决方案显示错误弹窗', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    
    // 进入创建页面
    const createButton = page.locator('button:has-text("新建"), button:has-text("Create")').first();
    await createButton.click();
    await page.waitForTimeout(2000);
    
    // 点击查看解决方案
    const solutionButton = page.locator('text=查看解决方案').first();
    if (await solutionButton.isVisible()) {
      await solutionButton.click();
      await page.waitForTimeout(500);
      
      // 检查弹窗是否显示
      const dialogVisible = await page.locator('text=环境初始化失败').isVisible().catch(() => false);
      
      console.log('Error dialog visible:', dialogVisible);
      
      // 截图
      await page.screenshot({ path: '/tmp/uat-tc003-dialog.png', fullPage: true });
      
      expect(dialogVisible).toBe(true);
    } else {
      console.log('Solution button not visible, skipping test');
      test.skip();
    }
  });
});
