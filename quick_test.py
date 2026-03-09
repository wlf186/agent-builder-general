"""
快速流式测试 - 5秒超时
"""
from playwright.sync_api import sync_playwright
import time

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_default_timeout(10000)

        console_logs = []
        page.on("console", lambda msg: console_logs.append(msg.text))

        try:
            print("📍 加载并进入差旅助手...")
            page.goto("http://localhost:20880")
            page.wait_for_load_state("networkidle")

            # 点击差旅助手卡片
            page.locator("text=差旅助手").first.click()
            page.wait_for_load_state("networkidle")
            time.sleep(1)

            # 发送消息
            chat_input = page.locator("input[placeholder='Type a message...']")
            chat_input.fill("数1到3")
            chat_input.press("Enter")

            print("📍 等待5秒观察...")
            time.sleep(5)

            # 检查结果
            assistant_bubbles = page.locator("div.bg-white\\/10").all()
            if assistant_bubbles:
                text = assistant_bubbles[-1].text_content() or ""
                print(f"助手回复: {text}")
            else:
                print("无助手回复")

            page.screenshot(path="/work/agent-general/screenshot/quick_test.png")

        except Exception as e:
            print(f"错误: {e}")

        finally:
            browser.close()

        # 检查控制台错误
        errors = [log for log in console_logs if 'error' in log.lower()]
        if errors:
            print(f"\n控制台错误: {errors}")

if __name__ == "__main__":
    main()
