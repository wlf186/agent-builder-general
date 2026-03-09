"""
创建差旅助手并测试流式输出
"""
from playwright.sync_api import sync_playwright
import time

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_default_timeout(60000)

        console_logs = []
        page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))

        try:
            print("📍 Step 1: 加载页面...")
            page.goto("http://localhost:20880")
            page.wait_for_load_state("networkidle")
            time.sleep(2)

            # 创建差旅助手
            print("📍 Step 2: 创建差旅助手...")
            create_btn = page.locator("button:has-text('Create Agent')")
            create_btn.click()
            page.wait_for_load_state("networkidle")
            time.sleep(1)

            # 填写表单
            name_input = page.locator("input").first
            name_input.fill("差旅助手")

            desc_input = page.locator("textarea")
            desc_input.fill("帮助用户处理差旅相关问题的AI助手")

            # 点击创建
            create_btn = page.locator("button:has-text('Create')")
            create_btn.click()
            page.wait_for_load_state("networkidle")
            time.sleep(2)

            print("📍 Step 3: 进入差旅助手...")
            # 返回列表
            page.goto("http://localhost:20880")
            page.wait_for_load_state("networkidle")
            time.sleep(1)

            # 点击差旅助手
            page.locator("text=差旅助手").first.click()
            page.wait_for_load_state("networkidle")
            time.sleep(2)

            print("📍 Step 4: 发送消息...")
            chat_input = page.locator("input[placeholder='Type a message...']")
            chat_input.fill("你好，数数1到5")
            chat_input.press("Enter")

            print("📍 Step 5: 监控流式输出...")
            prev_length = 0
            changes = []
            start_time = time.time()

            for i in range(80):
                time.sleep(0.25)
                try:
                    assistant_bubbles = page.locator("div.bg-white\\/10").all()
                    if assistant_bubbles:
                        text = assistant_bubbles[-1].text_content() or ""
                        current_length = len(text)
                        if current_length != prev_length and current_length > 0:
                            elapsed = time.time() - start_time
                            changes.append((elapsed, current_length, text[:50]))
                            print(f"  [{elapsed:.1f}s] 长度: {current_length} | {text[:30]}...")
                            prev_length = current_length
                except:
                    pass

            # 分析结果
            print(f"\n📊 分析结果：")
            print(f"  变化次数: {len(changes)}")
            if len(changes) > 3:
                print(f"  ✅ 流式输出正常！")
            else:
                print(f"  ❌ 流式输出异常")

            page.screenshot(path="/work/agent-general/screenshot/streaming_result.png")

            # 打印控制台错误
            errors = [log for log in console_logs if 'error' in log.lower()]
            if errors:
                print("\n❌ 控制台错误:")
                for err in errors:
                    print(f"  {err}")

        except Exception as e:
            print(f"❌ 错误: {e}")
            import traceback
            traceback.print_exc()
            page.screenshot(path="/work/agent-general/screenshot/error.png")

        finally:
            browser.close()

if __name__ == "__main__":
    main()
