# 工具概念统一设计

## 背景

当前系统中，Agent 能力扩展有四种途径：
- MCP 服务
- Skills 技能
- Sub-Agent 子智能体
- Knowledge Base 知识库

但 UI 中只有 MCP 被称为"工具"（工具配置），其他三个各自独立命名，导致新用户概念混淆，不理解为什么只有 MCP 叫工具。

## 目标

统一概念模型，让新用户快速理解"给 Agent 配置能力"的四条路径。

## 设计方案

### 核心变更

1. **统一顶层概念**：四种能力统一归为"工具"
2. **保留原名 + 后缀**：最小改动，降低学习成本
3. **UI 层级重组**：一个大面板套四个子区块

### 术语对照

| 原标签 | 新标签 | 英文 |
|--------|--------|------|
| 工具配置 | 工具配置 → MCP工具 | Tools → MCP Tools |
| 技能配置 | 工具配置 → 技能工具 | Tools → Skill Tools |
| 子 Agent 配置 | 工具配置 → 子智能体工具 | Tools → Agent Tools |
| 知识库配置 | 工具配置 → 知识库工具 | Tools → Knowledge Tools |

### UI 结构

```
┌─────────────────────────────────────────┐
│ 🔧 工具配置 (12)                   [展开] │
├─────────────────────────────────────────┤
│  ┌─────────────────────────────────┐    │
│  │ 🔌 MCP工具 (2)            [展开] │    │
│  │   服务列表...                   │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ 📖 技能工具 (3)           [展开] │    │
│  │   技能列表...                   │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ 🤖 子智能体工具 (1)       [展开] │    │
│  │   子智能体列表...               │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ 📚 知识库工具 (2)         [展开] │    │
│  │   知识库列表...                 │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

### 子区块说明文字

每个子区块底部保留一行说明，帮助用户区分用途：

| 子区块 | 说明文字 (中文) | 说明文字 (英文) |
|--------|----------------|----------------|
| MCP工具 | 连接外部 API 和服务，Agent 可主动调用 | Connect external APIs and services that the agent can call |
| 技能工具 | 注入行为指令，自动加载到系统提示词 | Inject behavior instructions, auto-loaded into system prompts |
| 子智能体工具 | 委派任务给其他 Agent，适合多角色协作 | Delegate tasks to other agents for multi-role collaboration |
| 知识库工具 | 检索私有文档，让 Agent 基于你的资料回答 | Search private documents to answer based on your data |

## 实现范围

### 前端改动

1. **`frontend/src/app/page.tsx`**
   - 移除四个独立的 Card 组件
   - 新增一个"工具配置"大 Card，内部包含四个子区块
   - 调整展开/收起状态管理（增加一层嵌套）

2. **`frontend/src/lib/i18n.ts`**
   - 新增术语翻译 key：
     - `toolsConfig`: "工具配置" / "Tools Configuration"
     - `mcpTools`: "MCP工具" / "MCP Tools"
     - `skillTools`: "技能工具" / "Skill Tools"
     - `agentTools`: "子智能体工具" / "Agent Tools"
     - `knowledgeTools`: "知识库工具" / "Knowledge Tools"
   - 新增说明文字 key：
     - `mcpToolsHint`, `skillToolsHint`, `agentToolsHint`, `knowledgeToolsHint`

3. **组件调整**
   - `SubAgentSelector.tsx`: 标题从"子 Agent 配置"改为"子智能体工具"
   - `KnowledgeBaseSelector.tsx`: 标题从"知识库配置"改为"知识库工具"
   - MCP 和 Skills 的配置区块也需要相应调整

### 后端改动

无需后端改动，仅前端 UI 层面的术语和结构重组。

## 补充设计细节

### 状态管理：嵌套展开/收起

- **父面板展开时**：子区块恢复各自的上次状态
- **父面板收起时**：子区块状态保留，但视觉上隐藏
- **默认行为**：父面板默认展开；子区块根据是否有选中项决定是否展开
- **状态变量**：
  ```typescript
  const [configToolsExpanded, setConfigToolsExpanded] = useState(true);
  const [mcpToolsExpanded, setMcpToolsExpanded] = useState(selectedMcpServices.length > 0);
  const [skillToolsExpanded, setSkillToolsExpanded] = useState(selectedSkills.length > 0);
  const [agentToolsExpanded, setAgentToolsExpanded] = useState(selectedSubAgents.length > 0);
  const [kbToolsExpanded, setKbToolsExpanded] = useState(selectedKnowledgeBases.length > 0);
  ```

### 计数徽章逻辑

父面板标题显示 **已选中的工具总数**：
```
工具配置 (8)  // = 2 MCP + 3 Skills + 1 Sub-Agent + 2 KB 选中项之和
```

### 术语标准化

| 场景 | 中文 | 英文 |
|------|------|------|
| UI 标题 | 子智能体工具 | Agent Tools |
| 代码变量 | subAgents / sub_agents | subAgents / sub_agents |
| 提示文字 | 子智能体 | Sub-Agent |

**统一规则**：UI 面向用户使用"子智能体"，代码层面保持 sub_agent 命名。

### 图标规范

| 区块 | Lucide 图标 | 颜色 |
|------|-------------|------|
| 父面板 | `Settings` | `text-gray-400` |
| MCP工具 | `Plug` | `text-emerald-400` |
| 技能工具 | `BookOpen` | `text-purple-400` |
| 子智能体工具 | `Bot` | `text-indigo-400` |
| 知识库工具 | `Database` | `text-emerald-400` |

### 组件架构

**保持现状**：MCP 和 Skills 配置区块保持内联在 `page.tsx` 中，不抽取为独立组件。

**原因**：
1. 减少改动范围，降低风险
2. `SubAgentSelector` 和 `KnowledgeBaseSelector` 已经是独立组件，可直接复用
3. MCP 和 Skills 的交互逻辑与页面状态紧密耦合，抽取收益不大

**结构**：
```tsx
<Card> {/* 父面板 */}
  <CardHeader onClick={() => setConfigToolsExpanded(!configToolsExpanded)}>
    <Settings /> 工具配置 ({totalCount})
  </CardHeader>
  {configToolsExpanded && (
    <CardContent>
      {/* MCP 内联区块 */}
      {/* Skills 内联区块 */}
      {/* SubAgentSelector 组件 */}
      {/* KnowledgeBaseSelector 组件 */}
    </CardContent>
  )}
</Card>
```

### i18n Key 复用策略

| 原 Key | 处理方式 |
|--------|----------|
| `toolConfig` | 复用为父面板标题 |
| `toolConfigDesc` | 复用为父面板描述 |
| `skillsConfig` | 改为 `skillToolsConfig` |
| 新增 | `mcpTools`, `skillTools`, `agentTools`, `knowledgeTools` |
| 新增 | `mcpToolsHint`, `skillToolsHint`, `agentToolsHint`, `knowledgeToolsHint` |

## 验收标准

1. 四个能力配置区块统一在"工具配置"大面板下
2. 每个子区块标题带有"工具"后缀
3. 每个子区块底部有说明文字帮助区分用途
4. 中英文术语正确显示
5. 原有功能（选择、保存、加载）不受影响
6. 父面板计数徽章显示已选中工具总数
7. 嵌套展开/收起状态正确工作
8. 语言切换后所有标签正确更新
