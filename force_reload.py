"""
强制刷新测试
"""
from playwright.sync_api import sync_playwright
import time

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        # 清除缓存
        context.clear_cookies()

        page = context.new_page()
        page.set_default_timeout(15000)

        try:
            print("📍 强制刷新页面...")
            # 先访问，然后强制刷新
            page.goto("http://localhost:20880", wait_until="networkidle")
            page.reload(wait_until="networkidle")
            time.sleep(3)

            page.screenshot(path="/work/agent-general/screenshot/after_reload.png")

            # 检查是否有agent
            text = page.text_content("body")
            if "差旅助手" in text or "mark-test" in text:
                print("✅ 找到agent")

                # 点击第一个agent
                cards = page.locator("[class*='Card']").all()
                print(f"找到 {len(cards)} 个卡片")

                if cards:
                    cards[0].click()
                    page.wait_for_load_state("networkidle")
                    time.sleep(2)

                    # 发送消息测试流式
                    chat_input = page.locator("input[placeholder='Type a message...']")
                    if chat_input.is_visible():
                        chat_input.fill("你好")
                        chat_input.press("Enter")

                        print("📍 等待5秒观察流式输出...")
                        prev_len = 0
                        for i in range(10):
                            time.sleep(0.5)
                            try:
                                bubbles = page.locator("div.bg-white\\/10").all()
                                if bubbles:
                                    txt = bubbles[-1].text_content() or ""
                                    if len(txt) != prev_len:
                                        print(f"  [{i*0.5}s] 长度变化: {prev_len} -> {len(txt)}")
                                        prev_len = len(txt)
                            except:
                                pass

                        page.screenshot(path="/work/agent-general/screenshot/stream_result.png")
            else:
                print("❌ 仍未找到agent")
                print(f"页面内容: {text[:500]}")

        except Exception as e:
            print(f"错误: {e}")

        finally:
            browser.close()

if __name__ == "__main__":
    main()
