"""
Skill工具 - 提供按需加载技能的Tool接口
"""
from pathlib import Path
from typing import Dict, List, Optional, Any

from .skill_registry import SkillRegistry
from .skill_loader import SkillLoader


class SkillTool:
    """Skill加载工具 - 允许LLM按需加载技能"""

    TOOL_NAME = "load_skill"

    def __init__(
        self,
        skill_registry: SkillRegistry,
        skills_dir: Path,
        enabled_skills: List[str]
    ):
        """
        初始化SkillTool

        Args:
            skill_registry: Skill注册表
            skills_dir: Skills根目录
            enabled_skills: Agent启用的技能名称列表
        """
        self.skill_registry = skill_registry
        self.skills_dir = skills_dir
        self.enabled_skills = enabled_skills
        self._loaded_skills: Dict[str, str] = {}  # 缓存已加载的skill内容

    def get_tool_definition(self) -> Dict[str, Any]:
        """
        返回工具定义，description中包含可用skills列表

        Returns:
            工具定义字典，包含name, description, input_schema
        """
        # 构建可用技能列表
        available_skills = []
        for skill_name in self.enabled_skills:
            skill = self.skill_registry.get_skill(skill_name)
            if skill and skill.enabled:
                available_skills.append({
                    "name": skill.name,
                    "description": skill.description[:100] + "..." if len(skill.description) > 100 else skill.description
                })

        skills_list_str = "\n".join([
            f"  - {s['name']}: {s['description']}"
            for s in available_skills
        ])

        description = f"""Load a skill's detailed guidance and instructions on-demand.

**IMPORTANT**: You MUST use the exact parameter name "skill_name" (not "skill") when calling this tool.

When to use: Call this tool when you need detailed instructions for handling specific tasks like PDF processing, DOCX creation, etc.

Available skills:
{skills_list_str}

This tool returns the full skill content including examples, best practices, and code snippets.
Each skill is only loaded once per session (cached).

Example call format:
{{"tool": "load_skill", "arguments": {{"skill_name": "exact-skill-name-here"}}}}"""

        return {
            "name": self.TOOL_NAME,
            "description": description,
            "input_schema": {
                "type": "object",
                "properties": {
                    "skill_name": {
                        "type": "string",
                        "description": "REQUIRED: The exact name of the skill to load from the available skills list above. Must match exactly."
                    },
                    "list_files": {
                        "type": "boolean",
                        "description": "If true, only list the files in the skill directory instead of loading content",
                        "default": False
                    }
                },
                "required": ["skill_name"]
            }
        }

    async def execute(self, skill_name: str, list_files: bool = False) -> str:
        """
        加载并返回skill内容

        Args:
            skill_name: 要加载的技能名称
            list_files: 如果为True，只列出文件而不是加载内容

        Returns:
            技能内容或错误信息
        """
        # 如果 skill_name 为空，返回错误提示
        if not skill_name:
            available = ", ".join(self.enabled_skills)
            return f"Error: No skill name provided. Available skills: {available}"

        # 检查是否在允许的技能列表中
        if skill_name not in self.enabled_skills:
            available = ", ".join(self.enabled_skills)
            return f"Error: Skill '{skill_name}' is not available. Available skills: {available}"

        # 检查缓存
        if skill_name in self._loaded_skills:
            if list_files:
                # 即使缓存了，也返回文件列表
                skill = self.skill_registry.get_skill(skill_name)
                if skill and skill.files:
                    return f"Files in skill '{skill_name}':\n" + "\n".join([f"  - {f}" for f in skill.files])
            return f"[Skill '{skill_name}' already loaded]\n\n{self._loaded_skills[skill_name]}"

        # 获取技能配置
        skill = self.skill_registry.get_skill(skill_name)
        if not skill:
            return f"Error: Skill '{skill_name}' not found in registry"

        if list_files:
            # 只列出文件
            if skill.files:
                return f"Files in skill '{skill_name}':\n" + "\n".join([f"  - {f}" for f in skill.files])
            else:
                return f"No files found for skill '{skill_name}'"

        # 加载技能内容
        try:
            content = SkillLoader.load_skill_content(skill, self.skills_dir)
            if not content:
                content = f"# {skill.name}\n\n{skill.description}"

            # 缓存内容
            self._loaded_skills[skill_name] = content

            return f"=== Skill Loaded: {skill.name} ===\n\n{content}\n\n=== End of Skill ==="

        except Exception as e:
            return f"Error loading skill '{skill_name}': {str(e)}"

    def is_skill_loaded(self, skill_name: str) -> bool:
        """检查技能是否已加载"""
        return skill_name in self._loaded_skills

    def get_loaded_skills(self) -> List[str]:
        """获取已加载的技能列表"""
        return list(self._loaded_skills.keys())

    def clear_cache(self):
        """清除缓存"""
        self._loaded_skills.clear()
