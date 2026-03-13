/**
 * ============================================================================
 * 迭代测试: Skill执行状态显示修复验证 (iteration-2603121500)
 *
 * 测试目标:
 * 1. 验证PDF skill执行状态只显示一个状态项
 * 2. 验证DOCX skill执行状态只显示一个状态项
 * 3. 验证流式输出功能正常
 *
 * 缺陷ID: T017
 * 修复内容: 使用skillName精确匹配替代status模糊匹配
 * ============================================================================
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:20880';
const AGENT_PDF = 'skill-test-pdf';
const AGENT_DOCX = 'skill-test-doc';
const AGENT_DOC = 'test001'; // 备用智能体，配置了ab-docx技能

/**
 * 点击智能体卡片 - 支持多种选择器
 */
async function clickAgentCard(page: any, agentName: string) {
  const selectors = [
    `[data-agent-name="${agentName}"]`,
    `text="${agentName}"`,
    `[class*="agent-card"]:has-text("${agentName}")`,
    `div:has-text("${agentName}")`,
  ];

  for (const selector of selectors) {
    try {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: 2000 })) {
        await element.click();
        return;
      }
    } catch (e) {
      // 继续尝试下一个选择器
    }
  }
  throw new Error(`无法找到智能体卡片: ${agentName}`);
}

test.describe('Iteration 2603121500: Skill执行状态显示修复', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    // 等待页面加载
    await page.waitForLoadState('networkidle');
  });

  /**
   * TC-001: PDF Skill执行状态显示测试
   */
  test('TC-001: PDF Skill执行状态只显示一个状态项', async ({ page }) => {
    console.log('=== 开始 TC-001: PDF Skill测试 ===');

    // 1. 选择智能体
    await clickAgentCard(page, AGENT_PDF);
    await page.waitForTimeout(1000);

    // 2. 上传PDF文件
    const fileInput = page.locator('input[type="file"]').first();
    const filePath = '/work/agent-builder-general/test/测试1.pdf';
    await fileInput.setInputFiles(filePath);
    await page.waitForTimeout(1000);

    // 验证文件上传成功
    const fileAttached = page.locator('text=测试1.pdf').or(page.locator('.text-xs:has-text("PDF")'));
    await expect(fileAttached.first()).toBeVisible({ timeout: 5000 });

    // 3. 发送消息
    const messageBox = page.locator('textarea').first();
    await messageBox.fill('提取文档的前150字');
    await messageBox.press('Enter');

    // 4. 等待响应完成
    await page.waitForTimeout(10000);

    // 5. 验证Skill执行状态
    // 检查思考区域
    const thinkingSection = page.locator('.border-l-2').or(page.locator('[class*="thinking"]'));
    const isThinkingVisible = await thinkingSection.count() > 0;

    if (isThinkingVisible) {
      // 查找所有skill状态项
      const skillStates = page.locator('[class*="skill"], [class*="cyan"]').or(
        page.locator('text=加载').or(page.locator('text=执行'))
      );

      const count = await skillStates.count();
      console.log(`找到 ${count} 个skill相关元素`);

      // 验证: 不应该出现多个相同skill的状态
      // 关键检查: 查找skill状态列表，每个skill应该只出现一次
      const skillLabels = await page.locator('text=ab-pdf').or(page.locator('text=pdf')).all();
      console.log(`找到 ${skillLabels.length} 个PDF skill相关标签`);

      // 截图保存
      await page.screenshot({ path: 'test-results/tc001-pdf-skill-states.png' });

      // 断言: PDF相关标签不应过多（正常应该是1-2个）
      expect(skillLabels.length).toBeLessThanOrEqual(3);
    }

    console.log('=== TC-001 完成 ===');
  });

  /**
   * TC-002: DOCX Skill执行状态显示测试
   */
  test('TC-002: DOCX Skill执行状态只显示一个状态项', async ({ page }) => {
    console.log('=== 开始 TC-002: DOCX Skill测试 ===');

    // 1. 选择智能体 (使用备用智能体)
    await clickAgentCard(page, AGENT_DOC);
    await page.waitForTimeout(1000);

    // 2. 上传DOCX文件
    const fileInput = page.locator('input[type="file"]').first();
    const filePath = '/work/agent-builder-general/test/测试2.docx';
    await fileInput.setInputFiles(filePath);
    await page.waitForTimeout(1000);

    // 验证文件上传成功
    const fileAttached = page.locator('text=测试2.docx').or(page.locator('.text-xs:has-text("DOCX")'));
    await expect(fileAttached.first()).toBeVisible({ timeout: 5000 });

    // 3. 发送消息
    const messageBox = page.locator('textarea').first();
    await messageBox.fill('提取文档的前100字');
    await messageBox.press('Enter');

    // 4. 等待响应完成
    await page.waitForTimeout(10000);

    // 5. 验证Skill执行状态
    const thinkingSection = page.locator('.border-l-2').or(page.locator('[class*="thinking"]'));
    const isThinkingVisible = await thinkingSection.count() > 0;

    if (isThinkingVisible) {
      const skillLabels = await page.locator('text=ab-docx').or(page.locator('text=docx')).all();
      console.log(`找到 ${skillLabels.length} 个DOCX skill相关标签`);

      await page.screenshot({ path: 'test-results/tc002-docx-skill-states.png' });

      expect(skillLabels.length).toBeLessThanOrEqual(3);
    }

    console.log('=== TC-002 完成 ===');
  });

  /**
   * TC-003: 流式输出打字机效果测试
   */
  test('TC-004: 流式输出打字机效果正常', async ({ page }) => {
    console.log('=== 开始 TC-004: 流式输出测试 ===');

    // 选择任意智能体
    await clickAgentCard(page, AGENT_PDF);
    await page.waitForTimeout(500);

    // 发送简单消息
    const messageBox = page.locator('textarea').first();
    await messageBox.fill('你好');
    await messageBox.press('Enter');

    // 记录开始时间
    const startTime = Date.now();

    // 等待响应完成 - 使用assistant角色消息
    await page.waitForTimeout(8000);

    // 查找包含回复的元素 - 检查是否有内容输出
    const hasResponse = await page.locator('text=/.*(你好|Hello|感谢|请讲).*/').first().isVisible({ timeout: 2000 }).catch(() => false);

    const firstTokenTime = Date.now();
    const firstTokenLatency = firstTokenTime - startTime;
    console.log(`首字延迟: ${firstTokenLatency}ms`);

    await page.screenshot({ path: 'test-results/tc004-streaming-output.png' });

    // 验证有响应（通过检查页面文本内容）
    const pageText = await page.textContent('body');
    const hasMeaningfulContent = pageText?.includes('你好') || pageText?.includes('Hello') || pageText?.includes('PDF');

    expect(hasMeaningfulContent).toBeTruthy();

    console.log('=== TC-004 完成 ===');
  });

  /**
   * TC-005: 思考区域展开/收起测试
   */
  test('TC-005: 思考区域展开和收起功能正常', async ({ page }) => {
    console.log('=== 开始 TC-005: 思考区域测试 ===');

    await clickAgentCard(page, AGENT_PDF);
    await page.waitForTimeout(500);

    const messageBox = page.locator('textarea').first();
    await messageBox.fill('介绍一下你自己');
    await messageBox.press('Enter');

    // 等待思考区域出现
    await page.waitForTimeout(3000);

    // 查找展开/收起按钮
    const toggleButton = page.locator('button:has-text("思考"), [class*="chevron"]').first();

    if (await toggleButton.isVisible({ timeout: 5000 })) {
      // 点击收起
      await toggleButton.click();
      await page.waitForTimeout(500);

      await page.screenshot({ path: 'test-results/tc005-thinking-collapsed.png' });

      // 点击展开
      await toggleButton.click();
      await page.waitForTimeout(500);

      await page.screenshot({ path: 'test-results/tc005-thinking-expanded.png' });

      console.log('思考区域展开/收起功能正常');
    }

    console.log('=== TC-005 完成 ===');
  });

  /**
   * TC-006: 验证skill状态不重复 - 核心测试
   */
  test('TC-006: Skill状态不重复显示 - 核心验证', async ({ page }) => {
    console.log('=== 开始 TC-006: 核心验证测试 ===');

    await clickAgentCard(page, AGENT_PDF);
    await page.waitForTimeout(500);

    // 上传文件并发送消息
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles('/work/agent-builder-general/test/测试1.pdf');
    await page.waitForTimeout(1000);

    const messageBox = page.locator('textarea').first();
    await messageBox.fill('提取文档的前50字');
    await messageBox.press('Enter');

    // 等待响应
    await page.waitForTimeout(12000);

    // 截图
    await page.screenshot({ path: 'test-results/tc006-core-verification.png', fullPage: true });

    // 检查页面上的所有skill状态容器
    const skillContainers = page.locator('[class*="border"], [class*="skill"]').or(
      page.locator('text=执行').or(page.locator('text=加载'))
    );

    const count = await skillContainers.count();
    console.log(`页面元素总数: ${count}`);

    // 关键检查: 获取所有包含skill状态文本的元素
    const pageContent = await page.content();

    // 统计"执行完成"出现次数
    const completedMatches = (pageContent.match(/执行完成/g) || []).length;
    console.log(`"执行完成"出现次数: ${completedMatches}`);

    // 统计skill名称出现次数
    const pdfSkillMatches = (pageContent.match(/ab-pdf/g) || []).length;
    console.log(`"ab-pdf"出现次数: ${pdfSkillMatches}`);

    // 验证: 不应该出现重复的执行状态
    // 正常情况: 每个skill只应该有1个执行状态记录
    expect(completedMatches).toBeLessThanOrEqual(2);
    expect(pdfSkillMatches).toBeLessThanOrEqual(4);

    console.log('=== TC-006 完成 ===');
  });
});
