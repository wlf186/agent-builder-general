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

**修改点**（约在 `_bind_tools_to_llm()` 方法第 221-227 行）:
- 取消注释 `_create_rag_tools()` 调用
- 取消注释 `tools_to_bind.extend()` 逻辑
- **删除** `self._rag_tools = []` 这一行（这是关键！）

```python
# 修改前
# 4. 【AC130-202603161918】RAG 知识库检索工具
# DISABLED: 改为自动注入模式，确保 RAG 一定被使用
# self._rag_tools = self._create_rag_tools()
# if self._rag_tools:
#     tools_to_bind.extend(self._rag_tools)
#     print(f"[DEBUG] 绑定 {len(self._rag_tools)} 个RAG检索工具")
self._rag_tools = []  # ⚠️ 这一行必须删除！

# 修改后
# 4. 【AC130-202603161918】RAG 知识库检索工具
self._rag_tools = self._create_rag_tools()
if self._rag_tools:
    tools_to_bind.extend(self._rag_tools)
    print(f"[DEBUG] 绑定 {len(self._rag_tools)} 个 RAG 检索工具")
```

#### 1.2 移除自动注入逻辑

**文件**: `src/agent_engine.py`

**修改点**（约在 `_run_with_tools()` 方法中）:
- 删除整个 `kb_context` 相关的自动注入逻辑
- RAG 检索改为仅通过 `rag_retrieve` 工具调用触发

```python
# 修改前
kb_context = ""
if self.config.knowledge_bases and self._retrievers:
    has_rag_tool = any(t.name == "rag_retrieve" for t in getattr(self, '_rag_tools', []))
    if not has_rag_tool:
        # 兼容模式：自动检索并注入上下文
        kb_context = await self._retrieve_for_query(user_input, trace_id=langfuse_trace_id)
    if kb_context:
        # ... 注入到 system_prompt 的逻辑

# 修改后
# 完全移除上述代码块，RAG 改为工具调用模式
# rag_retrieve 工具已在 bind_tools 中，LLM 会按需调用
```

#### 1.3 工具调用处理（添加 Langfuse 追踪）

**文件**: `src/agent_engine.py`

**修改点**（约在 `_execute_tool()` 方法中，`rag_retrieve` 处理分支）:
- 在工具调用前后添加 Langfuse Span 追踪

```python
# 修改前（约第 946 行）
if tool_name == "rag_retrieve":
    query = tool_args.get("query", "")
    top_k = tool_args.get("top_k", 3)
    # ... 直接执行检索

# 修改后
if tool_name == "rag_retrieve":
    query = tool_args.get("query", "")
    top_k = tool_args.get("top_k", 3)
    top_k = max(1, min(5, int(top_k))) if isinstance(top_k, (int, str)) else 3

    if not query:
        return "错误: 检索查询不能为空"

    if not self._retrievers:
        return "错误: 知识库检索器未初始化"

    # 【Langfuse 追踪】创建 RAG 工具调用 Span
    rag_tool_span_id = None
    if is_langfuse_enabled() and trace_id:
        rag_tool_span_id = langfuse_tracer.create_span(
            trace_id=trace_id,
            span_name="tool.rag_retrieve",
            span_type="TOOL",
            input={"query": query[:500], "top_k": top_k}
        )

    try:
        all_results = []
        for kb_id, retriever in self._retrievers.items():
            results = retriever.search(query, top_k=top_k)
            all_results.extend(results)

        if not all_results:
            result = f"未找到与 '{query}' 相关的文档内容。"
        else:
            all_results.sort(key=lambda x: x.score, reverse=True)
            top_results = all_results[:top_k]

            formatted_parts = []
            for i, r in enumerate(top_results, 1):
                formatted_parts.append(
                    f"[{i}] {r.content}\n"
                    f"    来源: {r.filename} (相关度: {r.score:.2%})"
                )
            result = "检索到以下相关内容：\n\n" + "\n".join(formatted_parts)

        # 【Langfuse 追踪】结束 Span
        if rag_tool_span_id and is_langfuse_enabled():
            langfuse_tracer.end_span(
                trace_id=trace_id,
                span_id=rag_tool_span_id,
                output={"result_length": len(result), "results_count": len(all_results)}
            )

        return result

    except Exception as e:
        # 【Langfuse 追踪】错误处理
        if rag_tool_span_id and is_langfuse_enabled():
            langfuse_tracer.end_span(
                trace_id=trace_id,
                span_id=rag_tool_span_id,
                output={"error": str(e)},
                status="error"
            )
        return f"检索失败: {str(e)}"
```

**注意**: `_execute_tool()` 方法需要额外接收 `trace_id` 参数以支持追踪。

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

#### 3.1 添加 `get_skill_description()` 方法

**文件**: `src/skill_tool.py`

**新增方法**: 获取单个 Skill 的描述信息

```python
def get_skill_description(self, skill_name: str) -> str:
    """获取指定技能的描述信息

    Args:
        skill_name: 技能名称

    Returns:
        str: 技能描述（来自 skill.yaml 的 description 字段），如果找不到返回空字符串
    """
    if not self.skill_registry:
        return ""

    skill = self.skill_registry.get_skill(skill_name)
    if skill:
        return skill.description or ""
    return ""
```

#### 3.2 构建统一的工具上下文

**文件**: `src/agent_engine.py`

**修改点**: `_run_with_tools()` 方法中构建工具描述的部分

```python
# 修改前
# 构建工具描述
tools_desc = ""
tool_names = []

if self.mcp_manager and self.mcp_manager.all_tools:
    tools_list = []
    for mcp_tool in self.mcp_manager.all_tools:
        tools_list.append(f"- {mcp_tool.name}: {mcp_tool.description}")
        tool_names.append(mcp_tool.name)
    tools_desc = "\n".join(tools_list)

# 添加 skill 工具（写死的规则）
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

1. [ ] 启用 `_bind_tools_to_llm()` 中的 RAG 工具绑定（取消注释 + 删除 `self._rag_tools = []`）
2. [ ] 移除 `_run_with_tools()` 中的自动注入逻辑
3. [ ] 为 `_execute_tool()` 中的 `rag_retrieve` 添加 Langfuse 追踪
4. [ ] 为 `_execute_tool()` 方法添加 `trace_id` 参数

### Phase 2: Span 详细化

5. [ ] 增强 `rag.retrieve` Span output（添加 results 详情）
6. [ ] 增强 `rag.rerank` Span output（添加 results 详情）

### Phase 3: 工具描述动态注入

7. [ ] 在 `skill_tool.py` 中添加 `get_skill_description()` 方法
8. [ ] 构建统一的工具上下文构建逻辑
9. [ ] 修改 System Prompt 注入逻辑

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
| `src/agent_engine.py` | 修改 | 启用 RAG 工具、移除自动注入、增强 Span output、动态注入工具描述、添加 trace_id 参数 |
| `src/skill_tool.py` | 修改 | 添加 `get_skill_description()` 方法 |
