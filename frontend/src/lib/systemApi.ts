/**
 * 系统 API - 系统级接口调用
 */

const API_BASE = "/api";

/**
 * Conda 检测结果
 */
export interface CondaCheckResult {
  available: boolean;       // conda 是否可用
  path: string | null;      // conda 可执行文件路径
  version: string | null;   // conda 版本
  error: string | null;     // 错误代码
  message: string;          // 用户友好的消息
}

/**
 * 环境错误详情
 */
export interface EnvironmentError {
  error_code: string;
  error_type: string;
  user_message: string;
  solutions: Array<{
    title: string;
    steps: string[];
    estimated_time: string;
    commands?: string[];
  }>;
  technical_details?: {
    error_message: string;
    stack_trace?: string;
  };
}

/**
 * 系统 API 类
 */
export class SystemApi {
  /**
   * 检测 Conda 是否可用
   */
  static async checkConda(): Promise<CondaCheckResult> {
    const response = await fetch(`${API_BASE}/system/check-conda`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`检测 Conda 失败: ${response.statusText}`);
    }

    return await response.json();
  }
}

// 导出单例实例
export const systemApi = SystemApi;
