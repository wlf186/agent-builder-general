# 产品需求规格说明书
# 异步环境初始化功能

| 文档版本 | 1.0 |
|---------|-----|
| 创建日期 | 2026-03-13 |
| 作者 | TF141 产品经理 |
| 状态 | 待评审 |

---

## 1. 需求概述

### 1.1 背景与问题

**当前问题**：
- 用户创建智能体后，后端在 `POST /api/agents` 接口中同步调用 `environment_manager.get_or_create_environment()`
- Conda 环境初始化耗时 10-30 秒
- 前端一直等待响应，用户体验极差

**用户痛点**：
- 创建智能体后长时间无响应
- 不清楚系统正在做什么
- 无法在等待期间进行其他操作

### 1.2 解决方案概述

将环境初始化从同步阻塞改为异步后台执行：
- 创建智能体后立即返回，用户可进入配置界面
- 前端显示"环境初始化中"状态，实时更新进度
- 环境初始化期间锁定 skill 相关配置，解锁其他配置项
- 初始化完成后自动解锁并通知用户

---

## 2. 配置项分类定义

### 2.1 Skill 相关配置（环境初始化期间锁定）

以下配置项与 Skill 执行环境直接相关，在环境初始化期间**禁用修改**：

| 配置项 | 说明 | 锁定原因 |
|--------|------|----------|
| `skills` | 启用的 Skill 列表 | Skill 依赖需安装到环境中 |
| `mcp_services` | MCP 服务列表 | 某些 MCP 服务需要环境支持 |

**锁定范围界定原则**：
> 任何可能触发 `ExecutionEngine.execute_script()` 的配置都属于 Skill 相关配置

### 2.2 其它配置（环境初始化期间可用）

以下配置项与环境初始化无关，在环境初始化期间**可正常修改**：

| 类别 | 配置项 | 说明 |
|------|--------|------|
| **基础配置** | `name` | 智能体名称 |
| **基础配置** | `persona` | 人设/系统提示词 |
| **模型配置** | `model_service` | 模型服务 |
| **模型配置** | `temperature` | 温度参数 |
| **高级配置** | `max_iterations` | 最大迭代次数 |
| **高级配置** | `planning_mode` | 规划模式 |
| **高级配置** | `short_term_memory` | 短期记忆轮次 |

**可用性界定原则**：
> 仅影响 LLM 推理行为的配置在初始化期间可修改

### 2.3 调试窗口状态

| 环境状态 | 调试窗口状态 | 说明 |
|----------|-------------|------|
| CREATING | 禁用 | 环境未就绪，无法执行 Skill |
| READY | 启用 | 环境就绪，可正常调试 |
| ERROR | 禁用 | 环境异常，需重新初始化 |

---

## 3. 用户交互流程

### 3.1 流程图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         用户创建智能体                                    │
└─────────────────────────────────────┬───────────────────────────────────┘
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  POST /api/agents                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 1. 创建 AgentConfig                                             │   │
│  │ 2. 保存配置 (manager.create_agent_config)                       │   │
│  │ 3. 后台任务: environment_manager.create_environment()            │   │
│  │ 4. 立即返回: { name, status: "creating" }                       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────┬───────────────────────────────────┘
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    进入配置界面（立即显示）                              │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 顶部提示条（黄色背景，闪烁图标）：                                 │   │
│  │ "Skill执行环境正在初始化，暂不可用"                                │   │
│  │ 预计剩余时间: ~15秒                                               │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────┬───────────────────────────────────┘
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          配置界面状态                                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 可用配置（正常交互）：                                             │   │
│  │ ✓ 名称、人设                                                      │   │
│  │ ✓ 模型服务、温度                                                   │   │
│  │ ✓ 高级设置（迭代次数、规划模式、记忆轮次）                          │   │
│  │                                                                    │   │
│  │ 禁用配置（置灰 + 禁用手势）：                                        │   │
│  │ ✗ Skills 选择（置灰，鼠标悬停显示"环境初始化中..."）                 │   │
│  │ ✗ MCP 服务选择（置灰）                                             │   │
│  │                                                                    │   │
│  │ 调试窗口：                                                         │   │
│  │ ✗ 禁用，显示"环境初始化中，请稍候"                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────┬───────────────────────────────────┘
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    前端轮询环境状态（每 2 秒）                            │
│  GET /api/agents/{name}/environment                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 返回: { status: "creating" | "ready" | "error" }                │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────┬───────────────────────────────────┘
                                      ▼
                          ┌───────────┴───────────┐
                          ▼                       ▼
              ┌───────────────────────┐   ┌───────────────────────┐
              │   status = "ready"    │   │  status = "error"     │
              └───────────────────────┘   └───────────────────────┘
                          │                       │
                          ▼                       ▼
      ┌───────────────────────────────┐   ┌───────────────────────────────┐
      │  顶部提示消失（绿色成功提示）   │   │  顶部提示（红色错误提示）       │
      │  "Skill执行环境初始化完成"     │   │  "环境初始化失败: {原因}"       │
      │  解锁 Skills / MCP 配置       │   │  [重试] [联系支持]             │
      │  启用调试窗口                  │   │                               │
      └───────────────────────────────┘   └───────────────────────────────┘
```

### 3.2 前端状态机

```
                    ┌─────────────────┐
                    │   IDLE (初始)    │
                    └────────┬────────┘
                             │ 用户创建智能体
                             ▼
                    ┌─────────────────┐
                    │ CREATING (初始化中) │
                    └────────┬────────┘
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
   ┌─────────────────┐              ┌─────────────────┐
   │   READY (就绪)   │              │  ERROR (失败)    │
   └─────────────────┘              └─────────────────┘
            │                                 │
            │ 用户重试                         │
            └─────────────────────────────────┘
```

---

## 4. 后端 API 变更

### 4.1 修改端点

#### `POST /api/agents`（创建智能体）

**变更前**（同步阻塞）：
```python
@app.post("/api/agents")
async def create_agent(req: CreateAgentRequest):
    config = AgentConfig(name=req.name.strip(), persona=req.description or "...")
    if manager.create_agent_config(config):
        # 阻塞 10-30 秒
        await environment_manager.get_or_create_environment(req.name.strip())
        return {"name": config.name, "status": "created"}
```

**变更后**（立即返回）：
```python
@app.post("/api/agents")
async def create_agent(req: CreateAgentRequest):
    config = AgentConfig(name=req.name.strip(), persona=req.description or "...")
    if manager.create_agent_config(config):
        # 异步后台任务，不阻塞响应
        asyncio.create_task(
            environment_manager.create_environment(req.name.strip())
        )
        # 立即返回，status 指示环境状态
        return {
            "name": config.name,
            "status": "creating",  # 新增字段
            "environment_status": "creating"  # 新增字段
        }
```

### 4.2 新增端点

#### `GET /api/agents/{name}/environment`（获取环境状态）

**请求**：
```http
GET /api/agents/{name}/environment
```

**响应**：
```json
{
  "environment": {
    "environment_id": "abc123",
    "agent_name": "my-agent",
    "status": "creating",  // "creating" | "ready" | "error" | "deleted"
    "environment_type": "conda",
    "python_version": "3.11",
    "packages": [],
    "installed_dependencies": {},
    "created_at": "2026-03-13T10:00:00",
    "updated_at": "2026-03-13T10:00:00",
    "error_message": null
  }
}
```

### 4.3 响应模型新增字段

**AgentConfig 响应**：
```typescript
interface AgentResponse {
  name: string;
  persona: string;
  status: "created" | "creating";
  environment_status?: "creating" | "ready" | "error";
  // ... 其他字段
}
```

---

## 5. 前端实现规范

### 5.1 状态管理

```typescript
// 新增环境状态
const [environmentStatus, setEnvironmentStatus] = useState<{
  status: 'creating' | 'ready' | 'error' | null;
  error?: string;
}>({ status: null });

// 初始化后轮询环境状态
useEffect(() => {
  if (currentView === 'config' && selectedAgent) {
    pollEnvironmentStatus(selectedAgent);
  }
}, [currentView, selectedAgent]);
```

### 5.2 UI 组件规范

#### 初始化提示条
```tsx
{environmentStatus.status === 'creating' && (
  <div className="fixed top-0 left-0 right-0 bg-yellow-50 border-b border-yellow-200 p-3 flex items-center justify-center z-50 animate-pulse">
    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
    <span className="text-yellow-800">
      Skill执行环境正在初始化，暂不可用（预计 15 秒）
    </span>
  </div>
)}
```

#### 配置项禁用样式
```tsx
<div className={cn(
  "space-y-4",
  environmentStatus.status === 'creating' && "opacity-50 pointer-events-none"
)}>
  <SkillsSelector disabled={environmentStatus.status === 'creating'} />
  <McpServicesSelector disabled={environmentStatus.status === 'creating'} />
</div>
```

### 5.3 轮询逻辑

```typescript
const pollEnvironmentStatus = async (agentName: string) => {
  const poll = async () => {
    const res = await fetch(`/api/agents/${agentName}/environment`);
    const data = await res.json();
    setEnvironmentStatus({
      status: data.environment.status,
      error: data.environment.error_message
    });

    if (data.environment.status === 'ready' || data.environment.status === 'error') {
      // 停止轮询
      return;
    }

    // 继续轮询
    setTimeout(poll, 2000);
  };

  poll();
};
```

---

## 6. 边界场景处理

### 6.1 环境创建失败

| 场景 | 处理方式 |
|------|----------|
| Conda 未安装 | 显示错误提示，提供安装指引 |
| 磁盘空间不足 | 显示"磁盘空间不足"错误，提示清理 |
| 网络问题 | 显示"下载包失败"，提供[重试]按钮 |
| 权限问题 | 显示"权限不足"，提示检查目录权限 |

### 6.2 用户操作冲突

| 操作 | 环境状态 | 行为 |
|------|----------|------|
| 保存配置 | CREATING | 允许保存非 Skill 配置 |
| 删除智能体 | CREATING | 允许删除，后台任务自动取消 |
| 切换智能体 | CREATING | 停止轮询，切换到新智能体状态 |

### 6.3 并发创建

- 多个用户同时创建智能体时，每个环境创建任务独立执行
- 环境名称使用安全转义：`agent_name.replace("/", "_").replace("\\", "_")`

---

## 7. 非功能性需求

### 7.1 性能指标

| 指标 | 目标 |
|------|------|
| 创建智能体响应时间 | < 500ms（不含环境初始化） |
| 环境状态轮询间隔 | 2 秒 |
| 环境初始化时间 | 10-30 秒（取决于网络） |

### 7.2 兼容性

- **向后兼容**：旧版智能体（无环境记录）首次使用时自动创建环境
- **错误恢复**：环境创建失败后，用户可手动重试

### 7.3 可观测性

```python
# 后端日志规范
[ENV] Creating environment for agent 'my-agent'
[ENV] Environment creation started: conda create -p /path/to/env_my_agent ...
[ENV] Environment creation completed in 12.3s
[ENV] Environment creation failed: conda: command not found
```

---

## 8. 验收标准

### 8.1 功能验收

| ID | 验收项 | 测试步骤 | 预期结果 |
|----|--------|----------|----------|
| TC-01 | 创建智能体立即返回 | 创建新智能体，观察响应时间 | < 500ms 返回，进入配置界面 |
| TC-02 | 初始化提示显示 | 创建智能体后观察顶部提示 | 显示"Skill执行环境正在初始化" |
| TC-03 | Skill 配置锁定 | 初始化期间尝试修改 Skills | 配置项置灰，无法修改 |
| TC-04 | 其它配置可用 | 初始化期间修改人设、模型 | 可正常修改并保存 |
| TC-05 | 调试窗口禁用 | 初始化期间打开调试窗口 | 显示"环境初始化中"提示 |
| TC-06 | 完成后自动解锁 | 等待环境初始化完成 | 配置项自动解锁，调试窗口可用 |
| TC-07 | 错误处理 | 模拟环境创建失败 | 显示错误提示，提供重试选项 |
| TC-08 | 删除智能体 | 初始化期间删除智能体 | 删除成功，后台任务取消 |

### 8.2 性能验收

| ID | 指标 | 验收标准 |
|----|------|----------|
| PC-01 | 创建响应时间 | P95 < 500ms |
| PC-02 | 轮询开销 | CPU < 5% |
| PC-03 | 内存泄漏 | 长时间运行无内存增长 |

---

## 9. 实施计划

### 9.1 技术任务拆分

| 任务 | 负责人 | 估时 | 依赖 |
|------|--------|------|------|
| 后端：修改创建接口为异步 | Backend Dev | 2h | - |
| 后端：新增环境状态查询接口 | Backend Dev | 1h | - |
| 后端：错误处理与日志 | Backend Dev | 2h | 接口修改 |
| 前端：环境状态轮询逻辑 | Frontend Dev | 2h | 状态接口 |
| 前端：配置项锁定/解锁 | Frontend Dev | 3h | 轮询逻辑 |
| 前端：初始化提示组件 | Frontend Dev | 2h | 设计稿 |
| 前端：错误提示与重试 | Frontend Dev | 2h | 错误处理 |
| 测试：E2E 自动化测试 | QA | 4h | 前后端完成 |

### 9.2 里程碑

| 阶段 | 交付物 | 日期 |
|------|--------|------|
| Phase 1 | 后端 API 完成并测试 | D+2 |
| Phase 2 | 前端 UI 完成 | D+4 |
| Phase 3 | 集成测试通过 | D+5 |
| Phase 4 | 上线发布 | D+6 |

---

## 10. 附录

### 10.1 相关文档

- `CLAUDE.md` - 系统架构说明
- `docs/holistic.md` - Skill 运行环境模式调查
- `src/models.py` - 数据模型定义
- `src/environment_manager.py` - 环境管理器实现

### 10.2 修订历史

| 版本 | 日期 | 修订人 | 变更说明 |
|------|------|--------|----------|
| 1.0 | 2026-03-13 | TF141 PM | 初始版本 |

---

**文档结束**
