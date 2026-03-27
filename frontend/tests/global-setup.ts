/**
 * Playwright 全局环境检查
 *
 * 在所有测试运行前检查显示器环境，防止远程 X11 环境使用 Test Runner
 */

import { FullConfig } from '@playwright/test';

export default async function globalSetup(config: FullConfig) {
  const display = process.env.DISPLAY || '';

  // 检查是否是 headed 模式（非 CI 且非 HEADLESS=true）
  const isCI = !!process.env.CI;
  const isHeadless = process.env.HEADLESS === 'true';
  const isHeaded = !isCI && !isHeadless;

  // 只在 headed 模式下检查显示器
  if (isHeaded && display) {
    // 本地显示器特征: 以 : 开头或 unix: 开头
    const isLocalDisplay = display.startsWith(':') || display.startsWith('unix:');

    if (!isLocalDisplay) {
      console.error('');
      console.error('⛔⛔⛔ 绝对红线：远程 X11 环境禁止使用 Playwright Test Runner ⛔⛔⛔');
      console.error('');
      console.error(`检测到远程显示器: DISPLAY=${display}`);
      console.error('');
      console.error('原因: Test Runner 会自动关闭浏览器，在远程 X11 中会导致连接断裂');
      console.error('      错误: "Target page, context or browser has been closed"');
      console.error('');
      console.error('解决方案:');
      console.error('  ❌ npx playwright test xxx.spec.ts --headed');
      console.error('  ✅ node xxx.mjs  (直接运行脚本)');
      console.error('');
      console.error('参考: docs/references/testing-guide.md');
      console.error('');

      // 退出并返回非零状态码
      process.exit(1);
    }

    console.log(`✅ 显示器检查通过: 本地显示器 (${display})`);
  }
}
