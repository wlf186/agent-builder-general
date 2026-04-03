"""
Langfuse 追踪器 - 非阻塞式全链路观测 (Langfuse SDK v4)

职责：
1. 创建 Trace/Span 用于对话追踪
2. 捕获 LLM 调用、工具调用、子 Agent 调用
3. 存储对象引用以支持更新和结束操作
4. 支持错误标记和性能指标

设计原则：
- Immediate creation: 立即创建对象并存储引用
- Deferred flush: 定期刷新到服务器
- Graceful degradation: Langfuse 不可用时静默失败

文件版本: 4.0
创建日期: 2026-03-17
"""

import os
import asyncio
import time
import threading
from datetime import datetime
from typing import Any, Optional, Dict, List
from contextlib import asynccontextmanager

try:
    from langfuse import Langfuse
    LANGFUSE_AVAILABLE = True
except ImportError:
    LANGFUSE_AVAILABLE = False
    Langfuse = None  # type: ignore


class LangfuseTracer:
    """
    Langfuse 追踪器 - 存储对象引用以支持更新操作
    """

    _SPAN_TYPE_MAP = {
        "DEFAULT": "span",
        "LLM": "generation",
        "TOOL": "tool",
        "AGENT": "agent",
        "CHAIN": "chain",
    }

    _instance: Optional['LangfuseTracer'] = None
    _lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(
        self,
        public_key: Optional[str] = None,
        secret_key: Optional[str] = None,
        host: Optional[str] = None,
        enabled: Optional[bool] = None,
        flush_interval: float = 5.0
    ):
        if hasattr(self, '_initialized'):
            return

        self.public_key = public_key or os.environ.get("LANGFUSE_PUBLIC_KEY", "pk-lf-xxxxx")
        self.secret_key = secret_key or os.environ.get("LANGFUSE_SECRET_KEY", "sk-lf-xxxxx")
        self.host = host or os.environ.get("LANGFUSE_HOST", "http://localhost:3000")

        if enabled is None:
            enabled = os.environ.get("LANGFUSE_ENABLED", "true").lower() == "true"
        self.enabled = enabled and LANGFUSE_AVAILABLE

        self._flush_interval = flush_interval
        self._flush_task: Optional[asyncio.Task] = None
        self._flush_started = False
        self._stop_event = asyncio.Event()
        self._client: Optional[Langfuse] = None

        # 存储对象引用以支持更新操作
        self._traces: Dict[str, Any] = {}  # trace_id -> observation object
        self._spans: Dict[str, Any] = {}   # span_id -> observation object
        self._hex_trace_ids: Dict[str, str] = {}  # trace_id -> hex_trace_id cache
        self._objects_lock = threading.Lock()

        self._initialized = True

        if self.enabled:
            print(f"[Langfuse] 追踪器已初始化 (host: {self.host})")

    def _get_client(self) -> Optional[Langfuse]:
        """获取或创建 Langfuse 客户端"""
        if not self.enabled:
            return None

        if self._client is None:
            try:
                self._client = Langfuse(
                    public_key=self.public_key,
                    secret_key=self.secret_key,
                    host=self.host,
                )
                print(f"[Langfuse] 客户端初始化成功: {self.host}")
            except Exception as e:
                print(f"[Langfuse] 客户端初始化失败: {e}")
                self.enabled = False
                return None

        return self._client

    def _ensure_flush_task_started(self):
        """确保后台刷新任务已启动"""
        if self._flush_started:
            return
        try:
            loop = asyncio.get_running_loop()
            if self._flush_task is None or self._flush_task.done():
                self._flush_task = asyncio.create_task(self._flush_loop())
                print(f"[Langfuse] 后台刷新任务已启动 (间隔: {self._flush_interval}s)")
            self._flush_started = True
        except RuntimeError:
            pass

    async def _flush_loop(self):
        """后台刷新循环"""
        while not self._stop_event.is_set():
            try:
                await asyncio.sleep(self._flush_interval)
                self._sync_flush()
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"[Langfuse] 刷新任务异常: {e}")

    def _sync_flush(self):
        """同步刷新到 Langfuse 服务器"""
        client = self._get_client()
        if client is None:
            return

        try:
            client.flush()
        except Exception as e:
            print(f"[Langfuse] 刷新失败: {e}")

    # ========================================================================
    # Trace 操作
    # ========================================================================

    def create_trace(
        self,
        trace_id: str,
        name: str,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        metadata: Optional[Dict] = None,
        tags: Optional[List[str]] = None,
        input: Optional[Dict] = None
    ) -> Optional[Dict]:
        """
        创建 Trace 并存储引用

        Returns:
            Dict with trace info (for compatibility)
        """
        if not self.enabled:
            return None

        client = self._get_client()
        if client is None:
            return None

        try:
            root_obs = client.start_observation(
                name=name,
                as_type="chain",
                input=input or {},
                metadata={
                    **(metadata or {}),
                    "user_id": user_id,
                    "session_id": session_id,
                    "tags": tags or [],
                },
            )

            # Get the trace_id assigned by Langfuse server from the root observation
            hex_trace_id = root_obs.trace_id

            # 存储引用和 hex_trace_id 缓存
            with self._objects_lock:
                self._traces[trace_id] = root_obs
                self._hex_trace_ids[trace_id] = hex_trace_id

            self._ensure_flush_task_started()

            return {
                'id': trace_id,
                'observation_id': root_obs.id,
                'name': name,
                'user_id': user_id,
                'session_id': session_id,
            }
        except Exception as e:
            print(f"[Langfuse] 创建 trace 失败: {e}")
            return None

    def end_trace(
        self,
        trace_id: str,
        output: Optional[Dict] = None,
        status: Optional[str] = "success",
        error: Optional[Dict] = None
    ):
        """结束 Trace"""
        if not self.enabled:
            return

        with self._objects_lock:
            trace = self._traces.get(trace_id)

        if trace is None:
            return

        try:
            update_kwargs = {}
            if output:
                update_kwargs['output'] = output
            if error:
                update_kwargs['metadata'] = {'error': error, 'status': status}
            if status == "error":
                update_kwargs['level'] = 'ERROR'
                update_kwargs['status_message'] = str(error) if error else 'error'

            if update_kwargs:
                trace.update(**update_kwargs)

            trace.end()

            with self._objects_lock:
                self._traces.pop(trace_id, None)
                self._hex_trace_ids.pop(trace_id, None)

        except Exception as e:
            print(f"[Langfuse] 结束 trace 失败: {e}")

    # ========================================================================
    # Span 操作
    # ========================================================================

    def create_span(
        self,
        trace_id: str,
        span_name: str,
        parent_observation_id: Optional[str] = None,
        metadata: Optional[Dict] = None,
        tags: Optional[List[str]] = None,
        input: Optional[Dict] = None,
        span_type: Optional[str] = "DEFAULT"
    ) -> Optional[tuple]:
        """
        创建 Span 并存储引用

        Returns:
            (span_id, observation_id) tuple, or None on failure
        """
        if not self.enabled:
            return None

        client = self._get_client()
        if client is None:
            return None

        try:
            span_id = f"{trace_id}-{span_name}-{int(time.time() * 1000)}"

            # 使用缓存的 hex_trace_id，避免重复计算
            with self._objects_lock:
                hex_trace_id = self._hex_trace_ids.get(trace_id)
            if hex_trace_id is None:
                # Don't use create_trace_id() to avoid ghost traces
                # If no hex_trace_id in cache, create_trace was likely not called — skip this span
                return None

            trace_context = {"trace_id": hex_trace_id}
            if parent_observation_id:
                trace_context["parent_span_id"] = parent_observation_id

            as_type = self._SPAN_TYPE_MAP.get(span_type, "span")

            obs_kwargs = {
                "trace_context": trace_context,
                "name": span_name,
                "as_type": as_type,
                "input": input or {},
                "metadata": metadata or {},
            }

            span = client.start_observation(**obs_kwargs)
            real_obs_id = span.id

            # 存储引用
            with self._objects_lock:
                self._spans[span_id] = span

            self._ensure_flush_task_started()

            return (span_id, real_obs_id)
        except Exception as e:
            print(f"[Langfuse] 创建 span 失败: {e}")
            return None

    def end_span(
        self,
        trace_id: str,
        span_id: str,
        output: Optional[Dict] = None,
        status: Optional[str] = "success",
        error: Optional[Dict] = None,
        usage: Optional[Dict[str, int]] = None,
        level: Optional[str] = None,
    ):
        """结束 Span"""
        if not self.enabled:
            return

        with self._objects_lock:
            span = self._spans.get(span_id)

        if span is None:
            return

        try:
            update_kwargs = {}
            if output:
                update_kwargs['output'] = output
            if usage:
                update_kwargs['usage_details'] = usage
            if level:
                update_kwargs['level'] = level
            if status == "error":
                update_kwargs['level'] = 'ERROR'
                if error:
                    update_kwargs['status_message'] = str(error)

            if update_kwargs:
                span.update(**update_kwargs)

            span.end()

            with self._objects_lock:
                self._spans.pop(span_id, None)

        except Exception as e:
            print(f"[Langfuse] 结束 span 失败: {e}")

    # ========================================================================
    # LLM 调用追踪 (保留上下文管理器接口)
    # ========================================================================

    @asynccontextmanager
    async def trace_llm_call(
        self,
        trace_id: str,
        model: str,
        provider: str,
        prompt: str,
        parent_observation_id: Optional[str] = None,
        metadata: Optional[Dict] = None
    ):
        """追踪 LLM 调用的上下文管理器"""
        result = self.create_span(
            trace_id=trace_id,
            span_name=f"llm.{provider}.{model}",
            parent_observation_id=parent_observation_id,
            span_type="LLM",
            input={"model": model, "provider": provider, "prompt_preview": prompt[:200]},
            metadata=metadata or {}
        )
        span_id = result[0] if isinstance(result, tuple) else None

        start_time = time.time()

        class LLMSpanContext:
            def __init__(self, tracer, trace_id, span_id, start_time):
                self.tracer = tracer
                self.trace_id = trace_id
                self.span_id = span_id
                self.start_time = start_time
                self.usage = None
                self.output = None

            def update(self, output: Dict = None, usage: Dict = None):
                self.usage = usage
                self.output = output

            async def __aenter__(self):
                return self

            async def __aexit__(self, exc_type, exc_val, exc_tb):
                self.tracer.end_span(
                    trace_id=self.trace_id,
                    span_id=self.span_id,
                    output=getattr(self, 'output', {}),
                    status="success" if exc_type is None else "error",
                )

        context = LLMSpanContext(self, trace_id, span_id, start_time)
        yield context

    # ========================================================================
    # 工具调用追踪 (保留上下文管理器接口)
    # ========================================================================

    @asynccontextmanager
    async def trace_tool_call(
        self,
        trace_id: str,
        tool_name: str,
        tool_args: Dict,
        tool_type: str = "mcp",
        parent_observation_id: Optional[str] = None,
        metadata: Optional[Dict] = None
    ):
        """追踪工具调用的上下文管理器"""
        result = self.create_span(
            trace_id=trace_id,
            span_name=f"tool.{tool_type}.{tool_name}",
            parent_observation_id=parent_observation_id,
            span_type="TOOL",
            input={"tool": tool_name, "args": tool_args},
            metadata=metadata or {}
        )
        span_id = result[0] if isinstance(result, tuple) else None

        start_time = time.time()

        class ToolSpanContext:
            def __init__(self, tracer, trace_id, span_id, start_time):
                self.tracer = tracer
                self.trace_id = trace_id
                self.span_id = span_id
                self.start_time = start_time
                self.result = None
                self.error = None

            def update(self, result: Any = None, error: str = None):
                self.result = result
                self.error = error

            async def __aenter__(self):
                return self

            async def __aexit__(self, exc_type, exc_val, exc_tb):
                self.tracer.end_span(
                    trace_id=self.trace_id,
                    span_id=self.span_id,
                    output={"result": getattr(self, 'result', None)},
                    status="success" if exc_type is None else "error",
                )

        context = ToolSpanContext(self, trace_id, span_id, start_time)
        yield context

    async def shutdown(self):
        """关闭追踪器，刷新所有数据"""
        self._stop_event.set()
        if self._flush_task and not self._flush_task.done():
            self._flush_task.cancel()
            try:
                await self._flush_task
            except asyncio.CancelledError:
                pass

        self._sync_flush()

        if self._client:
            try:
                self._client.shutdown()
            except Exception as e:
                print(f"[Langfuse] 关闭时刷新失败: {e}")


_tracer_instance: Optional[LangfuseTracer] = None


def get_langfuse_tracer() -> LangfuseTracer:
    """获取 Langfuse 追踪器单例"""
    global _tracer_instance
    if _tracer_instance is None:
        _tracer_instance = LangfuseTracer()
    return _tracer_instance


def is_langfuse_enabled() -> bool:
    """检查 Langfuse 是否启用"""
    tracer = get_langfuse_tracer()
    return tracer.enabled if tracer else False
