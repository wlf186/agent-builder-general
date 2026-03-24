# 工具概念统一实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 统一 MCP/Skills/SubAgent/KB 为"工具"概念，减少新用户认知负担。

**Architecture:** 在前端创建一个父级"工具配置"面板，内嵌四个子区块。保持现有组件结构，仅调整术语和嵌套关系。

**Tech Stack:** React, TypeScript, Next.js, Tailwind CSS, Lucide Icons

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `frontend/src/lib/i18n.ts` | 修改 | 新增工具相关翻译 key |
| `frontend/src/components/SubAgentSelector.tsx` | 修改 | 更新标题为"子智能体工具" |
| `frontend/src/components/KnowledgeBaseSelector.tsx` | 修改 | 更新标题为"知识库工具" |
| `frontend/src/app/page.tsx` | 修改 | 重组为嵌套面板结构 |

---

## Task 1: 更新 i18n 翻译文件

**Files:**
- Modify: `frontend/src/lib/i18n.ts:116-141`

- [ ] **Step 1: 在 zh 部分添加新的翻译 key**

在 `// Tool Config` 部分后添加：

```typescript
    // Tool Config
    toolConfig: "工具配置",
    toolConfigDesc: "配置此 Agent 可使用的工具能力",
    noMcpServices: "暂无可用的 MCP 服务",
    createMcpServiceFirst: "前往创建",

    // Tools (统一概念)
    mcpTools: "MCP工具",
    mcpToolsHint: "连接外部 API 和服务，Agent 可主动调用",
    skillTools: "技能工具",
    skillToolsHint: "注入行为指令，自动加载到系统提示词",
    agentTools: "子智能体工具",
    agentToolsHint: "委派任务给其他 Agent，适合多角色协作",
    knowledgeTools: "知识库工具",
    knowledgeToolsHint: "检索私有文档，让 Agent 基于你的资料回答",
    toolsSelected: "已选择 {count} 个工具",
```

- [ ] **Step 2: 在 en 部分添加对应的翻译 key**

在 `// Tool Config` 部分后添加：

```typescript
    // Tool Config
    toolConfig: "Tools Configuration",
    toolConfigDesc: "Configure tool capabilities for this agent",
    noMcpServices: "No MCP services available",
    createMcpServiceFirst: "Create One",

    // Tools (unified concept)
    mcpTools: "MCP Tools",
    mcpToolsHint: "Connect external APIs and services that the agent can call",
    skillTools: "Skill Tools",
    skillToolsHint: "Inject behavior instructions, auto-loaded into system prompts",
    agentTools: "Agent Tools",
    agentToolsHint: "Delegate tasks to other agents for multi-role collaboration",
    knowledgeTools: "Knowledge Tools",
    knowledgeToolsHint: "Search private documents to answer based on your data",
    toolsSelected: "{count} tools selected",
```

- [ ] **Step 3: 验证 i18n 更改**

运行前端开发服务器，检查控制台无报错：

```bash
cd frontend && npm run dev 2>&1 | head -20
```

Expected: 无 TypeScript 错误

- [ ] **Step 4: 提交 i18n 更改**

```bash
git add frontend/src/lib/i18n.ts
git commit -m "feat(i18n): add unified tools terminology translations"
```

---

## Task 2: 更新 SubAgentSelector 组件标题

**Files:**
- Modify: `frontend/src/components/SubAgentSelector.tsx:129-136`

- [ ] **Step 1: 更新 MultiSelectPanel 的 title 和 hint 属性**

将第 129-136 行：

```tsx
      <MultiSelectPanel<SubAgentInfo>
        title={zh ? "子 Agent 配置" : "Sub-Agent Configuration"}
        icon={<Bot size={16} />}
        color="indigo"
        hint={zh
          ? "选择此 Agent 可以调用的子 Agent。主 Agent 可以将任务委派给子 Agent 处理，适合多角色协作场景。"
          : "Select sub-agents that this agent can call. The main agent can delegate tasks to sub-agents for multi-role collaboration."
        }
```

改为：

```tsx
      <MultiSelectPanel<SubAgentInfo>
        title={zh ? "子智能体工具" : "Agent Tools"}
        icon={<Bot size={16} />}
        color="indigo"
        hint={zh
          ? "委派任务给其他 Agent，适合多角色协作"
          : "Delegate tasks to other agents for multi-role collaboration"
        }
```

- [ ] **Step 2: 更新底部警告文字**

将第 155-157 行：

```tsx
        {zh
          ? "注意：子 Agent 的工具和技能将作为主 Agent 的扩展能力可用"
          : "Note: Sub-agent tools and skills will be available to the main agent"}
```

改为：

```tsx
        {zh
          ? "注意：子智能体的工具和技能将作为主 Agent 的扩展能力可用"
          : "Note: Sub-agent tools and skills will be available to the main agent"}
```

- [ ] **Step 3: 提交 SubAgentSelector 更改**

```bash
git add frontend/src/components/SubAgentSelector.tsx
git commit -m "feat(SubAgentSelector): update title to '子智能体工具'"
```

---

## Task 3: 更新 KnowledgeBaseSelector 组件标题

**Files:**
- Modify: `frontend/src/components/KnowledgeBaseSelector.tsx:56-63`

- [ ] **Step 1: 更新 MultiSelectPanel 的 title 和 hint 属性**

将第 56-63 行：

```tsx
    <MultiSelectPanel<KnowledgeBase>
      title={zh ? "知识库配置" : "Knowledge Base Configuration"}
      icon={<Database size={16} />}
      color="emerald"
      hint={zh
        ? "选择知识库后，智能体将基于私有文档内容回答问题"
        : "After selecting knowledge bases, the agent will answer questions based on private document content"
      }
```

改为：

```tsx
    <MultiSelectPanel<KnowledgeBase>
      title={zh ? "知识库工具" : "Knowledge Tools"}
      icon={<Database size={16} />}
      color="emerald"
      hint={zh
        ? "检索私有文档，让 Agent 基于你的资料回答"
        : "Search private documents to answer based on your data"
      }
```

- [ ] **Step 2: 提交 KnowledgeBaseSelector 更改**

```bash
git add frontend/src/components/KnowledgeBaseSelector.tsx
git commit -m "feat(KnowledgeBaseSelector): update title to '知识库工具'"
```

---

## Task 4: 重构 page.tsx 为嵌套面板结构

**Files:**
- Modify: `frontend/src/app/page.tsx:1757-2013`

这是最复杂的任务，需要：
1. 添加新的状态变量
2. 创建父级"工具配置"面板
3. 将四个子区块移入父面板内部
4. 添加计数徽章

### 4.1 添加新的状态变量

- [ ] **Step 1: 添加嵌套展开状态变量**

在 `// 展开/收起状态` 部分（约第 200 行），找到：

```tsx
  const [configToolsExpanded, setConfigToolsExpanded] = useState(true);
  const [configSkillsExpanded, setConfigSkillsExpanded] = useState(true);
```

改为：

```tsx
  const [configToolsExpanded, setConfigToolsExpanded] = useState(true);
  // 子区块展开状态（嵌套在工具配置面板内）
  const [mcpToolsExpanded, setMcpToolsExpanded] = useState(false);
  const [skillToolsExpanded, setSkillToolsExpanded] = useState(false);
  const [agentToolsExpanded, setAgentToolsExpanded] = useState(false);
  const [kbToolsExpanded, setKbToolsExpanded] = useState(false);
```

- [ ] **Step 2: 添加计算选中工具总数的变量**

在状态变量声明后添加（约第 220 行）：

```tsx
  // 计算已选中的工具总数
  const totalSelectedTools = selectedMcpServices.length + selectedSkills.length + selectedSubAgents.length + selectedKnowledgeBases.length;
```

### 4.2 添加 Settings 图标导入

- [ ] **Step 3: 确认 Settings 图标已导入**

检查文件顶部的 lucide-react 导入（约第 6-36 行），确保包含 `Settings`。如果没有，添加它：

```tsx
import {
  // ... existing imports
  Settings,
  // ...
} from "lucide-react";
```

### 4.3 重构 UI 结构

- [ ] **Step 4: 创建父级"工具配置"面板并嵌套四个子区块**

找到 `{/* Tool Config - MCP Services */}` 注释（约第 1757 行），将整个 Tool Config Card、Skills Config Card、SubAgentSelector 和 KnowledgeBaseSelector（约第 1757-2013 行）替换为：

```tsx
          {/* 工具配置 - 统一的父面板 */}
          <Card className={cn(
            "overflow-hidden transition-all duration-300",
            isEnvironmentCreating && "opacity-50 pointer-events-none"
          )}>
            {/* 父面板头部 */}
            <div
              className="px-5 py-4 border-b border-white/[0.05] flex items-center gap-3 bg-white/[0.02] cursor-pointer"
              onClick={() => !isEnvironmentCreating && setConfigToolsExpanded(!configToolsExpanded)}
            >
              <Settings size={16} className="text-gray-400" />
              <span className="font-medium text-sm text-gray-300 flex-1">
                {locale === "zh" ? "工具配置" : "Tools Configuration"}
              </span>
              {totalSelectedTools > 0 && (
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                  {totalSelectedTools}
                </span>
              )}
              {configToolsExpanded ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
              {isEnvironmentCreating && (
                <Loader2 size={14} className="text-blue-400 animate-spin" />
              )}
            </div>

            {configToolsExpanded && (
              <CardContent className="p-4 space-y-4">
                {/* MCP工具子区块 */}
                <div className="border border-white/[0.05] rounded-xl overflow-hidden">
                  <div
                    className="px-4 py-3 flex items-center gap-2 bg-white/[0.02] cursor-pointer"
                    onClick={() => setMcpToolsExpanded(!mcpToolsExpanded)}
                  >
                    <Plug size={14} className="text-emerald-400" />
                    <span className="font-medium text-sm text-gray-300 flex-1">
                      {locale === "zh" ? "MCP工具" : "MCP Tools"}
                    </span>
                    {selectedMcpServices.length > 0 && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                        {selectedMcpServices.length}
                      </span>
                    )}
                    {mcpToolsExpanded ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
                  </div>
                  {mcpToolsExpanded && (
                    <div className="p-4 border-t border-white/[0.05]">
                      <p className="text-xs text-gray-500 mb-3">
                        {locale === "zh"
                          ? "连接外部 API 和服务，Agent 可主动调用"
                          : "Connect external APIs and services that the agent can call"}
                      </p>
                      {mcpServices.length === 0 ? (
                        <div className="text-center py-4">
                          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mx-auto mb-2">
                            <Server size={16} className="text-gray-600" />
                          </div>
                          <p className="text-sm text-gray-500 mb-2">
                            {locale === "zh" ? "暂无可用的 MCP 服务" : "No MCP services available"}
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentView("list")}
                          >
                            {locale === "zh" ? "前往创建" : "Create One"}
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {mcpServices.map((service) => {
                            const isBuiltin = BUILTIN_SERVICES.includes(service.name);
                            const testResult = mcpTestResults[service.name];
                            const tools = testResult?.tools || [];
                            return (
                              <label
                                key={service.name}
                                className={cn(
                                  "flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all border",
                                  selectedMcpServices.includes(service.name)
                                    ? "bg-emerald-500/10 border-emerald-500/30"
                                    : "bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04]"
                                )}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedMcpServices.includes(service.name)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedMcpServices([...selectedMcpServices, service.name]);
                                    } else {
                                      setSelectedMcpServices(selectedMcpServices.filter((s) => s !== service.name));
                                    }
                                  }}
                                  className="mt-0.5 accent-emerald-500 w-4 h-4 rounded"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium text-sm text-gray-200">{service.name}</span>
                                    {isBuiltin && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
                                        {locale === "zh" ? "预置" : "builtin"}
                                      </span>
                                    )}
                                    <span
                                      className={cn(
                                        "w-2 h-2 rounded-full",
                                        service.enabled ? "bg-emerald-500" : "bg-gray-500"
                                      )}
                                    />
                                    <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-gray-400">
                                      {service.connection_type}
                                    </span>
                                    {testResult?.success && tools.length > 0 && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">
                                        {tools.length} {locale === "zh" ? "个工具" : "tools"}
                                      </span>
                                    )}
                                  </div>
                                  {service.description && (
                                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{service.description}</p>
                                  )}
                                  {testResult?.success && tools.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                      {tools.slice(0, 5).map((tool, idx) => (
                                        <span
                                          key={`tools-${service.name}-tool-${idx}`}
                                          title={tool.description || tool.name}
                                          className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-gray-400 font-mono cursor-help"
                                        >
                                          {tool.name}
                                        </span>
                                      ))}
                                      {tools.length > 5 && (
                                        <span className="text-[10px] px-1.5 py-0.5 text-gray-500">
                                          +{tools.length - 5}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 技能工具子区块 */}
                <div className="border border-white/[0.05] rounded-xl overflow-hidden">
                  <div
                    className="px-4 py-3 flex items-center gap-2 bg-white/[0.02] cursor-pointer"
                    onClick={() => setSkillToolsExpanded(!skillToolsExpanded)}
                  >
                    <BookOpen size={14} className="text-purple-400" />
                    <span className="font-medium text-sm text-gray-300 flex-1">
                      {locale === "zh" ? "技能工具" : "Skill Tools"}
                    </span>
                    {selectedSkills.length > 0 && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">
                        {selectedSkills.length}
                      </span>
                    )}
                    {skillToolsExpanded ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
                  </div>
                  {skillToolsExpanded && (
                    <div className="p-4 border-t border-white/[0.05]">
                      <p className="text-xs text-gray-500 mb-3">
                        {locale === "zh"
                          ? "注入行为指令，自动加载到系统提示词"
                          : "Inject behavior instructions, auto-loaded into system prompts"}
                      </p>
                      {skills.length === 0 ? (
                        <div className="text-center py-4">
                          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mx-auto mb-2">
                            <BookOpen size={16} className="text-gray-600" />
                          </div>
                          <p className="text-sm text-gray-500">
                            {locale === "zh" ? "暂无可用的技能" : "No skills available"}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {skills.map((skill) => {
                            const isBuiltin = skill.source === "builtin";
                            return (
                              <label
                                key={skill.name}
                                className={cn(
                                  "flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all border",
                                  selectedSkills.includes(skill.name)
                                    ? "bg-purple-500/10 border-purple-500/30"
                                    : "bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04]"
                                )}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedSkills.includes(skill.name)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedSkills([...selectedSkills, skill.name]);
                                    } else {
                                      setSelectedSkills(selectedSkills.filter((s) => s !== skill.name));
                                    }
                                  }}
                                  className="mt-0.5 accent-purple-500 w-4 h-4 rounded"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium text-sm text-gray-200">{skill.name}</span>
                                    {isBuiltin ? (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
                                        {locale === "zh" ? "官方" : "Official"}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">
                                        {locale === "zh" ? "自定义" : "Custom"}
                                      </span>
                                    )}
                                    {skill.version && (
                                      <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-gray-400">
                                        v{skill.version}
                                      </span>
                                    )}
                                  </div>
                                  {skill.description && (
                                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{skill.description}</p>
                                  )}
                                  {skill.tags && skill.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                      {skill.tags.map((tag) => (
                                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                                          {tag}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 子智能体工具子区块 */}
                <div className="border border-white/[0.05] rounded-xl overflow-hidden">
                  <div
                    className="px-4 py-3 flex items-center gap-2 bg-white/[0.02] cursor-pointer"
                    onClick={() => setAgentToolsExpanded(!agentToolsExpanded)}
                  >
                    <Bot size={14} className="text-indigo-400" />
                    <span className="font-medium text-sm text-gray-300 flex-1">
                      {locale === "zh" ? "子智能体工具" : "Agent Tools"}
                    </span>
                    {selectedSubAgents.length > 0 && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400">
                        {selectedSubAgents.length}
                      </span>
                    )}
                    {agentToolsExpanded ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
                  </div>
                  {agentToolsExpanded && (
                    <div className="p-4 border-t border-white/[0.05]">
                      <p className="text-xs text-gray-500 mb-3">
                        {locale === "zh"
                          ? "委派任务给其他 Agent，适合多角色协作"
                          : "Delegate tasks to other agents for multi-role collaboration"}
                      </p>
                      <SubAgentSelector
                        availableAgents={agents.map(agent => ({
                          name: agent.name,
                          persona: agent.description || "",
                          model_service: agent.model_service || null,
                          skills: [],
                          mcp_services: [],
                        }))}
                        currentAgentName={selectedAgent || undefined}
                        selectedAgents={selectedSubAgents}
                        onSelectionChange={setSelectedSubAgents}
                        cycleError={cycleError}
                        disabled={isEnvironmentCreating || isSaving}
                        hidePanelWrapper={true}
                      />
                    </div>
                  )}
                </div>

                {/* 知识库工具子区块 */}
                <div className="border border-white/[0.05] rounded-xl overflow-hidden">
                  <div
                    className="px-4 py-3 flex items-center gap-2 bg-white/[0.02] cursor-pointer"
                    onClick={() => setKbToolsExpanded(!kbToolsExpanded)}
                  >
                    <Database size={14} className="text-emerald-400" />
                    <span className="font-medium text-sm text-gray-300 flex-1">
                      {locale === "zh" ? "知识库工具" : "Knowledge Tools"}
                    </span>
                    {selectedKnowledgeBases.length > 0 && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                        {selectedKnowledgeBases.length}
                      </span>
                    )}
                    {kbToolsExpanded ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
                  </div>
                  {kbToolsExpanded && (
                    <div className="p-4 border-t border-white/[0.05]">
                      <p className="text-xs text-gray-500 mb-3">
                        {locale === "zh"
                          ? "检索私有文档，让 Agent 基于你的资料回答"
                          : "Search private documents to answer based on your data"}
                      </p>
                      <KnowledgeBaseSelector
                        selectedIds={selectedKnowledgeBases}
                        onChange={setSelectedKnowledgeBases}
                        disabled={isEnvironmentCreating || isSaving}
                        onCreateNew={() => { setEditingKb(null); setKbDialogOpen(true); }}
                        onItemClick={(kb) => { setSelectedKb(kb); setKbDetailOpen(true); }}
                        hidePanelWrapper={true}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
```

- [ ] **Step 5: 添加 Plug 图标导入**

在 lucide-react 导入中添加 `Plug`：

```tsx
import {
  // ... existing imports
  Plug,
  // ...
} from "lucide-react";
```

### 4.4 更新 SubAgentSelector 和 KnowledgeBaseSelector 支持 hidePanelWrapper

- [ ] **Step 6: 为 SubAgentSelector 添加 hidePanelWrapper prop**

修改 `frontend/src/components/SubAgentSelector.tsx`：

在 interface 中添加：

```tsx
interface SubAgentSelectorProps {
  // ... existing props
  /** Hide the outer panel wrapper (for nested use) */
  hidePanelWrapper?: boolean;
}
```

在函数参数中解构：

```tsx
export function SubAgentSelector({
  // ... existing params
  hidePanelWrapper = false,
}: SubAgentSelectorProps) {
```

修改返回部分，当 hidePanelWrapper 时只渲染内容：

```tsx
  // 当 hidePanelWrapper 为 true 时，只渲染内容部分（不含 MultiSelectPanel 外壳）
  if (hidePanelWrapper) {
    return (
      <div className="space-y-2">
        {cycleError && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <AlertTriangle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-sm text-red-400 font-medium mb-1">
                {cycleError.message || (zh ? "检测到循环依赖" : "Circular dependency detected")}
              </div>
              {cycleError.cycle_path && cycleError.cycle_path.length > 0 && (
                <div className="text-xs text-gray-500 font-mono">
                  {cycleError.cycle_path.join(" → ")}
                </div>
              )}
            </div>
          </div>
        )}
        {filteredAgents.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500">
              {zh ? "没有可用的 Agent" : "No available agents"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredAgents.map((agent) => {
              const isSelected = selectedAgents.includes(agent.name);
              return (
                <label
                  key={agent.name}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all border",
                    isSelected
                      ? "bg-indigo-500/10 border-indigo-500/30"
                      : "bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04]"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      if (e.target.checked) {
                        onSelectionChange([...selectedAgents, agent.name]);
                      } else {
                        onSelectionChange(selectedAgents.filter((a) => a !== agent.name));
                      }
                    }}
                    className="mt-0.5 accent-indigo-500 w-4 h-4 rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-gray-200">{agent.name}</span>
                      {agent.model_service && (
                        <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-gray-400">
                          {agent.model_service}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{agent.persona}</p>
                  </div>
                </label>
              );
            })}
          </div>
        )}
        <div className="text-xs text-gray-600 flex items-center gap-1.5">
          <AlertTriangle size={12} className="text-amber-500/60" />
          {zh
            ? "注意：子智能体的工具和技能将作为主 Agent 的扩展能力可用"
            : "Note: Sub-agent tools and skills will be available to the main agent"}
        </div>
      </div>
    );
  }

  // 默认渲染完整的 MultiSelectPanel
  return (
    // ... existing return statement
  );
```

- [ ] **Step 7: 为 KnowledgeBaseSelector 添加 hidePanelWrapper prop**

修改 `frontend/src/components/KnowledgeBaseSelector.tsx`：

在 interface 中添加：

```tsx
interface KnowledgeBaseSelectorProps {
  // ... existing props
  /** Hide the outer panel wrapper (for nested use) */
  hidePanelWrapper?: boolean;
}
```

在函数参数中解构：

```tsx
export function KnowledgeBaseSelector({
  // ... existing params
  hidePanelWrapper = false,
}: KnowledgeBaseSelectorProps) {
```

修改返回部分：

```tsx
  // 当 hidePanelWrapper 为 true 时，只渲染内容部分
  if (hidePanelWrapper) {
    return (
      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500">
              {zh ? "加载中..." : "Loading..."}
            </p>
          </div>
        ) : knowledgeBases.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500">
              {zh ? "还没有知识库，请先创建" : "No knowledge bases yet, please create one"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {knowledgeBases.map((kb) => {
              const isSelected = selectedIds.includes(kb.kb_id);
              return (
                <label
                  key={kb.kb_id}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all border",
                    isSelected
                      ? "bg-emerald-500/10 border-emerald-500/30"
                      : "bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04]"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      if (e.target.checked) {
                        onChange([...selectedIds, kb.kb_id]);
                      } else {
                        onChange(selectedIds.filter((id) => id !== kb.kb_id));
                      }
                    }}
                    className="mt-0.5 accent-emerald-500 w-4 h-4 rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-gray-200">{kb.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-gray-400">
                        {kb.doc_count} {zh ? "文档" : "docs"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                      {kb.description || (zh ? "暂无描述" : "No description")}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // 默认渲染完整的 MultiSelectPanel
  return (
    // ... existing return statement
  );
```

- [ ] **Step 8: 在 KnowledgeBaseSelector 中导入 cn**

```tsx
import { cn } from "@/lib/utils";
```

- [ ] **Step 9: 提交 page.tsx 重构**

```bash
git add frontend/src/app/page.tsx frontend/src/components/SubAgentSelector.tsx frontend/src/components/KnowledgeBaseSelector.tsx
git commit -m "feat(page): restructure tool config as nested panel with 4 sub-sections"
```

---

## Task 5: 手动测试验证

- [ ] **Step 1: 启动前端开发服务器**

```bash
cd /home/wremote/claude-dev/agent-builder-general && ./start.sh --skip-deps
```

Expected: 前端在 20880 端口启动成功

- [ ] **Step 2: 验证 UI 结构**

在浏览器中打开 http://localhost:20880，创建或编辑一个 Agent，检查：

1. ✅ "工具配置" 父面板显示，带有 Settings 图标
2. ✅ 父面板显示已选中工具总数（绿色徽章）
3. ✅ 点击父面板可展开/收起
4. ✅ 展开后显示四个子区块：MCP工具、技能工具、子智能体工具、知识库工具
5. ✅ 每个子区块有独立的展开/收起功能
6. ✅ 每个子区块显示说明文字
7. ✅ 每个子区块显示选中数量徽章

- [ ] **Step 3: 验证功能完整性**

1. ✅ 选择 MCP 服务后保存，刷新页面后状态保持
2. ✅ 选择技能后保存，刷新页面后状态保持
3. ✅ 选择子智能体后保存，刷新页面后状态保持
4. ✅ 选择知识库后保存，刷新页面后状态保持
5. ✅ 语言切换后所有标签正确更新

- [ ] **Step 4: 最终提交**

```bash
git add -A
git commit -m "feat: unify tool concept across MCP/Skills/SubAgent/KB"
```

---

## 验收清单

- [ ] 四个能力配置区块统一在"工具配置"大面板下
- [ ] 每个子区块标题带有"工具"后缀
- [ ] 每个子区块有说明文字帮助区分用途
- [ ] 中英文术语正确显示
- [ ] 原有功能（选择、保存、加载）不受影响
- [ ] 父面板计数徽章显示已选中工具总数
- [ ] 嵌套展开/收起状态正确工作
- [ ] 语言切换后所有标签正确更新
