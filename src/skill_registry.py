"""
Skill注册表 - 管理Skills的注册、扫描和删除
"""
import json
import zipfile
import tempfile
import shutil
import re
from pathlib import Path
from typing import List, Optional, Tuple, Dict, Any
from datetime import datetime

from .models import SkillConfig, SkillSource


class SkillRegistry:
    """全局Skill注册表"""

    def __init__(self, data_dir: Path, skills_dir: Path):
        self.data_dir = data_dir
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.skills_dir = skills_dir
        self.skills_dir.mkdir(parents=True, exist_ok=True)
        self.builtin_dir = skills_dir / "builtin"
        self.user_dir = skills_dir / "user"
        self.builtin_dir.mkdir(parents=True, exist_ok=True)
        self.user_dir.mkdir(parents=True, exist_ok=True)
        self.index_file = data_dir / "skills_index.json"
        self.skills: Dict[str, SkillConfig] = {}
        self._load_index()
        self._scan_builtin_skills()

    def _load_index(self):
        """加载索引文件"""
        if self.index_file.exists():
            try:
                with open(self.index_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for name, config in data.items():
                        self.skills[name] = SkillConfig(**config)
            except Exception as e:
                print(f"加载Skills索引失败: {e}")

    def _save_index(self):
        """保存索引文件"""
        try:
            data = {
                name: config.model_dump()
                for name, config in self.skills.items()
            }
            with open(self.index_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"保存Skills索引失败: {e}")

    def _parse_skill_md(self, skill_path: Path) -> Tuple[str, str, Dict[str, Any]]:
        """
        解析SKILL.md文件，提取元数据
        返回: (name, description, metadata)
        """
        skill_md_path = skill_path / "SKILL.md"
        if not skill_md_path.exists():
            return "", "", {}

        try:
            with open(skill_md_path, "r", encoding="utf-8") as f:
                content = f.read()

            # 提取标题（第一个 # 标题）
            name = ""
            title_match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
            if title_match:
                name = title_match.group(1).strip()

            # 提取描述（标题后的第一段非空内容）
            description = ""
            lines = content.split('\n')
            found_title = False
            for line in lines:
                if line.startswith('# ') and not found_title:
                    found_title = True
                    continue
                if found_title and line.strip() and not line.startswith('#'):
                    description = line.strip()
                    break

            # 提取元数据（从frontmatter或特殊标记）
            metadata = {}

            # 尝试解析 YAML frontmatter
            if content.startswith('---'):
                frontmatter_match = re.search(r'^---\n(.*?)\n---', content, re.DOTALL)
                if frontmatter_match:
                    frontmatter = frontmatter_match.group(1)
                    for line in frontmatter.split('\n'):
                        if ':' in line:
                            key, value = line.split(':', 1)
                            metadata[key.strip()] = value.strip().strip('"').strip("'")

            # 如果没有从标题获取到name，从frontmatter获取
            if not name and 'name' in metadata:
                name = metadata['name']

            # 如果没有从内容获取到description，从frontmatter获取
            if not description and 'description' in metadata:
                description = metadata['description']

            # 从内容中提取标签
            tags_match = re.search(r'标签[：:]\s*(.+)$', content, re.MULTILINE)
            if tags_match:
                tags_str = tags_match.group(1).strip()
                metadata['tags'] = [t.strip() for t in tags_str.split(',') if t.strip()]

            # 从内容中提取版本
            version_match = re.search(r'版本[：:]\s*([\d.]+)', content)
            if version_match:
                metadata['version'] = version_match.group(1)

            # 从内容中提取作者
            author_match = re.search(r'作者[：:]\s*(.+)$', content, re.MULTILINE)
            if author_match:
                metadata['author'] = author_match.group(1).strip()

            return name, description, metadata

        except Exception as e:
            print(f"解析SKILL.md失败: {e}")
            return "", "", {}

    def _scan_builtin_skills(self):
        """扫描预置Skills目录"""
        if not self.builtin_dir.exists():
            return

        for skill_path in self.builtin_dir.iterdir():
            if skill_path.is_dir() and (skill_path / "SKILL.md").exists():
                name, description, metadata = self._parse_skill_md(skill_path)
                if name:
                    # 获取文件列表
                    files = self._get_skill_files(skill_path)

                    skill_config = SkillConfig(
                        name=name,
                        description=description or f"Skill: {name}",
                        source=SkillSource.BUILTIN,
                        skill_path=f"builtin/{skill_path.name}",
                        version=metadata.get("version", "1.0.0"),
                        author=metadata.get("author"),
                        tags=metadata.get("tags", []),
                        files=files,
                        enabled=True,
                        created_at=metadata.get("created_at"),
                        updated_at=metadata.get("updated_at")
                    )

                    # 如果已存在则更新，否则添加
                    if name in self.skills:
                        # 保留用户可能修改的enabled状态
                        existing = self.skills[name]
                        skill_config.enabled = existing.enabled
                    self.skills[name] = skill_config

        self._save_index()

    def _get_skill_files(self, skill_path: Path) -> List[str]:
        """获取Skill目录下的所有文件"""
        files = []
        for file_path in skill_path.rglob("*"):
            if file_path.is_file():
                rel_path = file_path.relative_to(skill_path)
                files.append(str(rel_path))
        return sorted(files)

    def register_skill(self, config: SkillConfig) -> bool:
        """注册一个Skill"""
        if config.name in self.skills and self.skills[config.name].source == SkillSource.BUILTIN:
            print(f"不能覆盖预置Skill: {config.name}")
            return False

        config.updated_at = datetime.now().isoformat()
        if not config.created_at:
            config.created_at = config.updated_at

        self.skills[config.name] = config
        self._save_index()
        return True

    def unregister_skill(self, name: str) -> bool:
        """注销一个Skill"""
        if name not in self.skills:
            return False

        skill = self.skills[name]
        if skill.source == SkillSource.BUILTIN:
            print(f"不能删除预置Skill: {name}")
            return False

        # 删除文件
        skill_path = self.skills_dir / skill.skill_path
        if skill_path.exists() and skill_path.parent == self.user_dir:
            shutil.rmtree(skill_path)

        del self.skills[name]
        self._save_index()
        return True

    def get_skill(self, name: str) -> Optional[SkillConfig]:
        """获取Skill配置"""
        return self.skills.get(name)

    def list_skills(self) -> List[SkillConfig]:
        """列出所有Skills"""
        return list(self.skills.values())

    def get_skills_by_names(self, names: List[str]) -> List[SkillConfig]:
        """根据名称列表获取Skills"""
        return [self.skills[name] for name in names if name in self.skills]

    def skill_exists(self, name: str) -> bool:
        """检查Skill是否存在"""
        return name in self.skills

    def extract_zip_and_register(self, zip_path: Path, skill_name: Optional[str] = None) -> Tuple[bool, str, Optional[SkillConfig]]:
        """
        解压zip包并注册Skill
        返回: (success, message, skill_config)
        """
        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                temp_path = Path(temp_dir)

                # 解压zip
                with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                    zip_ref.extractall(temp_path)

                # 查找SKILL.md文件
                skill_md_path = None
                extracted_root = None

                for file_path in temp_path.rglob("SKILL.md"):
                    skill_md_path = file_path
                    extracted_root = file_path.parent
                    break

                if not skill_md_path:
                    return False, "Zip包中未找到SKILL.md文件", None

                # 解析元数据
                name, description, metadata = self._parse_skill_md(extracted_root)
                if not name:
                    # 如果没有从md中提取到名称，使用文件夹名或参数
                    name = skill_name or extracted_root.name

                # 检查名称是否已存在
                if name in self.skills:
                    existing = self.skills[name]
                    if existing.source == SkillSource.BUILTIN:
                        return False, f"Skill名称 '{name}' 与预置Skill冲突", None

                # 创建目标目录
                safe_name = re.sub(r'[^\w\-]', '_', name)
                dest_path = self.user_dir / safe_name

                if dest_path.exists():
                    shutil.rmtree(dest_path)

                # 复制文件
                shutil.copytree(extracted_root, dest_path)

                # 获取文件列表
                files = self._get_skill_files(dest_path)

                # 创建配置
                skill_config = SkillConfig(
                    name=name,
                    description=description or f"用户上传的Skill: {name}",
                    source=SkillSource.USER,
                    skill_path=f"user/{safe_name}",
                    version=metadata.get("version", "1.0.0"),
                    author=metadata.get("author"),
                    tags=metadata.get("tags", []),
                    files=files,
                    enabled=True,
                    created_at=datetime.now().isoformat(),
                    updated_at=datetime.now().isoformat()
                )

                # 注册
                self.skills[name] = skill_config
                self._save_index()

                return True, f"Skill '{name}' 上传成功", skill_config

        except zipfile.BadZipFile:
            return False, "无效的zip文件", None
        except Exception as e:
            return False, f"解压失败: {str(e)}", None

    def get_skill_file_content(self, name: str, file_path: str) -> Optional[str]:
        """获取Skill文件内容"""
        skill = self.get_skill(name)
        if not skill:
            return None

        skill_full_path = self.skills_dir / skill.skill_path / file_path
        if not skill_full_path.exists():
            return None

        try:
            with open(skill_full_path, "r", encoding="utf-8") as f:
                return f.read()
        except Exception as e:
            print(f"读取文件失败: {e}")
            return None
