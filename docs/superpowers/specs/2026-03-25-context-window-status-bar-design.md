# Context Window Status Bar - Design Document

## Overview

Add a real-time context window usage indicator to the agent debugging conversation interface. The status bar displays remaining/total tokens in K units, helping users understand their context window consumption.

## Requirements

### Functional Requirements

1. Display context window usage in format: `12.5K / 128K`
2. Color-coded indicator based on usage percentage:
   - Green: < 50%
   - Yellow: 50% - 80%
   - Red: > 80%
3. Update after each AI message completes
4. Support different model context window sizes (8K, 32K, 128K, 200K, etc.)

### Non-Functional Requirements

1. Minimal performance impact on streaming
2. Accurate token counts from LLM API
3. Graceful degradation when API doesn't provide token info

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────┐
│  Conversation Area                                  │
│  ┌───────────────────────────────────────────────┐  │
│  │  [ContextStatusBar]  12.5K / 128K  ●          │  │
│  ├───────────────────────────────────────────────┤  │
│  │  Message List...                              │  │
│  │                                               │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Data Flow

```dot
digraph context_status {
    rankdir=LR;
    "User sends message" -> "Backend calls LLM API";
    "Backend calls LLM API" -> "LLM returns usage info";
    "LLM returns usage info" -> "Backend extends metrics event";
    "Backend extends metrics event" -> "Frontend receives SSE";
    "Frontend receives SSE" -> "ContextStatusBar updates";
}
```

## Backend Changes

### File: `backend.py`

Extend the SSE `metrics` event to include token information:

```python
metrics = {
    'type': 'metrics',
    # Existing fields
    'first_token_latency': round(first_token_latency * 1000, 0),
    'total_tokens': token_count,
    'total_duration': round(total_duration * 1000, 0),
    # New fields
    'input_tokens': response.usage.prompt_tokens,      # Input tokens from LLM
    'output_tokens': response.usage.completion_tokens, # Output tokens from LLM
    'context_window': get_context_window_size(model),  # Model context window size
}
```

### File: `src/model_config.py` (New)

Define default context window sizes for supported models:

```python
MODEL_CONTEXT_WINDOWS = {
    # OpenAI
    'gpt-4': 8192,
    'gpt-4-32k': 32768,
    'gpt-4-turbo': 128000,
    'gpt-4o': 128000,
    'gpt-3.5-turbo': 16385,

    # Anthropic
    'claude-3-opus': 200000,
    'claude-3-sonnet': 200000,
    'claude-3-haiku': 200000,

    # Zhipu
    'glm-4': 128000,
    'glm-4-plus': 128000,

    # Default fallback
    'default': 4096,
}

def get_context_window_size(model_name: str, user_override: int = None) -> int:
    """
    Get context window size with priority:
    1. User override (from agent config)
    2. API response (if available)
    3. Preset model config
    4. Default fallback
    """
    if user_override:
        return user_override

    # Try to match model name in presets
    for key, value in MODEL_CONTEXT_WINDOWS.items():
        if key in model_name.lower():
            return value

    return MODEL_CONTEXT_WINDOWS['default']
```

### User Configuration Support

Add `context_window_override` field to agent configuration:

```typescript
// Agent config type extension
interface AgentConfig {
  // ... existing fields
  context_window_override?: number | null;  // User can set custom window size
}
```

Priority order for context window size:
1. User configured value (highest priority, can be deleted to revert)
2. LLM API response
3. Preset model defaults

## Frontend Changes

### File: `frontend/src/components/ContextStatusBar.tsx` (New)

```typescript
interface ContextStatusBarProps {
  inputTokens: number;
  outputTokens: number;
  contextWindow: number;
  isLoading?: boolean;
}

export function ContextStatusBar({
  inputTokens,
  outputTokens,
  contextWindow,
  isLoading
}: ContextStatusBarProps) {
  const usedTokens = inputTokens + outputTokens;
  const usagePercent = (usedTokens / contextWindow) * 100;

  const formatK = (n: number) => {
    if (n === 0) return '0K';
    return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  };

  const getStatusColor = (percent: number) => {
    if (percent < 50) return 'text-green-500';
    if (percent < 80) return 'text-yellow-500';
    return 'text-red-500';
  };

  // Handle missing data
  if (!contextWindow || contextWindow === 0) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 border-b text-sm text-gray-400">
        <span>●</span>
        <span>--K / --K</span>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-2 px-4 py-2 border-b text-sm"
      title={`Context usage: ${usagePercent.toFixed(1)}%`}
    >
      <span className={getStatusColor(usagePercent)}>●</span>
      <span>
        {formatK(usedTokens)} / {formatK(contextWindow)}
      </span>
    </div>
  );
}
```

### File: `frontend/src/components/AgentChat.tsx`

Integrate ContextStatusBar above the message list:

```typescript
// Add state for context metrics
const [contextMetrics, setContextMetrics] = useState({
  inputTokens: 0,
  outputTokens: 0,
  contextWindow: 0,
});

// Update in SSE handler when receiving metrics event
if (data.type === 'metrics') {
  setContextMetrics({
    inputTokens: data.input_tokens ?? 0,
    outputTokens: data.output_tokens ?? 0,
    contextWindow: data.context_window ?? 0,
  });
  // ... existing metrics handling
}

// Render status bar
return (
  <div className="flex flex-col h-full">
    <ContextStatusBar {...contextMetrics} />
    {/* Message list */}
    {/* Input area */}
  </div>
);
```

### File: `frontend/src/types/index.ts`

Extend PerformanceMetrics interface:

```typescript
interface PerformanceMetrics {
  first_token_latency: number;
  total_tokens: number;
  total_duration: number;
  // New fields
  input_tokens?: number;
  output_tokens?: number;
  context_window?: number;
}
```

## Edge Cases

### Case 1: LLM API doesn't return token info

- Display: `--K / 128K` with gray color
- Tooltip: "Current model doesn't support token statistics"

### Case 2: No context window configured

- Use preset default (4096) or display `--K / --K`

### Case 3: Token limit approaching (>80%)

- Red color indicator
- Hover tooltip shows percentage and warning

### Case 4: New conversation

- Reset counters to 0
- Display: `0K / 128K`

### Case 5: Loading conversation history

- Initial display: `--K` with loading state
- Update to accurate value after first message

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `backend.py` | Modify | Extend metrics event with token fields |
| `src/model_config.py` | New | Model context window presets |
| `frontend/src/components/ContextStatusBar.tsx` | New | Status bar component |
| `frontend/src/components/AgentChat.tsx` | Modify | Integrate status bar |
| `frontend/src/types/index.ts` | Modify | Extend metrics type |

## Success Criteria

1. Status bar displays at top of conversation area
2. Format: `X.XK / X.XK` with color indicator
3. Colors change correctly at 50% and 80% thresholds
4. Updates after each AI message completes
5. Graceful degradation when token info unavailable
