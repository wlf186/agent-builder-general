"""
密钥安全加载器
支持多层级密钥加载：环境变量 > .env > 加密存储 > 明文存储
"""
import os
import json
from pathlib import Path
from typing import Optional, Dict


class SecretLoader:
    """
    密钥加载器 - 支持多层级加载

    优先级: 环境变量 > .env > 加密存储 > 明文存储
    """

    ENV_PREFIX = "_API_KEY"
    ENV_FILE = ".env"
    SECRETS_FILE = "data/.secrets.json.enc"
    SECRETS_KEY_ENV = "SECRET_ENCRYPTION_KEY"

    def __init__(self, project_root: Path):
        self.project_root = project_root
        self._fernet: Optional['Fernet'] = None
        self._encryption_key: Optional[str] = None

    def _init_encryption(self) -> Optional['Fernet']:
        """初始化加密（如果密钥可用）"""
        key = os.environ.get(self.SECRETS_KEY_ENV)
        if not key:
            return None

        try:
            from cryptography.fernet import Fernet
            import hashlib
            import base64

            # 确保密钥格式正确（Fernet需要32字节base64编码）
            if len(key) == 44:  # 标准Fernet密钥长度
                return Fernet(key.encode())
            else:
                # 从任意字符串派生密钥
                derived = hashlib.sha256(key.encode()).digest()
                return Fernet(base64.urlsafe_b64encode(derived))
        except ImportError:
            print("⚠️  cryptography库未安装，加密功能不可用")
            return None
        except Exception as e:
            print(f"加密初始化失败: {e}")
            return None

    def load_api_key(self, service_name: str, fallback: Optional[str] = None) -> Optional[str]:
        """
        加载服务API密钥

        Args:
            service_name: 服务名称（如 "TESTLLM"）
            fallback: 备用密钥（来自JSON存储）

        Returns:
            API密钥或None
        """
        # 1. 环境变量（最高优先级）
        env_key = f"{service_name}{self.ENV_PREFIX}"
        if value := os.environ.get(env_key):
            return value

        # 2. .env文件
        if value := self._load_from_env_file(service_name):
            return value

        # 3. 加密存储
        if value := self._load_from_encrypted(service_name):
            return value

        # 4. 明文存储（向后兼容）
        if fallback:
            # 返回但记录警告
            self._warn_insecure_storage(service_name)
            return fallback

        return None

    def _load_from_env_file(self, service_name: str) -> Optional[str]:
        """从.env文件加载"""
        env_file = self.project_root / self.ENV_FILE
        if not env_file.exists():
            return None

        try:
            from dotenv import dotenv_values
            values = dotenv_values(env_file)
            env_key = f"{service_name}_API_KEY"
            return values.get(env_key)
        except ImportError:
            # python-dotenv未安装，简单解析
            try:
                with open(env_file) as f:
                    for line in f:
                        line = line.strip()
                        if line.startswith(f"{service_name}_API_KEY="):
                            return line.split("=", 1)[1].strip().strip('"\'')
            except Exception:
                pass
        except Exception:
            pass
        return None

    def _load_from_encrypted(self, service_name: str) -> Optional[str]:
        """从加密存储加载"""
        secrets_file = self.project_root / self.SECRETS_FILE
        if not secrets_file.exists():
            return None

        if self._fernet is None:
            self._fernet = self._init_encryption()
        if self._fernet is None:
            return None

        try:
            with open(secrets_file, "rb") as f:
                encrypted_data = f.read()

            decrypted_data = self._fernet.decrypt(encrypted_data)
            secrets = json.loads(decrypted_data)
            return secrets.get(service_name)
        except Exception as e:
            print(f"解密失败: {e}")
            return None

    def _warn_insecure_storage(self, service_name: str):
        """警告不安全存储"""
        print(f"⚠️  警告: {service_name} 使用明文存储API密钥")
        print(f"   建议使用环境变量: {service_name}_API_KEY")

    def save_to_encrypted(self, secrets: Dict[str, str], encryption_key: Optional[str] = None):
        """保存到加密存储"""
        from cryptography.fernet import Fernet
        import hashlib
        import base64

        if encryption_key:
            os.environ[self.SECRETS_KEY_ENV] = encryption_key

        if self._fernet is None:
            self._fernet = self._init_encryption()
        if self._fernet is None:
            raise ValueError("加密密钥未配置，请设置环境变量SECRET_ENCRYPTION_KEY")

        secrets_file = self.project_root / self.SECRETS_FILE
        secrets_file.parent.mkdir(parents=True, exist_ok=True)

        data = json.dumps(secrets, ensure_ascii=False)
        encrypted_data = self._fernet.encrypt(data.encode())

        with open(secrets_file, "wb") as f:
            f.write(encrypted_data)

        print(f"✓ 密钥已加密保存到 {secrets_file}")

    def is_from_env(self, service_name: str) -> bool:
        """检查密钥是否来自环境变量"""
        env_key = f"{service_name}{self.ENV_PREFIX}"
        return os.environ.get(env_key) is not None

    def get_env_key_name(self, service_name: str) -> str:
        """获取环境变量名称"""
        return f"{service_name}{self.ENV_PREFIX}"


# 全局实例
_project_root = Path(__file__).parent.parent
_global_secret_loader = None


def get_secret_loader() -> SecretLoader:
    """获取全局密钥加载器实例"""
    global _global_secret_loader
    if _global_secret_loader is None:
        _global_secret_loader = SecretLoader(_project_root)
    return _global_secret_loader
