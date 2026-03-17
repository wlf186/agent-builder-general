"""
知识库管理器
负责知识库 CRUD、文档管理、向量集合管理
"""
import json
import logging
import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any

from src.models import (
    KnowledgeBase,
    Document,
    DocumentStatus,
    Chunk
)
from src.document_processor import DocumentProcessor
from src.embedder import Embedder

logger = logging.getLogger(__name__)


class KnowledgeBaseManager:
    """知识库管理器

    负责：
    - 知识库的 CRUD 操作
    - 知识库元数据持久化
    - 向量集合管理
    - 文档上传与处理
    """

    def __init__(self, data_dir: Path):
        """初始化知识库管理器

        Args:
            data_dir: 数据目录根路径
        """
        self.data_dir = data_dir
        self.kb_dir = data_dir / "knowledge_bases"
        self.kb_dir.mkdir(parents=True, exist_ok=True)

        self.config_file = self.kb_dir / "knowledge_bases.json"

        # 组件
        self.processor = DocumentProcessor()
        self.embedder: Optional[Embedder] = None

        self._load_configs()

    def _load_configs(self):
        """加载知识库配置"""
        if self.config_file.exists():
            try:
                with open(self.config_file, "r", encoding="utf-8") as f:
                    self._configs = json.load(f)
                logger.info(f"已加载 {len(self._configs)} 个知识库配置")
            except Exception as e:
                logger.error(f"加载配置失败: {e}")
                self._configs = {}
        else:
            self._configs = {}

    def _save_configs(self):
        """保存知识库配置"""
        try:
            with open(self.config_file, "w", encoding="utf-8") as f:
                json.dump(self._configs, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"保存配置失败: {e}")

    def _get_kb_dir(self, kb_id: str) -> Path:
        """获取知识库目录"""
        kb_dir = self.kb_dir / kb_id
        kb_dir.mkdir(parents=True, exist_ok=True)
        return kb_dir

    def _get_documents_dir(self, kb_id: str) -> Path:
        """获取文档存储目录"""
        docs_dir = self._get_kb_dir(kb_id) / "documents"
        docs_dir.mkdir(exist_ok=True)
        return docs_dir

    def _get_metadata_file(self, kb_id: str) -> Path:
        """获取元数据文件"""
        return self._get_kb_dir(kb_id) / "metadata.json"

    def _ensure_embedder(self):
        """确保嵌入模型已加载"""
        if self.embedder is None:
            self.embedder = Embedder()

    def create_kb(
        self,
        name: str,
        description: str = "",
        embedding_model: str = "BAAI/bge-small-zh-v1.5"
    ) -> KnowledgeBase:
        """创建知识库

        Args:
            name: 知识库名称
            description: 知识库描述
            embedding_model: 嵌入模型名称

        Returns:
            KnowledgeBase: 创建的知识库对象
        """
        # 检查名称重复
        for kb in self._configs.values():
            if kb["name"] == name:
                raise ValueError(f"知识库名称已存在: {name}")

        kb_id = f"kb_{str(uuid.uuid4())[:8]}"
        now = datetime.now().isoformat()

        kb_config = {
            "kb_id": kb_id,
            "name": name,
            "description": description,
            "embedding_model": embedding_model,
            "created_at": now,
            "updated_at": now,
            "doc_count": 0,
            "chunk_count": 0,
            "total_size": 0
        }

        self._configs[kb_id] = kb_config
        self._save_configs()

        # 创建目录结构
        kb_dir = self._get_kb_dir(kb_id)
        self._get_documents_dir(kb_id)

        # 保存元数据
        with open(self._get_metadata_file(kb_id), "w", encoding="utf-8") as f:
            json.dump(kb_config, f, ensure_ascii=False, indent=2)

        # 创建 ChromaDB 集合（初始化向量数据库）
        self._get_collection(kb_id)

        logger.info(f"知识库创建成功: {kb_id} - {name}")
        return KnowledgeBase(**kb_config)

    def delete_kb(self, kb_id: str) -> bool:
        """删除知识库

        删除向量集合、元数据和所有文档

        Args:
            kb_id: 知识库 ID

        Returns:
            bool: 是否删除成功
        """
        if kb_id not in self._configs:
            logger.warning(f"知识库不存在: {kb_id}")
            return False

        try:
            # 删除目录
            kb_dir = self._get_kb_dir(kb_id)
            if kb_dir.exists():
                shutil.rmtree(kb_dir)

            # 删除配置
            del self._configs[kb_id]
            self._save_configs()

            logger.info(f"知识库已删除: {kb_id}")
            return True

        except Exception as e:
            logger.error(f"删除知识库失败: {e}")
            return False

    def list_kb(self) -> List[KnowledgeBase]:
        """列出所有知识库

        Returns:
            List[KnowledgeBase]: 知识库列表
        """
        kbs = []
        for kb_config in self._configs.values():
            # 更新统计信息
            kb_config = self._update_kb_stats(kb_config["kb_id"])
            kbs.append(KnowledgeBase(**kb_config))
        return kbs

    def get_kb(self, kb_id: str) -> Optional[KnowledgeBase]:
        """获取知识库

        Args:
            kb_id: 知识库 ID

        Returns:
            Optional[KnowledgeBase]: 知识库对象，不存在返回 None
        """
        if kb_id not in self._configs:
            return None

        kb_config = self._update_kb_stats(kb_id)
        return KnowledgeBase(**kb_config)

    def _update_kb_stats(self, kb_id: str) -> Dict[str, Any]:
        """更新知识库统计信息"""
        if kb_id not in self._configs:
            return {}

        kb_config = self._configs[kb_id]

        try:
            # 计算文档数和总大小
            docs_dir = self._get_documents_dir(kb_id)
            doc_count = 0
            total_size = 0

            for file_path in docs_dir.iterdir():
                if file_path.is_file():
                    doc_count += 1
                    total_size += file_path.stat().st_size

            # 获取文档块数
            collection = self._get_collection(kb_id)
            chunk_count = collection.count()

            kb_config["doc_count"] = doc_count
            kb_config["chunk_count"] = chunk_count
            kb_config["total_size"] = total_size

            # 更新配置文件
            self._configs[kb_id] = kb_config
            self._save_configs()

            # 更新元数据文件
            with open(self._get_metadata_file(kb_id), "w", encoding="utf-8") as f:
                json.dump(kb_config, f, ensure_ascii=False, indent=2)

        except Exception as e:
            logger.warning(f"更新知识库统计信息失败: {e}")

        return kb_config

    def _get_collection(self, kb_id: str):
        """获取知识库的向量集合

        Args:
            kb_id: 知识库 ID

        Returns:
            chromadb.Collection: ChromaDB 集合
        """
        try:
            import chromadb

            vectordb_dir = self._get_kb_dir(kb_id) / "vectordb"
            vectordb_dir.mkdir(parents=True, exist_ok=True)

            client = chromadb.PersistentClient(path=str(vectordb_dir))
            collection = client.get_or_create_collection(
                name="documents",
                metadata={"hnsw:space": "cosine"}
            )

            return collection

        except ImportError as e:
            raise ImportError(
                "chromadb 未安装。请运行: pip install chromadb"
            ) from e
        except Exception as e:
            logger.error(f"获取向量集合失败: {e}")
            raise

    def add_document(
        self,
        kb_id: str,
        file_path: Path,
        filename: str
    ) -> Document:
        """添加文档到知识库

        处理流程：验证 → 解析 → 分块 → 向量化 → 存储

        Args:
            kb_id: 知识库 ID
            file_path: 文件路径（临时文件）
            filename: 原始文件名

        Returns:
            Document: 文档元数据对象
        """
        if kb_id not in self._configs:
            raise ValueError(f"知识库不存在: {kb_id}")

        doc_id = f"doc_{str(uuid.uuid4())[:8]}"
        file_size = file_path.stat().st_size
        mime_type = self._get_mime_type(filename)

        # 创建文档记录
        document = Document(
            doc_id=doc_id,
            kb_id=kb_id,
            filename=filename,
            file_size=file_size,
            file_path="",
            mime_type=mime_type,
            status=DocumentStatus.PROCESSING
        )

        try:
            # 1. 复制文件到知识库目录
            docs_dir = self._get_documents_dir(kb_id)
            target_path = docs_dir / f"{doc_id}_{filename}"
            shutil.copy(file_path, target_path)
            document.file_path = str(target_path)

            # 2. 解析并分块
            text, chunks = self.processor.process(target_path, doc_id)
            document.char_count = len(text)
            document.chunk_count = len(chunks)

            # 3. 向量化并存储
            self._embed_and_store(kb_id, doc_id, filename, chunks)

            # 4. 更新状态
            document.status = DocumentStatus.READY
            document.processed_at = datetime.now().isoformat()

            logger.info(f"文档处理完成: {doc_id} - {filename} ({len(chunks)} 块)")

        except Exception as e:
            document.status = DocumentStatus.FAILED
            document.error_message = str(e)
            logger.error(f"文档处理失败: {e}")

        return document

    def _get_mime_type(self, filename: str) -> str:
        """获取文件的 MIME 类型"""
        suffix = Path(filename).suffix.lower()
        mime_types = {
            ".pdf": "application/pdf",
            ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".txt": "text/plain",
            ".md": "text/markdown"
        }
        return mime_types.get(suffix, "application/octet-stream")

    def _embed_and_store(
        self,
        kb_id: str,
        doc_id: str,
        filename: str,
        chunks: List[Chunk]
    ):
        """向量化并存储文档块

        Args:
            kb_id: 知识库 ID
            doc_id: 文档 ID
            filename: 文件名
            chunks: 文档块列表
        """
        self._ensure_embedder()

        # 批量编码
        texts = [chunk.content for chunk in chunks]
        embeddings = self.embedder.encode(texts)

        # 准备 ChromaDB 数据
        ids = [chunk.chunk_id for chunk in chunks]
        documents = texts
        metadatas = [
            {
                "doc_id": doc_id,
                "chunk_index": chunk.chunk_index,
                "filename": filename,
                "chunk_length": len(chunk.content)
            }
            for chunk in chunks
        ]

        # 添加到向量数据库
        collection = self._get_collection(kb_id)
        collection.add(
            ids=ids,
            documents=documents,
            embeddings=embeddings,
            metadatas=metadatas
        )

        logger.info(f"向量存储完成: {len(chunks)} 块")

    def list_documents(self, kb_id: str) -> List[Document]:
        """列出知识库中的所有文档

        Args:
            kb_id: 知识库 ID

        Returns:
            List[Document]: 文档列表
        """
        if kb_id not in self._configs:
            return []

        documents = []
        docs_dir = self._get_documents_dir(kb_id)

        for file_path in docs_dir.iterdir():
            if file_path.is_file():
                # 从文件名解析 doc_id (格式: doc_id_filename)
                # doc_id 格式是 doc_xxxxx，需要找到第二个下划线
                stem = file_path.stem
                if stem.startswith("doc_"):
                    # 找到第二个下划线的位置
                    underscore_pos = stem.find("_", 4)  # 从第4个字符开始找（跳过 "doc_"）
                    if underscore_pos > 0:
                        doc_id = stem[:underscore_pos]
                        original_filename = stem[underscore_pos + 1:] + file_path.suffix

                        # 从 ChromaDB 获取块数
                        collection = self._get_collection(kb_id)
                        chunk_count = collection.get(
                            where={"doc_id": doc_id}
                        ).get("ids", [[]])[0]

                        documents.append(Document(
                            doc_id=doc_id,
                            kb_id=kb_id,
                            filename=original_filename,
                            file_size=file_path.stat().st_size,
                            file_path=str(file_path),
                            mime_type=self._get_mime_type(original_filename),
                            chunk_count=len(chunk_count),
                            status=DocumentStatus.READY
                        ))

        return documents

    def delete_document(self, kb_id: str, doc_id: str) -> bool:
        """从知识库中删除文档

        Args:
            kb_id: 知识库 ID
            doc_id: 文档 ID

        Returns:
            bool: 是否删除成功
        """
        if kb_id not in self._configs:
            return False

        try:
            # 1. 删除文件
            docs_dir = self._get_documents_dir(kb_id)
            for file_path in docs_dir.glob(f"{doc_id}_*"):
                file_path.unlink()

            # 2. 从向量数据库删除
            collection = self._get_collection(kb_id)
            collection.delete(where={"doc_id": doc_id})

            logger.info(f"文档已删除: {doc_id}")
            return True

        except Exception as e:
            logger.error(f"删除文档失败: {e}")
            return False

    def get_retriever(self, kb_id: str):
        """获取知识库的检索器

        Args:
            kb_id: 知识库 ID

        Returns:
            Retriever: 检索器实例
        """
        if kb_id not in self._configs:
            raise ValueError(f"知识库不存在: {kb_id}")

        from src.retriever import Retriever

        self._ensure_embedder()
        collection = self._get_collection(kb_id)

        return Retriever(collection, self.embedder)
