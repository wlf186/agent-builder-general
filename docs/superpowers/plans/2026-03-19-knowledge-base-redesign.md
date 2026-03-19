# Knowledge Base Experience Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix RAG so it always works (remove tool binding, use auto-inject) and integrate KB as a first-class sidebar section in Agent Builder.

**Architecture:** Remove `rag_retrieve` tool binding to force auto-injection path (guaranteed RAG usage). Add Knowledge section to sidebar matching Agents/MCP patterns. Enhance detail panel with drag-drop upload and status badges.

**Tech Stack:** Python/FastAPI (backend), Next.js 15 + React (frontend), ChromaDB (vector store), SSE streaming

---

## File Structure

### Backend Files
| File | Action | Purpose |
|------|--------|---------|
| `src/agent_engine.py` | Modify | Remove tool binding, add source tracking |
| `src/retriever.py` | Modify | Add source metadata to results |
| `backend.py` | Modify | Add `rag_sources` SSE event |

### Frontend Files
| File | Action | Purpose |
|------|--------|---------|
| `frontend/src/components/KnowledgeBaseSidebar.tsx` | Create | New sidebar section component |
| `frontend/src/components/KbDetailPanel.tsx` | Modify | Add drag-drop, status badges |
| `frontend/src/components/AgentChat.tsx` | Modify | Add source citations UI |
| `frontend/src/app/page.tsx` | Modify | Wire up KB sidebar section |
| `frontend/src/app/knowledge-bases/page.tsx` | Modify | Add redirect to main page |

---

## Phase 1: Core RAG Fix (Critical)

### Task 1.1: Remove RAG Tool Binding

**Files:**
- Modify: `src/agent_engine.py:223-226`

**Context:** Currently `rag_retrieve` tool is bound, so LLM decides whether to call it (often doesn't). Removing the binding forces auto-injection path.

- [ ] **Step 1: Comment out the tool binding**

In `src/agent_engine.py`, find lines 223-226 and comment out:

```python
        # 4. 【AC130-202603161918】RAG 知识库检索工具
        # DISABLED: 改为自动注入模式，确保 RAG 一定被使用
        # self._rag_tools = self._create_rag_tools()
        # if self._rag_tools:
        #     tools_to_bind.extend(self._rag_tools)
        #     print(f"[DEBUG] 绑定 {len(self._rag_tools)} 个RAG检索工具")
        self._rag_tools = []  # Empty list to prevent has_rag_tool check from failing
```

- [ ] **Step 2: Verify auto-injection path is triggered**

The auto-injection logic at lines 1721-1738 will now always be triggered because `has_rag_tool` will be `False`.

- [ ] **Step 3: Test locally**

```bash
# Start the backend
./start.sh

# Test RAG with a configured agent
curl -s -N http://localhost:20880/stream/agents/{agent_id}/chat \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"message": "test question about KB content"}'
```

Expected: Should see KB context in the response (check for "来源:" in output)

- [ ] **Step 4: Commit**

```bash
git add src/agent_engine.py
git commit -m "fix: disable rag_retrieve tool binding, use auto-injection

The rag_retrieve tool binding was causing LLM to skip RAG retrieval.
By removing the binding, the auto-injection path (lines 1721-1738) is
always used, guaranteeing KB context is injected into the prompt.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 1.2: Add Source Metadata to Retrieval Results

**Files:**
- Modify: `src/agent_engine.py:699-718`
- Modify: `src/retriever.py:118-125`

**Context:** Currently `_format_retrieved_context` returns a string. We need to also track sources separately for citation display.

- [ ] **Step 1: Add `_last_retrieval_sources` instance variable**

In `src/agent_engine.py`, in `__init__` method (around line 116), add:

```python
        self._last_retrieval_sources: List[Dict[str, Any]] = []  # Track sources for citations
```

- [ ] **Step 2: Modify `_retrieve_for_query` to track sources**

Update the method at line 657:

```python
    async def _retrieve_for_query(self, query: str) -> str:
        """为查询检索知识库内容

        Args:
            query: 用户查询

        Returns:
            str: 格式化的检索结果，如果无结果返回空字符串
        """
        if not self.config.knowledge_bases or not self._retrievers:
            self._last_retrieval_sources = []
            return ""

        config = self.config.retrieval_config
        if not config:
            self._last_retrieval_sources = []
            return ""

        all_results = []

        # 从所有挂载的知识库中检索
        for kb_id in self.config.knowledge_bases:
            retriever = self._retrievers.get(kb_id)
            if retriever:
                try:
                    results = retriever.search(
                        query,
                        top_k=config.top_k,
                        score_threshold=config.score_threshold
                    )
                    all_results.extend(results)
                except Exception as e:
                    print(f"[ERROR] 检索失败 (kb_id={kb_id}): {e}")

        if not all_results:
            self._last_retrieval_sources = []
            return ""

        # 按相似度排序，取 Top-K
        all_results.sort(key=lambda x: x.score, reverse=True)
        top_results = all_results[:config.top_k]

        # Track sources for citation
        self._last_retrieval_sources = [
            {
                "filename": r.filename,
                "chunk_index": r.chunk_index,
                "score": round(r.score, 2)
            }
            for r in top_results
        ]

        # 格式化为上下文
        return self._format_retrieved_context(top_results)
```

- [ ] **Step 3: Add method to get sources**

Add after `_format_retrieved_context`:

```python
    def get_last_retrieval_sources(self) -> List[Dict[str, Any]]:
        """Get sources from last retrieval for citation display"""
        return self._last_retrieval_sources
```

- [ ] **Step 4: Test**

```bash
# Run the backend and test
./start.sh

# Check that sources are tracked
curl -s http://localhost:20881/api/agents/{agent_id} | jq .
```

- [ ] **Step 5: Commit**

```bash
git add src/agent_engine.py
git commit -m "feat: add source tracking for RAG citations

Track retrieval sources in _last_retrieval_sources for displaying
source citations in the chat UI.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 1.3: Add rag_sources SSE Event

**Files:**
- Modify: `src/agent_engine.py` (streaming method)
- Modify: `backend.py` (if needed)

**Context:** Add a new SSE event type `rag_sources` that sends source metadata to the frontend.

- [ ] **Step 1: Find the streaming response location**

Search for where SSE events are yielded in `agent_engine.py`. Look for `yield f"data: {json.dumps(..."`.

- [ ] **Step 2: Add rag_sources event after retrieval**

After the retrieval happens (around line 1727), add:

```python
                # Send sources event for citation display
                if self._last_retrieval_sources:
                    yield f"data: {json.dumps({
                        'type': 'rag_sources',
                        'sources': self._last_retrieval_sources
                    })}\n\n"
```

- [ ] **Step 3: Test with curl**

```bash
curl -s -N http://localhost:20880/stream/agents/{agent_id}/chat \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"message": "test question"}' | grep rag_sources
```

Expected: Should see `{"type": "rag_sources", "sources": [...]}` event

- [ ] **Step 4: Commit**

```bash
git add src/agent_engine.py
git commit -m "feat: add rag_sources SSE event for citation display

Send source metadata to frontend after retrieval for displaying
source citations in the chat UI.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Phase 2: Sidebar Integration

### Task 2.1: Create KnowledgeBaseSidebar Component

**Files:**
- Create: `frontend/src/components/KnowledgeBaseSidebar.tsx`

**Context:** New component matching the styling of existing sidebar sections (Agents, MCP).

- [ ] **Step 1: Create the component file**

```tsx
"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Database } from "lucide-react";
import { KnowledgeBase } from "@/lib/kbApi";

interface KnowledgeBaseSidebarProps {
  knowledgeBases: KnowledgeBase[];
  selectedKbId: string | null;
  onSelectKb: (kb: KnowledgeBase) => void;
  onCreateKb: () => void;
  expanded: boolean;
  onToggleExpand: () => void;
}

export function KnowledgeBaseSidebar({
  knowledgeBases,
  selectedKbId,
  onSelectKb,
  onCreateKb,
  expanded,
  onToggleExpand,
}: KnowledgeBaseSidebarProps) {
  return (
    <div className="mb-4">
      {/* Header */}
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
        <Database className="w-4 h-4 text-emerald-600" />
        <span>Knowledge</span>
        {knowledgeBases.length > 0 && (
          <span className="ml-auto bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full">
            {knowledgeBases.length}
          </span>
        )}
      </button>

      {/* Knowledge Base List */}
      {expanded && (
        <div className="mt-1 ml-4 space-y-1">
          {knowledgeBases.map((kb) => (
            <button
              key={kb.kb_id}
              onClick={() => onSelectKb(kb)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                selectedKbId === kb.kb_id
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <span className="truncate">{kb.name}</span>
              <span className="ml-auto text-xs text-gray-400">
                {kb.doc_count} docs
              </span>
            </button>
          ))}

          {/* Create Button */}
          <button
            onClick={onCreateKb}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-dashed border-gray-200 hover:border-emerald-300"
          >
            <Plus className="w-4 h-4" />
            <span>Create Knowledge Base</span>
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/KnowledgeBaseSidebar.tsx
git commit -m "feat: add KnowledgeBaseSidebar component

New sidebar section for knowledge bases, matching the styling
of Agents and MCP sections.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2.2: Integrate KB Sidebar into Main Page

**Files:**
- Modify: `frontend/src/app/page.tsx`

**Context:** Add the KnowledgeBaseSidebar component to the main page sidebar.

- [ ] **Step 1: Import the component**

Add to imports in `page.tsx`:

```tsx
import { KnowledgeBaseSidebar } from "@/components/KnowledgeBaseSidebar";
```

- [ ] **Step 2: Add state for KB sidebar expansion**

Find the existing expansion states and add:

```tsx
  const [sidebarKbExpanded, setSidebarKbExpanded] = useState(true);
```

- [ ] **Step 3: Add the component to sidebar**

In the sidebar section, after the Agents list and before MCP section, add:

```tsx
            {/* Knowledge Base Section */}
            <KnowledgeBaseSidebar
              knowledgeBases={knowledgeBases}
              selectedKbId={selectedKb?.kb_id || null}
              onSelectKb={(kb) => {
                setSelectedKb(kb);
                setKbDetailOpen(true);
              }}
              onCreateKb={() => setKbDialogOpen(true)}
              expanded={sidebarKbExpanded}
              onToggleExpand={() => setSidebarKbExpanded(!sidebarKbExpanded)}
            />
```

- [ ] **Step 4: Test in browser**

```bash
cd frontend && npm run dev
```

Navigate to http://localhost:20880 and verify KB section appears in sidebar.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/page.tsx
git commit -m "feat: integrate KnowledgeBaseSidebar into main page

Add KB section to sidebar between Agents and MCP sections.
Users can now access KB management directly from the main UI.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2.3: Redirect Old KB Page to Main Page

**Files:**
- Modify: `frontend/src/app/knowledge-bases/page.tsx`

**Context:** Redirect the old `/knowledge-bases` route to the main page with a hash fragment.

- [ ] **Step 1: Replace the page with a redirect**

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function KnowledgeBasesPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to main page - KB is now integrated in sidebar
    router.replace('/#knowledge');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Redirecting to Agent Builder...</p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/knowledge-bases/page.tsx
git commit -m "refactor: redirect /knowledge-bases to main page

KB management is now integrated into the main Agent Builder UI.
Old route redirects to prevent broken links.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Phase 3: Enhanced KB Panel & Chat Citations

### Task 3.1: Add Drag & Drop Upload to KbDetailPanel

**Files:**
- Modify: `frontend/src/components/KbDetailPanel.tsx`

**Context:** Enhance the existing panel with drag & drop file upload.

- [ ] **Step 1: Add drag state and handlers**

Add state and handlers inside the component:

```tsx
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    setUploading(true);
    try {
      for (const file of files) {
        await kbApi.uploadDocument(knowledgeBase.kb_id, file);
      }
      await loadDocuments();
      onUpdate();
    } catch (error) {
      alert("Upload failed: " + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setUploading(false);
    }
  };
```

- [ ] **Step 2: Update the upload zone JSX**

Replace the existing upload button with drag-drop zone:

```tsx
      {/* Upload Zone */}
      <div className="p-4 border-b">
        <div
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt,.md"
          multiple
          onChange={handleFileUpload}
          className="hidden"
        />
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`w-full flex flex-col items-center justify-center gap-2 px-4 py-6 border-2 border-dashed rounded-lg transition-colors cursor-pointer ${
            isDragging
              ? "border-emerald-500 bg-emerald-50"
              : "border-gray-300 hover:border-emerald-500 hover:bg-emerald-50"
          } ${uploading ? "opacity-50 pointer-events-none" : ""}`}
        >
          {uploading ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
              <span className="text-gray-600">Uploading...</span>
            </>
          ) : (
            <>
              <Upload className={`w-6 h-6 ${isDragging ? "text-emerald-600" : "text-gray-400"}`} />
              <span className="text-gray-600 text-center">
                Drag & drop files here
                <br />
                <span className="text-xs text-gray-400">or click to browse (PDF, DOCX, TXT, MD)</span>
              </span>
            </>
          )}
        </div>
      </div>
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/KbDetailPanel.tsx
git commit -m "feat: add drag & drop upload to KbDetailPanel

Users can now drag files directly onto the upload zone instead
of only clicking to browse.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3.2: Add Status Badges to Document List

**Files:**
- Modify: `frontend/src/components/KbDetailPanel.tsx`

**Context:** Show Ready/Processing/Failed status badges for each document.

- [ ] **Step 1: Add status badge component**

Add a helper function in the component:

```tsx
  const StatusBadge = ({ status }: { status: string }) => {
    const styles: Record<string, string> = {
      ready: "bg-green-100 text-green-700",
      processing: "bg-yellow-100 text-yellow-700",
      failed: "bg-red-100 text-red-700",
    };

    const labels: Record<string, string> = {
      ready: "Ready",
      processing: "Processing",
      failed: "Failed",
    };

    return (
      <span className={`text-xs px-2 py-0.5 rounded ${styles[status] || styles.ready}`}>
        {labels[status] || status}
      </span>
    );
  };
```

- [ ] **Step 2: Update document list item**

Update the document list rendering to include status:

```tsx
              <div
                key={doc.doc_id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{doc.filename}</p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(doc.file_size)} · {doc.chunk_count} chunks
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={doc.status} />
                  <button
                    onClick={() => handleDeleteDocument(doc.doc_id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/KbDetailPanel.tsx
git commit -m "feat: add status badges to document list

Show Ready/Processing/Failed status for each document in the
KB detail panel.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3.3: Add Source Citations to Chat

**Files:**
- Modify: `frontend/src/components/AgentChat.tsx`

**Context:** Handle `rag_sources` SSE event and display citations in chat.

- [ ] **Step 1: Add state for RAG sources**

Add to the message interface and state:

```tsx
interface RAGSource {
  filename: string;
  chunk_index: number;
  score: number;
}

// In ChatMessage interface, add:
  ragSources?: RAGSource[];
```

- [ ] **Step 2: Handle rag_sources SSE event**

In the SSE event handling section, add:

```tsx
      } else if (data.type === "rag_sources") {
        // Store sources for citation display
        const sources = data.sources as RAGSource[];
        if (streamingMessageRef.current) {
          streamingMessageRef.current.ragSources = sources;
        }
      }
```

- [ ] **Step 3: Add citation rendering**

Add after the message content rendering:

```tsx
            {/* RAG Source Citations */}
            {msg.ragSources && msg.ragSources.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                  <Database className="w-3 h-3" />
                  <span>Sources:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {msg.ragSources.map((source, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 text-xs rounded"
                    >
                      <FileText className="w-3 h-3" />
                      {source.filename}
                      <span className="text-emerald-500">({source.score})</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
```

- [ ] **Step 4: Test with a KB-configured agent**

```bash
# Start services
./start.sh

# In browser, create agent with KB, ask question, verify citations appear
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/AgentChat.tsx
git commit -m "feat: add source citations to chat messages

Display RAG source citations at the end of assistant messages
when knowledge base is used.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Phase 4: Testing & Verification

### Task 4.1: End-to-End RAG Test

**Files:**
- Test: Manual testing

**Context:** Verify the complete RAG flow works.

- [ ] **Step 1: Create a test knowledge base**

1. Open Agent Builder at http://localhost:20880
2. Click "Create Knowledge Base" in sidebar
3. Name it "Test KB"
4. Upload a PDF document with specific content

- [ ] **Step 2: Create agent with KB**

1. Create new agent
2. In agent config, select "Test KB"
3. Save agent

- [ ] **Step 3: Test RAG retrieval**

1. Start chat with agent
2. Ask question about document content
3. Verify:
   - "Searching..." indicator appears (optional, depends on implementation)
   - Response includes information from document
   - Source citations appear at bottom

- [ ] **Step 4: Verify in Langfuse**

1. Open Langfuse dashboard
2. Find the trace for the chat
3. Verify that:
   - KB context was injected into prompt
   - No `rag_retrieve` tool call was made (we removed it)

- [ ] **Step 5: Document test results**

Create a test report in `docs/exec-plans/completed/kb-redesign-uat-YYYYMMDD.md`

---

## Summary

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| Phase 1: Core RAG Fix | 3 tasks | 1-2 days |
| Phase 2: Sidebar Integration | 3 tasks | 1-2 days |
| Phase 3: Enhanced Panel & Citations | 3 tasks | 1-2 days |
| Phase 4: Testing | 1 task | 0.5 day |

**Total: 4-6 days**

---

## Success Criteria

- [ ] RAG works reliably (verified via Langfuse traces)
- [ ] KB management accessible from main page sidebar
- [ ] Drag & drop file upload works
- [ ] Source citations appear in chat responses
- [ ] Old `/knowledge-bases` route redirects properly
