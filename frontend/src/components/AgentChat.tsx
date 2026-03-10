/**
 * ============================================================================
 * 【流式输出前端渲染组件 - 谨慎修改】
 *
 * 此组件是调试对话的核心 UI，负责：
 * 1. 发送流式请求到 /stream/agents/{name}/chat
 * 2. 解析 SSE (Server-Sent Events) 数据
 * 3. 实时渲染思考过程、工具调用、最终回答
 * 4. 实现打字机效果
 *
 * 关键技术：
 * 1. ReadableStream API - 逐块读取 SSE 数据
 * 2. flushSync - 强制 React 同步渲染，确保打字机效果
 * 3. useRef 存储流式内容 - 避免频繁触发重渲染
 *
 * ⚠️ 修改此文件可能影响：
 * - 打字机效果的流畅性
 * - 思考过程的实时更新
 * - 工具调用的正确展示
 * - 性能指标的显示
 *
 * 相关文件：
 * - backend.py: chat_stream() - 后端 SSE 端点
 * - src/agent_engine.py: stream() - 事件生成
 * - frontend/src/app/stream/agents/[name]/chat/route.ts - 流式代理
 * ============================================================================
 */
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { flushSync } from 'react-dom';  // 【关键】flushSync 用于强制同步渲染
import { useLocale } from '@/lib/LocaleContext';
import { ChevronDown, ChevronRight, Wrench, Lightbulb, Loader2, Clock, Zap, Hash } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const API_BASE = '/api';

// 【流式输出关键】流式请求使用专用路径，绕过 rewrites 代理
// 这样可以避免 Next.js 代理缓冲导致的流式输出失效
const getStreamingUrl = () => {
  return '/stream';
};

// 本地日志存储
const localLogs: string[] = [];

const addLog = (type: string, message: string, details?: any) => {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${type}] ${message}${details ? '\n  ' + JSON.stringify(details, null, 2).replace(/\n/g, '\n  ') : ''}`;
  localLogs.push(logEntry);
  console.log(logEntry);
};

// 只在关键点记录日志，避免过多
const addChunkLog = (chunkNum: number, totalBytes: number, preview: string) => {
  // 每10个chunk记录一次，或最后一个chunk
  if (chunkNum % 10 === 0) {
    addLog('DEBUG', `已接收 ${chunkNum} 个数据块`, { totalBytes, preview: preview.substring(0, 50) });
  }
};

interface ToolCall {
  name: string;
  call_id?: string;  // 唯一标识符，用于区分同名工具的多次调用
  service?: string;  // 来源服务名
  args: Record<string, any>;
  result?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  // 思考过程相关
  thinking?: string;
  toolCalls?: ToolCall[];
  isThinkingExpanded?: boolean;
  // 性能指标
  metrics?: PerformanceMetrics;
  // 已加载的技能
  loadedSkills?: string[];
}

interface PerformanceMetrics {
  first_token_latency: number;  // 首 token 时延（毫秒）
  total_tokens: number;         // 总 token 数
  total_duration: number;       // 整体耗时（毫秒）
}

interface AgentChatProps {
  agentName: string;
  shortTermMemory?: number;
}

export function AgentChat({ agentName, shortTermMemory = 5 }: AgentChatProps) {
  const { locale, t } = useLocale();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [hasError, setHasError] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  // 使用 ref 存储流式内容，避免频繁触发重渲染
  const streamingContentRef = useRef<string>("");
  const streamingThinkingRef = useRef<string>("");
  const streamingToolCallsRef = useRef<ToolCall[]>([]);
  const streamingLoadedSkillsRef = useRef<string[]>([]);

  // 自动滚动到底部
  const scrollToBottom = useCallback(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, []);

  // 当消息变化时自动滚动
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const downloadLogs = async () => {
    const clientLog = locale === "zh"
      ? `=== 客户端日志 ===\n${localLogs.join('\n\n')}`
      : `=== Client Logs ===\n${localLogs.join('\n\n')}`;

    // 尝试获取服务端日志
    let serverLog = locale === "zh"
      ? '=== 服务端日志 ===\n(无法获取)'
      : '=== Server Logs ===\n(Unavailable)';
    try {
      const res = await fetch('/api/../logs/stream-debug.txt');
      if (res.ok) {
        serverLog = locale === "zh"
          ? `=== 服务端日志 ===\n${await res.text()}`
          : `=== Server Logs ===\n${await res.text()}`;
      }
    } catch (e) {}

    const allLogs = `${clientLog}\n\n${serverLog}`;

    const blob = new Blob([allLogs], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-debug-log-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isRunning) return;

    const userContent = inputValue.trim();
    setInputValue('');
    setHasError(false);

    const streamingUrl = getStreamingUrl();
    const requestUrl = `${streamingUrl}/agents/${agentName}/chat`;

    addLog('INFO', locale === "zh" ? '开始发送消息' : 'Start sending message', {
      agentName,
      message: userContent,
      streamingUrl,
      requestUrl,
      hostname: window.location.hostname,
      port: window.location.port,
      userAgent: navigator.userAgent
    });

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: userContent,
    };

    const assistantMsgId = `msg-${Date.now() + 1}`;
    setMessages((prev) => [...prev, userMsg, {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      thinking: '',
      toolCalls: [],
      isThinkingExpanded: false,
      loadedSkills: []
    }]);
    setIsRunning(true);
    streamingContentRef.current = "";
    streamingThinkingRef.current = "";
    streamingToolCallsRef.current = [];
    streamingLoadedSkillsRef.current = [];

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // 构建历史消息（根据 shortTermMemory 截取）
    const historyMessages = messages.slice(-(shortTermMemory * 2)).map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    try {
      addLog('INFO', locale === "zh" ? '准备发起 fetch 请求' : 'Preparing fetch request', { url: requestUrl, historyCount: historyMessages.length });

      const res = await fetch(requestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userContent,
          history: historyMessages
        }),
        signal: abortController.signal,
      });

      addLog('INFO', locale === "zh" ? 'fetch 请求完成' : 'Fetch request completed', { status: res.status, ok: res.ok, contentType: res.headers.get('content-type') });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      // 【流式输出核心】使用 ReadableStream API 读取 SSE 数据
      // 这是实现打字机效果的关键：逐块读取，而不是等待完整响应
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No reader available');
      }

      addLog('INFO', locale === "zh" ? '开始读取流' : 'Start reading stream', { hasReader: !!reader });

      let buffer = '';
      let chunkCount = 0;
      let totalBytes = 0;

      // 【流式输出核心】循环读取数据块，直到流结束
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          addLog('INFO', locale === "zh" ? '流读取完成' : 'Stream reading completed', { chunkCount, totalBytes });
          break;
        }

        chunkCount++;
        totalBytes += value?.length || 0;

        // 【关键】使用 stream: true 选项，确保跨 chunk 的 UTF-8 字符能正确解码
        const chunk = decoder.decode(value, { stream: true });
        addChunkLog(chunkCount, totalBytes, chunk);

        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';  // 保留最后一个不完整的行

        // 【流式输出核心】解析 SSE 数据
        // SSE 格式: data: {"type": "...", "content": "..."}\n
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'thinking') {
                // 思考过程
                streamingThinkingRef.current = data.content;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? { ...msg, thinking: data.content }
                      : msg
                  )
                );
              } else if (data.type === 'tool_call') {
                // 工具调用开始
                const newToolCall: ToolCall = {
                  name: data.name,
                  call_id: data.call_id,  // 保存唯一标识符
                  service: data.service,
                  args: data.args || {}
                };
                streamingToolCallsRef.current = [...streamingToolCallsRef.current, newToolCall];
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? { ...msg, toolCalls: [...(msg.toolCalls || []), newToolCall] }
                      : msg
                  )
                );
              } else if (data.type === 'tool_result') {
                // 工具调用结果 - 使用 call_id 匹配（如果有），否则回退到 name
                const toolCallId = data.call_id;
                const toolName = data.name;
                const toolResult = data.result;

                streamingToolCallsRef.current = streamingToolCallsRef.current.map(tc => {
                  // 优先使用 call_id 匹配，确保同名工具的多次调用能正确匹配
                  if (toolCallId && tc.call_id === toolCallId) {
                    return { ...tc, result: toolResult };
                  }
                  // 回退：如果没有 call_id，则使用 name 匹配第一个没有结果的
                  if (!toolCallId && tc.name === toolName && !tc.result) {
                    return { ...tc, result: toolResult };
                  }
                  return tc;
                });
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? { ...msg, toolCalls: msg.toolCalls?.map(tc => {
                          // 同样的匹配逻辑
                          if (toolCallId && tc.call_id === toolCallId) {
                            return { ...tc, result: toolResult };
                          }
                          if (!toolCallId && tc.name === toolName && !tc.result) {
                            return { ...tc, result: toolResult };
                          }
                          return tc;
                        }) }
                      : msg
                  )
                );
              } else if (data.type === 'content') {
                // ============================================================
                // 【流式输出核心 - 打字机效果】
                //
                // 这里的实现非常关键：
                // 1. 使用 useRef (streamingContentRef) 累积内容，避免频繁触发重渲染
                // 2. 使用 flushSync 强制 React 同步渲染，确保每次字符都能立即显示
                //
                // ⚠️ 不要修改此处的 flushSync，否则打字机效果会失效！
                // React 默认的批处理会延迟渲染，导致字符不是逐个出现
                // ============================================================
                streamingContentRef.current += data.content;
                flushSync(() => {
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMsgId
                        ? { ...msg, content: streamingContentRef.current }
                        : msg
                    )
                  );
                });
              } else if (data.type === 'metrics') {
                // 性能指标
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? { ...msg, metrics: {
                          first_token_latency: data.first_token_latency,
                          total_tokens: data.total_tokens,
                          total_duration: data.total_duration
                        }}
                      : msg
                  )
                );
              } else if (data.type === 'skill_loading') {
                // 技能加载中
                const skillName = data.skill_name;
                streamingThinkingRef.current = `正在加载技能: ${skillName}...`;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? { ...msg, thinking: streamingThinkingRef.current }
                      : msg
                  )
                );
              } else if (data.type === 'skill_loaded') {
                // 技能加载完成
                const skillName = data.skill_name;
                const success = data.success;
                if (success && !streamingLoadedSkillsRef.current.includes(skillName)) {
                  streamingLoadedSkillsRef.current = [...streamingLoadedSkillsRef.current, skillName];
                }
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? {
                          ...msg,
                          loadedSkills: [...(msg.loadedSkills || []), ...(success ? [skillName] : [])],
                          thinking: success ? `已加载技能: ${skillName}` : `加载技能失败: ${skillName}`
                        }
                      : msg
                  )
                );
              } else if (data.content) {
                // 兼容旧格式
                streamingContentRef.current += data.content;
                flushSync(() => {
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMsgId
                        ? { ...msg, content: streamingContentRef.current }
                        : msg
                    )
                  );
                });
              }

              const errorPrefix = locale === "zh" ? '错误: ' : 'Error: ';
              if (data.error) {
                streamingContentRef.current = `${errorPrefix}${data.error}`;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? { ...msg, content: streamingContentRef.current }
                      : msg
                  )
                );
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
        // 滚动到底部
        scrollToBottom();
      }

      addLog('INFO', locale === "zh" ? '流式响应完成' : 'Stream response completed', { contentLength: streamingContentRef.current.length, chunkCount, totalBytes });

    } catch (error) {
      setHasError(true);

      const errorDetails = error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
        requestUrl,
        cause: (error as any).cause
      } : { error: String(error), requestUrl };

      addLog('ERROR', locale === "zh" ? 'fetch 请求失败' : 'Fetch request failed', errorDetails);

      const networkError = locale === "zh" ? '网络错误，请重试' : 'Network error, please retry';
      if (error instanceof Error && error.name === 'AbortError') {
        addLog('INFO', locale === "zh" ? '请求被取消' : 'Request cancelled');
      } else {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? { ...msg, content: networkError }
              : msg
          )
        );
      }
    } finally {
      setIsRunning(false);
      abortControllerRef.current = null;
    }
  }, [inputValue, isRunning, agentName, locale, messages, shortTermMemory, scrollToBottom, t]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleThinkingExpand = (msgId: string) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === msgId
          ? { ...msg, isThinkingExpanded: !msg.isThinkingExpanded }
          : msg
      )
    );
  };

  // 渲染思考过程区域
  const renderThinkingSection = (msg: ChatMessage) => {
    const hasThinking = msg.thinking || (msg.toolCalls && msg.toolCalls.length > 0) || (msg.loadedSkills && msg.loadedSkills.length > 0);
    if (!hasThinking) return null;

    // 如果正在运行且有思考内容或工具调用，自动展开
    const isExpanded = msg.isThinkingExpanded || (isRunning && (msg.thinking || (msg.toolCalls && msg.toolCalls.length > 0)));

    return (
      <div className="border-b border-white/10">
        {/* 标题栏 - 可点击展开/收起 */}
        <button
          type="button"
          onClick={() => toggleThinkingExpand(msg.id)}
          className="w-full px-4 py-2 flex items-center gap-2 bg-white/5 hover:bg-white/10 transition-colors text-left"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
          <Lightbulb className="w-4 h-4 text-yellow-500" />
          <span className="text-xs text-gray-400 font-medium">
            {t("thinkingProcess")}
          </span>
          {/* 流式输出指示器 */}
          {isRunning && msg.thinking && !msg.content && (
            <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full animate-pulse ml-1"></span>
          )}
          {!isExpanded && msg.toolCalls && msg.toolCalls.length > 0 && (
            <span className="text-xs text-gray-500 ml-auto">
              {msg.toolCalls.length} {t("toolCallsCount")}
            </span>
          )}
        </button>

        {/* 展开内容 */}
        {isExpanded && (
          <div className="px-4 py-2 bg-white/5 space-y-2">
            {/* 思考内容 - 流式输出效果 */}
            {msg.thinking && (
              <div className="text-xs text-gray-400 italic whitespace-pre-wrap">
                {msg.thinking}
                {/* 流式输出时的光标效果 */}
                {isRunning && !msg.content && (
                  <span className="inline-block w-1.5 h-3 bg-yellow-500 ml-0.5 animate-pulse"></span>
                )}
              </div>
            )}

            {/* 已加载技能列表 */}
            {msg.loadedSkills && msg.loadedSkills.length > 0 && (
              <div className="border-l-2 border-purple-500/50 pl-2 py-1">
                <div className="flex items-center gap-1 text-xs mb-1">
                  <span className="text-purple-400 font-medium">
                    {locale === "zh" ? "已加载技能" : "Loaded Skills"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {msg.loadedSkills.map((skill, idx) => (
                    <span key={idx} className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 工具调用列表 - 默认只显示名称，展开后显示详情 */}
            {msg.toolCalls && msg.toolCalls.map((tc, idx) => (
              <div key={idx} className="border-l-2 border-blue-500/50 pl-2 py-1">
                <div className="flex items-center gap-1 text-xs">
                  <Wrench className="w-3 h-3 text-blue-400" />
                  <span className="text-blue-400 font-mono">{tc.name}</span>
                  {tc.service && (
                    <span className="text-gray-500 text-[10px] ml-1">({tc.service})</span>
                  )}
                  {tc.result && (
                    <span className="text-green-400 text-[10px] ml-1">✓</span>
                  )}
                  {/* 工具执行中指示器 */}
                  {!tc.result && isRunning && (
                    <Loader2 className="w-3 h-3 text-blue-400 animate-spin ml-1" />
                  )}
                </div>
                {/* 展开后才显示输入输出详情 */}
                {Object.keys(tc.args).length > 0 && (
                  <div className="text-xs text-gray-500 mt-1 font-mono bg-black/20 px-2 py-1 rounded">
                    {t("input")}: {JSON.stringify(tc.args)}
                  </div>
                )}
                {tc.result && (
                  <div className="text-xs text-green-400 mt-1 font-mono bg-black/20 px-2 py-1 rounded max-h-32 overflow-auto whitespace-pre-wrap">
                    {tc.result}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-black/20">
      {/* 消息列表 */}
      <div ref={messagesContainerRef} className="flex-1 overflow-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-sm">{t("sendTestMessage")}</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              {/* 用户消息 */}
              {msg.role === 'user' && (
                <div className="max-w-[85%] bg-blue-500 text-white rounded-2xl rounded-br-md px-4 py-2.5 text-sm whitespace-pre-wrap">
                  {msg.content}
                </div>
              )}

              {/* 助手消息 - 思考过程和回答分开显示 */}
              {msg.role === 'assistant' && (
                <div className="max-w-[85%] bg-white/10 text-gray-300 rounded-2xl rounded-bl-md overflow-hidden">
                  {/* 思考过程区域 - 独立的区块 */}
                  {renderThinkingSection(msg)}

                  {/* 最终回答区域 - 独立的区块，支持 Markdown */}
                  <div className="px-4 py-2.5 text-sm prose prose-invert prose-sm max-w-none">
                    {msg.content ? (
                      <span className="inline">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                        {/* 打字机光标效果 - 流式输出时显示 */}
                        {isRunning && (
                          <span className="inline-block w-1.5 h-4 bg-emerald-400 ml-0.5 animate-pulse align-middle"></span>
                        )}
                      </span>
                    ) : (isRunning && !msg.thinking && (!msg.toolCalls || msg.toolCalls.length === 0) ? (
                      <span className="flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        {t("generating")}
                      </span>
                    ) : '')}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
        {isRunning && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex justify-start">
            <div className="bg-white/10 px-4 py-2.5 rounded-2xl rounded-bl-md">
              <span className="text-gray-400 text-sm animate-pulse">{t("thinking")}</span>
            </div>
          </div>
        )}
      </div>

      {/* 输入框 */}
      <div className="p-4 border-t border-white/10">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("sendMessagePlaceholder")}
            disabled={isRunning}
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={isRunning || !inputValue.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {t("send")}
          </button>
        </div>

        {/* 日志下载按钮 */}
        {localLogs.length > 0 && (
          <button
            type="button"
            onClick={downloadLogs}
            className="mt-3 w-full px-4 py-2 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg text-sm font-medium hover:bg-blue-500/30 transition-colors"
          >
            📥 {t("downloadDebugLog")} ({localLogs.length} {t("logsCount")})
          </button>
        )}

        {/* 性能指标显示 */}
        {(() => {
          const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant' && m.metrics);
          if (lastAssistantMsg?.metrics) {
            const m = lastAssistantMsg.metrics;
            return (
              <div className="mt-3 p-3 bg-white/5 border border-white/10 rounded-lg">
                <div className="text-xs text-gray-500 mb-2 font-medium">
                  {locale === "zh" ? "最近响应性能" : "Last Response Metrics"}
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Zap size={12} className="text-yellow-400" />
                    <span className="text-gray-400">{locale === "zh" ? "首Token" : "First Token"}:</span>
                    <span className="text-yellow-400 font-mono">{m.first_token_latency}ms</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Hash size={12} className="text-blue-400" />
                    <span className="text-gray-400">{locale === "zh" ? "Token数" : "Tokens"}:</span>
                    <span className="text-blue-400 font-mono">{m.total_tokens}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock size={12} className="text-emerald-400" />
                    <span className="text-gray-400">{locale === "zh" ? "总耗时" : "Duration"}:</span>
                    <span className="text-emerald-400 font-mono">{m.total_duration}ms</span>
                  </div>
                </div>
              </div>
            );
          }
          return null;
        })()}

        {isRunning && (
          <div className="text-xs text-gray-500 mt-2 flex items-center gap-1">
            <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            {t("generating")}
          </div>
        )}
      </div>
    </div>
  );
}
