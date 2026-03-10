"use client";

import {
  ExternalStoreRuntime,
  ExternalStoreAdapter,
  AppendMessage,
  ThreadMessage,
  ThreadUserMessage,
  ThreadAssistantMessage,
} from "@assistant-ui/react";

// 后端 API 基础 URL
const API_BASE = "/api";

// 将后端消息转换为 assistant-ui 格式
function convertToThreadMessages(
  messages: Array<{ role: string; content: string }>
): ThreadMessage[] {
  return messages.map((msg, index) => {
    if (msg.role === "user") {
      return {
        id: `msg-${index}`,
        role: "user",
        content: [{ type: "text", text: msg.content }],
        createdAt: new Date(),
      } as ThreadUserMessage;
    } else {
      return {
        id: `msg-${index}`,
        role: "assistant",
        content: [{ type: "text", text: msg.content }],
        createdAt: new Date(),
      } as ThreadAssistantMessage;
    }
  });
}

// 创建自定义 runtime
export function createAssistantRuntime(agentName: string) {
  const messages: Array<{ role: string; content: string }> = [];
  let isRunning = false;
  let abortController: AbortController | null = null;

  const adapter: ExternalStoreAdapter = {
    // 获取当前消息列表
    async getMessages() {
      return convertToThreadMessages(messages);
    },

    // 获取当前状态
    async getRunningState() {
      return isRunning ? { status: "running" } : { status: "idle" };
    },

    // 发送消息
    async sendMessage(message: AppendMessage) {
      const userContent =
        message.content[0]?.type === "text" ? message.content[0].text : "";

      // 添加用户消息
      messages.push({ role: "user", content: userContent });
      isRunning = true;

      // 通知 UI 更新
      adapter.notify?.();

      abortController = new AbortController();

      try {
        // 调用后端流式 API
        const res = await fetch(`${API_BASE}/agents/${agentName}/chat/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: userContent }),
          signal: abortController.signal,
        });

        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error("No reader available");
        }

        // 添加空的助手消息用于流式更新
        messages.push({ role: "assistant", content: "" });

        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.content) {
                  // 追加内容到助手消息
                  messages[messages.length - 1].content += data.content;
                  // 通知 UI 更新
                  adapter.notify?.();
                }
                if (data.error) {
                  messages[messages.length - 1] = {
                    role: "assistant",
                    content: `错误: ${data.error}`,
                  };
                  adapter.notify?.();
                }
              } catch {
                // 忽略解析错误
              }
            }
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('请求已取消');
        } else {
          console.error("Chat error:", error);
          messages.push({
            role: "assistant",
            content: "网络错误，请重试",
          });
        }
      } finally {
        isRunning = false;
        abortController = null;
        adapter.notify?.();
      }
    },

    // 取消当前请求
    async cancel() {
      if (abortController) {
        abortController.abort();
      }
    },
  };

  return new ExternalStoreRuntime(adapter);
}
