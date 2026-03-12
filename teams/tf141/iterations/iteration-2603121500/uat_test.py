#!/usr/bin/env python3
"""
UAT验收测试脚本 - iteration-2603121500

测试内容:
1. skill-test-pdf智能体上传PDF并提取前150字
2. skill-test-doc智能体上传DOCX并提取前100字
3. test001例行验证（3轮对话）
"""

import os
import json
from datetime import datetime
from playwright.sync_api import sync_playwright

# 测试配置
BASE_URL = "http://localhost:20880"
OUTPUT_DIR = "/work/agent-builder-general/teams/tf141/iterations/iteration-2603121500"
PDF_FILE = "/work/agent-builder-general/test/测试1.pdf"
DOCX_FILE = "/work/agent-builder-general/test/测试2.docx"

# 确保输出目录存在
os.makedirs(OUTPUT_DIR, exist_ok=True)

class UATTester:
    def __init__(self):
        self.results = []
        self.screenshots = []

    def log(self, test_name, status, details, screenshot_path=None):
        """记录测试结果"""
        result = {
            "timestamp": datetime.now().isoformat(),
            "test_name": test_name,
            "status": status,  # PASS, FAIL, WARN
            "details": details
        }
        if screenshot_path:
            result["screenshot"] = screenshot_path
        self.results.append(result)
        print(f"[{status}] {test_name}: {details}")

    def screenshot(self, page, name):
        """保存截图"""
        path = os.path.join(OUTPUT_DIR, f"{name}.png")
        page.screenshot(path=path, full_page=True)
        self.screenshots.append(path)
        return path

    def wait_for_response(self, page, timeout=60000):
        """等待流式响应完成"""
        try:
            # 等待思考区域出现
            try:
                page.wait_for_selector(".border-l-2.border-cyan-500\\/50, [class*='thinking']", timeout=10000)
            except:
                pass

            # 等待光标消失（打字机完成）
            page.wait_for_timeout(3000)
            return True
        except Exception as e:
            return False

    def test_pdf_skill(self, page):
        """测试PDF技能"""
        print("\n=== 测试PDF技能 ===")

        # 1. 点击进入skill-test-pdf智能体
        page.goto(f"{BASE_URL}/")
        page.wait_for_load_state("networkidle")

        # 查找并点击skill-test-pdf卡片
        try:
            page.click("text=skill-test-pdf", timeout=5000)
        except:
            # 可能需要滚动或使用其他选择器
            page.locator(".agent-card").filter(has_text="skill-test-pdf").click()
        page.wait_for_load_state("networkidle")
        self.screenshot(page, "01_pdf_agent_page")

        # 2. 上传PDF文件
        try:
            # 查找文件上传按钮
            file_input = page.locator("input[type='file']").first
            file_input.set_input_files(PDF_FILE)
            page.wait_for_timeout(1000)
            self.screenshot(page, "02_pdf_uploaded")
            self.log("PDF文件上传", "PASS", "成功上传测试1.pdf")
        except Exception as e:
            self.screenshot(page, "02_pdf_upload_fail")
            self.log("PDF文件上传", "FAIL", f"上传失败: {str(e)}")
            return

        # 3. 发送消息
        try:
            # 输入框是input类型，不是textarea
            message_box = page.locator("input[type='text']").first
            message_box.fill("提取文档的前150字")
            page.wait_for_timeout(500)
            self.screenshot(page, "03_pdf_message_typed")

            # 点击发送按钮 - 查找包含"发送"或"Send"文本的按钮
            send_button = page.locator("button:has-text('发送'), button:has-text('Send')").first
            send_button.click()
            self.log("PDF消息发送", "PASS", "发送消息: 提取文档的前150字")
        except Exception as e:
            self.screenshot(page, "03_pdf_send_fail")
            self.log("PDF消息发送", "FAIL", f"发送失败: {str(e)}")
            return

        # 4. 等待响应完成
        self.wait_for_response(page)
        page.wait_for_timeout(3000)
        self.screenshot(page, "04_pdf_response")

        # 5. 检查技能执行状态
        try:
            # 先展开思考过程区域（点击展开按钮）
            try:
                expand_button = page.locator("button:has-text('思考过程'), button:has-text('Thinking')").first
                if expand_button.is_visible():
                    expand_button.click()
                    page.wait_for_timeout(500)
            except:
                pass

            # 查找技能执行状态 - 在"技能执行状态"/"Skill Execution"区域内
            status_elements = page.locator(".border-l-2.border-cyan-500\\/50, [class*='skill']").all()
            statuses = [el.inner_text() for el in status_elements if el.is_visible()]
            print(f"发现状态元素: {statuses}")

            # 检查是否有"执行完成"/"Completed"状态
            has_complete = any("完成" in s or "Completed" in s or "✓" in s for s in statuses)
            has_failed = any("失败" in s or "Failed" in s or "error" in s.lower() or "✗" in s for s in statuses)

            if has_complete and not has_failed:
                self.log("PDF技能状态", "PASS", f"显示执行完成，状态: {statuses}")
            elif has_failed:
                self.log("PDF技能状态", "FAIL", f"显示执行失败，状态: {statuses}")
            else:
                self.log("PDF技能状态", "WARN", f"未找到明确状态，发现: {statuses}")
        except Exception as e:
            self.log("PDF技能状态", "WARN", f"状态检查异常: {str(e)}")

        # 6. 获取响应内容
        try:
            messages = page.locator(".message, [class*='chat-message']").all()
            for msg in messages:
                text = msg.inner_text()
                if len(text) > 50:  # 非测试消息
                    self.log("PDF响应内容", "PASS", f"提取结果: {text[:200]}...")
                    break
        except Exception as e:
            self.log("PDF响应内容", "WARN", f"获取响应失败: {str(e)}")

    def test_docx_skill(self, page):
        """测试DOCX技能"""
        print("\n=== 测试DOCX技能 ===")

        # 1. 返回首页并进入skill-test-doc智能体
        page.goto(f"{BASE_URL}/")
        page.wait_for_load_state("networkidle")

        try:
            page.click("text=skill-test-doc", timeout=5000)
        except:
            page.locator(".agent-card").filter(has_text="skill-test-doc").click()
        page.wait_for_load_state("networkidle")
        self.screenshot(page, "05_docx_agent_page")

        # 2. 上传DOCX文件
        try:
            file_input = page.locator("input[type='file']").first
            file_input.set_input_files(DOCX_FILE)
            page.wait_for_timeout(1000)
            self.screenshot(page, "06_docx_uploaded")
            self.log("DOCX文件上传", "PASS", "成功上传测试2.docx")
        except Exception as e:
            self.screenshot(page, "06_docx_upload_fail")
            self.log("DOCX文件上传", "FAIL", f"上传失败: {str(e)}")
            return

        # 3. 发送消息
        try:
            message_box = page.locator("input[type='text']").first
            message_box.fill("提取文档的前100字")
            page.wait_for_timeout(500)
            self.screenshot(page, "07_docx_message_typed")

            send_button = page.locator("button:has-text('发送'), button:has-text('Send')").first
            send_button.click()
            self.log("DOCX消息发送", "PASS", "发送消息: 提取文档的前100字")
        except Exception as e:
            self.screenshot(page, "07_docx_send_fail")
            self.log("DOCX消息发送", "FAIL", f"发送失败: {str(e)}")
            return

        # 4. 等待响应完成
        self.wait_for_response(page)
        page.wait_for_timeout(3000)
        self.screenshot(page, "08_docx_response")

        # 5. 检查技能执行状态
        try:
            # 先展开思考过程区域
            try:
                expand_button = page.locator("button:has-text('思考过程'), button:has-text('Thinking')").first
                if expand_button.is_visible():
                    expand_button.click()
                    page.wait_for_timeout(500)
            except:
                pass

            # 查找技能执行状态
            status_elements = page.locator(".border-l-2.border-cyan-500\\/50, [class*='skill']").all()
            statuses = [el.inner_text() for el in status_elements if el.is_visible()]
            print(f"发现状态元素: {statuses}")

            has_complete = any("完成" in s or "Completed" in s or "✓" in s for s in statuses)
            has_failed = any("失败" in s or "Failed" in s or "error" in s.lower() or "✗" in s for s in statuses)

            if has_complete and not has_failed:
                self.log("DOCX技能状态", "PASS", f"显示执行完成，状态: {statuses}")
            elif has_failed:
                self.log("DOCX技能状态", "FAIL", f"显示执行失败，状态: {statuses}")
            else:
                self.log("DOCX技能状态", "WARN", f"未找到明确状态，发现: {statuses}")
        except Exception as e:
            self.log("DOCX技能状态", "WARN", f"状态检查异常: {str(e)}")

        # 6. 获取响应内容
        try:
            messages = page.locator(".message, [class*='chat-message']").all()
            for msg in messages:
                text = msg.inner_text()
                if len(text) > 50:
                    self.log("DOCX响应内容", "PASS", f"提取结果: {text[:200]}...")
                    break
        except Exception as e:
            self.log("DOCX响应内容", "WARN", f"获取响应失败: {str(e)}")

    def test_test001_agent(self, page):
        """测试test001例行验证"""
        print("\n=== 测试test001例行验证 ===")

        # 进入test001智能体
        page.goto(f"{BASE_URL}/")
        page.wait_for_load_state("networkidle")

        try:
            page.click("text=test001", timeout=5000)
        except:
            page.locator(".agent-card").filter(has_text="test001").click()
        page.wait_for_load_state("networkidle")
        self.screenshot(page, "09_test001_page")

        # 第1轮对话
        test_messages = [
            ("你好", "第1轮"),
            ("今天天气怎么样", "第2轮"),
            ("谢谢", "第3轮")
        ]

        for msg, round_name in test_messages:
            try:
                message_box = page.locator("input[type='text']").first
                message_box.fill(msg)
                page.wait_for_timeout(500)

                send_button = page.locator("button:has-text('发送'), button:has-text('Send')").first
                send_button.click()
                self.log(f"test001{round_name}", "PASS", f"发送消息: {msg}")

                self.wait_for_response(page)
                page.wait_for_timeout(2000)
                self.screenshot(page, f"10_test001_{round_name}")
            except Exception as e:
                self.log(f"test001{round_name}", "FAIL", f"发送失败: {str(e)}")

    def save_report(self):
        """保存测试报告"""
        # JSON格式报告
        json_report = {
            "test_run": datetime.now().isoformat(),
            "iteration": "iteration-2603121500",
            "tester": "User-representative (TF141)",
            "results": self.results,
            "screenshots": self.screenshots
        }

        json_path = os.path.join(OUTPUT_DIR, "uat_report.json")
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(json_report, f, ensure_ascii=False, indent=2)

        # Markdown格式报告
        md_lines = [
            "# UAT验收报告",
            "",
            f"**迭代**: iteration-2603121500",
            f"**测试时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            f"**测试人员**: User-representative (TF141)",
            "",
            "## 测试摘要",
            "",
        ]

        pass_count = sum(1 for r in self.results if r["status"] == "PASS")
        fail_count = sum(1 for r in self.results if r["status"] == "FAIL")
        warn_count = sum(1 for r in self.results if r["status"] == "WARN")

        md_lines.extend([
            f"- **通过**: {pass_count}",
            f"- **失败**: {fail_count}",
            f"- **警告**: {warn_count}",
            "",
            "## 测试详情",
            ""
        ])

        for r in self.results:
            status_icon = {"PASS": "✅", "FAIL": "❌", "WARN": "⚠️"}[r["status"]]
            md_lines.append(f"### {status_icon} {r['test_name']}")
            md_lines.append(f"- **状态**: {r['status']}")
            md_lines.append(f"- **详情**: {r['details']}")
            if "screenshot" in r:
                rel_path = os.path.basename(r["screenshot"])
                md_lines.append(f"- **截图**: {rel_path}")
            md_lines.append("")

        md_lines.extend([
            "## 截图清单",
            ""
        ])

        for s in self.screenshots:
            md_lines.append(f"- ![{os.path.basename(s)}]({os.path.basename(s)})")
            md_lines.append("")

        md_path = os.path.join(OUTPUT_DIR, "UAT报告.md")
        with open(md_path, "w", encoding="utf-8") as f:
            f.write("\n".join(md_lines))

        print(f"\n报告已保存:")
        print(f"- JSON: {json_path}")
        print(f"- Markdown: {md_path}")

        return md_path, json_path

    def run(self):
        """运行所有测试"""
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                viewport={"width": 1920, "height": 1080}
            )
            page = context.new_page()

            try:
                self.test_pdf_skill(page)
                self.test_docx_skill(page)
                self.test_test001_agent(page)
            finally:
                browser.close()

        return self.save_report()

if __name__ == "__main__":
    tester = UATTester()
    tester.run()
