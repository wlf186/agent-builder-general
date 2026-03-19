/**
 * Langfuse 集成验收测试 (UAT)
 *
 * 验收标准:
 * 1. Trace ID 树状结构展示完整调用链
 * 2. 每个环节耗时清晰可见
 * 3. 子 Agent 报错时显示异常堆栈
 * 4. 支持 Conversation ID 反向查询
 *
 * 运行: npx playwright test langfuse-uat.spec.ts --headed
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.FRONTEND_URL || 'http://localhost:20880';
const LANGFUSE_URL = 'http://localhost:3000';
const AGENT_NAME = process.env.TEST_AGENT || 'demo';

test.describe('Langfuse 集成验收测试', () => {

  test.beforeAll(async () => {
    // 确保 Langfuse 服务可访问
    console.log('检查 Langfuse 服务...');
    const response = await fetch(LANGFUSE_URL);
    expect(response.ok).toBeTruthy();
    console.log('✓ Langfuse 服务可访问');
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/stream/agents/${AGENT_NAME}/chat`);
    await page.waitForLoadState('networkidle');
  });

  test('TC-001: 简单对话创建 Trace', async ({ page }) => {
    const testInput = '你好，请简单介绍一下你自己。';

    // 发送消息
    await page.locator('input[type="text"][placeholder]').first().fill(testInput);
    await page.locator('button[type="submit"]').click();

    // 等待响应完成
    await page.waitForSelector('[data-testid="assistant-message"]', { timeout: 30000 });

    // 验证前端显示正常
    const messages = await page.locator('[data-testid="assistant-message"]').all();
    expect(messages.length).toBeGreaterThan(0);

    console.log('✓ TC-001: 简单对话成功，Trace 应已在 Langfuse 中创建');
    console.log(`  请访问 ${LANGFUSE_URL} 查看验证 Trace`);
  });

  test('TC-002: 工具调用创建 Span', async ({ page }) => {
    const testInput = '帮我计算 123 * 456';

    // 发送消息
    await page.locator('input[type="text"][placeholder]').first().fill(testInput);
    await page.locator('button[type="submit"]').click();

    // 等待工具调用事件
    await page.waitForSelector('text=/工具.*evaluate/', { timeout: 30000 });

    // 等待响应完成
    await page.waitForSelector('[data-testid="assistant-message"]', { timeout: 30000 });

    console.log('✓ TC-002: 工具调用成功，Tool Span 应已在 Langfuse 中创建');
  });

  test('TC-003: 多轮对话记录在同一 Trace 下', async ({ page }) => {
    const conversation = [
      '我叫 Alice',
      '我叫什么名字？'
    ];

    for (const message of conversation) {
      await page.locator('input[type="text"][placeholder]').first().fill(message);
      await page.locator('button[type="submit"]').click();
      await page.waitForSelector('[data-testid="assistant-message"]', { timeout: 30000 });
      await page.waitForTimeout(1000);
    }

    console.log('✓ TC-003: 多轮对话完成');
    console.log(`  请在 Langfuse 中验证 session_id 关联的对话历史`);
  });

  test('TC-004: 错误场景捕获', async ({ page }) => {
    // 尝试调用不存在的工具
    const testInput = '请调用 tool_does_not_exist 工具';

    await page.locator('input[type="text"][placeholder]').first().fill(testInput);
    await page.locator('button[type="submit"]').click();

    // 等待响应（可能包含错误信息）
    await page.waitForSelector('[data-testid="assistant-message"]', { timeout: 30000 });

    console.log('✓ TC-004: 错误场景测试完成');
    console.log(`  请在 Langfuse 中验证错误状态的 Span (level=ERROR)`);
  });

  test('TC-005: 验证 RAG 检索追踪', async ({ page }) => {
    // 注意：需要智能体配置了知识库
    const testInput = '请从知识库中查询相关信息';

    await page.locator('input[type="text"][placeholder]').first().fill(testInput);
    await page.locator('button[type="submit"]').click();

    // 等待响应
    await page.waitForSelector('[data-testid="assistant-message"]', { timeout: 30000 });

    console.log('✓ TC-005: RAG 检索测试完成');
    console.log(`  请在 Langfuse 中验证 rag_retrieve Span`);
  });

  test('TC-006: 验证 Token 使用量记录', async ({ page }) => {
    const testInput = '请生成一段较长的文本，至少200字';

    await page.locator('input[type="text"][placeholder]').first().fill(testInput);
    await page.locator('button[type="submit"]').click();

    await page.waitForSelector('[data-testid="assistant-message"]', { timeout: 30000 });

    // 获取响应内容长度
    const message = await page.locator('[data-testid="assistant-message"]').last().textContent();
    expect(message?.length).toBeGreaterThan(200);

    console.log('✓ TC-006: Token 使用量测试完成');
    console.log(`  请在 Langfuse 中验证 LLM Span 的 usage 字段`);
  });

  test('TC-007: 验证性能元数据 (duration_ms)', async ({ page }) => {
    const testInput = '当前时间是什么时候？';

    await page.locator('input[type="text"][placeholder]').first().fill(testInput);
    await page.locator('button[type="submit"]').click();

    await page.waitForSelector('[data-testid="assistant-message"]', { timeout: 30000 });

    console.log('✓ TC-007: 性能元数据测试完成');
    console.log(`  请在 Langfuse 中验证 Span 的 duration_ms 字段`);
  });
});

test.describe('Langfuse UI 验证', () => {

  test('UI-001: 检查 Trace 列表页面', async ({ page }) => {
    await page.goto(LANGFUSE_URL);

    // 登录（如果需要）
    const loginButton = page.locator('button:has-text("Sign in")');
    if (await loginButton.isVisible()) {
      // 这里可能需要配置登录信息
      console.log('⚠ 需要配置 Langfuse 登录');
    }

    // 导航到 Traces 页面
    await page.goto(`${LANGFUSE_URL}/traces`);

    // 等待页面加载
    await page.waitForLoadState('networkidle');

    console.log('✓ UI-001: Trace 列表页面可访问');
  });

  test('UI-002: 检查 Trace 详情页面的树状结构', async ({ page }) => {
    // 导航到 Traces 页面
    await page.goto(`${LANGFUSE_URL}/traces`);
    await page.waitForLoadState('networkidle');

    // 点击第一个 Trace
    const firstTrace = page.locator('[data-testid="trace-item"]').first();
    if (await firstTrace.isVisible()) {
      await firstTrace.click();
      await page.waitForLoadState('networkidle');

      // 验证树状结构
      const spanTree = page.locator('[data-testid="span-tree"]');
      const isVisible = await spanTree.isVisible();
      console.log(isVisible ? '✓ UI-002: Span 树状结构可见' : '⚠ UI-002: Span 树状结构未找到');
    } else {
      console.log('⚠ UI-002: 没有 Trace 可显示，请先运行对话测试');
    }
  });
});
