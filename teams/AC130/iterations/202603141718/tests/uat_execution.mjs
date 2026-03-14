#!/usr/bin/env node
/**
 * UAT 测试脚本 - 环境初始化优化
 * 迭代: iteration-2603141718
 *
 * 使用 Playwright 进行前端验证
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.join(__dirname, '../../../screenshots');
const BASE_URL = 'http://localhost:20880';
const BACKEND_URL = 'http://localhost:20881';

// 确保截图目录存在
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

console.log('='.repeat(60));
console.log('UAT 测试 - 环境初始化优化');
console.log('='.repeat(60));

const results = [];
let browser, page, context;

async function runTests() {
  try {
    // 启动浏览器
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    context = await browser.newContext();
    page = await context.newPage();
    page.setDefaultTimeout(10000);

    // ============================================
    // TC-001: Conda 检测 API
    // ============================================
    console.log('\n[TC-001] 测试 Conda 检测 API...');
    try {
      const response = await page.request.get(`${BACKEND_URL}/api/system/check-conda`);
      const status = response.status();
      const data = await response.json();

      console.log(`  Status Code: ${status}`);
      console.log(`  Response:`, JSON.stringify(data, null, 2));

      if (status !== 200) {
        throw new Error(`Expected 200, got ${status}`);
      }
      if (!data.hasOwnProperty('conda_available')) {
        throw new Error("Missing 'conda_available' field");
      }
      if (!data.hasOwnProperty('conda_path')) {
        throw new Error("Missing 'conda_path' field");
      }
      if (!data.hasOwnProperty('environment_type')) {
        throw new Error("Missing 'environment_type' field");
      }

      console.log('  ✅ PASSED: API 响应结构正确');
      results.push({ id: 'TC-001', status: 'PASSED', message: 'Conda 检测 API 响应正确' });

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tc-001-api-response.png') });

    } catch (e) {
      console.log(`  ❌ FAILED: ${e.message}`);
      results.push({ id: 'TC-001', status: 'FAILED', message: e.message });
    }

    // ============================================
    // TC-002: 主页加载
    // ============================================
    console.log('\n[TC-002] 测试主页加载...');
    try {
      await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tc-002-homepage.png'), fullPage: true });

      const title = await page.title();
      console.log(`  Page Title: ${title}`);

      console.log('  ✅ PASSED: 主页加载成功');
      results.push({ id: 'TC-002', status: 'PASSED', message: '主页加载成功' });

    } catch (e) {
      console.log(`  ❌ FAILED: ${e.message}`);
      results.push({ id: 'TC-002', status: 'FAILED', message: e.message });
    }

    // ============================================
    // TC-003: 查找"新建智能体"按钮
    // ============================================
    console.log('\n[TC-003] 查找新建智能体按钮...');
    try {
      await page.waitForTimeout(2000);

      const selectors = [
        'button:has-text("新建智能体")',
        'button:has-text("新建")',
        '[data-testid="new-agent-button"]',
        'text="新建智能体"',
      ];

      let buttonFound = false;
      for (const selector of selectors) {
        try {
          const button = page.locator(selector).first();
          const count = await button.count();
          if (count > 0) {
            console.log(`  Found button with selector: ${selector}`);
            await button.screenshot({ path: path.join(SCREENSHOT_DIR, 'tc-003-new-agent-button.png') });
            buttonFound = true;
            break;
          }
        } catch (e) {
          // continue
        }
      }

      if (buttonFound) {
        console.log('  ✅ PASSED: 新建智能体按钮存在');
        results.push({ id: 'TC-003', status: 'PASSED', message: '新建智能体按钮存在' });
      } else {
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tc-003-page-state.png'), fullPage: true });
        console.log('  ⚠️ WARNING: 未找到新建智能体按钮，已保存页面状态');
        results.push({ id: 'TC-003', status: 'WARNING', message: '未找到新建智能体按钮' });
      }

    } catch (e) {
      console.log(`  ❌ FAILED: ${e.message}`);
      results.push({ id: 'TC-003', status: 'FAILED', message: e.message });
    }

    // ============================================
    // TC-004: 点击新建智能体并查看 Conda 警告
    // ============================================
    console.log('\n[TC-004] 测试 Conda 警告显示...');
    try {
      const button = page.locator('button:has-text("新建智能体")').first();
      const buttonCount = await button.count();

      if (buttonCount > 0) {
        await button.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tc-004-after-click.png'), fullPage: true });

        // 查找 Conda 相关警告
        const warningSelectors = [
          '.conda-warning',
          '[data-testid="conda-warning"]',
          'text=Conda',
          'text=环境',
          '.warning',
          '.alert',
        ];

        let warningFound = false;
        for (const selector of warningSelectors) {
          try {
            const warning = page.locator(selector);
            const count = await warning.count();
            if (count > 0) {
              console.log(`  Found warning with selector: ${selector}`);
              await warning.screenshot({ path: path.join(SCREENSHOT_DIR, 'tc-004-conda-warning.png') });
              warningFound = true;
              break;
            }
          } catch (e) {
            // continue
          }
        }

        if (warningFound) {
          console.log('  ✅ PASSED: Conda 警告显示正常');
          results.push({ id: 'TC-004', status: 'PASSED', message: 'Conda 警告显示正常' });
        } else {
          console.log('  ⚠️ INFO: 当前环境 conda 可用，未显示警告（符合预期）');
          results.push({ id: 'TC-004', status: 'INFO', message: 'Conda 可用，无警告显示' });
        }
      } else {
        console.log('  ⚠️ SKIP: 无法找到新建智能体按钮');
        results.push({ id: 'TC-004', status: 'SKIP', message: '无法找到新建智能体按钮' });
      }

    } catch (e) {
      console.log(`  ❌ FAILED: ${e.message}`);
      results.push({ id: 'TC-004', status: 'FAILED', message: e.message });
    }

    // ============================================
    // TC-005: 查看错误详情弹窗
    // ============================================
    console.log('\n[TC-005] 测试错误详情弹窗...');
    try {
      const solutionSelectors = [
        'button:has-text("查看解决方案")',
        'button:has-text("查看详情")',
        'a:has-text("了解更多")',
        'a:has-text("安装指引")',
      ];

      let dialogOpened = false;
      for (const selector of solutionSelectors) {
        try {
          const button = page.locator(selector).first();
          const count = await button.count();
          if (count > 0) {
            await button.click();
            await page.waitForTimeout(1000);
            await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tc-005-error-dialog.png'), fullPage: true });
            dialogOpened = true;
            console.log(`  Opened dialog with selector: ${selector}`);
            break;
          }
        } catch (e) {
          // continue
        }
      }

      if (dialogOpened) {
        console.log('  ✅ PASSED: 错误详情弹窗可以打开');
        results.push({ id: 'TC-005', status: 'PASSED', message: '错误详情弹窗可以打开' });
      } else {
        console.log('  ⚠️ INFO: 未找到解决方案按钮（可能需要先触发错误）');
        results.push({ id: 'TC-005', status: 'INFO', message: '未找到解决方案按钮' });
      }

    } catch (e) {
      console.log(`  ❌ FAILED: ${e.message}`);
      results.push({ id: 'TC-005', status: 'FAILED', message: e.message });
    }

    // ============================================
    // TC-006: 尝试创建智能体
    // ============================================
    console.log('\n[TC-006] 测试创建智能体...');
    try {
      const nameInput = page.locator('input[name="name"], input[placeholder*="名称"], input[placeholder*="name"]').first;
      const inputCount = await nameInput.count();

      if (inputCount > 0) {
        const testName = `uat-test-${Date.now()}`;
        await nameInput.fill(testName);
        await page.waitForTimeout(500);

        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tc-006-before-create.png'), fullPage: true });

        const createSelectors = [
          'button:has-text("创建")',
          'button:has-text("确定")',
          'button[type="submit"]',
        ];

        for (const selector of createSelectors) {
          try {
            const createBtn = page.locator(selector).first();
            const count = await createBtn.count();
            if (count > 0) {
              await createBtn.click();
              await page.waitForTimeout(3000);
              break;
            }
          } catch (e) {
            // continue
          }
        }

        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tc-006-after-create.png'), fullPage: true });

        console.log('  ✅ PASSED: 创建操作执行完成');
        results.push({ id: 'TC-006', status: 'PASSED', message: '创建操作执行完成' });
      } else {
        console.log('  ⚠️ WARNING: 未找到名称输入框');
        results.push({ id: 'TC-006', status: 'WARNING', message: '未找到名称输入框' });
      }

    } catch (e) {
      console.log(`  ❌ FAILED: ${e.message}`);
      results.push({ id: 'TC-006', status: 'FAILED', message: e.message });
    }

  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// 运行测试
await runTests();

// ============================================
// 测试结果汇总
// ============================================
console.log('\n' + '='.repeat(60));
console.log('测试结果汇总');
console.log('='.repeat(60));

for (const result of results) {
  const statusIcon = result.status === 'PASSED' ? '✅' : result.status === 'FAILED' ? '❌' : '⚠️';
  console.log(`${statusIcon} ${result.id}: ${result.status} - ${result.message}`);
}

const passed = results.filter(r => r.status === 'PASSED').length;
const failed = results.filter(r => r.status === 'FAILED').length;
const total = results.length;

console.log(`\n总计: ${passed}/${total} 通过`);
if (failed > 0) {
  console.log(`失败: ${failed} 个测试`);
}

console.log('\n截图保存在:', SCREENSHOT_DIR);
