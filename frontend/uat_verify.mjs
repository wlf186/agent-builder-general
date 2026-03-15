/**
 * UAT 验证 - 调试日志功能 (Node.js Playwright)
 */
import { chromium } from 'playwright';

const FRONTEND_URL = 'http://localhost:20880';
const BACKEND_URL = 'http://localhost:20881';

console.log('\n=== UAT 验证启动 ===\n');

// 1. 先验证后端 API
async function verifyBackendAPI() {
  console.log('1. 验证后端 API...');
  try {
    const response = await fetch(`${BACKEND_URL}/api/debug/logs`);
    console.log(`   ✓ GET /api/debug/logs: ${response.status}`);
    const data = await response.json();
    console.log(`   日志数量: ${data.logs?.length || 0}`);
    return true;
  } catch (e) {
    console.log(`   ✗ 后端 API 验证失败: ${e.message}`);
    return false;
  }
}

// 2. 浏览器验证
async function runUAT() {
  await verifyBackendAPI();
  
  console.log('\n2. 启动浏览器验证...');
  
  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // 监听响应头获取 X-Request-ID
  const requestIds = [];
  page.on('response', async (response) => {
    const headers = response.headers();
    const requestId = headers['x-request-id'] || headers['X-Request-ID'];
    if (requestId) {
      requestIds.push(requestId);
      console.log(`   ✓ 捕获 X-Request-ID: ${requestId.substring(0, 16)}...`);
    }
  });
  
  // 监听下载
  const downloads = [];
  page.on('download', (download) => {
    downloads.push(download);
    console.log(`   ✓ 下载文件: ${download.suggestedFilename()}`);
  });
  
  try {
    // 导航到主页
    console.log(`\n3. 导航到 ${FRONTEND_URL}`);
    await page.goto(FRONTEND_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.screenshot({ path: '/tmp/uat_01_homepage.png' });
    console.log('   ✓ 主页加载完成');
    
    // 检查智能体列表
    await page.waitForTimeout(2000);
    const content = await page.content();
    
    // 查找测试智能体
    const agents = await page.locator('text=/test|调试|debug').all();
    console.log(`\n4. 发现 ${agents.length} 个测试/调试相关元素`);
    
    // 点击第一个智能体
    if (agents.length > 0) {
      await agents[0].click();
      console.log('   ✓ 已选择智能体');
      await page.waitForTimeout(1000);
    }
    
    await page.screenshot({ path: '/tmp/uat_02_agent_selected.png' });
    
    // 发送测试消息
    console.log('\n5. 发送测试消息');
    const textarea = page.locator('textarea').first();
    if (await textarea.count() > 0) {
      await textarea.fill('你好，请介绍一下你自己');
      await page.waitForTimeout(500);
      
      // 查找发送按钮
      const sendBtn = page.locator('button:has-text("发送"), button[type="submit"]').first();
      if (await sendBtn.count() > 0) {
        await sendBtn.click();
        console.log('   ✓ 消息已发送');
      } else {
        await textarea.press('Enter');
        console.log('   ✓ 消息已发送 (Enter)');
      }
    } else {
      console.log('   ✗ 未找到输入框');
    }
    
    await page.screenshot({ path: '/tmp/uat_03_message_sent.png' });
    
    // 等待响应
    console.log('\n6. 等待响应...');
    await page.waitForTimeout(10000);
    await page.screenshot({ path: '/tmp/uat_04_response.png' });
    
    // 检查 X-Request-ID
    console.log('\n7. 检查 X-Request-ID');
    if (requestIds.length > 0) {
      console.log(`   ✓ 捕获到 ${requestIds.length} 个 X-Request-ID`);
      console.log(`   最新: ${requestIds[requestIds.length - 1]}`);
    } else {
      console.log('   ⚠ 未捕获到 X-Request-ID');
    }
    
    // 查找下载按钮
    console.log('\n8. 检查下载按钮');
    const downloadBtns = await page.locator('button:has-text("下载"), button:has-text("导出"), button:has-text("日志"), button:has-text("JSON"), button:has-text("LOG")').all();
    console.log(`   找到 ${downloadBtns.length} 个下载相关按钮`);
    
    if (downloadBtns.length > 0) {
      console.log('\n9. 点击下载按钮');
      await downloadBtns[0].click();
      await page.waitForTimeout(3000);
      
      if (downloads.length > 0) {
        const download = downloads[downloads.length - 1];
        const filename = download.suggestedFilename();
        console.log(`   ✓ 下载文件: ${filename}`);
        
        // 保存并读取文件
        const tempPath = `/tmp/${filename}`;
        await download.saveAs(tempPath);
        
        const fs = await import('fs');
        const logContent = fs.readFileSync(tempPath, 'utf-8');
        
        console.log(`   文件大小: ${logContent.length} 字节`);
        
        // 检查内容
        console.log('\n10. 检查日志内容');
        if (logContent.includes('Request') || logContent.includes('request')) {
          console.log('   ✓ 包含 Request 段');
        }
        if (logContent.includes('Response') || logContent.includes('response')) {
          console.log('   ✓ 包含 Response 段');
        }
        if (logContent.includes('Execution') || logContent.includes('execution')) {
          console.log('   ✓ 包含 Execution 段');
        }
        if (logContent.includes('Error') || logContent.includes('error')) {
          console.log('   ✓ 包含 Error 段');
        }
        
        // 检查敏感数据脱敏
        const apiKeyPattern = /sk-[a-zA-Z0-9]{32,}/;
        if (apiKeyPattern.test(logContent)) {
          console.log('   ⚠ 警告: 发现可能的完整 API Key');
        } else {
          console.log('   ✓ API Key 已脱敏');
        }
        
        // 显示前500字符
        console.log('\n日志内容预览 (前500字符):');
        console.log(logContent.substring(0, 500));
      }
    } else {
      console.log('   ⚠ 未找到下载按钮');
    }
    
    // 最终截图
    await page.screenshot({ path: '/tmp/uat_10_final.png', fullPage: true });
    
  } catch (e) {
    console.error(`\n✗ 测试过程中出错: ${e.message}`);
  } finally {
    await page.waitForTimeout(2000);
    await browser.close();
  }
  
  console.log('\n=== UAT 验证完成 ===');
  console.log('\n截图已保存到 /tmp/uat_*.png');
}

runUAT().catch(console.error);
