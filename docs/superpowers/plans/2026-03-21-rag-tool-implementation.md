# RAG 工具化与 Span 详细化实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 RAG 从自动注入模式改为工具调用模式，增强 Langfuse Span output 详细度，实现工具描述动态注入。

**Architecture:** 启用已存在的 `_create_rag_tools()` 创建的 `rag_retrieve` 工具，移除自动注入逻辑，为 `_execute_tool()` 添加 Langfuse 追踪，增强 Span output 包含详细结果，统一构建工具上下文。

**Tech Stack:** Python, Langfuse SDK, LangChain Tools

---

## 文件结构

| 文件 | 职责 | 变更类型 |
|------|------|----------|
| `src/agent_engine.py` | 智能体引擎核心 | 修改（多处） |
| `src/skill_tool.py` | 技能工具封装 | 修改（新增方法） |

---

## Task 1: 添加 `get_skill_description()` 方法

**Files:**
- Modify: `src/skill_tool.py`

- [ ] **Step 1: 在 SkillTool 类中添加 `get_skill_description()` 方法**

在 `src/skill_tool.py` 文件末尾的 `SkillTool` 类中添加新方法：

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

- [ ] **Step 2: 验证语法正确**

Run: `python3 -m py_compile src/skill_tool.py`
Expected: 无输出（成功）

- [ ] **Step 3: Commit**

```bash
git add src/skill_tool.py
git commit -m "feat(skill): add get_skill_description() method

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 2: 启用 RAG 工具绑定

**Files:**
- Modify: `src/agent_engine.py:221-227`

- [ ] **Step 1: 启用 RAG 工具绑定**

找到 `_bind_tools_to_llm()` 方法中约第 221-227 行的 RAG 工具禁用代码：

```python
# 修改前
# 4. 【AC130-202603161918】RAG 知识库检索工具
# DISABLED: 改为自动注入模式，确保 RAG 一定被使用
# self._rag_tools = self._create_rag_tools()
# if self._rag_tools:
#     tools_to_bind.extend(self._rag_tools)
#     print(f"[DEBUG] 绑定 {len(self._rag_tools)} 个RAG检索工具")
self._rag_tools = []  # Empty list to prevent has_rag_tool check from failing
```

替换为：

```python
# 4. 【AC130-202603161918】RAG 知识库检索工具
self._rag_tools = self._create_rag_tools()
if self._rag_tools:
    tools_to_bind.extend(self._rag_tools)
    print(f"[DEBUG] 绑定 {len(self._rag_tools)} 个 RAG 检索工具")
```

- [ ] **Step 2: 验证语法正确**

Run: `python3 -m py_compile src/agent_engine.py`
Expected: 无输出（成功）

- [ ] **Step 3: Commit**

```bash
git add src/agent_engine.py
git commit -m "feat(rag): enable RAG tool binding in _bind_tools_to_llm()

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: 移除 RAG 自动注入逻辑

**Files:**
- Modify: `src/agent_engine.py:1785-1816`

- [ ] **Step 1: 定位并删除自动注入代码块**

找到 `_run_with_tools()` 方法中约第 1785-1816 行的 RAG 自动注入逻辑：

```python
# 【AC130-202603161542】RAG 知识库检索
# 【AC130-202603161918】调整为工具模式优先
# ====================================================================
# 如果配置了知识库但未绑定工具（兼容模式），自动注入检索上下文
# 如果已绑定 rag_retrieve 工具，让 LLM 自主决定是否调用
kb_context = ""
if self.config.knowledge_bases and self._retrievers:
    # 检查是否已绑定 RAG 工具
    has_rag_tool = any(t.name == "rag_retrieve" for t in getattr(self, '_rag_tools', []))

    if not has_rag_tool:
        # 兼容模式：自动检索并注入上下文
        kb_context = await self._retrieve_for_query(user_input, trace_id=langfuse_trace_id)

    if kb_context:
        retrieval_config = self.config.retrieval_config
        if retrieval_config:
            # 使用配置的提示词模板
            kb_prompt = retrieval_config.prompt_template.format(
                retrieved_chunks=kb_context,
                user_query=user_input
            )
        else:
            # 默认模板
            kb_prompt = f"""
## 知识库内容

请基于以下知识库内容回答用户问题。如果知识库中没有相关信息，请明确告知。

{kb_context}
"""
        system_prompt += kb_prompt
```

**完全删除上述代码块**。RAG 现在通过工具调用模式工作。

- [ ] **Step 2: 验证语法正确**

Run: `python3 -m py_compile src/agent_engine.py`
Expected: 无输出（成功）

- [ ] **Step 3: Commit**

```bash
git add src/agent_engine.py
git commit -m "refactor(rag): remove auto-injection logic, RAG is now tool-only

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 4: 为 `_execute_tool()` 添加 `trace_id` 参数

**Files:**
- Modify: `src/agent_engine.py` (`_execute_tool` 方法签名及调用点)

- [ ] **Step 1: 修改 `_execute_tool()` 方法签名**

找到 `_execute_tool()` 方法定义（约第 850 行），添加 `trace_id` 参数：

```python
# 修改前
async def _execute_tool(
    self,
    tool_name: str,
    tool_args: Dict[str, Any],
    input_file_ids: Optional[List[str]] = None
) -> Any:

# 修改后
async def _execute_tool(
    self,
    tool_name: str,
    tool_args: Dict[str, Any],
    input_file_ids: Optional[List[str]] = None,
    trace_id: Optional[str] = None
) -> Any:
```

- [ ] **Step 2: 更新所有调用点**

搜索所有 `_execute_tool(` 调用，添加 `trace_id=langfuse_trace_id` 参数：

主要调用点约在：
- 第 1076 行附近（`_process_tool_calls` 方法）
- 第 1287 行附近
- 第 1599 行附近
- 第 2277 行附近

示例修改：
```python
# 修改前
result = await self._execute_tool(tool_name, tool_args, input_file_ids)

# 修改后
result = await self._execute_tool(tool_name, tool_args, input_file_ids, trace_id=langfuse_trace_id)
```

**注意**: 如果调用点没有 `langfuse_trace_id` 变量，传 `None` 即可。

- [ ] **Step 3: 验证语法正确**

Run: `python3 -m py_compile src/agent_engine.py`
Expected: 无输出（成功）

- [ ] **Step 4: Commit**

```bash
git add src/agent_engine.py
git commit -m "feat(tracing): add trace_id parameter to _execute_tool()

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 5: 为 `rag_retrieve` 工具添加 Langfuse 追踪

**Files:**
- Modify: `src/agent_engine.py:946-982`

- [ ] **Step 1: 重写 `rag_retrieve` 工具处理分支**

找到 `_execute_tool()` 方法中 `if tool_name == "rag_retrieve":` 分支（约第 946 行），替换为带 Langfuse 追踪的版本：

```python
if tool_name == "rag_retrieve":
    query = tool_args.get("query", "")
    top_k = tool_args.get("top_k", 3)
    # 限制 top_k 范围
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
            result = f"未找到与 '{query}' 相关的文档内容。请尝试其他关键词或告知用户该问题不在知识库范围内。"
        else:
            # 按相似度排序，取 Top-K
            all_results.sort(key=lambda x: x.score, reverse=True)
            top_results = all_results[:top_k]

            # 格式化结果
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
                output={
                    "result_length": len(result),
                    "results_count": len(all_results),
                    "results": [
                        {
                            "filename": r.filename,
                            "chunk_index": r.chunk_index,
                            "score": round(r.score, 4)
                        }
                        for r in (top_results if all_results else [])
                    ]
                }
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

- [ ] **Step 2: 验证语法正确**

Run: `python3 -m py_compile src/agent_engine.py`
Expected: 无输出（成功）

- [ ] **Step 3: Commit**

```bash
git add src/agent_engine.py
git commit -m "feat(tracing): add Langfuse tracing to rag_retrieve tool

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 6: 增强 `rag.retrieve` Span output

**Files:**
- Modify: `src/agent_engine.py:708-716`

- [ ] **Step 1: 修改 `rag.retrieve` Span output**

找到 `_retrieve_for_query()` 方法中 `rag_retrieve_span_id` 相关的 `end_span` 调用（约第 708-716 行）：

```python
# 修改前
if rag_retrieve_span_id and is_langfuse_enabled():
    langfuse_tracer.end_span(
        trace_id=trace_id,
        span_id=rag_retrieve_span_id,
        output={
            "raw_results_count": len(all_results)
        }
    )

# 修改后
if rag_retrieve_span_id and is_langfuse_enabled():
    langfuse_tracer.end_span(
        trace_id=trace_id,
        span_id=rag_retrieve_span_id,
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
    )
```

- [ ] **Step 2: 验证语法正确**

Run: `python3 -m py_compile src/agent_engine.py`
Expected: 无输出（成功）

- [ ] **Step 3: Commit**

```bash
git add src/agent_engine.py
git commit -m "feat(tracing): enhance rag.retrieve Span output with detailed results

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 7: 增强 `rag.rerank` Span output

**Files:**
- Modify: `src/agent_engine.py:740-748`

- [ ] **Step 1: 修改 `rag.rerank` Span output**

找到 `_retrieve_for_query()` 方法中 `rag_rerank_span_id` 相关的 `end_span` 调用（约第 740-748 行）：

```python
# 修改前
if rag_rerank_span_id and is_langfuse_enabled():
    langfuse_tracer.end_span(
        trace_id=trace_id,
        span_id=rag_rerank_span_id,
        output={
            "top_results_count": len(top_results),
            "top_scores": [round(r.score, 2) for r in top_results]
        }
    )

# 修改后
if rag_rerank_span_id and is_langfuse_enabled():
    langfuse_tracer.end_span(
        trace_id=trace_id,
        span_id=rag_rerank_span_id,
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
    )
```

- [ ] **Step 2: 验证语法正确**

Run: `python3 -m py_compile src/agent_engine.py`
Expected: 无输出（成功）

- [ ] **Step 3: Commit**

```bash
git add src/agent_engine.py
git commit -m "feat(tracing): enhance rag.rerank Span output with detailed results

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 8: 构建统一的工具上下文

**Files:**
- Modify: `src/agent_engine.py:1818-1851`

- [ ] **Step 1: 重构工具描述构建逻辑**

找到 `_run_with_tools()` 方法中构建工具描述的部分（约第 1818-1851 行），替换为统一构建逻辑：

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

# 添加 skill 工具（如果有启用的技能）
if self.skill_tool and self.skill_tool.enabled_skills:
    skill_tool_def = self.skill_tool.get_tool_definition()
    tools_desc += f"\n- {skill_tool_def['name']}: {skill_tool_def['description'].split(chr(10))[0]}"
    tool_names.append(SkillTool.TOOL_NAME)

    # 添加 execute_skill 工具（如果有执行引擎且存在可执行技能）
    execute_tool_def = self.skill_tool.get_execute_tool_definition()
    if execute_tool_def:
        tools_desc += f"\n- {execute_tool_def['name']}: {execute_tool_def['description'].split(chr(10))[0]}"
        tool_names.append(SkillTool.EXECUTE_TOOL_NAME)

# ... 后续的子 Agent 工具描述 ...

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

    if kb_descriptions:
        tools_context_parts.append(
            f"### rag_retrieve\n"
            f"从知识库检索相关文档内容。\n"
            f"可用知识库：\n"
            f"{chr(10).join(kb_descriptions)}\n"
        )

tools_context = "\n".join(tools_context_parts)
```

- [ ] **Step 2: 验证语法正确**

Run: `python3 -m py_compile src/agent_engine.py`
Expected: 无输出（成功）

- [ ] **Step 3: Commit**

```bash
git add src/agent_engine.py
git commit -m "refactor(tools): unify tool context building for MCP/Skill/RAG

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 9: 修改 System Prompt 注入逻辑

**Files:**
- Modify: `src/agent_engine.py:1873-1954`

- [ ] **Step 1: 替换写死的工具规则为动态注入**

找到 System Prompt 中 `## 🔴 强制规则：必须使用工具` 部分（约第 1873 行开始），替换为动态注入：

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

**注意**: 保留后续的 `messages = [SystemMessage(content=system_prompt)]` 等代码不变。

- [ ] **Step 2: 验证语法正确**

Run: `python3 -m py_compile src/agent_engine.py`
Expected: 无输出（成功）

- [ ] **Step 3: Commit**

```bash
git add src/agent_engine.py
git commit -m "refactor(prompt): inject tool descriptions dynamically to System Prompt

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 10: 验证与测试

- [ ] **Step 1: 重启后端服务**

```bash
./stop.sh && ./start.sh --skip-deps
```

- [ ] **Step 2: 手动测试 RAG 工具调用**

1. 打开前端 http://localhost:20880
2. 选择一个配置了知识库的智能体
3. 发送一个需要检索知识库的问题
4. 观察 LLM 是否调用了 `rag_retrieve` 工具
5. 检查 Langfuse (http://localhost:3000) 中的 Trace：
   - 应看到 `tool.rag_retrieve` Span
   - `rag.retrieve` 和 `rag.rerank` Span output 应包含详细 results

- [ ] **Step 3: 最终 Commit**

```bash
git add -A
git commit -m "feat(rag): complete RAG tool-mode implementation

- Enable RAG tool binding in _bind_tools_to_llm()
- Remove auto-injection logic, RAG is now tool-only
- Add Langfuse tracing to rag_retrieve tool
- Enhance rag.retrieve/rerank Span output with detailed results
- Unify tool context building for MCP/Skill/RAG
- Inject tool descriptions dynamically to System Prompt

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## 回滚策略

如果 LLM 频繁忘记调用 RAG，可以通过以下方式快速回滚：

1. 恢复 Task 3 的删除（RAG 自动注入逻辑）
2. 在 Task 2 中重新注释 RAG 工具绑定

```bash
git revert HEAD~N  # N 为需要回滚的 commit 数量
```

---

## 验收标准

| 检查项 | 预期结果 |
|--------|----------|
| RAG 工具调用 | LLM 按需调用 `rag_retrieve`，`tool_calls` 不为空 |
| `rag.retrieve` Span | output 包含 `results` 数组，每个元素有 filename/chunk_index/score/content_preview |
| `rag.rerank` Span | output 包含 `results` 数组，每个元素有 filename/chunk_index/score |
| 工具描述 | System Prompt 中显示 MCP/Skill/RAG 所有工具的描述 |
