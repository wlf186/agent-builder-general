"""
模型上下文窗口配置

定义各模型服务提供商的上下文窗口大小预设值。
优先级：用户配置 > API 返回 > 预设值 > 默认值
"""

from typing import Optional


# 模型上下文窗口大小预设（单位：tokens）
MODEL_CONTEXT_WINDOWS = {
    # OpenAI
    'gpt-4': 8192,
    'gpt-4-32k': 32768,
    'gpt-4-turbo': 128000,
    'gpt-4o': 128000,
    'gpt-4o-mini': 128000,
    'gpt-3.5-turbo': 16385,
    'o1': 200000,
    'o1-mini': 128000,
    'o3-mini': 200000,

    # Anthropic
    'claude-3-opus': 200000,
    'claude-3-sonnet': 200000,
    'claude-3-haiku': 200000,
    'claude-3.5-sonnet': 200000,
    'claude-3.5-haiku': 200000,
    'claude-3.7-sonnet': 200000,

    # 智谱 AI
    'glm-4': 128000,
    'glm-4-plus': 128000,
    'glm-4-air': 128000,
    'glm-4-flash': 128000,
    'glm-4-long': 1024000,
    'glm-4v': 8192,

    # 阿里百炼
    'qwen-turbo': 8192,
    'qwen-plus': 32768,
    'qwen-max': 32768,
    'qwen-long': 10000000,

    # DeepSeek
    'deepseek-chat': 64000,
    'deepseek-reasoner': 64000,

    # 本地模型默认值
    'llama': 4096,
    'mistral': 32768,
    'qwen': 8192,

    # 默认回退值
    'default': 4096,
}


def get_context_window_size(
    model_name: str,
    user_override: Optional[int] = None
) -> int:
    """
    获取模型的上下文窗口大小。

    优先级：
    1. 用户配置的覆盖值（user_override）
    2. 预设模型配置（模糊匹配模型名）
    3. 默认值（4096）

    Args:
        model_name: 模型名称（如 "gpt-4o", "glm-4-plus"）
        user_override: 用户配置的覆盖值（可选）

    Returns:
        上下文窗口大小（tokens）
    """
    if user_override and user_override > 0:
        return user_override

    if not model_name:
        return MODEL_CONTEXT_WINDOWS['default']

    # 标准化模型名（小写，移除常见前缀）
    normalized = model_name.lower()

    # 尝试精确匹配或部分匹配
    for key, value in MODEL_CONTEXT_WINDOWS.items():
        if key == 'default':
            continue
        if key in normalized or normalized in key:
            return value

    return MODEL_CONTEXT_WINDOWS['default']


def get_all_model_presets() -> dict:
    """返回所有模型预设配置（用于调试或展示）"""
    return MODEL_CONTEXT_WINDOWS.copy()
