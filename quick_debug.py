"""
检查页面并截图
"""
from playwright.sync_api import sync_playwright
import time

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_default_timeout(10000)

        try:
            print("📍 加载页面...")
            page.goto("http://localhost:20880")
            page.wait_for_load_state("networkidle")
            time.sleep(2)

            # 截图
            page.screenshot(path="/work/agent-general/screenshot/page_debug.png")
            print("📸 截图已保存")

            # 获取所有文本
            text = page.text_content("body")
            # 查找agent名称
            if "差旅助手" in text:
                print("✅ 找到差旅助手")
            else:
                print("❌ 未找到差旅助手")
                print(f"页面文本片段: {text[:300]}")

        except Exception as e:
            print(f"错误: {e}")

        finally:
            browser.close()

if __name__ == "__main__":
    main()
