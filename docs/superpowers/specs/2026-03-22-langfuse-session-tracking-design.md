# Langfuse Session Tracking

**Date:** 2026-03-22
**Status:** Draft

## Problem

Langfuse traces are being recorded, but the "Sessions" view is empty. Sessions should group traces by UI conversation (会话).

## Root Cause

The frontend (`AgentChat.tsx`) has `activeConversationId` but doesn't include it in the chat request body. The backend expects `conversation_id` in the request to pass as `session_id` to Langfuse.

## Solution

### Data Flow

```
Frontend                          Backend                    Langfuse
   │                                │                           │
   │ POST /api/agents/{name}/chat   │                           │
   │ {message, history,             │                           │
   │  file_ids,                     │                           │
   │  conversation_id} ────────────>│                           │
   │                                │                           │
   │                                │ if conversation_id:       │
   │                                │   session_id = conv_id    │
   │                                │ else:                     │
   │                                │   session_id = uuid       │
   │                                │                           │
   │                                │ create_trace(             │
   │                                │   session_id=session_id) ─>│
```

### Code Changes

#### 1. Frontend: `frontend/src/components/AgentChat.tsx`

**Location:** Line ~660, the fetch request body

Add `conversation_id` to the request:

```typescript
body: JSON.stringify({
  message: userContent,
  history: historyMessages,
  file_ids: allFileIds,
  conversation_id: activeConversationId || null
}),
```

#### 2. Backend: `backend.py`

**Location:** The `/api/agents/{name}/chat` endpoint

Generate `session_id` when `conversation_id` is missing:

```python
# Generate session_id for Langfuse
langfuse_session_id = req.conversation_id or f"anon-{uuid.uuid4().hex[:8]}"

async for event in instance.chat_stream(
    req.message,
    req.history,
    file_context,
    conversation_id=langfuse_session_id
):
    ...
```

**Note:** `agent_engine.py` already passes `conversation_id` to `session_id` in Langfuse (line 1808). No changes needed there.

## Session Behavior

| Scenario | conversation_id | session_id | Result |
|----------|-----------------|------------|--------|
| Normal chat with conversation | `"abc123"` | `"abc123"` | Traces grouped by UI conversation |
| Anonymous/quick test | `null` | `"anon-f4a2b1c3"` | Each request is isolated session |

## Acceptance Criteria

1. When chatting in a UI conversation, all traces appear in one Langfuse session
2. When `conversation_id` is null, a unique session is created for that request
3. Existing trace/span functionality unchanged
4. No breaking changes to API

## Files Changed

| File | Change |
|------|--------|
| `frontend/src/components/AgentChat.tsx` | Add `conversation_id` to request body |
| `backend.py` | Generate session_id when missing |
