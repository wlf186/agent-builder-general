# Knowledge Base Experience Redesign

**Date**: 2026-03-19
**Status**: Draft
**Author**: Claude (via brainstorming session)

---

## Problem Statement

Users report two critical issues with the Knowledge Base (RAG) functionality:

1. **UX Disconnect**: KB management feels separated from Agent Builder - it's on a different route (`/knowledge-bases`), uses inconsistent styling, and users don't know how to upload/delete/manage files.

2. **RAG Not Working**: Even when a knowledge base is configured, the LLM never calls the `rag_retrieve` tool. Users see this in Langfuse traces - the tool exists but is never invoked.

---

## Current State Analysis

### What Already Exists

| Feature | Location | Status |
|---------|----------|--------|
| Auto-injection logic | `agent_engine.py` lines 1715-1746 | Exists but may have issues |
| `ragRetrievals` UI | `AgentChat.tsx` lines 1391-1406 | Exists, shows retrieving/completed/failed |
| `rag_retrieve` tool | `agent_engine.py` lines 411-486 | Tool is created and bound |
| `HybridRetriever` class | `retriever.py` line 182 | Stub only (has TODO) |
| Separate KB page | `/knowledge-bases` | Exists, disconnected from main UI |

### Root Cause Analysis

The auto-injection logic exists but has a **conditional path issue**:

1. When `rag_retrieve` tool IS bound → LLM decides whether to call it (often doesn't)
2. When `rag_retrieve` tool is NOT bound → Auto-injection happens (lines 1721-1738)

**The problem**: The current code binds the `rag_retrieve` tool (line 223-225), so the LLM path is taken, and LLM often doesn't call it. The fix is to **remove the tool binding and always use auto-injection**.

---

## Design Goals

- Make KB a **first-class citizen** in Agent Builder (same level as Agents, MCP services)
- **Guarantee RAG usage** - don't rely on LLM choosing to call the tool
- Provide **visual feedback** when RAG is active
- Show **source citations** so users know where answers come from

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Agent Builder Main Page                                        │
├──────────────┬──────────────────────────────────────────────────┤
│              │                                                  │
│  SIDEBAR     │              MAIN CONTENT                        │
│  ─────────   │   ┌──────────────────────────────────────────┐   │
│  ▼ Agents    │   │                                          │   │
│    Agent 1   │   │         Chat Interface                   │   │
│    Agent 2   │   │                                          │   │
│              │   │  User: What's our PTO policy?            │   │
│  ▼ Knowledge │   │                                          │   │
│    + HR Docs │   │  🤖 [Searching HR Docs...]               │   │
│    + Product │   │                                          │   │
│      Specs   │   │  Based on our HR documentation:          │   │
│              │   │  • 15 days PTO after 1 year 📄           │   │
│  ▼ MCP       │   │                                          │   │
│    calc      │   │  [Source: employee_handbook.pdf p.12]    │   │
│    jokes     │   │                                          │   │
│              │   └──────────────────────────────────────────┘   │
│              │                                                  │
└──────────────┴──────────────────────────────────────────────────┘
```

---

## Component 1: Sidebar KB Section

### Collapsed State
- Shows "📚 Knowledge" with count badge (e.g., "2")
- Matches styling of Agents and MCP sections
- Chevron indicates expandable

### Expanded State
- Lists all knowledge bases with document counts
- Each KB shows: icon, name, doc count
- "Create Knowledge Base" button at bottom (dashed border)

### Behavior
- Click on KB → Opens detail panel (slide-out from right)
- Click "Create" → Opens KB creation dialog
- Consistent with existing sidebar UX patterns

---

## Component 2: KB Detail Panel

### Layout
```
┌─────────────────────────────────────┐
│  HR Documents              ✕       │
│  Employee handbook, policies        │
├─────────────────────────────────────┤
│  [5 Documents] [142 Chunks] [2.3MB] │
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐    │
│  │     ↑ Drag & drop files     │    │
│  │  or click to browse         │    │
│  │  (PDF, DOCX, TXT, MD)       │    │
│  └─────────────────────────────┘    │
├─────────────────────────────────────┤
│  Documents                          │
│  📕 employee_handbook.pdf           │
│     1.2 MB · 45 chunks [Ready]  🗑  │
│  📘 pto_policy.docx                 │
│     256 KB · 12 chunks [Ready]  🗑  │
│  📄 benefits_summary.pdf            │
│     Processing... [Processing]  🗑  │
└─────────────────────────────────────┘
```

### Features
- **Stats bar**: Document count, chunk count, total size
- **Drag & drop upload zone**: Intuitive file upload
- **Document list**: Filename, size, chunk count, status
- **Status badges**: Ready (green), Processing (yellow), Failed (red)
- **Delete button**: One-click document removal

---

## Component 3: RAG Chat Integration

### The Core Fix: Remove Tool, Use Auto-Inject

**Current problem**: The `rag_retrieve` tool is bound to the LLM (lines 223-225 in `agent_engine.py`), so the LLM path is taken, and LLM often doesn't call it.

**Fix**: Remove the `rag_retrieve` tool binding and always use auto-injection (which already exists at lines 1721-1738).

**Flow (guaranteed):**
```
User query → Retrieve from KB (always) → Inject context into system prompt → LLM uses it
```

### Existing UI (Needs Enhancement)

The `ragRetrievals` state already exists in `AgentChat.tsx` (lines 1391-1406) but needs enhancement:
- Add visual "Searching KB..." indicator during retrieval
- Add source citation rendering at end of responses
- Handle `rag_sources` metadata event type

### System Prompt Enhancement

When an agent has a knowledge base configured, inject this into the system prompt:

```
You have access to the following knowledge base: {kb_name}

Relevant information from {kb_name}:
{retrieved_chunks}

Use this information to answer the user's question. If the knowledge base
doesn't contain relevant information, say so clearly.
```

### Visual Feedback in Chat

1. **"Searching..." indicator**: When RAG is triggered, show:
   ```
   ⟳ Searching HR Documents...
   ```

2. **Source citations**: At the end of responses, show:
   ```
   📚 Sources:
   📄 employee_handbook.pdf p.12  📄 pto_policy.docx
   ```

### Retrieval Flow

1. **Query Analysis**: Check if query might be answerable from KB
2. **Hybrid Retrieval**: Vector search + BM25 keyword matching
3. **Context Injection**: Add retrieved chunks to system prompt
4. **LLM Generation**: LLM naturally uses the provided context
5. **Citation Display**: Show which documents were used

---

## Backend Changes

### 1. Remove rag_retrieve Tool Binding

**File**: `src/agent_engine.py`

**Change**: Remove lines 223-225 that bind the `rag_retrieve` tool:
```python
# REMOVE THESE LINES:
self._rag_tools = self._create_rag_tools()
if self._rag_tools:
    tools_to_bind.extend(self._rag_tools)
```

This forces the code to use the auto-injection path (lines 1721-1738) which already exists and works.

### 2. Hybrid Retrieval (Optional Enhancement)

Current: Vector-only search via ChromaDB
New: Combine vector search with BM25 keyword matching

The `HybridRetriever` class already exists in `src/retriever.py` (line 182) but is not implemented. This is Phase 4 (optional).

### 3. Source Tracking

Add source tracking to the existing `_retrieve_for_query` method to include sources in response metadata:

```python
{
    "type": "rag_sources",
    "sources": [
        {"filename": "employee_handbook.pdf", "page": 12},
        {"filename": "pto_policy.docx", "chunk_index": 3}
    ]
}
```

---

## Frontend Changes

### 1. Remove Separate KB Page

- Delete `/knowledge-bases` route (or keep as redirect)
- Move all KB functionality to main page sidebar

### 2. Sidebar KB Section

New component: `frontend/src/components/KnowledgeBaseSidebar.tsx`

```tsx
// Add to sidebar, between Agents and MCP sections
<KnowledgeBaseSidebar
  knowledgeBases={knowledgeBases}
  selectedKb={selectedKb}
  onSelectKb={setSelectedKb}
  onCreateKb={() => setKbDialogOpen(true)}
/>
```

### 3. Enhanced KbDetailPanel

Update existing `KbDetailPanel.tsx`:
- Add drag & drop upload zone
- Add status badges (Ready/Processing/Failed)
- Improve styling to match Agent Builder theme
- Add delete confirmation

### 4. Chat RAG Indicators

Update `AgentChat.tsx`:
- Add "Searching KB..." status indicator
- Add source citation rendering
- Handle `rag_sources` event type

---

## Implementation Phases

### Phase 1: Core RAG Fix (1-2 days) - CRITICAL
- [ ] Remove `rag_retrieve` tool binding in `agent_engine.py` (lines 223-225)
- [ ] Verify auto-injection path works (lines 1721-1738)
- [ ] Add source tracking to `_retrieve_for_query` method
- [ ] Add `rag_sources` event to SSE stream
- [ ] Test: RAG works reliably (verify in Langfuse)

### Phase 2: Sidebar Integration (2-3 days)
- [ ] Create KnowledgeBaseSidebar component
- [ ] Add to main page sidebar
- [ ] Wire up KB selection and detail panel
- [ ] Remove/deprecate separate KB page

### Phase 3: Enhanced KB Panel (2-3 days)
- [ ] Add drag & drop upload
- [ ] Add status badges
- [ ] Improve styling consistency
- [ ] Add source citations in chat

### Phase 4: Hybrid Retrieval (2-3 days) - OPTIONAL, CAN DEFER
> **Note**: This phase is optional and can be deferred. Vector-only search is sufficient for most use cases.

- [ ] Implement BM25 indexer in `HybridRetriever` class
- [ ] Implement Reciprocal Rank Fusion (RRF) merging
- [ ] Add retrieval config options (top_k, score_threshold)
- [ ] Performance testing

---

## Success Criteria

1. **RAG Works**: When KB is configured, agent uses it for relevant queries (verified via Langfuse)
2. **UX Unified**: KB management happens in main page, no separate route needed
3. **Visual Feedback**: Users see "Searching..." and source citations
4. **Easy Management**: Drag & drop upload, one-click delete, clear status

---

## Files to Modify

### Backend
- `src/agent_engine.py` - Auto-inject KB context
- `src/retriever.py` - Hybrid retrieval (optional)
- `backend.py` - Source metadata in responses

### Frontend
- `frontend/src/app/page.tsx` - Add KB sidebar section
- `frontend/src/components/KnowledgeBaseSidebar.tsx` - New component
- `frontend/src/components/KbDetailPanel.tsx` - Enhanced panel
- `frontend/src/components/AgentChat.tsx` - RAG indicators & citations
- `frontend/src/app/knowledge-bases/page.tsx` - Remove or redirect

---

## Out of Scope

- Multiple KBs per agent (can add later)
- KB sharing between agents
- Advanced retrieval (reranking, query expansion)
- KB analytics/usage metrics
