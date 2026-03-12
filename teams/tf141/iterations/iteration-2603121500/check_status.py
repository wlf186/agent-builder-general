#!/usr/bin/env python3
"""Check frontend skill status"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto('http://localhost:20880')
    page.wait_for_load_state('networkidle')

    # 点击进入skill-test-pdf智能体
    page.click('text=skill-test-pdf')
    page.wait_for_load_state('networkidle')

    # 展开思考过程区域
    try:
        expand_button = page.locator('button:has-text("思考过程"), button:has-text("Thinking")').first
        if expand_button.is_visible():
            expand_button.click()
    except:
        pass

    page.wait_for_timeout(1000)

    # 打印页面HTML的关键部分
    content = page.content()
    # 查找技能执行状态部分
    if 'skillStates' in content or '技能执行状态' in content:
        # 截取相关部分
        start = content.find('技能执行状态')
        if start > 0:
            print(content[max(0, start-100):min(len(content), start+500)])
        print('...')

    # 截图保存
    page.screenshot(path='/tmp/skill_status_check.png')
    print('Screenshot saved to /tmp/skill_status_check.png')

    browser.close()
