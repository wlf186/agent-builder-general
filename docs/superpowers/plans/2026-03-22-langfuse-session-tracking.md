# Langfuse Session Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable Langfuse session tracking by passing conversation_id from frontend to backend, so traces are grouped by UI conversation.

**Architecture:** Frontend sends conversation_id in chat request body. Backend generates a unique session_id if conversation_id is missing. Langfuse receives valid session_id for every trace.

**Tech Stack:** TypeScript (React), Python (FastAPI), Langfuse SDK

---

## File Structure

| File | Change | Responsibility |
|------|--------|----------------|
| `frontend/src/components/AgentChat.tsx:660-664` | Modify | Add conversation_id to request body |
| `backend.py:909` | Modify | Generate session_id when missing |

---

## Task 1: Frontend - Add conversation_id to Request Body

**Files:**
- Modify: `frontend/src/components/AgentChat.tsx:660-664`

- [ ] **Step 1: Add conversation_id to the fetch request body**

```typescript
// Location: frontend/src/components/AgentChat.tsx, line ~660
// Find the body: JSON.stringify({...}) block and add conversation_id

body: JSON.stringify({
  message: userContent,
  history: historyMessages,
  file_ids: allFileIds,
  conversation_id: activeConversationId || null
}),
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npm run build`
Expected: No TypeScript errors

- [ ] **Step 3: Commit frontend change**

```bash
git add frontend/src/components/AgentChat.tsx
git commit -m "feat(chat): send conversation_id to backend for Langfuse session tracking"
```

---

## Task 2: Backend - Generate session_id When Missing

**Files:**
- Modify: `backend.py:909`

- [ ] **Step 1: Add session_id generation before chat_stream call**

```python
# Location: backend.py, line 909
# BEFORE:
async for event in instance.chat_stream(req.message, req.history, file_context, conversation_id=req.conversation_id):

# AFTER (insert session_id generation, then modify the call):
# Generate session_id for Langfuse (group traces by conversation)
# Note: uuid is already imported at line 813, no need to re-import
langfuse_session_id = req.conversation_id or f"anon-{uuid.uuid4().hex[:8]}"

async for event in instance.chat_stream(req.message, req.history, file_context, conversation_id=langfuse_session_id):
```

- [ ] **Step 2: Verify Python syntax**

Run: `.venv/bin/python -m py_compile backend.py`
Expected: No syntax errors

- [ ] **Step 3: Commit backend change**

```bash
git add backend.py
git commit -m "feat(langfuse): generate session_id when conversation_id is missing"
```

---

## Task 3: Verification Test

**Files:**
- Manual verification

- [ ] **Step 1: Restart services**

```bash
./stop.sh && ./start.sh
```

- [ ] **Step 2: Test with existing conversation**

1. Open Agent Builder UI at http://localhost:20880
2. Select an agent and send a message in an existing conversation
3. Check Langfuse UI at http://localhost:3000
4. Navigate to Sessions - verify a session exists with the conversation_id

- [ ] **Step 3: Verify anonymous fallback (edge case)**

This tests the backend fallback when `conversation_id` is null (e.g., if conversation creation fails on frontend):
1. The backend generates `anon-xxxxxx` session_id automatically
2. Check Langfuse UI - sessions with `anon-` prefix should exist for any null conversation_id requests
3. Note: Normal UI flow always creates a conversation, so this is a defensive fallback

- [ ] **Step 4: Verify session grouping**

1. Send multiple messages in the same conversation
2. All traces should appear under the same session in Langfuse

---

## Acceptance Criteria

- [ ] Frontend sends `conversation_id` in chat request body
- [ ] Backend generates `session_id` when `conversation_id` is null
- [ ] Langfuse Sessions view shows grouped traces
- [ ] No breaking changes to existing functionality
