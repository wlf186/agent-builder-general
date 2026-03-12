"""
脚本执行引擎 - 在隔离环境中执行Skill脚本
"""
import asyncio
import json
import shutil
import tempfile
import time
from pathlib import Path
from typing import Optional, List, Dict
from datetime import datetime

from .models import ExecutionRecord, ExecutionStatus
from .environment_manager import EnvironmentManager, EnvironmentError
from .file_storage_manager import FileStorageManager


class ExecutionError(Exception):
    """执行相关错误"""
    pass


class ExecutionEngine:
    """脚本执行引擎"""

    DEFAULT_TIMEOUT = 60  # 默认超时60秒
    MAX_CONCURRENT_PER_AGENT = 3  # 每个Agent最多3个并发执行

    def __init__(
        self,
        environment_manager: EnvironmentManager,
        file_storage: FileStorageManager,
        data_dir: Path
    ):
        """
        初始化执行引擎

        Args:
            environment_manager: 环境管理器
            file_storage: 文件存储管理器
            data_dir: 数据目录
        """
        self.environment_manager = environment_manager
        self.file_storage = file_storage
        self.data_dir = Path(data_dir)
        self.executions_dir = self.data_dir / "executions"
        self._running_executions: Dict[str, asyncio.subprocess.Process] = {}
        self._semaphores: Dict[str, asyncio.Semaphore] = {}
        self._ensure_dirs()

    def _ensure_dirs(self):
        """确保目录存在"""
        self.executions_dir.mkdir(parents=True, exist_ok=True)

    def get_executions_dir(self, agent_name: str) -> Path:
        """获取Agent执行记录目录"""
        safe_name = agent_name.replace("/", "_").replace("\\", "_")
        return self.executions_dir / safe_name

    def get_execution_path(self, agent_name: str, execution_id: str) -> Path:
        """获取执行记录文件路径"""
        return self.get_executions_dir(agent_name) / f"{execution_id}.json"

    def _get_semaphore(self, agent_name: str) -> asyncio.Semaphore:
        """获取Agent的并发控制信号量"""
        if agent_name not in self._semaphores:
            self._semaphores[agent_name] = asyncio.Semaphore(
                self.MAX_CONCURRENT_PER_AGENT
            )
        return self._semaphores[agent_name]

    async def execute_script(
        self,
        agent_name: str,
        skill_name: str,
        script_path: str,
        args: List[str] = None,
        input_file_ids: List[str] = None,
        timeout: int = None,
        skill_base_path: str = None
    ) -> ExecutionRecord:
        """
        执行Skill脚本

        Args:
            agent_name: Agent名称
            skill_name: Skill名称
            script_path: 脚本路径（相对于skill目录）
            args: 命令行参数
            input_file_ids: 输入文件ID列表
            timeout: 超时时间(秒)
            skill_base_path: Skill基础路径

        Returns:
            ExecutionRecord: 执行记录
        """
        if args is None:
            args = []
        if input_file_ids is None:
            input_file_ids = []
        if timeout is None:
            timeout = self.DEFAULT_TIMEOUT

        # 创建执行记录
        import uuid
        execution_id = str(uuid.uuid4())[:8]

        record = ExecutionRecord(
            execution_id=execution_id,
            agent_name=agent_name,
            skill_name=skill_name,
            script_path=script_path,
            arguments=args,
            input_file_ids=input_file_ids,
            status=ExecutionStatus.PENDING
        )

        # 保存初始记录
        self._save_record(record)

        # 获取并发控制
        semaphore = self._get_semaphore(agent_name)

        async with semaphore:
            try:
                # 更新状态为运行中
                record.status = ExecutionStatus.RUNNING
                record.started_at = datetime.now().isoformat()
                self._save_record(record)

                # 获取或创建环境
                env = await self.environment_manager.get_or_create_environment(agent_name)

                # 安装 Skill 依赖（如果有 requirements.txt）
                if skill_base_path:
                    skill_path = Path(skill_base_path).parent  # skill_base_path 是 scripts 目录，需要获取父目录
                    success, message, packages = await self.environment_manager.install_skill_dependencies(
                        agent_name=agent_name,
                        skill_path=skill_path,
                        skill_name=skill_name
                    )
                    if not success:
                        print(f"[EXEC] 警告: 依赖安装失败 - {message}")
                    elif packages:
                        print(f"[EXEC] 已安装依赖: {packages}")

                # 准备工作目录（包含复制技能文件）
                work_dir = await self._prepare_work_dir_with_skill(
                    agent_name=agent_name,
                    execution_id=execution_id,
                    input_file_ids=input_file_ids,
                    skill_base_path=skill_base_path
                )

                # 复制输入文件到工作目录
                if input_file_ids:
                    await self._copy_input_files(agent_name, input_file_ids, work_dir)

                # 执行脚本
                exit_code, stdout, stderr, duration_ms = await self._execute_in_environment(
                    agent_name=agent_name,
                    script_path=script_path,
                    args=args,
                    work_dir=work_dir,
                    timeout=timeout
                )

                # 更新执行记录
                record.exit_code = exit_code
                record.stdout = stdout
                record.stderr = stderr
                record.duration_ms = duration_ms
                record.finished_at = datetime.now().isoformat()

                if exit_code == 0:
                    record.status = ExecutionStatus.SUCCESS
                else:
                    record.status = ExecutionStatus.FAILED

                self._save_record(record)

                # 清理工作目录
                self._cleanup_work_dir(work_dir)

                return record

            except asyncio.TimeoutError:
                record.status = ExecutionStatus.TIMEOUT
                record.stderr = f"执行超时 ({timeout}秒)"
                record.finished_at = datetime.now().isoformat()
                self._save_record(record)
                return record

            except EnvironmentError as e:
                record.status = ExecutionStatus.FAILED
                record.stderr = str(e)
                record.finished_at = datetime.now().isoformat()
                self._save_record(record)
                return record

            except Exception as e:
                record.status = ExecutionStatus.FAILED
                record.stderr = f"执行错误: {str(e)}"
                record.finished_at = datetime.now().isoformat()
                self._save_record(record)
                return record

    async def _execute_in_environment(
        self,
        agent_name: str,
        script_path: str,
        args: List[str],
        work_dir: Path,
        timeout: int
    ) -> tuple:
        """
        在Conda环境中执行脚本

        Returns:
            (exit_code, stdout, stderr, duration_ms)
        """
        # 构建命令
        command = ["python", script_path] + args

        try:
            return await self.environment_manager.execute_in_environment(
                agent_name=agent_name,
                command=command,
                cwd=str(work_dir),
                timeout=timeout
            )
        except EnvironmentError as e:
            if "超时" in str(e):
                raise asyncio.TimeoutError(str(e))
            raise

    def _prepare_work_dir(
        self,
        agent_name: str,
        execution_id: str,
        input_file_ids: List[str]
    ) -> Path:
        """
        准备工作目录（修复版）

        Args:
            agent_name: Agent名称
            execution_id: 执行ID
            input_file_ids: 输入文件ID列表

        Returns:
            工作目录路径
        """
        # 创建临时工作目录
        work_dir = Path(tempfile.mkdtemp(prefix=f"exec_{execution_id}_"))

        # 创建输入文件目录
        input_dir = work_dir / "input"
        input_dir.mkdir(exist_ok=True)

        return work_dir

    async def _prepare_work_dir_with_skill(
        self,
        agent_name: str,
        execution_id: str,
        input_file_ids: List[str],
        skill_base_path: str = None
    ) -> Path:
        """
        准备工作目录并复制技能文件

        Args:
            agent_name: Agent名称
            execution_id: 执行ID
            input_file_ids: 输入文件ID列表
            skill_base_path: Skill基础路径

        Returns:
            工作目录路径
        """
        # 创建临时工作目录
        work_dir = Path(tempfile.mkdtemp(prefix=f"exec_{execution_id}_"))

        # 创建输入文件目录
        input_dir = work_dir / "input"
        input_dir.mkdir(exist_ok=True)

        # 复制技能文件到工作目录
        if skill_base_path:
            skill_path = Path(skill_base_path)
            if skill_path.exists() and skill_path.is_dir():
                # 复制整个技能目录
                for item in skill_path.iterdir():
                    if item.is_file():
                        shutil.copy2(item, work_dir / item.name)
                    elif item.is_dir():
                        shutil.copytree(item, work_dir / item.name)
                print(f"[EXEC] 已复制技能文件到工作目录: {skill_path}")
            else:
                print(f"[EXEC] 警告: 技能路径不存在: {skill_base_path}")

        return work_dir

    async def _copy_input_files(
        self,
        agent_name: str,
        input_file_ids: List[str],
        work_dir: Path
    ):
        """复制输入文件到工作目录（修复版）

        Args:
            agent_name: Agent名称
            input_file_ids: 输入文件ID列表
            work_dir: 工作目录路径
        """
        if not input_file_ids:
            return

        input_dir = work_dir / "input"
        input_dir.mkdir(exist_ok=True)

        for file_id in input_file_ids:
            try:
                target_path = await self.file_storage.copy_file_to_workdir(
                    agent_name=agent_name,
                    file_id=file_id,
                    workdir=input_dir
                )
                if target_path:
                    print(f"[EXEC] 已复制输入文件: {target_path}")
                else:
                    print(f"[EXEC] 警告: 无法复制文件 {file_id}")
            except Exception as e:
                print(f"[EXEC] 复制文件 {file_id} 失败: {e}")

    def _cleanup_work_dir(self, work_dir: Path):
        """清理工作目录"""
        try:
            if work_dir.exists():
                shutil.rmtree(work_dir, ignore_errors=True)
        except Exception as e:
            print(f"清理工作目录失败: {e}")

    async def get_execution_status(self, agent_name: str, execution_id: str) -> Optional[ExecutionRecord]:
        """
        获取执行状态

        Args:
            agent_name: Agent名称
            execution_id: 执行ID

        Returns:
            ExecutionRecord或None
        """
        execution_path = self.get_execution_path(agent_name, execution_id)

        if not execution_path.exists():
            return None

        try:
            with open(execution_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return ExecutionRecord(**data)
        except Exception as e:
            print(f"读取执行记录失败: {e}")
            return None

    async def list_executions(self, agent_name: str, limit: int = 50) -> List[ExecutionRecord]:
        """
        列出执行记录

        Args:
            agent_name: Agent名称
            limit: 最大数量

        Returns:
            执行记录列表
        """
        executions_dir = self.get_executions_dir(agent_name)

        if not executions_dir.exists():
            return []

        records = []
        for json_file in executions_dir.glob("*.json"):
            try:
                with open(json_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                records.append(ExecutionRecord(**data))
            except:
                continue

        # 按创建时间倒序排序
        records.sort(key=lambda r: r.created_at, reverse=True)

        return records[:limit]

    async def cancel_execution(self, agent_name: str, execution_id: str) -> bool:
        """
        取消执行

        Args:
            agent_name: Agent名称
            execution_id: 执行ID

        Returns:
            是否取消成功
        """
        # 检查是否在运行中
        if execution_id in self._running_executions:
            process = self._running_executions[execution_id]
            try:
                process.kill()
                await process.wait()
            except:
                pass

        # 更新状态
        record = await self.get_execution_status(agent_name, execution_id)
        if record and record.status == ExecutionStatus.RUNNING:
            record.status = ExecutionStatus.CANCELLED
            record.finished_at = datetime.now().isoformat()
            self._save_record(record)
            return True

        return False

    def _save_record(self, record: ExecutionRecord):
        """保存执行记录"""
        executions_dir = self.get_executions_dir(record.agent_name)
        executions_dir.mkdir(parents=True, exist_ok=True)

        execution_path = self.get_execution_path(record.agent_name, record.execution_id)

        with open(execution_path, 'w', encoding='utf-8') as f:
            json.dump(record.model_dump(), f, ensure_ascii=False, indent=2)

    async def cleanup_old_executions(self, agent_name: str, days: int = 7) -> int:
        """
        清理旧的执行记录

        Args:
            agent_name: Agent名称
            days: 保留天数

        Returns:
            清理的记录数
        """
        executions_dir = self.get_executions_dir(agent_name)

        if not executions_dir.exists():
            return 0

        import time
        cutoff_time = time.time() - (days * 24 * 60 * 60)
        cleaned = 0

        for json_file in executions_dir.glob("*.json"):
            try:
                # 检查文件修改时间
                if json_file.stat().st_mtime < cutoff_time:
                    json_file.unlink()
                    cleaned += 1
            except:
                continue

        return cleaned
