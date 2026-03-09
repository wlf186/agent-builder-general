"""
通用Agent构建器 - Web界面
端口: 20880
参考扣子空间的设计风格
"""
import asyncio
import sys
from pathlib import Path
from typing import Optional, List

import gradio as gr

# 添加项目路径
sys.path.insert(0, str(Path(__file__).parent))

from src.models import AgentConfig, LLMProvider
from src.agent_manager import AgentManager

# 自定义CSS样式
CUSTOM_CSS = """
/* 全局样式 */
.gradio-container {
    max-width: 100% !important;
    padding: 0 !important;
    background: #f5f5f5 !important;
}

/* 主容器 */
.main-container {
    display: flex;
    min-height: 100vh;
}

/* 侧边栏 */
.sidebar {
    width: 240px;
    background: #ffffff;
    padding: 20px;
    border-right: 1px solid #e8e8e8;
    min-height: 100vh;
}

/* 内容区 */
.content-area {
    flex: 1;
    padding: 24px;
    background: #f5f5f5;
}

/* Agent卡片 */
.agent-card {
    background: #ffffff;
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 16px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    cursor: pointer;
    transition: all 0.2s ease;
    border: 1px solid transparent;
}

.agent-card:hover {
    box-shadow: 0 4px 16px rgba(0,0,0,0.1);
    border-color: #1890ff;
}

.agent-card-title {
    font-size: 16px;
    font-weight: 600;
    color: #1a1a1a;
    margin-bottom: 8px;
}

.agent-card-desc {
    font-size: 14px;
    color: #666;
    margin-bottom: 12px;
    line-height: 1.5;
}

.agent-card-meta {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 12px;
    color: #999;
}

.agent-card-tag {
    background: #f0f0f0;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
    color: #666;
}

/* 按钮样式 */
.primary-btn {
    background: #1890ff !important;
    color: white !important;
    border: none !important;
    border-radius: 8px !important;
    padding: 10px 20px !important;
    font-weight: 500 !important;
}

.primary-btn:hover {
    background: #40a9ff !important;
}

/* 输入框样式 */
.input-box {
    border-radius: 8px !important;
    border: 1px solid #d9d9d9 !important;
}

.input-box:focus {
    border-color: #1890ff !important;
    box-shadow: 0 0 0 2px rgba(24,144,255,0.1) !important;
}

/* 配置页面 */
.config-section {
    background: #ffffff;
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 16px;
}

.config-title {
    font-size: 14px;
    font-weight: 600;
    color: #1a1a1a;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #f0f0f0;
}

/* 聊天框 */
.chat-container {
    background: #ffffff;
    border-radius: 12px;
    border: 1px solid #e8e8e8;
}

/* 隐藏默认元素 */
.hide-container > .gradio-container > .contain {
    display: none;
}
"""


class AgentBuilderApp:
    """Agent构建器应用"""

    def __init__(self):
        self.data_dir = Path(__file__).parent / "data"
        self.manager = AgentManager(self.data_dir)
        self.current_agent: Optional[str] = None

    def create_ui(self):
        """创建UI"""
        with gr.Blocks(title="通用Agent构建器") as app:
            # 状态变量
            current_agent_state = gr.State(None)
            agents_data_state = gr.State([])

            # ==================== 主页面 ====================
            with gr.Group(visible=True) as main_page:
                with gr.Row():
                    # 左侧导航栏
                    with gr.Column(scale=1, min_width=220):
                        with gr.Column(elem_classes=["sidebar"]):
                            gr.Markdown("### 🤖 Agent构建器")
                            gr.Markdown("---")
                            create_btn_sidebar = gr.Button(
                                "➕ 创建Agent",
                                variant="primary",
                                size="lg",
                                elem_classes=["primary-btn"]
                            )
                            gr.Markdown(" ")
                            gr.Markdown("**我的Agent**")
                            agent_count = gr.Markdown("共 0 个")

                    # 右侧主内容区
                    with gr.Column(scale=5):
                        with gr.Column(elem_classes=["content-area"]):
                            # 顶部栏
                            with gr.Row():
                                gr.Markdown("## Agent工作台")
                                with gr.Column(scale=1):
                                    refresh_btn = gr.Button("🔄 刷新", size="sm")

                            # Agent卡片区域
                            agents_container = gr.Column()
                            with agents_container:
                                agent_cards_html = gr.HTML("<p style='color:#999;text-align:center;padding:40px;'>暂无Agent，点击左侧「创建Agent」开始</p>")

            # ==================== 创建弹窗 ====================
            with gr.Group(visible=False) as create_modal:
                with gr.Column():
                    gr.Markdown("## 创建Agent")
                    gr.Markdown("---")

                    new_name = gr.Textbox(
                        label="Agent名称",
                        placeholder="给Agent起个名字",
                        max_length=50,
                        elem_classes=["input-box"]
                    )
                    new_description = gr.Textbox(
                        label="功能介绍",
                        placeholder="简要描述Agent的功能和用途...",
                        lines=4,
                        max_length=500,
                        elem_classes=["input-box"]
                    )

                    gr.Markdown("---")

                    with gr.Row():
                        cancel_create_btn = gr.Button("取消", size="lg")
                        submit_create_btn = gr.Button("创建", variant="primary", size="lg", elem_classes=["primary-btn"])

                    create_result_msg = gr.Markdown()

            # ==================== 配置调试页面 ====================
            with gr.Group(visible=False) as config_page:
                # 顶部标题栏
                with gr.Row():
                    back_btn = gr.Button("← 返回列表", size="sm")
                    config_agent_title = gr.Markdown("# Agent配置")
                    with gr.Column(scale=1):
                        with gr.Row():
                            save_config_btn = gr.Button("💾 保存", variant="primary", size="sm")
                            publish_btn = gr.Button("🚀 发布", size="sm")

                gr.Markdown("---")

                # 左右分栏布局
                with gr.Row():
                    # 左侧：配置区
                    with gr.Column(scale=1):
                        with gr.Column(elem_classes=["config-section"]):
                            gr.Markdown("**📝 人设与提示词**", elem_classes=["config-title"])
                            persona_input = gr.Textbox(
                                label="",
                                placeholder="描述Agent的角色、性格和能力...",
                                lines=5,
                                value="你是一个有帮助的AI助手。",
                                elem_classes=["input-box"]
                            )

                        with gr.Column(elem_classes=["config-section"]):
                            gr.Markdown("**🧠 模型配置**", elem_classes=["config-title"])
                            llm_provider = gr.Dropdown(
                                label="LLM提供商",
                                choices=[p.value for p in LLMProvider],
                                value="ollama"
                            )
                            llm_model = gr.Textbox(
                                label="模型名称",
                                value="qwen2.5:7b",
                                elem_classes=["input-box"]
                            )
                            with gr.Row():
                                llm_base_url = gr.Textbox(
                                    label="API地址",
                                    placeholder="http://localhost:11434",
                                    elem_classes=["input-box"]
                                )
                                llm_api_key = gr.Textbox(
                                    label="API密钥",
                                    type="password",
                                    elem_classes=["input-box"]
                                )

                        with gr.Column(elem_classes=["config-section"]):
                            gr.Markdown("**⚙️ 高级设置**", elem_classes=["config-title"])
                            with gr.Row():
                                temperature = gr.Slider(
                                    label="温度 (Temperature)",
                                    minimum=0,
                                    maximum=1,
                                    step=0.1,
                                    value=0.7
                                )
                                max_iterations = gr.Slider(
                                    label="最大迭代次数",
                                    minimum=1,
                                    maximum=20,
                                    step=1,
                                    value=10
                                )

                    # 右侧：调试区
                    with gr.Column(scale=1):
                        with gr.Column(elem_classes=["config-section"]):
                            gr.Markdown("**💬 调试对话**", elem_classes=["config-title"])

                            debug_chatbot = gr.Chatbot(
                                label="",
                                height=450
                            )

                            with gr.Row():
                                debug_input = gr.Textbox(
                                    label="",
                                    placeholder="输入消息测试Agent...",
                                    scale=4,
                                    elem_classes=["input-box"]
                                )
                                debug_send_btn = gr.Button("发送", variant="primary", scale=1)

                            with gr.Row():
                                clear_debug_btn = gr.Button("清空对话", size="sm")
                                delete_agent_btn = gr.Button("🗑️ 删除此Agent", variant="stop", size="sm")

                config_result_msg = gr.Markdown()

            # ==================== 事件绑定 ====================

            def get_agent_cards_html():
                agents = self.manager.list_agents()
                if not agents:
                    return "<p style='color:#999;text-align:center;padding:40px;'>暂无Agent，点击左侧「创建Agent」开始</p>"

                cards_html = ""
                for name in agents:
                    config = self.manager.get_config(name)
                    if config:
                        desc = config.persona[:80] + "..." if len(config.persona) > 80 else config.persona
                        model = config.llm_model
                        cards_html += f"""
                        <div class="agent-card" onclick="document.querySelector('#card_{name}').click()">
                            <div class="agent-card-title">🤖 {name}</div>
                            <div class="agent-card-desc">{desc}</div>
                            <div class="agent-card-meta">
                                <span class="agent-card-tag">{model}</span>
                                <span>已保存</span>
                            </div>
                        </div>
                        """
                return cards_html

            def refresh_main_page():
                agents = self.manager.list_agents()
                return (
                    get_agent_cards_html(),
                    f"共 {len(agents)} 个",
                    agents
                )

            def show_create_modal_fn():
                return (
                    gr.update(visible=False),  # main_page
                    gr.update(visible=True),   # create_modal
                    "",                        # new_name
                    "",                        # new_description
                    ""                         # create_result_msg
                )

            def hide_create_modal_fn():
                return (
                    gr.update(visible=True),   # main_page
                    gr.update(visible=False),  # create_modal
                    refresh_main_page()[0],    # agent_cards_html
                    refresh_main_page()[1]     # agent_count
                )

            def create_agent_simple(name, description):
                if not name or not name.strip():
                    return gr.update(), gr.update(), gr.update(), gr.update(), "❌ 请输入Agent名称"

                if name in self.manager.list_agents():
                    return gr.update(), gr.update(), gr.update(), gr.update(), "❌ Agent名称已存在"

                config = AgentConfig(
                    name=name.strip(),
                    persona=description or "你是一个有帮助的AI助手。"
                )

                if self.manager.create_agent_config(config):
                    return (
                        gr.update(visible=True),   # main_page
                        gr.update(visible=False),  # create_modal
                        get_agent_cards_html(),    # agent_cards_html
                        f"共 {len(self.manager.list_agents())} 个",  # agent_count
                        ""                         # create_result_msg
                    )
                else:
                    return gr.update(), gr.update(), gr.update(), gr.update(), "❌ 创建失败"

            def show_config_page_fn(agent_name):
                if not agent_name:
                    return [gr.update()] * 14

                config = self.manager.get_config(agent_name)
                if not config:
                    return [gr.update()] * 14

                return (
                    gr.update(visible=False),      # main_page
                    gr.update(visible=True),       # config_page
                    f"# 🤖 {agent_name}",          # config_agent_title
                    config.persona,                # persona_input
                    config.llm_provider.value,     # llm_provider
                    config.llm_model,              # llm_model
                    config.llm_base_url or "",     # llm_base_url
                    config.llm_api_key or "",      # llm_api_key
                    config.temperature,            # temperature
                    config.max_iterations,         # max_iterations
                    [],                            # debug_chatbot
                    "",                            # config_result_msg
                    agent_name,                    # current_agent_state
                    gr.update(visible=True)        # ensure config page visible
                )

            def save_config_fn(name, persona, provider, model, base_url, api_key, temp, max_iter):
                if not name:
                    return "❌ Agent名称无效"

                config = AgentConfig(
                    name=name,
                    persona=persona,
                    llm_provider=LLMProvider(provider),
                    llm_model=model,
                    llm_base_url=base_url or None,
                    llm_api_key=api_key or None,
                    temperature=temp,
                    max_iterations=int(max_iter)
                )

                if self.manager.update_agent_config(name, config):
                    return "✅ 配置已保存"
                else:
                    return "❌ 保存失败"

            async def debug_chat(agent_name, message, history):
                if not agent_name:
                    history = history + [(message, "请先选择或创建Agent")]
                    return history

                if not message.strip():
                    return history

                instance = await self.manager.get_instance(agent_name)
                if not instance:
                    history = history + [(message, f"无法加载Agent: {agent_name}")]
                    return history

                try:
                    response = await instance.chat(message)
                    history = history + [(message, response)]
                except Exception as e:
                    history = history + [(message, f"错误: {str(e)}")]

                return history

            def sync_debug_chat(agent_name, message, history):
                return asyncio.run(debug_chat(agent_name, message, history))

            def delete_current_agent(agent_name):
                if not agent_name:
                    return (
                        gr.update(visible=True),
                        gr.update(visible=False),
                        get_agent_cards_html(),
                        f"共 {len(self.manager.list_agents())} 个",
                        ""
                    )

                self.manager.delete_agent_config(agent_name)
                agents = self.manager.list_agents()
                return (
                    gr.update(visible=True),
                    gr.update(visible=False),
                    get_agent_cards_html(),
                    f"共 {len(agents)} 个",
                    ""
                )

            def back_to_main():
                return (
                    gr.update(visible=True),
                    gr.update(visible=False),
                    get_agent_cards_html(),
                    f"共 {len(self.manager.list_agents())} 个"
                )

            # 隐藏的按钮用于卡片点击
            hidden_card_btns = []
            for name in self.manager.list_agents():
                btn = gr.Button(value=name, visible=False, elem_id=f"card_{name}")
                hidden_card_btns.append(btn)

            # 动态卡片点击处理
            card_click_input = gr.Textbox(visible=False)

            def handle_card_click(agent_name, agents_list):
                if agent_name in agents_list:
                    return show_config_page_fn(agent_name)
                return [gr.update()] * 14

            # 主页面事件
            create_btn_sidebar.click(
                show_create_modal_fn,
                outputs=[main_page, create_modal, new_name, new_description, create_result_msg]
            )

            refresh_btn.click(
                refresh_main_page,
                outputs=[agent_cards_html, agent_count, agents_data_state]
            )

            # 创建弹窗事件
            cancel_create_btn.click(
                hide_create_modal_fn,
                outputs=[main_page, create_modal, agent_cards_html, agent_count]
            )

            submit_create_btn.click(
                create_agent_simple,
                inputs=[new_name, new_description],
                outputs=[main_page, create_modal, agent_cards_html, agent_count, create_result_msg]
            )

            # 配置页面事件
            back_btn.click(
                back_to_main,
                outputs=[main_page, config_page, agent_cards_html, agent_count]
            )

            save_config_btn.click(
                save_config_fn,
                inputs=[current_agent_state, persona_input, llm_provider, llm_model,
                       llm_base_url, llm_api_key, temperature, max_iterations],
                outputs=[config_result_msg]
            )

            publish_btn.click(
                save_config_fn,
                inputs=[current_agent_state, persona_input, llm_provider, llm_model,
                       llm_base_url, llm_api_key, temperature, max_iterations],
                outputs=[config_result_msg]
            )

            delete_agent_btn.click(
                delete_current_agent,
                inputs=[current_agent_state],
                outputs=[main_page, config_page, agent_cards_html, agent_count, current_agent_state]
            )

            # 调试聊天事件
            debug_send_btn.click(
                sync_debug_chat,
                inputs=[current_agent_state, debug_input, debug_chatbot],
                outputs=[debug_chatbot]
            ).then(lambda: "", outputs=[debug_input])

            debug_input.submit(
                sync_debug_chat,
                inputs=[current_agent_state, debug_input, debug_chatbot],
                outputs=[debug_chatbot]
            ).then(lambda: "", outputs=[debug_input])

            clear_debug_btn.click(lambda: [], outputs=[debug_chatbot])

            # 卡片点击事件（通过隐藏的输入框）
            card_click_input.change(
                handle_card_click,
                inputs=[card_click_input, agents_data_state],
                outputs=[main_page, config_page, config_agent_title, persona_input,
                        llm_provider, llm_model, llm_base_url, llm_api_key,
                        temperature, max_iterations, debug_chatbot, config_result_msg,
                        current_agent_state, config_page]
            )

            # JavaScript来处理卡片点击
            gr.HTML("""
            <script>
            document.addEventListener('click', function(e) {
                const card = e.target.closest('.agent-card');
                if (card) {
                    const title = card.querySelector('.agent-card-title');
                    if (title) {
                        const name = title.textContent.replace('🤖 ', '').trim();
                        // 找到隐藏的输入框并设置值
                        const inputs = document.querySelectorAll('input[type="text"], input:not([type])');
                        inputs.forEach(input => {
                            if (input.offsetWidth === 0 && input.offsetHeight === 0) {
                                // 这是一个隐藏的输入框
                                input.value = name;
                                input.dispatchEvent(new Event('input', { bubbles: true }));
                                input.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                        });
                    }
                }
            });
            </script>
            """)

            # 初始化
            app.load(
                refresh_main_page,
                outputs=[agent_cards_html, agent_count, agents_data_state]
            )

        return app

    def run(self, port: int = 20880):
        """运行应用"""
        print(f"🚀 启动服务: http://localhost:{port}")
        app = self.create_ui()
        app.launch(
            server_name="127.0.0.1",
            server_port=port,
            share=False,
            show_error=True,
            css=CUSTOM_CSS
        )


if __name__ == "__main__":
    app = AgentBuilderApp()
    app.run(port=20880)
