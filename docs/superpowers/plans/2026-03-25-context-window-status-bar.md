# Context Window Status Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real-time context window usage indicator to the agent debugging conversation interface, displaying tokens in K units with color-coded status.

**Architecture:** Backend captures LLM token usage and exposes via SSE metrics event. Frontend renders a status bar component above the message list, updating after each AI message completes.

**Tech Stack:** Python (FastAPI, LangChain), TypeScript (React, Next.js), Tailwind CSS

---

## File Structure

| File | Change Type | Responsibility |
|------|-------------|----------------|
| `src/model_config.py` | Create | Model context window size presets and lookup |
| `src/agent_engine.py` | Modify | Capture LLM token usage, yield in final event |
| `backend.py` | Modify | Extract token info from agent, extend metrics event |
| `frontend/src/types/index.ts` | Modify | Extend MetricsEvent interface |
| `frontend/src/components/ContextStatusBar.tsx` | Create | Status bar UI component |
| `frontend/src/components/AgentChat.tsx` | Modify | Integrate status bar, handle metrics update |

---

## Task 1: Create Model Context Window Configuration

**Files:**
- Create: `src/model_config.py`

- [ ] **Step 1: Write the model config module**

```python
"""
模型上下文窗口配置

定义各模型服务提供商的上下文窗口大小预设值。
优先级：用户配置 > API 返回 > 预设值 > 默认值
"""

from typing import Optional


# 模型上下文窗口大小预设（单位：tokens）
MODEL_CONTEXT_WINDOWS = {
    # OpenAI
    'gpt-4': 8192,
    'gpt-4-32k': 32768,
    'gpt-4-turbo': 128000,
    'gpt-4o': 128000,
    'gpt-4o-mini': 128000,
    'gpt-3.5-turbo': 16385,
    'o1': 200000,
    'o1-mini': 128000,
    'o3-mini': 200000,

    # Anthropic
    'claude-3-opus': 200000,
    'claude-3-sonnet': 200000,
    'claude-3-haiku': 200000,
    'claude-3.5-sonnet': 200000,
    'claude-3.5-haiku': 200000,
    'claude-3.7-sonnet': 200000,

    # 智谱 AI
    'glm-4': 128000,
    'glm-4-plus': 128000,
    'glm-4-air': 128000,
    'glm-4-flash': 128000,
    'glm-4-long': 1024000,
    'glm-4v': 8192,

    # 阿里百炼
    'qwen-turbo': 8192,
    'qwen-plus': 32768,
    'qwen-max': 32768,
    'qwen-long': 10000000,

    # DeepSeek
    'deepseek-chat': 64000,
    'deepseek-reasoner': 64000,

    # 本地模型默认值
    'llama': 4096,
    'mistral': 32768,
    'qwen': 8192,

    # 默认回退值
    'default': 4096,
}


def get_context_window_size(
    model_name: str,
    user_override: Optional[int] = None
) -> int:
    """
    获取模型的上下文窗口大小。

    优先级：
    1. 用户配置的覆盖值（user_override）
    2. 预设模型配置（模糊匹配模型名）
    3. 默认值（4096）

    Args:
        model_name: 模型名称（如 "gpt-4o", "glm-4-plus"）
        user_override: 用户配置的覆盖值（可选）

    Returns:
        上下文窗口大小（tokens）
    """
    if user_override and user_override > 0:
        return user_override

    if not model_name:
        return MODEL_CONTEXT_WINDOWS['default']

    # 标准化模型名（小写，移除常见前缀）
    normalized = model_name.lower()

    # 尝试精确匹配或部分匹配
    for key, value in MODEL_CONTEXT_WINDOWS.items():
        if key == 'default':
            continue
        if key in normalized or normalized in key:
            return value

    return MODEL_CONTEXT_WINDOWS['default']


def get_all_model_presets() -> dict:
    """返回所有模型预设配置（用于调试或展示）"""
    return MODEL_CONTEXT_WINDOWS.copy()
```

- [ ] **Step 2: Commit**

```bash
git add src/model_config.py
git commit -m "feat: add model context window configuration module"
```

---

## Task 2: Capture LLM Token Usage in AgentEngine

**Files:**
- Modify: `src/agent_engine.py`

- [ ] **Step 1: Add token tracking fields to AgentEngine class**

在 `AgentEngine.__init__` 方法中添加 token 追踪字段。找到 `__init__` 方法的末尾（约第 100 行附近），在 `_config_ref` 赋值后添加：

```python
        # ====================================================================
        # 【上下文窗口状态栏】Token 追踪
        # ====================================================================
        self._last_input_tokens: int = 0
        self._last_output_tokens: int = 0
```

- [ ] **Step 2: Capture token usage from LLM response**

在 `stream` 方法中，找到 Langfuse LLM Span 结束的位置（约第 2063-2072 行），在 `langfuse_tracer.end_span` 调用之后添加 token 提取逻辑：

```python
            # 【Langfuse 追踪】结束 LLM Span (成功)
            if llm_span_id and is_langfuse_enabled():
                langfuse_tracer.end_span(
                    trace_id=langfuse_trace_id,
                    span_id=llm_span_id,
                    output={
                        "response_length": len(response_content),
                        "response_preview": response_content[:1000] if response_content else ""
                    }
                )

            # ====================================================================
            # 【上下文窗口状态栏】提取 token 使用信息
            # ====================================================================
            # 尝试从流式响应中提取 token 信息
            # 某些模型在流式结束时返回 usage 信息
            try:
                if hasattr(chunk, 'usage_metadata') and chunk.usage_metadata:
                    self._last_input_tokens = getattr(chunk.usage_metadata, 'input_tokens', 0) or 0
                    self._last_output_tokens = getattr(chunk.usage_metadata, 'output_tokens', 0) or 0
            except Exception:
                pass
```

- [ ] **Step 3: Add method to get token usage**

在 `AgentEngine` 类中添加获取 token 使用信息的方法（在类的末尾添加）：

```python
    def get_token_usage(self) -> dict:
        """
        获取最后一次 LLM 调用的 token 使用信息。

        Returns:
            dict: 包含 input_tokens 和 output_tokens 的字典
        """
        return {
            "input_tokens": self._last_input_tokens,
            "output_tokens": self._last_output_tokens
        }
```

- [ ] **Step 4: Commit**

```bash
git add src/agent_engine.py
git commit -m "feat(agent-engine): add token usage tracking for context status bar"
```

---

## Task 3: Extend Backend Metrics Event

**Files:**
- Modify: `backend.py`

- [ ] **Step 1: Import model config module**

在 `backend.py` 文件顶部的导入区域（约第 30-50 行），添加导入：

```python
from src.model_config import get_context_window_size
```

- [ ] **Step 2: Extend metrics event with token fields**

找到 `finally` 块中构建 `metrics` 字典的位置（约第 982-989 行），修改为：

```python
            finally:
                # ============================================================================
                # 【AC130-202603150000】确保发送性能指标
                # ============================================================================
                end_time = time.time()
                total_duration = end_time - start_time
                first_token_latency = (first_token_time - start_time) if first_token_time else total_duration

                # ====================================================================
                # 【上下文窗口状态栏】获取 token 使用信息
                # ====================================================================
                input_tokens = 0
                output_tokens = 0
                context_window = 0

                try:
                    if instance and hasattr(instance, 'get_token_usage'):
                        token_usage = instance.get_token_usage()
                        input_tokens = token_usage.get('input_tokens', 0)
                        output_tokens = token_usage.get('output_tokens', 0)

                    # 获取模型名称和上下文窗口大小
                    if instance and hasattr(instance, 'config') and instance.config:
                        model_service = getattr(instance.config, 'model_service', None)
                        if model_service:
                            context_window = get_context_window_size(model_service)
                except Exception as e:
                    print(f"[WARN] 获取 token 使用信息失败: {e}")

                metrics = {
                    'type': 'metrics',
                    'first_token_latency': round(first_token_latency * 1000, 0),  # 毫秒
                    'total_tokens': token_count,
                    'total_duration': round(total_duration * 1000, 0),  # 毫秒
                    # 【上下文窗口状态栏】新增字段
                    'input_tokens': input_tokens,
                    'output_tokens': output_tokens,
                    'context_window': context_window,
                }
                logger.log_event("metrics", metrics)
                yield f"data: {json.dumps(metrics, ensure_ascii=False)}\n\n"
```

- [ ] **Step 3: Commit**

```bash
git add backend.py
git commit -m "feat(backend): extend metrics event with token and context window info"
```

---

## Task 4: Extend Frontend Types

**Files:**
- Modify: `frontend/src/types/index.ts`

- [ ] **Step 1: Extend MetricsEvent interface**

找到 `MetricsEvent` 接口定义（约第 330-335 行），修改为：

```typescript
/**
 * 性能指标事件
 */
export interface MetricsEvent extends StreamEvent {
  type: 'metrics';
  first_token_latency: number;
  total_tokens: number;
  total_duration: number;
  // 上下文窗口状态栏字段
  input_tokens?: number;
  output_tokens?: number;
  context_window?: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/types/index.ts
git commit -m "feat(types): extend MetricsEvent with context window fields"
```

---

## Task 5: Create ContextStatusBar Component

**Files:**
- Create: `frontend/src/components/ContextStatusBar.tsx`

- [ ] **Step 1: Write the ContextStatusBar component**

```typescript
/**
 * 上下文窗口状态栏组件
 *
 * 显示当前 LLM 上下文窗口使用情况：
 * - 格式：X.XK / X.XK（已用 / 总量）
 * - 颜色指示：绿色 <50%，黄色 50-80%，红色 >80%
 */
'use client';

import { useMemo } from 'react';

interface ContextStatusBarProps {
  inputTokens: number;
  outputTokens: number;
  contextWindow: number;
}

export function ContextStatusBar({
  inputTokens,
  outputTokens,
  contextWindow,
}: ContextStatusBarProps) {
  const status = useMemo(() => {
    // 处理无效数据
    if (!contextWindow || contextWindow === 0) {
      return {
        display: '--K / --K',
        colorClass: 'text-gray-400',
        percent: 0,
        hasData: false,
      };
    }

    const usedTokens = inputTokens + outputTokens;
    const percent = (usedTokens / contextWindow) * 100;

    // 格式化为 K 单位
    const formatK = (n: number): string => {
      if (n === 0) return '0K';
      const k = n / 1000;
      // 如果是整数，不显示小数点
      return k % 1 === 0 ? `${k}K` : `${k.toFixed(1)}K`;
    };

    // 确定颜色
    let colorClass: string;
    if (percent < 50) {
      colorClass = 'text-green-500';
    } else if (percent < 80) {
      colorClass = 'text-yellow-500';
    } else {
      colorClass = 'text-red-500';
    }

    return {
      display: `${formatK(usedTokens)} / ${formatK(contextWindow)}`,
      colorClass,
      percent,
      hasData: true,
    };
  }, [inputTokens, outputTokens, contextWindow]);

  return (
    <div
      className="flex items-center gap-2 px-4 py-1.5 border-b bg-gray-50/50 text-xs"
      title={
        status.hasData
          ? `上下文使用: ${status.percent.toFixed(1)}%`
          : '当前模型不支持 token 统计'
      }
    >
      <span className={status.colorClass}>●</span>
      <span className="text-gray-600">{status.display}</span>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ContextStatusBar.tsx
git commit -m "feat(ui): add ContextStatusBar component for token usage display"
```

---

## Task 6: Integrate Status Bar into AgentChat

**Files:**
- Modify: `frontend/src/components/AgentChat.tsx`

- [ ] **Step 1: Import ContextStatusBar component**

在文件顶部的导入区域（约第 60-70 行），添加导入：

```typescript
import { ContextStatusBar } from '@/components/ContextStatusBar';
```

- [ ] **Step 2: Add state for context metrics**

在 `AgentChat` 组件内部，找到 state 定义区域（约第 150-200 行），添加新的 state：

```typescript
  // 上下文窗口状态栏
  const [contextMetrics, setContextMetrics] = useState({
    inputTokens: 0,
    outputTokens: 0,
    contextWindow: 0,
  });
```

- [ ] **Step 3: Update metrics handler**

找到处理 `metrics` 事件的代码块（约第 919-929 行），在 `setMessages` 调用之前添加：

```typescript
              } else if (data.type === 'metrics') {
                // 更新上下文窗口状态栏
                setContextMetrics({
                  inputTokens: data.input_tokens ?? 0,
                  outputTokens: data.output_tokens ?? 0,
                  contextWindow: data.context_window ?? 0,
                });
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
```

- [ ] **Step 4: Render ContextStatusBar in component**

找到组件的 return 语句，在消息列表上方添加状态栏。找到类似以下的 JSX 结构（约第 1800 行附近）：

```typescript
    <div className="flex flex-col h-full bg-white">
```

修改为在消息列表容器开始处添加状态栏：

```typescript
    <div className="flex flex-col h-full bg-white">
      {/* 上下文窗口状态栏 */}
      <ContextStatusBar
        inputTokens={contextMetrics.inputTokens}
        outputTokens={contextMetrics.outputTokens}
        contextWindow={contextMetrics.contextWindow}
      />
      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
```

注意：实际位置可能因代码结构而异，需要找到消息滚动容器的开始位置。

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/AgentChat.tsx
git commit -m "feat(chat): integrate ContextStatusBar into AgentChat component"
```

---

## Task 7: Manual Testing & Verification

- [ ] **Step 1: Clear frontend cache and restart services**

```bash
rm -rf frontend/.next && ./stop.sh && ./start.sh --skip-deps
```

- [ ] **Step 2: Verify status bar appears**

1. Open browser to http://localhost:20880
2. Navigate to an agent's debug conversation
3. Verify status bar appears at top of conversation area
4. Initial state should show `0K / --K` or `0K / 128K` (depending on model)

- [ ] **Step 3: Verify metrics update after message**

1. Send a message to the agent
2. Wait for response to complete
3. Verify status bar updates with token counts
4. Check color changes correctly based on usage

- [ ] **Step 4: Test edge cases**

1. Switch between different models - verify context window size changes
2. Start new conversation - verify counters reset
3. Check tooltip shows percentage on hover

---

## Success Criteria

- [ ] Status bar displays at top of conversation area
- [ ] Format: `X.XK / X.XK` with color indicator dot
- [ ] Colors: Green <50%, Yellow 50-80%, Red >80%
- [ ] Updates after each AI message completes
- [ ] Shows `--K / --K` when token info unavailable
- [ ] Tooltip shows percentage on hover
