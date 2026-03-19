"""
Langfuse 客户端封装

提供统一的 Langfuse 接口，支持异步非阻塞的 Tracing。
设计原则：
1. 所有方法都是非阻塞的（内部使用后台线程队列）
2. 不影响流式输出
3. 支持环境隔离（通过 LANGFUSE_HOST）
"""
import os
import json
from typing import Optional, Dict, Any, List
from pathlib import Path
from dataclasses import dataclass, field

# Langfuse 导入（需要安装: pip install langfuse>=2.0.0）
try:
    from langfuse import Langfuse
    LANGFUSE_AVAILABLE = True
except ImportError:
    LANGFUSE_AVAILABLE = False
    Langfuse = None


@dataclass
class TraceConfig:
    """Trace 配置"""
    name: str
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    tags: List[str] = field(default_factory=dict)
    release: Optional[str] = None


class LangfuseClient:
    """
    Langfuse 客户端封装

    使用示例:
        client = LangfuseClient()
        trace = client.create_trace("agent_chat", user_id="user123", session_id="conv456")
        generation = trace.generation(model="gpt-4", input="Hello", output="Hi")
    """

    # 类变量：全局单例
    _instance: Optional['LangfuseClient'] = None
    _langfuse: Optional[Langfuse] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if not LANGFUSE_AVAILABLE:
            print("[Langfuse] SDK 未安装，Tracing 功能已禁用。运行: pip install langfuse")
            self.enabled = False
            return

        if self._langfuse is not None:
            return  # 已初始化

        # 从环境变量读取配置
        public_key = os.environ.get("LANGFUSE_PUBLIC_KEY")
        secret_key = os.environ.get("LANGFUSE_SECRET_KEY")
        host = os.environ.get("LANGFUSE_HOST", "http://localhost:3000")

        # 检查是否启用
        self.enabled = bool(public_key and secret_key)

        if not self.enabled:
            print("[Langfuse] 未配置 API Keys，Tracing 功能已禁用")
            print("[Langfuse] 设置 LANGFUSE_PUBLIC_KEY 和 LANGFUSE_SECRET_KEY 环境变量启用")
            return

        # 初始化 Langfuse 客户端
        try:
            self._langfuse = Langfuse(
                public_key=public_key,
                secret_key=secret_key,
                host=host,
                release=os.environ.get("LANGFUSE_RELEASE", "local-dev"),
                debug=os.environ.get("LANGFUSE_DEBUG", "false").lower() == "true",
                threads=int(os.environ.get("LANGFUSE_THREADS", "1")),
            )
            print(f"[Langfuse] 已启用: {host}")
        except Exception as e:
            print(f"[Langfuse] 初始化失败: {e}")
            self.enabled = False

    def create_trace(
        self,
        name: str,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        input: Optional[Any] = None,
        metadata: Optional[Dict[str, Any]] = None,
        tags: Optional[List[str]] = None,
    ) -> Optional['TraceProxy']:
        """创建一个新的 Trace（非阻塞）"""
        if not self.enabled:
            return None

        try:
            trace = self._langfuse.trace(
                name=name,
                user_id=user_id,
                session_id=session_id,
                input=input,
                metadata=metadata or {},
                tags=tags or [],
            )
            return TraceProxy(trace)
        except Exception as e:
            print(f"[Langfuse] 创建 Trace 失败: {e}")
            return None

    def auth_check(self) -> bool:
        """验证 Langfuse 连接是否正常"""
        if not self.enabled:
            return False
        try:
            return self._langfuse.auth_check()
        except Exception:
            return False

    def flush(self):
        """刷新所有待发送的事件（阻塞，用于应用关闭时）"""
        if self.enabled and self._langfuse:
            self._langfuse.flush()


class TraceProxy:
    """
    Trace 代理对象

    包装 Langfuse Trace 对象，提供更友好的接口。
    所有方法都是非阻塞的。
    """

    def __init__(self, trace: Any):
        self._trace = trace
        self.id = trace.id if hasattr(trace, 'id') else None

    def update(
        self,
        output: Optional[Any] = None,
        metadata: Optional[Dict[str, Any]] = None,
        level: Optional[str] = None,
        status_message: Optional[str] = None,
    ) -> None:
        """更新 Trace（非阻塞）"""
        try:
            kwargs = {}
            if output is not None:
                kwargs['output'] = output
            if metadata is not None:
                kwargs['metadata'] = metadata
            if level is not None:
                kwargs['level'] = level
            if status_message is not None:
                kwargs['status_message'] = status_message

            self._trace.update(**kwargs)
        except Exception as e:
            print(f"[Langfuse] 更新 Trace 失败: {e}")

    def span(
        self,
        name: str,
        input: Optional[Any] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional['SpanProxy']:
        """创建子 Span（非阻塞）"""
        try:
            span = self._trace.span(
                name=name,
                input=input,
                metadata=metadata or {},
            )
            return SpanProxy(span)
        except Exception as e:
            print(f"[Langfuse] 创建 Span 失败: {e}")
            return None

    def generation(
        self,
        name: str,
        model: str,
        input: Any,
        output: Optional[str] = None,
        usage_details: Optional[Dict[str, Any]] = None,
        model_parameters: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional['GenerationProxy']:
        """创建 Generation（非阻塞）"""
        try:
            gen = self._trace.generation(
                name=name,
                model=model,
                input=input,
                output=output,
                usage_details=usage_details or {},
                model_parameters=model_parameters or {},
                metadata=metadata or {},
            )
            return GenerationProxy(gen)
        except Exception as e:
            print(f"[Langfuse] 创建 Generation 失败: {e}")
            return None

    def event(
        self,
        name: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """记录事件（非阻塞）"""
        try:
            self._trace.event(
                name=name,
                metadata=metadata or {},
            )
        except Exception as e:
            print(f"[Langfuse] 记录 Event 失败: {e}")

    def score(
        self,
        name: str,
        value: float,
        comment: Optional[str] = None,
    ) -> None:
        """添加评分（非阻塞）"""
        try:
            self._trace.score(
                name=name,
                value=value,
                comment=comment,
            )
        except Exception as e:
            print(f"[Langfuse] 添加 Score 失败: {e}")

    def get_trace_url(self) -> str:
        """获取 Trace 的 URL（用于日志或调试）"""
        if self._trace and hasattr(self._trace, 'get_trace_url'):
            return self._trace.get_trace_url()
        return ""


class SpanProxy:
    """Span 代理对象"""

    def __init__(self, span: Any):
        self._span = span
        self.id = span.id if hasattr(span, 'id') else None

    def end(
        self,
        output: Optional[Any] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """结束 Span（非阻塞）"""
        try:
            kwargs = {}
            if output is not None:
                kwargs['output'] = output
            if metadata is not None:
                kwargs['metadata'] = metadata

            self._span.end(**kwargs)
        except Exception as e:
            print(f"[Langfuse] 结束 Span 失败: {e}")

    def update(
        self,
        **kwargs
    ) -> None:
        """更新 Span（非阻塞）"""
        try:
            self._span.update(**kwargs)
        except Exception as e:
            print(f"[Langfuse] 更新 Span 失败: {e}")

    def event(
        self,
        name: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """记录事件（非阻塞）"""
        try:
            self._span.event(
                name=name,
                metadata=metadata or {},
            )
        except Exception as e:
            print(f"[Langfuse] 记录 Event 失败: {e}")


class GenerationProxy:
    """Generation 代理对象"""

    def __init__(self, generation: Any):
        self._generation = generation
        self.id = generation.id if hasattr(generation, 'id') else None

    def end(
        self,
        output: Optional[str] = None,
        usage_details: Optional[Dict[str, Any]] = None,
    ) -> None:
        """结束 Generation（非阻塞）"""
        try:
            kwargs = {}
            if output is not None:
                kwargs['output'] = output
            if usage_details is not None:
                kwargs['usage_details'] = usage_details

            self._generation.end(**kwargs)
        except Exception as e:
            print(f"[Langfuse] 结束 Generation 失败: {e}")

    def update(
        self,
        **kwargs
    ) -> None:
        """更新 Generation（非阻塞）"""
        try:
            self._generation.update(**kwargs)
        except Exception as e:
            print(f"[Langfuse] 更新 Generation 失败: {e}")


# 便捷函数
def get_langfuse_client() -> LangfuseClient:
    """获取 Langfuse 客户端单例"""
    return LangfuseClient()


def is_enabled() -> bool:
    """检查 Langfuse 是否已启用"""
    client = get_langfuse_client()
    return client.enabled if client else False
