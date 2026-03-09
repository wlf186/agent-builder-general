"""
MCP服务注册表 - 全局MCP服务配置管理
"""
import json
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime

from .models import MCPServiceConfig, MCPConnectionType, MCPAuthType


class MCPServiceRegistry:
    """MCP服务注册表 - 管理全局MCP服务配置"""

    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.services: Dict[str, MCPServiceConfig] = {}
        self._load_services()

    def _get_services_file(self) -> Path:
        """获取服务配置文件路径"""
        return self.data_dir / "mcp_services.json"

    def _load_services(self):
        """加载已保存的服务配置"""
        services_file = self._get_services_file()
        if services_file.exists():
            try:
                with open(services_file, "r", encoding="utf-8") as f:
                    services_data = json.load(f)
                    for name, config in services_data.items():
                        self.services[name] = MCPServiceConfig(**config)
            except Exception as e:
                print(f"加载MCP服务配置失败: {e}")

    def _save_services(self):
        """保存服务配置"""
        services_file = self._get_services_file()
        try:
            services_data = {
                name: config.model_dump()
                for name, config in self.services.items()
            }
            with open(services_file, "w", encoding="utf-8") as f:
                json.dump(services_data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"保存MCP服务配置失败: {e}")

    def create_service(self, config: MCPServiceConfig) -> bool:
        """创建MCP服务"""
        if config.name in self.services:
            return False

        # 设置创建时间
        config.created_at = datetime.now().isoformat()
        config.updated_at = config.created_at

        self.services[config.name] = config
        self._save_services()
        return True

    def update_service(self, name: str, config: MCPServiceConfig) -> bool:
        """更新MCP服务"""
        if name not in self.services:
            return False

        # 保留创建时间，更新修改时间
        config.created_at = self.services[name].created_at
        config.updated_at = datetime.now().isoformat()

        # 如果名称改变，需要删除旧的
        if name != config.name:
            if config.name in self.services:
                return False  # 新名称已存在
            del self.services[name]

        self.services[config.name] = config
        self._save_services()
        return True

    def delete_service(self, name: str) -> bool:
        """删除MCP服务"""
        if name not in self.services:
            return False
        del self.services[name]
        self._save_services()
        return True

    def get_service(self, name: str) -> Optional[MCPServiceConfig]:
        """获取单个服务配置"""
        return self.services.get(name)

    def list_services(self) -> List[MCPServiceConfig]:
        """获取所有服务列表"""
        return list(self.services.values())

    def get_services_by_names(self, names: List[str]) -> List[MCPServiceConfig]:
        """根据名称列表获取服务配置"""
        return [
            self.services[name]
            for name in names
            if name in self.services
        ]

    def service_exists(self, name: str) -> bool:
        """检查服务是否存在"""
        return name in self.services

    def get_enabled_services(self) -> List[MCPServiceConfig]:
        """获取所有启用的服务"""
        return [
            service
            for service in self.services.values()
            if service.enabled
        ]
