# Langfuse 集成验收测试清单

## 验收标准

### AC-001: Trace ID 树状结构展示完整调用链
- [ ] 每个 Trace 有唯一 ID
- [ ] Trace 包含用户输入 (input)
- [ ] Trace 包含最终输出 (output)
- [ ] Trace 包含所有子 Span（LLM、Tool、RAG 等）
- [ ] Span 之间有父子关系 (parentObservationId)

### AC-002: 每个环节耗时清晰可见
- [ ] LLM Span 显示持续时间 (duration_ms)
- [ ] Tool Span 显示执行耗时
- [ ] RAG Span 显示检索耗时
- [ ] 总耗时 = Trace.endTime - Trace.startTime

### AC-003: 子 Agent 报错时显示异常堆栈
- [ ] 错误 Span 的 level = "ERROR"
- [ ] 包含 error.type (异常类型)
- [ ] 包含 error.message (错误消息)
- [ ] 包含 error.stack_trace (堆栈跟踪，前5000字符)

### AC-004: Token 使用量统计
- [ ] LLM Span 包含 usage.prompt_tokens
- [ ] LLM Span 包含 usage.completion_tokens
- [ ] LLM Span 包含 usage.total_tokens
- [ ] 估算值标记 usage.estimated = true/false

### AC-005: JSON 序列化验证
- [ ] 所有工具输入可序列化为 JSON
- [ ] 所有工具输出可序列化为 JSON
- [ ] 超长字符串自动截断 (>10000 字符)
- [ ] 不可序列化对象转为字符串

### AC-006: 性能元数据
- [ ] 每个 Span 有 startTime (毫秒级时间戳)
- [ ] 每个 Span 有 endTime (毫秒级时间戳)
- [ ] output.duration_ms 可用时

### AC-007: 错误状态标记
- [ ] LLM 调用失败: Span status = "error"
- [ ] 工具执行失败: Span status = "error", level = "ERROR"
- [ ] 空响应: Trace status = "error"

## 测试步骤

### 1. 启动服务
```bash
# 启动 Langfuse
docker compose -f docker-compose.langfuse.yml up -d

# 验证服务
curl http://localhost:3000/api/health
```

### 2. 配置环境变量
```bash
# 复制并编辑 .env 文件
cp .env.example .env
# 设置 LANGFUSE_ENABLED=true
```

### 3. 启动 Agent Builder
```bash
./start.sh
```

### 4. 执行测试场景

#### 场景 1: 简单对话
```
输入: 你好
预期: 创建 1 个 Trace，1 个 LLM Span
验证: Langfuse UI → Traces → 查看最新 Trace
```

#### 场景 2: 工具调用
```
输入: 帮我计算 100 * 200
预期: 创建 1 个 Trace，1 个 LLM Span，1 个 Tool Span (evaluate)
验证: 检查 Tool Span 的 input.args 和 output.result
```

#### 场景 3: 多轮对话
```
输入:
1. 我叫 Bob
2. 我叫什么？
预期: 2 个 Traces 或 1 个 Trace 包含多轮
验证: 检查 session_id 是否相同
```

#### 场景 4: 错误处理
```
输入: 调用不存在的工具 tool_not_exist
预期: Tool Span status = "error", level = "ERROR"
验证: 检查错误信息包含 stack_trace
```

### 5. 运行自动化测试
```bash
# Playwright UAT 测试
cd frontend
npx playwright test tests/langfuse-uat.spec.ts --headed

# Python 验收测试 (需要 trace_id)
python3 tests/test_langfuse_acceptance.py <trace_id>
```

## 验收通过条件

- [ ] 所有 AC-001 到 AC-007 的子项全部通过
- [ ] 至少执行了 4 个测试场景
- [ ] Langfuse UI 能正常显示 Trace 详情
- [ ] 流式输出不受影响（打字机效果正常）

## 常见问题

**Q: Langfuse UI 显示 "No traces found"**
A: 检查 LANGFUSE_ENABLED=true 和 Langfuse 服务是否运行

**Q: Token 使用量为 0**
A: 流式响应使用估算值，检查 usage.estimated 字段

**Q: 没有看到 stack_trace**
A: 只有错误 Span 才会包含堆栈跟踪，触发一个错误场景测试
