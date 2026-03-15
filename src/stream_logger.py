"""
流式请求日志记录器 - AC130-202603150000

与前端 DebugLogger 配合，提供结构化的后端日志系统
"""
import threading
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any


class StreamLogger:
    """流式请求日志记录器

    为每个请求记录结构化日志，支持线程安全的并发访问
    """

    # 类级别的日志存储
    _log_store: Dict[str, 'StreamLogger'] = {}
    _log_lock = threading.Lock()
    _max_entries = 1000  # 最大日志条目数，防止内存泄漏
    _cleanup_interval = 300  # 清理间隔（秒）
    _retention_hours = 1  # 日志保留时间（小时）

    def __init__(self, request_id: str):
        """初始化日志记录器

        Args:
            request_id: 请求唯一标识符
        """
        self.request_id = request_id
        self.start_time = datetime.now()
        self.events: List[Dict[str, Any]] = []
        self._lock = threading.Lock()  # 实例级别的锁，保护 events 列表

    def log_event(self, category: str, data: Dict[str, Any]) -> None:
        """记录日志事件

        Args:
            category: 事件类别（如 request_start, llm_call, tool_call 等）
            data: 事件数据（字典格式）
        """
        with self._lock:
            self.events.append({
                "timestamp": datetime.now().isoformat(),
                "category": category,
                "data": data
            })

    def log_error(self, error_type: str, message: str, traceback: str = None) -> None:
        """记录错误事件

        Args:
            error_type: 错误类型（如 TimeoutError, ValueError 等）
            message: 错误消息
            traceback: 错误堆栈（可选）
        """
        error_data = {
            "type": error_type,
            "message": message
        }
        if traceback:
            error_data["traceback"] = traceback

        self.log_event("error", error_data)

    def log_llm_call(self, model: str, input_tokens: int = 0, output_tokens: int = 0) -> None:
        """记录 LLM 调用事件

        Args:
            model: 模型名称
            input_tokens: 输入 token 数
            output_tokens: 输出 token 数
        """
        self.log_event("llm_call", {
            "model": model,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens
        })

    def log_tool_call(self, tool_name: str, args: Dict[str, Any]) -> None:
        """记录工具调用事件

        Args:
            tool_name: 工具名称
            args: 工具参数
        """
        self.log_event("tool_call", {
            "name": tool_name,
            "args": args
        })

    def log_sse_event(self, event_type: str) -> None:
        """记录 SSE 事件

        Args:
            event_type: SSE 事件类型（thinking, content, tool_call 等）
        """
        self.log_event("sse_event", {"type": event_type})

    def get_logs(self) -> Dict[str, Any]:
        """获取完整日志

        Returns:
            包含 request_id 和 events 的字典
        """
        with self._lock:
            return {
                "request_id": self.request_id,
                "start_time": self.start_time.isoformat(),
                "end_time": datetime.now().isoformat(),
                "event_count": len(self.events),
                "events": list(self.events)  # 返回副本
            }

    @classmethod
    def get_logger(cls, request_id: Optional[str] = None) -> 'StreamLogger':
        """获取或创建日志记录器

        Args:
            request_id: 请求 ID，如果为 None 则自动生成

        Returns:
            StreamLogger 实例
        """
        if request_id is None:
            request_id = f"auto-{uuid.uuid4().hex[:8]}"

        with cls._log_lock:
            if request_id not in cls._log_store:
                cls._log_store[request_id] = StreamLogger(request_id)
                # 定期清理旧日志
                if len(cls._log_store) > cls._max_entries // 2:
                    cls._cleanup_old_logs()
            return cls._log_store[request_id]

    @classmethod
    def _cleanup_old_logs(cls) -> None:
        """清理超过保留时间的日志

        此方法应在持有 _log_lock 的情况下调用
        """
        cutoff = datetime.now() - timedelta(hours=cls._retention_hours)
        expired = []

        for request_id, logger in cls._log_store.items():
            if logger.start_time < cutoff:
                expired.append(request_id)

        for request_id in expired:
            del cls._log_store[request_id]

        if expired:
            print(f"[StreamLogger] 清理了 {len(expired)} 条过期日志")

    @classmethod
    def get_all_request_ids(cls) -> List[str]:
        """获取所有活跃的请求 ID

        Returns:
            请求 ID 列表
        """
        with cls._log_lock:
            return list(cls._log_store.keys())

    @classmethod
    def remove_logger(cls, request_id: str) -> bool:
        """手动移除指定请求的日志记录器

        Args:
            request_id: 请求 ID

        Returns:
            是否成功移除
        """
        with cls._log_lock:
            if request_id in cls._log_store:
                del cls._log_store[request_id]
                return True
            return False


# 便捷函数
def get_logger(request_id: Optional[str] = None) -> StreamLogger:
    """获取或创建日志记录器（便捷函数）

    Args:
        request_id: 请求 ID

    Returns:
        StreamLogger 实例
    """
    return StreamLogger.get_logger(request_id)


def cleanup_old_logs() -> None:
    """清理超过保留时间的日志（便捷函数）"""
    StreamLogger._cleanup_old_logs()
