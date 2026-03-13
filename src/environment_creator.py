"""
环境创建后台任务管理器

负责在后台异步创建Conda环境，避免阻塞API响应。
"""
import asyncio
from typing import Dict, Optional
from datetime import datetime

from .environment_manager import EnvironmentManager, EnvironmentError
from .models import AgentEnvironment, EnvironmentStatus


class EnvironmentCreator:
    """环境创建后台任务管理器"""

    def __init__(
        self,
        environment_manager: EnvironmentManager,
        max_concurrent: int = 3
    ):
        """
        初始化环境创建器

        Args:
            environment_manager: 环境管理器实例
            max_concurrent: 最大并发创建数量
        """
        self.environment_manager = environment_manager
        self.max_concurrent = max_concurrent
        self._tasks: Dict[str, asyncio.Task] = {}  # agent_name -> task
        self._semaphore = asyncio.Semaphore(max_concurrent)

    async def create(
        self,
        agent_name: str,
        python_version: str = "3.11"
    ) -> bool:
        """
        异步创建Conda环境

        此方法立即返回，在后台任务中执行实际创建工作。

        Args:
            agent_name: 智能体名称
            python_version: Python版本

        Returns:
            bool: 是否成功启动创建任务
        """
        # 检查是否已有进行中的任务
        if agent_name in self._tasks:
            existing_task = self._tasks[agent_name]
            if not existing_task.done():
                print(f"[ENV_CREATOR] 环境创建任务已在进行中: {agent_name}")
                return True

        # 创建后台任务
        task = asyncio.create_task(
            self._create_with_semaphore(agent_name, python_version)
        )
        self._tasks[agent_name] = task

        print(f"[ENV_CREATOR] 已启动环境创建任务: {agent_name}")
        return True

    async def _create_with_semaphore(
        self,
        agent_name: str,
        python_version: str
    ):
        """带并发控制的环境创建"""
        async with self._semaphore:
            try:
                await self._do_create(agent_name, python_version)
            finally:
                # 清理任务记录
                self._tasks.pop(agent_name, None)

    async def _do_create(
        self,
        agent_name: str,
        python_version: str
    ):
        """实际执行环境创建"""
        try:
            # 检查环境是否已存在且就绪
            existing = await self.environment_manager.get_environment_status(agent_name)
            if existing and existing.status == EnvironmentStatus.READY:
                print(f"[ENV_CREATOR] 环境已存在且就绪: {agent_name}")
                return

            # 如果环境处于错误状态，先清理
            if existing and existing.status == EnvironmentStatus.ERROR:
                print(f"[ENV_CREATOR] 清理失败的环境，重新创建: {agent_name}")
                try:
                    await self.environment_manager.delete_environment(agent_name)
                except Exception as e:
                    print(f"[ENV_CREATOR] 清理失败环境时出错: {e}")

            # 创建环境记录（状态为creating）
            environment = AgentEnvironment(
                agent_name=agent_name,
                python_version=python_version,
                status=EnvironmentStatus.CREATING
            )
            self.environment_manager._save_metadata(environment)

            # 执行环境创建
            print(f"[ENV_CREATOR] 开始创建环境: {agent_name}")
            start_time = datetime.now()

            await self.environment_manager.create_environment(
                agent_name=agent_name,
                python_version=python_version
            )

            elapsed = (datetime.now() - start_time).total_seconds()
            print(f"[ENV_CREATOR] 环境创建完成: {agent_name}, 耗时: {elapsed:.1f}秒")

        except Exception as e:
            print(f"[ENV_CREATOR] 环境创建失败: {agent_name}, 错误: {e}")
            # 标记环境状态为错误
            await self._mark_error(agent_name, str(e))

    async def _mark_error(self, agent_name: str, error_message: str):
        """标记环境创建失败"""
        try:
            existing = await self.environment_manager.get_environment_status(agent_name)
            if existing:
                existing.status = EnvironmentStatus.ERROR
                existing.error_message = error_message
                existing.updated_at = datetime.now().isoformat()
                self.environment_manager._save_metadata(existing)
        except Exception as e:
            print(f"[ENV_CREATOR] 标记错误状态失败: {e}")

    async def cancel(self, agent_name: str) -> bool:
        """
        取消进行中的环境创建任务

        Args:
            agent_name: 智能体名称

        Returns:
            bool: 是否成功取消
        """
        task = self._tasks.get(agent_name)
        if task and not task.done():
            task.cancel()
            print(f"[ENV_CREATOR] 已取消环境创建任务: {agent_name}")
            return True
        return False

    async def get_task_status(self, agent_name: str) -> Optional[str]:
        """
        获取任务状态

        Args:
            agent_name: 智能体名称

        Returns:
            "running" | "done" | "failed" | None
        """
        task = self._tasks.get(agent_name)
        if not task:
            return None

        if task.done():
            if task.exception():
                return "failed"
            return "done"

        return "running"

    def has_running_task(self, agent_name: str) -> bool:
        """
        检查是否有运行中的任务

        Args:
            agent_name: 智能体名称

        Returns:
            bool: 是否有运行中的任务
        """
        task = self._tasks.get(agent_name)
        return task is not None and not task.done()

    async def shutdown(self):
        """关闭所有进行中的任务"""
        for agent_name, task in list(self._tasks.items()):
            if not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
        self._tasks.clear()
        print("[ENV_CREATOR] 所有后台任务已关闭")

    def get_active_tasks(self) -> list[str]:
        """获取当前活跃的任务列表"""
        return [
            name for name, task in self._tasks.items()
            if not task.done()
        ]

    def get_concurrent_count(self) -> int:
        """获取当前并发创建数量"""
        return self.max_concurrent - self._semaphore._value
