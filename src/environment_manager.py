"""
环境管理模块 - 管理Agent的Conda虚拟环境
"""
import asyncio
import json
import os
import shutil
from pathlib import Path
from typing import Optional, List, Dict, Tuple
from datetime import datetime

from .models import (
    AgentEnvironment,
    EnvironmentType,
    EnvironmentStatus
)

# Conda可执行文件路径
CONDA_PATH = os.environ.get("CONDA_EXE", "/opt/miniconda3/bin/conda")


def get_conda_path() -> str:
    """获取conda可执行文件路径"""
    # 优先使用环境变量
    if os.environ.get("CONDA_EXE"):
        return os.environ["CONDA_EXE"]
    # 检查常见安装位置
    common_paths = [
        "/opt/miniconda3/bin/conda",
        "/opt/conda/bin/conda",
        os.path.expanduser("~/miniconda3/bin/conda"),
        os.path.expanduser("~/anaconda3/bin/conda"),
        "/usr/local/miniconda3/bin/conda",
    ]
    for path in common_paths:
        if os.path.isfile(path):
            return path
    # 回退到PATH中的conda
    return "conda"


class EnvironmentError(Exception):
    """环境相关错误"""
    pass


class EnvironmentManager:
    """环境管理器 - 管理Agent的Conda虚拟环境"""

    ENV_PREFIX = "env_"  # 环境名称前缀

    def __init__(self, data_dir: Path, environments_dir: Path):
        """
        初始化环境管理器

        Args:
            data_dir: 数据目录 (存储环境元数据)
            environments_dir: Conda环境存储目录
        """
        self.data_dir = Path(data_dir)
        self.environments_dir = Path(environments_dir)
        self.metadata_dir = self.data_dir / "environments"
        self._ensure_dirs()

    def _ensure_dirs(self):
        """确保目录存在"""
        self.metadata_dir.mkdir(parents=True, exist_ok=True)
        self.environments_dir.mkdir(parents=True, exist_ok=True)

    def get_env_path(self, agent_name: str) -> Path:
        """获取环境路径"""
        # 使用安全的目录名（替换特殊字符）
        safe_name = agent_name.replace("/", "_").replace("\\", "_")
        return self.environments_dir / f"{self.ENV_PREFIX}{safe_name}"

    def get_metadata_path(self, agent_name: str) -> Path:
        """获取元数据文件路径"""
        safe_name = agent_name.replace("/", "_").replace("\\", "_")
        return self.metadata_dir / f"{safe_name}.json"

    async def _run_conda_command(
        self,
        args: List[str],
        timeout: int = 300,
        env: Optional[Dict[str, str]] = None
    ) -> Tuple[int, str, str]:
        """
        执行Conda命令

        Args:
            args: 命令参数列表
            timeout: 超时时间(秒)
            env: 环境变量

        Returns:
            (exit_code, stdout, stderr)
        """
        conda_exe = get_conda_path()
        cmd = [conda_exe] + args

        # 准备环境变量，确保conda可用
        process_env = os.environ.copy()
        conda_bin_dir = str(Path(conda_exe).parent)
        if conda_bin_dir not in process_env.get("PATH", ""):
            process_env["PATH"] = f"{conda_bin_dir}:{process_env.get('PATH', '')}"

        if env:
            process_env.update(env)

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=process_env
        )

        try:
            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=timeout
            )
            return (
                process.returncode or 0,
                stdout.decode('utf-8', errors='replace'),
                stderr.decode('utf-8', errors='replace')
            )
        except asyncio.TimeoutError:
            process.kill()
            await process.wait()
            raise EnvironmentError(f"Conda命令超时: {' '.join(args)}")

    async def create_environment(
        self,
        agent_name: str,
        python_version: str = "3.11"
    ) -> AgentEnvironment:
        """
        为Agent创建Conda环境

        Args:
            agent_name: Agent名称
            python_version: Python版本

        Returns:
            AgentEnvironment: 环境信息
        """
        # 检查环境是否已存在
        existing = await self.get_environment_status(agent_name)
        if existing and existing.status == EnvironmentStatus.READY:
            return existing

        env_path = self.get_env_path(agent_name)
        metadata_path = self.get_metadata_path(agent_name)

        # 创建环境记录
        environment = AgentEnvironment(
            agent_name=agent_name,
            environment_type=EnvironmentType.CONDA,
            status=EnvironmentStatus.CREATING,
            python_version=python_version,
            packages=[]
        )

        # 保存初始状态
        self._save_metadata(environment)

        try:
            # 执行 conda create 命令
            args = [
                "create",
                "-p", str(env_path),
                f"python={python_version}",
                "-y"  # 自动确认
            ]

            exit_code, stdout, stderr = await self._run_conda_command(
                args,
                timeout=300  # 5分钟超时
            )

            if exit_code != 0:
                environment.status = EnvironmentStatus.ERROR
                environment.error_message = f"创建环境失败: {stderr}"
                self._save_metadata(environment)
                raise EnvironmentError(f"创建环境失败: {stderr}")

            # 更新状态为就绪
            environment.status = EnvironmentStatus.READY
            environment.updated_at = datetime.now().isoformat()
            self._save_metadata(environment)

            return environment

        except EnvironmentError:
            raise
        except Exception as e:
            environment.status = EnvironmentStatus.ERROR
            environment.error_message = str(e)
            self._save_metadata(environment)
            raise EnvironmentError(f"创建环境时发生错误: {e}")

    async def delete_environment(self, agent_name: str) -> bool:
        """
        删除Agent的Conda环境

        Args:
            agent_name: Agent名称

        Returns:
            bool: 是否删除成功
        """
        env_path = self.get_env_path(agent_name)
        metadata_path = self.get_metadata_path(agent_name)

        # 检查环境是否存在
        environment = await self.get_environment_status(agent_name)
        if not environment:
            return False

        try:
            # 执行 conda env remove 命令
            if env_path.exists():
                args = [
                    "env",
                    "remove",
                    "-p", str(env_path),
                    "-y"
                ]

                exit_code, stdout, stderr = await self._run_conda_command(
                    args,
                    timeout=60
                )

                if exit_code != 0:
                    print(f"警告: 删除Conda环境时出错: {stderr}")

                # 确保删除目录
                if env_path.exists():
                    shutil.rmtree(env_path, ignore_errors=True)

            # 删除元数据
            if metadata_path.exists():
                metadata_path.unlink()

            return True

        except Exception as e:
            raise EnvironmentError(f"删除环境时发生错误: {e}")

    async def get_environment_status(self, agent_name: str) -> Optional[AgentEnvironment]:
        """
        获取环境状态

        Args:
            agent_name: Agent名称

        Returns:
            AgentEnvironment 或 None
        """
        metadata_path = self.get_metadata_path(agent_name)

        if not metadata_path.exists():
            return None

        try:
            with open(metadata_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return AgentEnvironment(**data)
        except Exception as e:
            print(f"读取环境元数据失败: {e}")
            return None

    async def install_packages(
        self,
        agent_name: str,
        packages: List[str]
    ) -> Tuple[bool, str]:
        """
        安装Python包

        Args:
            agent_name: Agent名称
            packages: 包列表

        Returns:
            (success, message)
        """
        environment = await self.get_environment_status(agent_name)
        if not environment:
            return False, "环境不存在"

        if environment.status != EnvironmentStatus.READY:
            return False, f"环境状态异常: {environment.status}"

        env_path = self.get_env_path(agent_name)

        try:
            # 使用 pip 安装包
            args = [
                "run",
                "-p", str(env_path),
                "pip", "install"
            ] + packages

            exit_code, stdout, stderr = await self._run_conda_command(
                args,
                timeout=300  # 5分钟超时
            )

            if exit_code != 0:
                return False, f"安装失败: {stderr}"

            # 更新包列表
            environment.packages.extend(packages)
            environment.updated_at = datetime.now().isoformat()
            self._save_metadata(environment)

            return True, stdout

        except Exception as e:
            return False, f"安装时发生错误: {e}"

    async def list_packages(self, agent_name: str) -> List[Dict[str, str]]:
        """
        列出已安装的包

        Args:
            agent_name: Agent名称

        Returns:
            包列表 [{"name": "...", "version": "..."}]
        """
        environment = await self.get_environment_status(agent_name)
        if not environment or environment.status != EnvironmentStatus.READY:
            return []

        env_path = self.get_env_path(agent_name)

        try:
            # 使用 pip list 获取包列表
            args = [
                "run",
                "-p", str(env_path),
                "pip", "list",
                "--format=json"
            ]

            exit_code, stdout, stderr = await self._run_conda_command(
                args,
                timeout=30
            )

            if exit_code != 0:
                return []

            import json as json_module
            packages = json_module.loads(stdout)
            return [{"name": p["name"], "version": p["version"]} for p in packages]

        except Exception as e:
            print(f"获取包列表失败: {e}")
            return []

    async def execute_in_environment(
        self,
        agent_name: str,
        command: List[str],
        cwd: Optional[str] = None,
        timeout: int = 60,
        env_vars: Optional[Dict[str, str]] = None
    ) -> Tuple[int, str, str, int]:
        """
        在Conda环境中执行命令

        Args:
            agent_name: Agent名称
            command: 命令及参数列表
            cwd: 工作目录
            timeout: 超时时间(秒)
            env_vars: 额外环境变量

        Returns:
            (exit_code, stdout, stderr, duration_ms)
        """
        import time

        environment = await self.get_environment_status(agent_name)
        if not environment:
            raise EnvironmentError("环境不存在")

        if environment.status != EnvironmentStatus.READY:
            raise EnvironmentError(f"环境状态异常: {environment.status}")

        env_path = self.get_env_path(agent_name)

        # 构建 conda run 命令
        conda_exe = get_conda_path()
        args = [
            "run",
            "-p", str(env_path),
            "--no-capture-output"  # 直接输出，不缓冲
        ] + command

        # 准备环境变量
        process_env = os.environ.copy()
        conda_bin_dir = str(Path(conda_exe).parent)
        if conda_bin_dir not in process_env.get("PATH", ""):
            process_env["PATH"] = f"{conda_bin_dir}:{process_env.get('PATH', '')}"

        if env_vars:
            process_env.update(env_vars)

        start_time = time.time()

        process = await asyncio.create_subprocess_exec(
            conda_exe, *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=cwd,
            env=process_env
        )

        try:
            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=timeout
            )

            duration_ms = int((time.time() - start_time) * 1000)

            return (
                process.returncode or 0,
                stdout.decode('utf-8', errors='replace'),
                stderr.decode('utf-8', errors='replace'),
                duration_ms
            )

        except asyncio.TimeoutError:
            process.kill()
            await process.wait()
            duration_ms = int((time.time() - start_time) * 1000)
            raise EnvironmentError(f"命令执行超时 ({timeout}秒)")

    def _save_metadata(self, environment: AgentEnvironment):
        """保存环境元数据"""
        metadata_path = self.get_metadata_path(environment.agent_name)

        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(environment.model_dump(), f, ensure_ascii=False, indent=2)

    async def get_or_create_environment(
        self,
        agent_name: str,
        python_version: str = "3.11"
    ) -> AgentEnvironment:
        """
        获取或创建环境（幂等操作）

        Args:
            agent_name: Agent名称
            python_version: Python版本

        Returns:
            AgentEnvironment: 环境信息
        """
        existing = await self.get_environment_status(agent_name)

        if existing and existing.status == EnvironmentStatus.READY:
            return existing

        if existing and existing.status == EnvironmentStatus.CREATING:
            # 等待创建完成
            import asyncio
            for _ in range(30):  # 最多等待30秒
                await asyncio.sleep(1)
                existing = await self.get_environment_status(agent_name)
                if existing and existing.status == EnvironmentStatus.READY:
                    return existing
                if existing and existing.status == EnvironmentStatus.ERROR:
                    raise EnvironmentError(f"环境创建失败: {existing.error_message}")

            raise EnvironmentError("环境创建超时")

        # 创建新环境
        return await self.create_environment(agent_name, python_version)

    async def install_skill_dependencies(
        self,
        agent_name: str,
        skill_path: Path,
        skill_name: str
    ) -> Tuple[bool, str, List[str]]:
        """
        为 Skill 安装依赖

        检测 Skill 目录下的 scripts/requirements.txt 文件，
        如果存在且尚未安装，则自动安装依赖包。

        Args:
            agent_name: Agent名称
            skill_path: Skill 目录路径（Skill 的根目录）
            skill_name: Skill名称

        Returns:
            (success, message, installed_packages) - 成功标志、消息、已安装的包列表
        """
        requirements_path = Path(skill_path) / "scripts" / "requirements.txt"

        if not requirements_path.exists():
            return True, "No requirements.txt found", []

        # 读取依赖列表
        try:
            with open(requirements_path, 'r', encoding='utf-8') as f:
                packages = [
                    line.strip()
                    for line in f
                    if line.strip() and not line.startswith('#')
                ]
        except Exception as e:
            return False, f"Failed to read requirements.txt: {e}", []

        if not packages:
            return True, "No packages to install", []

        # 检查环境状态
        environment = await self.get_environment_status(agent_name)
        if not environment:
            return False, "Environment not found", []

        if environment.status != EnvironmentStatus.READY:
            return False, f"Environment not ready: {environment.status}", []

        # 检查是否已安装过此 Skill 的依赖
        if skill_name in environment.installed_dependencies:
            existing_packages = environment.installed_dependencies[skill_name]
            # 检查是否有新的依赖需要安装
            new_packages = [p for p in packages if p not in existing_packages]
            if not new_packages:
                return True, f"Dependencies for '{skill_name}' already installed", []

        print(f"[ENV] Installing dependencies for skill '{skill_name}': {packages}")

        # 安装依赖
        success, message = await self.install_packages(agent_name, packages)

        if success:
            # 更新已安装依赖记录
            if skill_name not in environment.installed_dependencies:
                environment.installed_dependencies[skill_name] = []

            # 合并已安装的包（避免重复）
            for pkg in packages:
                if pkg not in environment.installed_dependencies[skill_name]:
                    environment.installed_dependencies[skill_name].append(pkg)

            environment.updated_at = datetime.now().isoformat()
            self._save_metadata(environment)

            print(f"[ENV] Successfully installed dependencies for skill '{skill_name}'")
            return True, f"Installed {len(packages)} packages", packages
        else:
            print(f"[ENV] Failed to install dependencies for skill '{skill_name}': {message}")
            return False, message, []

    async def check_skill_dependencies_installed(
        self,
        agent_name: str,
        skill_name: str
    ) -> bool:
        """
        检查 Skill 的依赖是否已安装

        Args:
            agent_name: Agent名称
            skill_name: Skill名称

        Returns:
            bool: 是否已安装
        """
        environment = await self.get_environment_status(agent_name)
        if not environment:
            return False

        return skill_name in environment.installed_dependencies
