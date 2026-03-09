"""
差旅助手网络请求调试
"""
from playwright.sync_api import sync_playwright
import os
import time

SCREENSHOT_DIR = "/work/agent-general/screenshot/network_debug"
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

def screenshot(page, name):
    path = f"{SCREENSHOT_DIR}/{name}"
    page.screenshot(path=path, full_page=True)
    print(f"  📸 {name}")

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_default_timeout(30000)

        requests_log = []

        def on_request(request):
            if 'chat' in request.url:
                requests_log.append(f"➡️ {request.method} {request.url[:80]}")

        def on_response(response):
            if 'chat' in response.url:
                requests_log.append(f"⬅️ {response.status} {response.url[:80]}")

        page.on("request", on_request)
        page.on("response", on_response)

        print("\n" + "="*50)
        print("🔍 差旅助手网络调试测试")
        print("="*50)

        try:
            # 进入页面
            print("\n📍 Step 1: 进入差旅助手")
            page.goto("http://localhost:20880")
            page.wait_for_load_state("networkidle")
            page.reload(wait_until="networkidle")

            page.locator("text=差旅助手").first.click()
            page.wait_for_load_state("networkidle")
            time.sleep(2)
            screenshot(page, "01_initial.png")

            chat_input = page.locator("input[placeholder='Type a message...']")
            send_btn = page.locator("text=Debug Chat").locator("..").locator("..").locator("button").last

            # 第一轮对话
            print("\n📍 Step 2: 第一轮对话")
            requests_log.clear()
            chat_input.fill("你好")
            screenshot(page, "02_msg1_input.png")
            send_btn.click()
            screenshot(page, "03_msg1_sending.png")

            # 等待输入框恢复
            for i in range(30):
                time.sleep(1)
                if not chat_input.is_disabled():
                    print(f"  ✅ 第一轮完成 ({i+1}秒)")
                    break

            screenshot(page, "04_msg1_response.png")
            print("  网络请求:")
            for log in requests_log:
                print(f"    {log}")

            # 第二轮对话
            print("\n📍 Step 3: 第二轮对话")
            requests_log.clear()
            chat_input.fill("我想去上海出差")
            screenshot(page, "05_msg2_input.png")
            send_btn.click()
            screenshot(page, "06_msg2_sending.png")

            # 等待输入框恢复
            for i in range(30):
                time.sleep(1)
                if not chat_input.is_disabled():
                    print(f"  ✅ 第二轮完成 ({i+1}秒)")
                    break
            else:
                print(f"  ⚠️ 第二轮超时 (30秒)")

            screenshot(page, "07_msg2_response.png")
            print("  网络请求:")
            for log in requests_log:
                print(f"    {log}")

            # 检查最终状态
            print(f"\n📍 Step 4: 最终状态")
            is_disabled = chat_input.is_disabled()
            print(f"  输入框 disabled: {is_disabled}")
            screenshot(page, "08_final.png")

            if is_disabled:
                print("\n❌ BUG: 输入框仍被禁用")
            else:
                print("\n✅ 测试通过: 可以进行多轮对话")

        except Exception as e:
            print(f"\n❌ 错误: {e}")
            screenshot(page, "error.png")

        finally:
            browser.close()

if __name__ == "__main__":
    main()
