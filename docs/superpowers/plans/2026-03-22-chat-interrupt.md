# Chat Interrupt Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a stop button to the chat interface that allows users to interrupt LLM generation and tool calls.

**Architecture:** Minimal changes to `AgentChat.tsx` leveraging existing `AbortController` infrastructure. The send button transforms into a red stop button during streaming.

**Tech Stack:** React, TypeScript, lucide-react icons

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `frontend/src/components/AgentChat.tsx` | Modify | Add stop button functionality |

---

## Task 1: Add Square Icon Import

**Files:**
- Modify: `frontend/src/components/AgentChat.tsx:66`

- [ ] **Step 1: Add Square to lucide-react import**

Find line 66 with the existing import and add `Square` to the end:

```typescript
import { ChevronDown, ChevronRight, Wrench, Lightbulb, Loader2, Clock, Zap, Hash, Paperclip, FileText, FileSpreadsheet, Image, File, X, Database, Square } from 'lucide-react';
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors related to Square import

---

## Task 2: Add handleStop Function

**Files:**
- Modify: `frontend/src/components/AgentChat.tsx` (after `handleKeyDown` function, around line 1209)

- [ ] **Step 1: Add handleStop callback function**

Insert after `handleKeyDown` function (around line 1209):

```typescript
const handleStop = useCallback(() => {
  if (abortControllerRef.current) {
    abortControllerRef.current.abort();
    abortControllerRef.current = null;
  }
}, []);
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

---

## Task 3: Modify AbortError Handling

**Files:**
- Modify: `frontend/src/components/AgentChat.tsx:1168-1178`

- [ ] **Step 1: Update AbortError handler to remove assistant message**

Find the existing `if (error instanceof Error && error.name === 'AbortError')` block (around line 1168) and replace:

**Before:**
```typescript
if (error instanceof Error && error.name === 'AbortError') {
  addLog('INFO', locale === "zh" ? '请求被取消' : 'Request cancelled');
} else {
```

**After:**
```typescript
if (error instanceof Error && error.name === 'AbortError') {
  addLog('INFO', locale === "zh" ? '请求被取消' : 'Request cancelled');
  // 移除空的 assistant 消息
  setMessages((prev) => prev.filter(msg => msg.id !== assistantMsgId));
  messagesRef.current = messagesRef.current.filter(msg => msg.id !== assistantMsgId);
} else {
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

---

## Task 4: Replace Send Button with Conditional Stop/Send Button

**Files:**
- Modify: `frontend/src/components/AgentChat.tsx:1738-1745`

- [ ] **Step 1: Replace the send button with conditional button**

Find the send button (around lines 1738-1745) and replace:

**Before:**
```tsx
<button
  type="button"
  onClick={handleSend}
  disabled={isRunning || isUploading || (!inputValue.trim() && pendingFiles.length === 0 && fileContext.file_ids.length === 0)}
  className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
>
  {t("send")}
</button>
```

**After:**
```tsx
<button
  type="button"
  onClick={isRunning ? handleStop : handleSend}
  disabled={!isRunning && (isUploading || (!inputValue.trim() && pendingFiles.length === 0 && fileContext.file_ids.length === 0))}
  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
    isRunning
      ? 'bg-red-500 hover:bg-red-600 text-white'
      : 'bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed'
  }`}
>
  {isRunning ? <Square className="w-4 h-4" /> : t("send")}
</button>
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

---

## Task 5: Manual Testing

- [ ] **Step 1: Start the development servers**

Run: `./start.sh --skip-deps`
Wait for both frontend (20880) and backend (20881) to start.

- [ ] **Step 2: Test basic stop functionality**

1. Open http://localhost:20880 in browser
2. Select an agent
3. Type a message and click send
4. While streaming, verify:
   - Send button turns red with Square icon
   - Click the red button
   - Streaming stops immediately
   - Assistant message is removed (only user message remains)
   - Button returns to blue "发送"

- [ ] **Step 3: Test stop during thinking phase**

1. Send a complex query that triggers thinking
2. While thinking content is streaming, click stop
3. Verify: All content discarded, assistant message removed

- [ ] **Step 4: Test stop during tool call**

1. Send a message that triggers tool calls (e.g., upload a file and ask to process it)
2. While tool is executing, click stop
3. Verify: Tool execution interrupted, no error shown, assistant message removed

- [ ] **Step 5: Stop services**

Run: `./stop.sh`

---

## Task 6: Commit Changes

- [ ] **Step 1: Stage and commit**

```bash
git add frontend/src/components/AgentChat.tsx
git commit -m "feat(chat): add stop button to interrupt LLM generation

- Add handleStop callback to abort fetch request
- Transform send button to stop button during streaming
- Remove assistant message when user stops generation
- Red button with Square icon indicates stop action

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Summary

| Task | Description | Estimated Time |
|------|-------------|----------------|
| 1 | Add Square icon import | 1 min |
| 2 | Add handleStop function | 2 min |
| 3 | Modify AbortError handling | 2 min |
| 4 | Replace send button | 3 min |
| 5 | Manual testing | 10 min |
| 6 | Commit | 1 min |

**Total: ~20 minutes**
