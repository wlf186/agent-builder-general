# RAG 工具化与 Span 详细化设计

## 概述

将 RAG 从自动注入模式改为工具调用模式，与 MCP/Skill 平级，让 LLM 按需选择。同时增强 Langfuse Span output 的详细度，便于追溯检索结果。

## 背景

### 当前问题

1. **RAG 不是工具调用**：RAG 在 `_bind_tools_to_llm()` 中被禁用，采用自动注入模式。导致 `tool_calls` 显示为空，无法与其他工具平级
2. **Span output 太简略**：只有 `raw_results_count` 和 `top_scores`，看不出具体召回了什么文档的什么 chunk
3. **工具选择缺乏引导**：System Prompt 中有写死的规则，不够灵活

### 目标

1. RAG 作为 `rag_retrieve` 工具，与 MCP/Skill 平级
2. Span output 包含详细内容（文档名、chunk_index、score、content 预览）
3. 所有工具描述动态注入到 System Prompt，一视同仁

---

## 设计

### 1. RAG 工具化

#### 1.1 启用 RAG 工具

**文件**: `src/agent_engine.py`

**修改点**:
- 移除 `_bind_tools_to_llm()` 中禁用 RAG 工具的逻辑（第 221-226 行）
- 将 `_rag_tools` 加入 `tools_to_bind` 列表

```python
# 修改前 (第 221-226 行)
# 4. 【AC130-202603161918】RAG 知识库检索工具
# DISABLED: 改为自动注入模式，确保 RAG 一定被使用
# if self._rag_tools:
#     tools_to_bind.extend(self._rag_tools)
#     print(f"[DEBUG] 绑定 {len(self._rag_tools)} 个RAG检索工具")

# 修改后
# 4. 【AC130-202603161918】RAG 知识库检索工具
if self._rag_tools:
    tools_to_bind.extend(self._rag_tools)
    print(f"[DEBUG] 绑定 {len(self._rag_tools)} 个 RAG 检索工具")
```

#### 1.2 移除自动注入逻辑

**文件**: `src/agent_engine.py`

**修改点**:
- 修改 `_run_with_tools()` 中的 RAG 处理逻辑（第 1785-1816 行）
- 移除自动注入，改为仅在工具调用时检索

```python
# 修改前 (第 1785-1816 行)
kb_context = ""
if self.config.knowledge_bases and self._retrievers:
    has_rag_tool = any(t.name == "rag_retrieve" for t in getattr(self, '_rag_tools', []))
    if not has_rag_tool:
        # 兼容模式：自动检索并注入上下文
        kb_context = await self._retrieve_for_query(user_input, trace_id=langfuse_trace_id)
    if kb_context:
        # ... 注入到 system_prompt

# 修改后
# RAG 改为工具调用模式，不再自动注入
# 如果智能体没有知识库配置，跳过
# 如果有知识库配置，rag_retrieve 工具已在 bind_tools 中，LLM 会按需调用
```

#### 1.3 工具调用处理

**文件**: `src/agent_engine.py`

**修改点**:
- 增强 `_execute_tool()` 中 `rag_retrieve` 的 Langfuse 追踪（第 943-982 行）

```python
# 当前实现 (第 943-982 行) 已经正确处理 rag_retrieve 工具调用
# 需要增加 Langfuse 追踪，与 _retrieve_for_query 类似
```

---

### 2. Span Output 详细化

#### 2.1 rag.retrieve Span

**文件**: `src/agent_engine.py`

**修改点**: `_retrieve_for_query()` 方法（第 708-716 行）

```python
# 修改前
output={
    "raw_results_count": len(all_results)
}

# 修改后
output={
    "raw_results_count": len(all_results),
    "results": [
        {
            "filename": r.filename,
            "chunk_index": r.chunk_index,
            "score": round(r.score, 4),
            "content_preview": r.content[:200] if r.content else ""
        }
        for r in all_results[:10]  # 最多显示前 10 个
    ]
}
```

#### 2.2 rag.rerank Span

**文件**: `src/agent_engine.py`

**修改点**: `_retrieve_for_query()` 方法（第 740-748 行）

```python
# 修改前
output={
    "top_results_count": len(top_results),
    "top_scores": [round(r.score, 2) for r in top_results]
}

# 修改后
output={
    "top_results_count": len(top_results),
    "results": [
        {
            "filename": r.filename,
            "chunk_index": r.chunk_index,
            "score": round(r.score, 4)
        }
        for r in top_results
    ]
}
```

---

### 3. 工具描述动态注入

#### 3.1 构建统一的工具上下文

**文件**: `src/agent_engine.py`

**修改点**: `_run_with_tools()` 方法（第 1818-1851 行）

```python
# 修改前 (第 1818-1851 行)
# 构建工具描述
tools_desc = ""
tool_names = []

if self.mcp_manager and self.mcp_manager.all_tools:
    tools_list = []
    for mcp_tool in self.mcp_manager.all_tools:
        tools_list.append(f"- {mcp_tool.name}: {mcp_tool.description}")
        tool_names.append(mcp_tool.name)
    tools_desc = "\n".join(tools_list)

# 添加 skill 工具
if self.skill_tool and self.skill_tool.enabled_skills:
    # ...

# 修改后
# 构建统一的工具描述，所有工具一视同仁
tools_context_parts = []

# 1. MCP 工具
if self.mcp_manager and self.mcp_manager.all_tools:
    for mcp_tool in self.mcp_manager.all_tools:
        tools_context_parts.append(
            f"### {mcp_tool.name}\n{mcp_tool.description}\n"
        )

# 2. Skill 工具
if self.skill_tool and self.skill_tool.enabled_skills:
    for skill_name in self.skill_tool.enabled_skills:
        skill_desc = self.skill_tool.get_skill_description(skill_name)
        tools_context_parts.append(
            f"### load_skill ({skill_name})\n{skill_desc}\n"
        )

# 3. RAG 工具（如果配置了知识库）
if self.config.knowledge_bases and self.kb_manager:
    kb_descriptions = []
    for kb_id in self.config.knowledge_bases:
        kb = self.kb_manager.get_kb(kb_id)
        if kb:
            kb_descriptions.append(f"  - {kb.name}: {kb.description or '无描述'}")

    tools_context_parts.append(
        f"### rag_retrieve\n"
        f"从知识库检索相关文档内容。\n"
        f"可用知识库：\n"
        f"{chr(10).join(kb_descriptions)}\n"
    )

tools_context = "\n".join(tools_context_parts)
```

#### 3.2 注入到 System Prompt

**文件**: `src/agent_engine.py`

**修改点**: System Prompt 构建部分

```python
# 修改前
system_prompt += f"""
## 🔴 强制规则：必须使用工具
**重要：你没有任何内置计算能力！** 所有计算、获取笑话、加载技能等操作，**必须**通过调用工具完成。
...
"""

# 修改后
if tools_context:
    system_prompt += f"""

## 可用工具

{tools_context}

## 工具使用规则

1. 根据用户问题选择合适的工具
2. 如果问题涉及内部文档、公司制度等，使用 rag_retrieve 检索知识库
3. 如果需要计算、查询外部数据等，使用相应的 MCP 工具
4. 如果需要处理特定格式的文件（PDF、DOCX 等），先加载对应的 Skill
5. 调用工具时使用 JSON 格式
"""
```

---

## 实现清单

### Phase 1: RAG 工具化

1. [ ] 启用 `_bind_tools_to_llm()` 中的 RAG 工具绑定
2. [ ] 移除 `_run_with_tools()` 中的自动注入逻辑
3. [ ] 为 `rag_retrieve` 工具调用添加 Langfuse 追踪

### Phase 2: Span 详细化

4. [ ] 增强 `rag.retrieve` Span output（添加 results 详情）
5. [ ] 增强 `rag.rerank` Span output（添加 results 详情）

### Phase 3: 工具描述动态注入

6. [ ] 构建统一的工具上下文构建函数
7. [ ] 修改 System Prompt 注入逻辑
8. [ ] 添加 `get_skill_description()` 方法（如果不存在）

---

## 测试验证

1. **RAG 工具调用**：配置知识库的智能体，LLM 应能按需调用 `rag_retrieve`
2. **Span 详细度**：在 Langfuse 中查看 `rag.retrieve` 和 `rag.rerank` 的 output
3. **工具选择**：同时配置 RAG、MCP、Skill 的智能体，LLM 应能正确选择工具

---

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| LLM 可能忘记调用 RAG | 工具描述清晰说明适用场景 |
| 自动注入移除后，某些场景无上下文 | 在 System Prompt 中强调何时使用 RAG |
| Span output 太大 | 限制 results 数量（最多 10 个），content 预览限制 200 字符 |

---

## 文件变更

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src/agent_engine.py` | 修改 | 启用 RAG 工具、移除自动注入、增强 Span output、动态注入工具描述 |
