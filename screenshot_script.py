from playwright.sync_api import sync_playwright
import os
import time

# 确保截图目录存在
os.makedirs("/work/agent-general/screenshot", exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.set_default_timeout(10000)

    try:
        # 访问首页
        print("访问首页...")
        page.goto("http://localhost:20880")
        page.wait_for_load_state("networkidle")
        time.sleep(1)

        # 截图首页
        page.screenshot(path="/work/agent-general/screenshot/homepage.png", full_page=True)
        print("首页截图已保存: screenshot/homepage.png")

        # 点击 Create Agent 按钮
        print("点击 Create Agent...")
        create_btn = page.get_by_role("button", name="Create Agent")
        create_btn.click()
        page.wait_for_load_state("networkidle")
        time.sleep(0.5)

        # 填写表单 - 使用更通用的选择器
        print("填写表单...")
        inputs = page.locator("input").all()
        textareas = page.locator("textarea").all()

        if inputs:
            inputs[0].fill("差旅助手")
        if textareas:
            textareas[0].fill("帮助用户处理差旅相关问题的AI助手，包括预订机票、酒店、行程规划等")

        # 截图创建页面
        page.screenshot(path="/work/agent-general/screenshot/create_agent.png", full_page=True)
        print("创建页面截图已保存: screenshot/create_agent.png")

        # 点击创建按钮
        create_btn = page.get_by_role("button", name="Create")
        create_btn.click()
        page.wait_for_load_state("networkidle")
        time.sleep(1)

        # 返回列表页
        print("返回列表页...")
        page.goto("http://localhost:20880")
        page.wait_for_load_state("networkidle")
        time.sleep(1)

        # 查找差旅助手卡片并点击
        print("查找差旅助手...")
        agent_card = page.locator("h3:has-text('差旅助手')")
        if agent_card.is_visible():
            agent_card.click()
            page.wait_for_load_state("networkidle")
            time.sleep(1)

            # 截图差旅助手配置页面
            page.screenshot(path="/work/agent-general/screenshot/travel_agent.png", full_page=True)
            print("差旅助手配置页面截图已保存: screenshot/travel_agent.png")
        else:
            print("未找到差旅助手卡片，尝试点击第一个卡片")
            cards = page.locator("[class*='Card']").all()
            if cards:
                cards[0].click()
                page.wait_for_load_state("networkidle")
                time.sleep(1)
                page.screenshot(path="/work/agent-general/screenshot/travel_agent.png", full_page=True)
                print("Agent配置页面截图已保存: screenshot/travel_agent.png")

    except Exception as e:
        print(f"发生错误: {e}")
        page.screenshot(path="/work/agent-general/screenshot/error.png", full_page=True)
        print("错误截图已保存: screenshot/error.png")

    browser.close()
    print("截图完成！")
