"""
差旅助手调试 - 完整版
"""
from playwright.sync_api import sync_playwright
import os
import time

SCREENSHOT_DIR = "/work/agent-general/screenshot/full_debug"
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

def screenshot(page, name):
    page.screenshot(path=f"{SCREENSHOT_DIR}/{name}", full_page=True)
    print(f"  📸 {name}")

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_default_timeout(60000)

        network_log = []

        def on_request(req):
            if 'chat' in req.url:
                network_log.append(f"[{time.strftime('%H:%M:%S')}] ➡️ REQUEST: {req.method} {req.url[:60]}")

        def on_response(res):
            if 'chat' in res.url:
                network_log.append(f"[{time.strftime('%H:%M:%S')}] ⬅️ RESPONSE: {res.status}")

        page.on("request", on_request)
        page.on("response", on_response)

        print("\n" + "="*60)
        print("🔍 差旅助手完整调试测试")
        print("="*60)

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
            print("\n📍 Step 2: 第一轮对话 - '你好'")
            network_log.clear()
            chat_input.fill("你好")
            screenshot(page, "02_msg1_input.png")
            send_btn.click()
            print("  已发送，等待完成...")

            start_time = time.time()
            for i in range(60):
                time.sleep(1)
                if not chat_input.is_disabled():
                    elapsed = time.time() - start_time
                    print(f"  ✅ 第一轮完成 ({elapsed:.1f}秒)")
                    break
            else:
                print(f"  ⚠️ 第一轮超时 (60秒)")

            screenshot(page, "03_msg1_response.png")
            print("  网络日志:")
            for log in network_log:
                print(f"    {log}")

            # 第二轮对话
            print("\n📍 Step 3: 第二轮对话 - '我想去上海出差'")
            network_log.clear()
            chat_input.fill("我想去上海出差")
            screenshot(page, "04_msg2_input.png")
            send_btn.click()
            print("  已发送，等待完成...")

            start_time = time.time()
            for i in range(60):
                time.sleep(1)
                if not chat_input.is_disabled():
                    elapsed = time.time() - start_time
                    print(f"  ✅ 第二轮完成 ({elapsed:.1f}秒)")
                    break
            else:
                print(f"  ⚠️ 第二轮超时 (60秒)")

            screenshot(page, "05_msg2_response.png")
            print("  网络日志:")
            for log in network_log:
                print(f"    {log}")

            # 第三轮对话
            print("\n📍 Step 4: 第三轮对话 - '推荐酒店'")
            if chat_input.is_disabled():
                print("  ❌ 输入框被禁用，无法继续")
                screenshot(page, "06_error.png")
                return

            network_log.clear()
            chat_input.fill("推荐几家商务酒店")
            screenshot(page, "07_msg3_input.png")
            send_btn.click()
            print("  已发送，等待完成...")

            start_time = time.time()
            for i in range(60):
                time.sleep(1)
                if not chat_input.is_disabled():
                    elapsed = time.time() - start_time
                    print(f"  ✅ 第三轮完成 ({elapsed:.1f}秒)")
                    break
            else:
                print(f"  ⚠️ 第三轮超时 (60秒)")

            screenshot(page, "08_msg3_response.png")
            print("  网络日志:")
            for log in network_log:
                print(f"    {log}")

            print("\n✅ 三轮对话全部完成！")

        except Exception as e:
            print(f"\n❌ 错误: {e}")
            import traceback
            traceback.print_exc()
            screenshot(page, "error.png")

        finally:
            browser.close()
            print(f"\n📸 截图保存在: {SCREENSHOT_DIR}")

if __name__ == "__main__":
    main()
