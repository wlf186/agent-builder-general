"""
模型供应商测试器 - 测试连通性和获取模型列表
"""
import httpx
from typing import Dict, List, Tuple, Optional
from .models import ModelProvider


class ModelProviderTester:
    """模型供应商测试器"""

    @staticmethod
    async def test_connection(
        provider: ModelProvider,
        base_url: str,
        api_key: Optional[str] = None
    ) -> Tuple[bool, List[str], str]:
        """
        测试连接并获取可用模型列表

        Returns:
            Tuple[success, models, message]
        """
        if provider == ModelProvider.ZHIPU:
            return await ModelProviderTester._test_zhipu(base_url, api_key)
        elif provider == ModelProvider.ALIBABA_BAILIAN:
            return await ModelProviderTester._test_alibaba_bailian(base_url, api_key)
        elif provider == ModelProvider.OLLAMA:
            return await ModelProviderTester._test_ollama(base_url)
        else:
            return False, [], f"不支持的供应商: {provider}"

    @staticmethod
    async def _test_zhipu(base_url: str, api_key: Optional[str]) -> Tuple[bool, List[str], str]:
        """测试智谱AI连接"""
        if not api_key:
            return False, [], "API Key 不能为空"

        try:
            async with httpx.AsyncClient(timeout=30.0, proxy=None) as client:
                # 智谱AI使用OpenAI兼容接口获取模型列表
                models_url = f"{base_url.rstrip('/')}/models"
                response = await client.get(
                    models_url,
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json"
                    }
                )

                if response.status_code == 200:
                    data = response.json()
                    models = []
                    if "data" in data:
                        models = [m.get("id", m.get("name", "")) for m in data["data"]]
                    elif isinstance(data, list):
                        models = [m.get("id", m.get("name", "")) for m in data]
                    return True, sorted(models), "连接成功"
                else:
                    error_msg = f"请求失败: HTTP {response.status_code}"
                    try:
                        error_data = response.json()
                        if "error" in error_data:
                            error_msg = error_data["error"].get("message", error_msg)
                    except:
                        pass
                    return False, [], error_msg

        except httpx.TimeoutException:
            return False, [], "连接超时，请检查网络或URL是否正确"
        except httpx.ConnectError:
            return False, [], "无法连接到服务器，请检查URL是否正确"
        except Exception as e:
            return False, [], f"连接失败: {str(e)}"

    @staticmethod
    async def _test_alibaba_bailian(base_url: str, api_key: Optional[str]) -> Tuple[bool, List[str], str]:
        """测试阿里云百炼连接"""
        if not api_key:
            return False, [], "API Key 不能为空"

        try:
            async with httpx.AsyncClient(timeout=30.0, proxy=None) as client:
                # 阿里云百炼使用OpenAI兼容接口获取模型列表
                models_url = f"{base_url.rstrip('/')}/models"
                response = await client.get(
                    models_url,
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json"
                    }
                )

                if response.status_code == 200:
                    data = response.json()
                    models = []
                    if "data" in data:
                        models = [m.get("id", m.get("name", "")) for m in data["data"]]
                    elif isinstance(data, list):
                        models = [m.get("id", m.get("name", "")) for m in data]
                    return True, sorted(models), "连接成功"
                else:
                    error_msg = f"请求失败: HTTP {response.status_code}"
                    try:
                        error_data = response.json()
                        if "error" in error_data:
                            error_msg = error_data["error"].get("message", error_msg)
                        elif "message" in error_data:
                            error_msg = error_data["message"]
                    except:
                        pass
                    return False, [], error_msg

        except httpx.TimeoutException:
            return False, [], "连接超时，请检查网络或URL是否正确"
        except httpx.ConnectError:
            return False, [], "无法连接到服务器，请检查URL是否正确"
        except Exception as e:
            return False, [], f"连接失败: {str(e)}"

    @staticmethod
    async def _test_ollama(base_url: str) -> Tuple[bool, List[str], str]:
        """测试Ollama连接"""
        try:
            async with httpx.AsyncClient(timeout=30.0, proxy=None) as client:
                # Ollama获取模型列表的API
                # 尝试两种可能的API路径
                tags_url = f"{base_url.rstrip('/')}/api/tags"

                # 如果base_url是/v1结尾的OpenAI兼容格式，需要调整
                if base_url.rstrip("/").endswith("/v1"):
                    base = base_url.rstrip("/")[:-3]  # 移除 /v1
                    tags_url = f"{base}/api/tags"

                response = await client.get(tags_url)

                if response.status_code == 200:
                    data = response.json()
                    models = []
                    if "models" in data:
                        models = [m.get("name", "") for m in data["models"]]
                    return True, sorted(models), "连接成功"
                else:
                    return False, [], f"请求失败: HTTP {response.status_code}"

        except httpx.TimeoutException:
            return False, [], "连接超时，请检查Ollama服务是否运行"
        except httpx.ConnectError:
            return False, [], "无法连接到Ollama服务，请确认服务是否运行"
        except Exception as e:
            return False, [], f"连接失败: {str(e)}"


async def test_model_service_connection(
    provider: ModelProvider,
    base_url: str,
    api_key: Optional[str] = None
) -> Dict:
    """
    测试模型服务连接

    Returns:
        {
            "success": bool,
            "models": List[str],
            "message": str
        }
    """
    success, models, message = await ModelProviderTester.test_connection(
        provider, base_url, api_key
    )
    return {
        "success": success,
        "models": models,
        "message": message
    }
