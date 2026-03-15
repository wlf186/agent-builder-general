/**
 * ============================================================================
 * 前端调试日志系统
 *
 * 功能：
 * 1. 生成并传递 X-Request-ID 到后端
 * 2. 收集完整 Payload（messages 数组）
 * 3. 记录 SSE 流式输出的每个 Chunk
 * 4. 记录渲染状态和环境指纹
 * 5. 日志导出功能（.log 或 .json 格式）
 * 6. 合并前后端日志
 *
 * 使用方式：
 * ```typescript
 * const logger = DebugLogger.create();
 * logger.logRequestStart(requestPayload);
 * logger.logChunk(chunkData);
 * logger.logRenderState(renderState);
 * const fullLog = logger.export();
 * ```
 * ============================================================================
 */

// ============================================================================
// 类型定义
// ============================================================================

export interface RequestPayload {
  agentName: string;
  message: string;
  history: Array<{ role: string; content: string }>;
  file_ids?: string[];
  conversation_id?: string | null;
}

export interface ChunkData {
  type: string;
  content?: string;
  name?: string;
  args?: Record<string, any>;
  result?: string;
  error?: string;
  timestamp: number;
}

export interface RenderState {
  messageCount: number;
  isRunning: boolean;
  hasThinking: boolean;
  toolCallCount: number;
  skillStateCount: number;
}

export interface EnvironmentFingerprint {
  userAgent: string;
  language: string;
  platform: string;
  screenResolution: string;
  viewportSize: string;
  timezone: string;
  locale: string;
  cookieEnabled: boolean;
  onlineStatus: boolean;
  connectionType?: string;
}

export interface BackendLogEntry {
  request_id: string;
  timestamp: string;
  level: string;
  category: string;
  data: any;
}

export interface BackendLogPackage {
  meta: {
    version: string;
    exported_at: string;
    request_id: string;
  };
  server: {
    environment?: any;
    dependencies?: any;
    request?: any;
    logs?: BackendLogEntry[];
    model_calls?: any[];
    tool_calls?: any[];
    errors?: any[];
  };
}

// ============================================================================
// X-Request-ID 生成
// ============================================================================

export function generateRequestId(): string {
  // 生成格式: req-{timestamp}-{random}
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  return `req-${timestamp}-${random}`;
}

// ============================================================================
// 敏感数据脱敏
// ============================================================================

const SENSITIVE_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /(["']?api[_-]?key["']?\s*[:=]\s*["']?)([^"'}\s]+)(["']?)/gi, replacement: '$1[已脱敏 ***]$3' },
  { pattern: /(["']?token["']?\s*[:=]\s*["']?)([^"'}\s]{10,})(["']?)/gi, replacement: '$1[已脱敏 ****]$3' },
  { pattern: /(["']?password["']?\s*[:=]\s*["']?)([^"'}\s]+)(["']?)/gi, replacement: '$1[已脱敏 ***]$3' },
  { pattern: /(Bearer\s+)([A-Za-z0-9\-._~+/]+=*)/gi, replacement: '$1[已脱敏]' },
  { pattern: /(sk-[a-zA-Z0-9_-]{10,})/g, replacement: '[已脱敏 sk-****]' },
];

export function sanitizeForLogging(data: any): any {
  if (typeof data === 'string') {
    let result = data;
    for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
      result = result.replace(pattern, replacement);
    }
    // 限制长度
    if (result.length > 5000) {
      return result.substring(0, 5000) + `...(truncated, original: ${result.length})`;
    }
    return result;
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeForLogging);
  }

  if (typeof data === 'object' && data !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeForLogging(value);
    }
    return sanitized;
  }

  return data;
}

// ============================================================================
// 环境指纹采集
// ============================================================================

export function collectEnvironmentFingerprint(): EnvironmentFingerprint {
  const fingerprint: EnvironmentFingerprint = {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    screenResolution: `${screen.width}x${screen.height}`,
    viewportSize: `${window.innerWidth}x${window.innerHeight}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale: navigator.language,
    cookieEnabled: navigator.cookieEnabled,
    onlineStatus: navigator.onLine,
  };

  // 网络连接类型（如果支持）
  if ('connection' in navigator) {
    const conn = (navigator as any).connection;
    if (conn) {
      fingerprint.connectionType = conn.effectiveType || 'unknown';
    }
  }

  return fingerprint;
}

// ============================================================================
// 调试日志记录器
// ============================================================================

export class DebugLogger {
  private requestId: string;
  private startTime: number;
  private logs: Array<{
    timestamp: number;
    category: string;
    data: any;
  }> = [];
  private chunks: ChunkData[] = [];
  private payload: RequestPayload | null = null;
  private renderStates: Array<{
    timestamp: number;
    state: RenderState;
  }> = [];
  private errors: Array<{
    timestamp: number;
    error: string;
    stack?: string;
    context?: any;
  }> = [];
  private backendLogPackage: BackendLogPackage | null = null;

  private constructor(requestId: string) {
    this.requestId = requestId;
    this.startTime = Date.now();
    this.log('logger_init', { requestId });
  }

  static create(requestId?: string): DebugLogger {
    return new DebugLogger(requestId || generateRequestId());
  }

  getRequestId(): string {
    return this.requestId;
  }

  // ========================================================================
  // 日志记录方法
  // ========================================================================

  log(category: string, data: any): void {
    const entry = {
      timestamp: Date.now(),
      category,
      data: sanitizeForLogging(data),
    };
    this.logs.push(entry);
  }

  logRequestStart(payload: RequestPayload): void {
    this.payload = sanitizeForLogging(payload);
    this.log('request_start', {
      ...payload,
      // 记录消息数量而不是完整内容
      historyCount: payload.history?.length || 0,
      messageLength: payload.message?.length || 0,
    });
  }

  logChunk(chunkText: string, parsedData?: any): void {
    const chunkData: ChunkData = {
      timestamp: Date.now(),
      type: parsedData?.type || 'unknown',
      ...parsedData,
    };
    this.chunks.push(chunkData);

    // 每 50 个 chunk 记录一次摘要
    if (this.chunks.length % 50 === 0) {
      this.log('chunk_summary', {
        chunkCount: this.chunks.length,
        types: this.getChunkTypeSummary(),
      });
    }
  }

  logRenderState(state: RenderState): void {
    this.renderStates.push({
      timestamp: Date.now(),
      state: sanitizeForLogging(state),
    });
  }

  logError(error: Error, context?: any): void {
    this.errors.push({
      timestamp: Date.now(),
      error: error.message,
      stack: error.stack,
      context: sanitizeForLogging(context),
    });
    this.log('error', {
      message: error.message,
      name: error.name,
      context,
    });
  }

  logSSEEvent(eventType: string, eventData: any): void {
    this.log(`sse_${eventType}`, eventData);
  }

  // ========================================================================
  // 后端日志合并
  // ========================================================================

  async fetchBackendLogs(apiBase: string = '/api'): Promise<void> {
    try {
      const response = await fetch(`${apiBase}/debug/logs/${this.requestId}`);
      if (response.ok) {
        this.backendLogPackage = await response.json();
        this.log('backend_logs_fetched', {
          logCount: this.backendLogPackage?.server?.logs?.length || 0,
          toolCallCount: this.backendLogPackage?.server?.tool_calls?.length || 0,
          modelCallCount: this.backendLogPackage?.server?.model_calls?.length || 0,
        });
      }
    } catch (error) {
      this.log('backend_logs_fetch_failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // ========================================================================
  // 导出功能
  // ========================================================================

  export(format: 'json' | 'log' = 'json'): string {
    const endTime = Date.now();
    const duration = endTime - this.startTime;

    const fullLog = {
      meta: {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        requestId: this.requestId,
        duration: `${duration}ms`,
      },
      client: {
        environment: collectEnvironmentFingerprint(),
        request: this.payload,
        logs: this.logs,
        chunks: {
          total: this.chunks.length,
          typeSummary: this.getChunkTypeSummary(),
          // 只保留前 100 和后 50 个 chunk，避免过大
          samples: [
            ...this.chunks.slice(0, 100),
            ...this.chunks.length > 150 ? [{ type: '...', timestamp: 0, truncated: true }] : [],
            ...this.chunks.length > 150 ? this.chunks.slice(-50) : [],
          ],
        },
        renderStates: this.renderStates,
        errors: this.errors,
      },
      server: this.backendLogPackage || null,
    };

    if (format === 'json') {
      return JSON.stringify(fullLog, null, 2);
    } else {
      return this.formatAsText(fullLog);
    }
  }

  private formatAsText(log: any): string {
    const lines: string[] = [];

    lines.push('='.repeat(60));
    lines.push(`调试日志报告 - ${log.meta.requestId}`);
    lines.push(`导出时间: ${log.meta.exportedAt}`);
    lines.push(`持续时间: ${log.meta.duration}`);
    lines.push('='.repeat(60));
    lines.push('');

    // 客户端环境
    lines.push('--- 客户端环境 ---');
    const env = log.client.environment;
    lines.push(`User Agent: ${env.userAgent}`);
    lines.push(`Platform: ${env.platform}`);
    lines.push(`屏幕: ${env.screenResolution}`);
    lines.push(`视口: ${env.viewportSize}`);
    lines.push(`时区: ${env.timezone}`);
    lines.push(`语言: ${env.locale}`);
    lines.push(`在线: ${env.onlineStatus}`);
    lines.push('');

    // 请求信息
    if (log.client.request) {
      lines.push('--- 请求信息 ---');
      lines.push(`Agent: ${log.client.request.agentName}`);
      lines.push(`消息长度: ${log.client.request.messageLength}`);
      lines.push(`历史消息数: ${log.client.request.historyCount}`);
      lines.push('');
    }

    // Chunk 统计
    lines.push('--- SSE Chunk 统计 ---');
    lines.push(`总计: ${log.client.chunks.total} 个`);
    if (log.client.chunks.typeSummary) {
      Object.entries(log.client.chunks.typeSummary).forEach(([type, count]) => {
        lines.push(`  ${type}: ${count}`);
      });
    }
    lines.push('');

    // 渲染状态
    if (log.client.renderStates.length > 0) {
      lines.push('--- 渲染状态记录 ---');
      log.client.renderStates.forEach((record: any, i: number) => {
        const time = new Date(record.timestamp).toISOString().substring(11, 23);
        lines.push(`[${time}] #${i + 1}: running=${record.state.isRunning}, messages=${record.state.messageCount}, tools=${record.state.toolCallCount}`);
      });
      lines.push('');
    }

    // 错误
    if (log.client.errors.length > 0) {
      lines.push('--- 错误记录 ---');
      log.client.errors.forEach((err: any) => {
        const time = new Date(err.timestamp).toISOString();
        lines.push(`[${time}] ${err.error}`);
        if (err.stack) {
          lines.push(`  Stack: ${err.stack.split('\n')[0]}`);
        }
      });
      lines.push('');
    }

    // 后端日志
    if (log.server) {
      lines.push('--- 后端日志 ---');
      if (log.server.environment) {
        lines.push('环境信息:');
        Object.entries(log.server.environment).forEach(([key, value]) => {
          if (key !== 'error') {
            lines.push(`  ${key}: ${value}`);
          }
        });
      }
      if (log.server.model_calls && log.server.model_calls.length > 0) {
        lines.push(`模型调用: ${log.server.model_calls.length} 次`);
        log.server.model_calls.forEach((call: any) => {
          lines.push(`  - ${call.model_name} (${call.provider})`);
        });
      }
      if (log.server.tool_calls && log.server.tool_calls.length > 0) {
        lines.push(`工具调用: ${log.server.tool_calls.length} 次`);
        log.server.tool_calls.forEach((call: any) => {
          lines.push(`  - ${call.tool_name} (${call.tool_type})`);
        });
      }
      if (log.server.errors && log.server.errors.length > 0) {
        lines.push(`错误: ${log.server.errors.length} 个`);
      }
      lines.push('');
    }

    lines.push('='.repeat(60));
    lines.push('--- 完整日志结束 ---');

    return lines.join('\n');
  }

  // ========================================================================
  // 辅助方法
  // ========================================================================

  private getChunkTypeSummary(): Record<string, number> {
    const summary: Record<string, number> = {};
    for (const chunk of this.chunks) {
      const type = chunk.type || 'unknown';
      summary[type] = (summary[type] || 0) + 1;
    }
    return summary;
  }

  getDuration(): number {
    return Date.now() - this.startTime;
  }
}

// ============================================================================
// 全局日志存储（用于调试）
// ============================================================================

const globalLogStore = new Map<string, DebugLogger>();

export function getGlobalLogger(requestId: string): DebugLogger | undefined {
  return globalLogStore.get(requestId);
}

export function setGlobalLogger(logger: DebugLogger): void {
  globalLogStore.set(logger.getRequestId(), logger);
}

export function removeGlobalLogger(requestId: string): void {
  globalLogStore.delete(requestId);
}

export function listGlobalLoggers(): Array<{ requestId: string; duration: number }> {
  return Array.from(globalLogStore.values()).map(logger => ({
    requestId: logger.getRequestId(),
    duration: logger.getDuration(),
  }));
}

// 清理超过 1 小时的日志
export function cleanupOldLoggers(): number {
  const cutoff = Date.now() - 3600000; // 1 hour
  let cleaned = 0;
  for (const [requestId, logger] of globalLogStore.entries()) {
    if (logger.getDuration() > cutoff) {
      globalLogStore.delete(requestId);
      cleaned++;
    }
  }
  return cleaned;
}
