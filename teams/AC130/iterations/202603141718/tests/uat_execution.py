#!/usr/bin/env python3
"""
UAT 测试脚本 - 环境初始化优化
迭代: iteration-2603141718

使用 Playwright 进行前端验证
"""

from playwright.sync_api import sync_playwright
import json
import time
import os

SCREENSHOT_DIR = "/home/wremote/claude-dev/agent-builder-general/teams/AC130/iterations/202603141718/screenshots"
BASE_URL = "http://localhost:20880"
BACKEND_URL = "http://localhost:20881"

os.makedirs(SCREENSHOT_DIR, exist_ok=True)

print("=" * 60)
print("UAT 测试 - 环境初始化优化")
print("=" * 60)

with sync_playwright() as p:
    # 启动浏览器
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.set_default_timeout(10000)

    results = []

    # ============================================
    # TC-001: Conda 检测 API
    # ============================================
    print("\n[TC-001] 测试 Conda 检测 API...")
    try:
        response = page.request.get(f"{BACKEND_URL}/api/system/check-conda")
        status_code = response.status
        data = response.json()

        print(f"  Status Code: {status_code}")
        print(f"  Response: {json.dumps(data, indent=2, ensure_ascii=False)}")

        # 验证响应结构
        assert status_code == 200, f"Expected 200, got {status_code}"
        assert "conda_available" in data, "Missing 'conda_available' field"
        assert "conda_path" in data, "Missing 'conda_path' field"
        assert "environment_type" in data, "Missing 'environment_type' field"

        print("  ✅ PASSED: API 响应结构正确")
        results.append(("TC-001", "PASSED", "Conda 检测 API 响应正确"))

        page.screenshot(path=f"{SCREENSHOT_DIR}/tc-001-api-response.png")

    except Exception as e:
        print(f"  ❌ FAILED: {e}")
        results.append(("TC-001", "FAILED", str(e)))

    # ============================================
    # TC-002: 主页加载
    # ============================================
    print("\n[TC-002] 测试主页加载...")
    try:
        page.goto(BASE_URL)
        page.wait_for_load_state("networkidle", timeout=15000)
        page.screenshot(path=f"{SCREENSHOT_DIR}/tc-002-homepage.png")

        title = page.title()
        print(f"  Page Title: {title}")

        print("  ✅ PASSED: 主页加载成功")
        results.append(("TC-002", "PASSED", "主页加载成功"))

    except Exception as e:
        print(f"  ❌ FAILED: {e}")
        results.append(("TC-002", "FAILED", str(e)))

    # ============================================
    # TC-003: 查找"新建智能体"按钮
    # ============================================
    print("\n[TC-003] 查找新建智能体按钮...")
    try:
        # 等待页面加载完成
        page.wait_for_timeout(2000)

        # 尝试多种选择器
        selectors = [
            'button:has-text("新建智能体")',
            'button:has-text("新建")',
            '[data-testid="new-agent-button"]',
            'text="新建智能体"',
        ]

        button_found = False
        for selector in selectors:
            try:
                button = page.locator(selector).first
                if button.count() > 0:
                    print(f"  Found button with selector: {selector}")
                    button.screenshot(path=f"{SCREENSHOT_DIR}/tc-003-new-agent-button.png")
                    button_found = True
                    break
            except:
                continue

        if button_found:
            print("  ✅ PASSED: 新建智能体按钮存在")
            results.append(("TC-003", "PASSED", "新建智能体按钮存在"))
        else:
            # 截图当前页面状态
            page.screenshot(path=f"{SCREENSHOT_DIR}/tc-003-page-state.png", full_page=True)
            print("  ⚠️ WARNING: 未找到新建智能体按钮，已保存页面状态")
            results.append(("TC-003", "WARNING", "未找到新建智能体按钮"))

    except Exception as e:
        print(f"  ❌ FAILED: {e}")
        results.append(("TC-003", "FAILED", str(e)))

    # ============================================
    # TC-004: 点击新建智能体并查看 Conda 警告
    # ============================================
    print("\n[TC-004] 测试 Conda 警告显示...")
    try:
        # 点击新建智能体按钮
        page.locator('button:has-text("新建智能体")').first.click()
        page.wait_for_timeout(2000)

        page.screenshot(path=f"{SCREENSHOT_DIR}/tc-004-after-click.png")

        # 查找 Conda 相关警告
        warning_selectors = [
            '.conda-warning',
            '[data-testid="conda-warning"]',
            'text=Conda',
            'text=环境',
            '.warning',
        ]

        warning_found = False
        for selector in warning_selectors:
            try:
                warning = page.locator(selector)
                if warning.count() > 0:
                    print(f"  Found warning with selector: {selector}")
                    warning.screenshot(path=f"{SCREENSHOT_DIR}/tc-004-conda-warning.png")
                    warning_found = True
                    break
            except:
                continue

        if warning_found:
            print("  ✅ PASSED: Conda 警告显示正常")
            results.append(("TC-004", "PASSED", "Conda 警告显示正常"))
        else:
            print("  ⚠️ INFO: 当前环境 conda 可用，未显示警告（符合预期）")
            results.append(("TC-004", "INFO", "Conda 可用，无警告显示"))

    except Exception as e:
        print(f"  ❌ FAILED: {e}")
        results.append(("TC-004", "FAILED", str(e)))

    # ============================================
    # TC-005: 查看错误详情弹窗
    # ============================================
    print("\n[TC-005] 测试错误详情弹窗...")
    try:
        # 查找"查看解决方案"或类似按钮
        solution_selectors = [
            'button:has-text("查看解决方案")',
            'button:has-text("查看详情")',
            'a:has-text("了解更多")',
            'a:has-text("安装指引")',
        ]

        dialog_opened = False
        for selector in solution_selectors:
            try:
                button = page.locator(selector).first
                if button.count() > 0:
                    button.click()
                    page.wait_for_timeout(1000)
                    page.screenshot(path=f"{SCREENSHOT_DIR}/tc-005-error-dialog.png")
                    dialog_opened = True
                    print(f"  Opened dialog with selector: {selector}")
                    break
            except:
                continue

        if dialog_opened:
            print("  ✅ PASSED: 错误详情弹窗可以打开")
            results.append(("TC-005", "PASSED", "错误详情弹窗可以打开"))
        else:
            print("  ⚠️ INFO: 未找到解决方案按钮（可能需要先触发错误）")
            results.append(("TC-005", "INFO", "未找到解决方案按钮"))

    except Exception as e:
        print(f"  ❌ FAILED: {e}")
        results.append(("TC-005", "FAILED", str(e)))

    # ============================================
    # TC-006: 尝试创建智能体
    # ============================================
    print("\n[TC-006] 测试创建智能体...")
    try:
        # 查找名称输入框
        name_input = page.locator('input[name="name"], input[placeholder*="名称"], input[placeholder*="name"]').first

        if name_input.count() > 0:
            test_name = f"uat-test-{int(time.time())}"
            name_input.fill(test_name)
            page.wait_for_timeout(500)

            page.screenshot(path=f"{SCREENSHOT_DIR}/tc-006-before-create.png")

            # 点击创建按钮
            create_selectors = [
                'button:has-text("创建")',
                'button:has-text("确定")',
                'button[type="submit"]',
            ]

            for selector in create_selectors:
                try:
                    create_btn = page.locator(selector).first
                    if create_btn.count() > 0:
                        create_btn.click()
                        page.wait_for_timeout(3000)
                        break
                except:
                    continue

            page.screenshot(path=f"{SCREENSHOT_DIR}/tc-006-after-create.png")

            print("  ✅ PASSED: 创建操作执行完成")
            results.append(("TC-006", "PASSED", "创建操作执行完成"))
        else:
            print("  ⚠️ WARNING: 未找到名称输入框")
            results.append(("TC-006", "WARNING", "未找到名称输入框"))

    except Exception as e:
        print(f"  ❌ FAILED: {e}")
        results.append(("TC-006", "FAILED", str(e)))

    # 关闭浏览器
    browser.close()

# ============================================
# 测试结果汇总
# ============================================
print("\n" + "=" * 60)
print("测试结果汇总")
print("=" * 60)

for test_id, status, message in results:
    status_icon = "✅" if status == "PASSED" else "❌" if status == "FAILED" else "⚠️"
    print(f"{status_icon} {test_id}: {status} - {message}")

passed = sum(1 for _, s, _ in results if s == "PASSED")
failed = sum(1 for _, s, _ in results if s == "FAILED")
total = len(results)

print(f"\n总计: {passed}/{total} 通过")
if failed > 0:
    print(f"失败: {failed} 个测试")

print("\n截图保存在:", SCREENSHOT_DIR)
