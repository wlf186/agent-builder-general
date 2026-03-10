"""
会话存储管理器

负责管理会话的持久化存储，包括：
- 会话列表的增删改查
- 会话消息的存储和加载
- 数据存储在 data/conversations/{agent_name}/ 目录下
"""
import json
import uuid
from pathlib import Path
from typing import List, Optional, Dict, Any
from datetime import datetime

from src.models import ConversationConfig


class ConversationManager:
    """会话存储管理器"""

    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self.conversations_dir = data_dir / "conversations"
        self._ensure_dir()

    def _ensure_dir(self):
        """确保会话目录存在"""
        self.conversations_dir.mkdir(parents=True, exist_ok=True)

    def _get_agent_dir(self, agent_name: str) -> Path:
        """获取智能体对应的会话目录"""
        agent_dir = self.conversations_dir / agent_name
        agent_dir.mkdir(parents=True, exist_ok=True)
        return agent_dir

    def _get_conversation_file(self, agent_name: str, conversation_id: str) -> Path:
        """获取会话文件路径"""
        return self._get_agent_dir(agent_name) / f"{conversation_id}.json"

    def _get_index_file(self, agent_name: str) -> Path:
        """获取会话索引文件路径"""
        return self._get_agent_dir(agent_name) / "index.json"

    def _load_index(self, agent_name: str) -> Dict[str, Any]:
        """加载会话索引"""
        index_file = self._get_index_file(agent_name)
        if index_file.exists():
            try:
                with open(index_file, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return {"conversations": []}

    def _save_index(self, agent_name: str, index: Dict[str, Any]):
        """保存会话索引"""
        index_file = self._get_index_file(agent_name)
        with open(index_file, "w", encoding="utf-8") as f:
            json.dump(index, f, ensure_ascii=False, indent=2)

    def create_conversation(self, agent_name: str, title: Optional[str] = None) -> ConversationConfig:
        """创建新会话"""
        conversation_id = str(uuid.uuid4())[:8]  # 使用短ID
        now = datetime.now().isoformat()

        conversation = ConversationConfig(
            id=conversation_id,
            agent_name=agent_name,
            title=title or "新对话",
            messages=[],
            created_at=now,
            updated_at=now
        )

        # 保存会话文件
        self._save_conversation(conversation)

        # 更新索引
        index = self._load_index(agent_name)
        index["conversations"].insert(0, {
            "id": conversation_id,
            "title": conversation.title,
            "preview": "",
            "message_count": 0,
            "created_at": now,
            "updated_at": now
        })
        self._save_index(agent_name, index)

        return conversation

    def _save_conversation(self, conversation: ConversationConfig):
        """保存会话到文件"""
        file_path = self._get_conversation_file(conversation.agent_name, conversation.id)
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(conversation.model_dump(), f, ensure_ascii=False, indent=2)

    def get_conversation(self, agent_name: str, conversation_id: str) -> Optional[ConversationConfig]:
        """获取会话详情"""
        file_path = self._get_conversation_file(agent_name, conversation_id)
        if not file_path.exists():
            return None

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return ConversationConfig(**data)
        except Exception:
            return None

    def update_conversation(self, agent_name: str, conversation_id: str, title: str) -> Optional[ConversationConfig]:
        """更新会话（重命名）"""
        conversation = self.get_conversation(agent_name, conversation_id)
        if not conversation:
            return None

        conversation.title = title
        conversation.updated_at = datetime.now().isoformat()
        self._save_conversation(conversation)

        # 更新索引
        index = self._load_index(agent_name)
        for conv in index["conversations"]:
            if conv["id"] == conversation_id:
                conv["title"] = title
                conv["updated_at"] = conversation.updated_at
                break
        self._save_index(agent_name, index)

        return conversation

    def delete_conversation(self, agent_name: str, conversation_id: str) -> bool:
        """删除会话"""
        file_path = self._get_conversation_file(agent_name, conversation_id)
        if not file_path.exists():
            return False

        try:
            file_path.unlink()

            # 更新索引
            index = self._load_index(agent_name)
            index["conversations"] = [
                conv for conv in index["conversations"]
                if conv["id"] != conversation_id
            ]
            self._save_index(agent_name, index)

            return True
        except Exception:
            return False

    def add_message(self, agent_name: str, conversation_id: str, role: str, content: str,
                   thinking: Optional[str] = None, tool_calls: Optional[List[Dict]] = None,
                   metrics: Optional[Dict] = None) -> Optional[Dict[str, Any]]:
        """添加消息到会话"""
        conversation = self.get_conversation(agent_name, conversation_id)
        if not conversation:
            return None

        now = datetime.now().isoformat()
        message = {
            "id": f"msg-{uuid.uuid4().hex[:8]}",
            "role": role,
            "content": content,
            "timestamp": now
        }

        if thinking:
            message["thinking"] = thinking
        if tool_calls:
            message["tool_calls"] = tool_calls
        if metrics:
            message["metrics"] = metrics

        conversation.messages.append(message)
        conversation.updated_at = now

        # 更新标题（如果是第一条用户消息）
        if role == "user" and len(conversation.messages) == 1:
            conversation.title = content[:30] + "..." if len(content) > 30 else content

        self._save_conversation(conversation)

        # 更新索引
        index = self._load_index(agent_name)
        for conv in index["conversations"]:
            if conv["id"] == conversation_id:
                conv["title"] = conversation.title
                conv["preview"] = conversation.get_preview()
                conv["message_count"] = conversation.get_message_count()
                conv["updated_at"] = now
                # 将更新的会话移到列表顶部
                index["conversations"].remove(conv)
                index["conversations"].insert(0, conv)
                break
        self._save_index(agent_name, index)

        return message

    def list_conversations(self, agent_name: str) -> List[Dict[str, Any]]:
        """获取会话列表"""
        index = self._load_index(agent_name)
        return index.get("conversations", [])

    def save_messages(self, agent_name: str, conversation_id: str, messages: List[Dict[str, Any]]) -> Optional[ConversationConfig]:
        """批量保存消息（用于前端同步整个消息列表）"""
        conversation = self.get_conversation(agent_name, conversation_id)
        if not conversation:
            return None

        now = datetime.now().isoformat()
        conversation.messages = messages
        conversation.updated_at = now

        # 更新标题（如果有用户消息）
        for msg in messages:
            if msg.get("role") == "user" and msg.get("content"):
                content = msg.get("content", "")
                conversation.title = content[:30] + "..." if len(content) > 30 else content
                break

        self._save_conversation(conversation)

        # 更新索引
        index = self._load_index(agent_name)
        for conv in index["conversations"]:
            if conv["id"] == conversation_id:
                conv["title"] = conversation.title
                conv["preview"] = conversation.get_preview()
                conv["message_count"] = conversation.get_message_count()
                conv["updated_at"] = now
                # 将更新的会话移到列表顶部
                index["conversations"].remove(conv)
                index["conversations"].insert(0, conv)
                break
        self._save_index(agent_name, index)

        return conversation
