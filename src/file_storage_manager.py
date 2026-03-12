"""
文件存储模块 - 管理Agent的文件上传和存储
"""
import json
import hashlib
import shutil
from pathlib import Path
from typing import Optional, List, Tuple
from datetime import datetime

from .models import FileInfo


class FileStorageError(Exception):
    """文件存储相关错误"""
    pass


class FileStorageManager:
    """Agent文件存储管理器"""

    MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB

    def __init__(self, storage_dir: Path):
        """
        初始化文件存储管理器

        Args:
            storage_dir: 文件存储根目录
        """
        self.storage_dir = Path(storage_dir)
        self.metadata_dir = self.storage_dir / ".metadata"
        self._ensure_dirs()

    def _ensure_dirs(self):
        """确保目录存在"""
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self.metadata_dir.mkdir(parents=True, exist_ok=True)

    def get_agent_storage_path(self, agent_name: str) -> Path:
        """获取Agent存储目录"""
        safe_name = agent_name.replace("/", "_").replace("\\", "_")
        return self.storage_dir / safe_name

    def get_metadata_path(self, agent_name: str) -> Path:
        """获取元数据文件路径"""
        safe_name = agent_name.replace("/", "_").replace("\\", "_")
        return self.metadata_dir / f"{safe_name}.json"

    def _calculate_checksum(self, content: bytes) -> str:
        """计算文件MD5校验和"""
        return hashlib.md5(content).hexdigest()

    def _detect_mime_type(self, filename: str) -> str:
        """检测文件MIME类型"""
        ext = Path(filename).suffix.lower()
        mime_types = {
            '.pdf': 'application/pdf',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.xls': 'application/vnd.ms-excel',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.csv': 'text/csv',
            '.txt': 'text/plain',
            '.json': 'application/json',
            '.xml': 'application/xml',
            '.html': 'text/html',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.zip': 'application/zip',
            '.py': 'text/x-python',
            '.js': 'text/javascript',
            '.md': 'text/markdown',
        }
        return mime_types.get(ext, 'application/octet-stream')

    async def upload_file(
        self,
        agent_name: str,
        file_content: bytes,
        filename: str,
        mime_type: Optional[str] = None
    ) -> FileInfo:
        """
        上传文件

        Args:
            agent_name: Agent名称
            file_content: 文件内容
            filename: 原始文件名
            mime_type: MIME类型（可选，自动检测）

        Returns:
            FileInfo: 文件信息
        """
        # 检查文件大小
        if len(file_content) > self.MAX_FILE_SIZE:
            raise FileStorageError(f"文件过大，最大支持 {self.MAX_FILE_SIZE // (1024*1024)}MB")

        # 生成文件ID
        import uuid
        file_id = str(uuid.uuid4())[:8]

        # 计算校验和
        checksum = self._calculate_checksum(file_content)

        # 检测MIME类型
        if not mime_type:
            mime_type = self._detect_mime_type(filename)

        # 创建Agent存储目录
        agent_dir = self.get_agent_storage_path(agent_name)
        agent_dir.mkdir(parents=True, exist_ok=True)

        # 保存文件（使用file_id作为文件名，保留原始扩展名）
        ext = Path(filename).suffix
        stored_filename = f"{file_id}{ext}" if ext else file_id
        file_path = agent_dir / stored_filename

        with open(file_path, 'wb') as f:
            f.write(file_content)

        # 创建文件信息
        file_info = FileInfo(
            file_id=file_id,
            agent_name=agent_name,
            filename=filename,
            file_size=len(file_content),
            mime_type=mime_type,
            checksum=checksum,
            file_path=str(file_path.relative_to(self.storage_dir))
        )

        # 更新元数据索引
        self._add_file_to_index(agent_name, file_info)

        return file_info

    async def list_files(self, agent_name: str) -> List[FileInfo]:
        """
        列出Agent的所有文件

        Args:
            agent_name: Agent名称

        Returns:
            文件信息列表
        """
        metadata_path = self.get_metadata_path(agent_name)

        if not metadata_path.exists():
            return []

        try:
            with open(metadata_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return [FileInfo(**item) for item in data.get("files", [])]
        except Exception as e:
            print(f"读取文件索引失败: {e}")
            return []

    async def get_file_path(self, agent_name: str, file_id: str) -> Optional[Path]:
        """
        获取文件物理路径

        Args:
            agent_name: Agent名称
            file_id: 文件ID

        Returns:
            文件路径或None
        """
        file_info = await self.get_file_info(agent_name, file_id)
        if not file_info:
            return None

        file_path = self.storage_dir / file_info.file_path
        if file_path.exists():
            return file_path
        return None

    async def get_file_info(self, agent_name: str, file_id: str) -> Optional[FileInfo]:
        """
        获取文件信息

        Args:
            agent_name: Agent名称
            file_id: 文件ID

        Returns:
            FileInfo或None
        """
        files = await self.list_files(agent_name)
        for file_info in files:
            if file_info.file_id == file_id:
                return file_info
        return None

    async def delete_file(self, agent_name: str, file_id: str) -> bool:
        """
        删除文件

        Args:
            agent_name: Agent名称
            file_id: 文件ID

        Returns:
            是否删除成功
        """
        file_info = await self.get_file_info(agent_name, file_id)
        if not file_info:
            return False

        # 删除物理文件
        file_path = self.storage_dir / file_info.file_path
        if file_path.exists():
            file_path.unlink()

        # 从索引中移除
        self._remove_file_from_index(agent_name, file_id)

        return True

    async def get_file_content(self, agent_name: str, file_id: str) -> Optional[bytes]:
        """
        获取文件内容

        Args:
            agent_name: Agent名称
            file_id: 文件ID

        Returns:
            文件内容或None
        """
        file_path = await self.get_file_path(agent_name, file_id)
        if not file_path:
            return None

        with open(file_path, 'rb') as f:
            return f.read()

    def _add_file_to_index(self, agent_name: str, file_info: FileInfo):
        """添加文件到索引"""
        metadata_path = self.get_metadata_path(agent_name)

        # 读取现有索引
        data = {"files": []}
        if metadata_path.exists():
            try:
                with open(metadata_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
            except:
                data = {"files": []}

        # 添加新文件
        data["files"].append(file_info.model_dump())
        data["updated_at"] = datetime.now().isoformat()

        # 保存索引
        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _remove_file_from_index(self, agent_name: str, file_id: str):
        """从索引中移除文件"""
        metadata_path = self.get_metadata_path(agent_name)

        if not metadata_path.exists():
            return

        try:
            with open(metadata_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            # 过滤掉要删除的文件
            data["files"] = [
                f for f in data.get("files", [])
                if f.get("file_id") != file_id
            ]
            data["updated_at"] = datetime.now().isoformat()

            with open(metadata_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

        except Exception as e:
            print(f"更新文件索引失败: {e}")

    async def cleanup_agent_files(self, agent_name: str) -> bool:
        """
        清理Agent的所有文件

        Args:
            agent_name: Agent名称

        Returns:
            是否成功
        """
        agent_dir = self.get_agent_storage_path(agent_name)
        metadata_path = self.get_metadata_path(agent_name)

        try:
            # 删除文件目录
            if agent_dir.exists():
                shutil.rmtree(agent_dir)

            # 删除元数据
            if metadata_path.exists():
                metadata_path.unlink()

            return True
        except Exception as e:
            print(f"清理文件失败: {e}")
            return False

    async def copy_file_to_workdir(
        self,
        agent_name: str,
        file_id: str,
        workdir: Path,
        new_name: Optional[str] = None
    ) -> Optional[Path]:
        """
        复制文件到工作目录

        Args:
            agent_name: Agent名称
            file_id: 文件ID
            workdir: 目标工作目录
            new_name: 新文件名（可选）

        Returns:
            目标文件路径或None
        """
        file_info = await self.get_file_info(agent_name, file_id)
        if not file_info:
            return None

        src_path = self.storage_dir / file_info.file_path
        if not src_path.exists():
            return None

        # 确保工作目录存在
        workdir.mkdir(parents=True, exist_ok=True)

        # 确定目标文件名
        target_name = new_name or file_info.filename
        target_path = workdir / target_name

        # 复制文件
        shutil.copy2(src_path, target_path)

        return target_path
