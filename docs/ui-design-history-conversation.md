# 历史会话记录功能 - 前端交互设计方案

## 1. 行业最佳实践调研

### 1.1 主流AI对话产品的历史会话设计

| 产品 | 交互方式 | 布局特点 | 会话卡片内容 |
|------|---------|---------|-------------|
| **ChatGPT** | 左侧边栏 | 固定侧边栏 + 可折叠 | 标题（自动生成）+ 编辑时间 |
| **Claude** | 左侧边栏 | 滑出式侧边栏 | 标题 + 简短预览 |
| **文心一言** | 左侧边栏 | 固定侧边栏 | 标题 + 时间 |
| **Kimi** | 左侧边栏 | 固定侧边栏 | 标题 + 消息数量 |
| **豆包** | 左侧边栏 | 可折叠侧边栏 | 标题 + 时间 + 预览 |

### 1.2 设计趋势总结

1. **侧边栏是主流**：几乎所有产品都采用侧边栏展示历史会话
2. **自动生成标题**：基于首次对话内容自动生成会话标题
3. **时间分组**：按"今天"、"昨天"、"7天内"、"更早"分组显示
4. **快捷操作**：支持重命名、删除、置顶等快捷操作
5. **新建会话**：明显的"新建对话"入口

### 1.3 本项目适配考量

- 当前项目调试对话区域在右侧卡片内
- 已有左侧配置面板，不适合再添加侧边栏
- 采用**抽屉式（Drawer）**设计更合适，从右侧滑出

---

## 2. UI布局设计

### 2.1 整体布局

```
+------------------------------------------------------------------+
|                        顶部导航栏                                  |
+------------------------------------------------------------------+
|          |                                    |                   |
|  左侧    |        配置面板                    |    调试对话       |
|  侧边栏  |        (Persona, Model, etc.)      |    +--------+    |
|          |                                    |    | 历史  |    |
|          |                                    |    +--------+    |
|          |                                    |                   |
|          |                                    |    [消息区域]     |
|          |                                    |                   |
|          |                                    |    [输入区域]     |
+------------------------------------------------------------------+

                    点击"历史"按钮后：

+------------------------------------------------------------------+
|                        顶部导航栏                                  |
+------------------------------------------------------------------+
|          |                        |              |               |
|  左侧    |    配置面板            |  调试对话    |   历史会话    |
|  侧边栏  |    (宽度不变)          |  (收窄)      |   抽屉面板    |
|          |                        |              |               |
|          |                        |              |  [会话列表]   |
|          |                        |              |               |
|          |                        |              |               |
|          |                        |              |               |
+------------------------------------------------------------------+
```

### 2.2 历史按钮位置

位于调试对话区域标题栏右侧：

```
+---------------------------------------------------+
|  [Bot icon] 调试对话          [历史] [清空]       |
+---------------------------------------------------+
```

### 2.3 历史会话抽屉布局

```
+------------------------------------------+
|  历史会话                    [新建] [X]  |
+------------------------------------------+
|  搜索: [________________] [搜索图标]     |
+------------------------------------------+
|                                          |
|  ┌────────────────────────────────────┐  |
|  │ 📅 今天                            │  |
|  ├────────────────────────────────────┤  |
|  │ ┌────────────────────────────────┐ │  |
|  │ │ [标题] 如何使用Python处理文件  │ │  |
|  │ │ 10:30 · 3条消息               │ │  |
|  │ │ 预览: 你好，我想问一下...     │ │  |
|  │ └────────────────────────────────┘ │  |
|  │                                    │  |
|  │ ┌────────────────────────────────┐ │  |
|  │ │ [标题] React组件优化建议      │ │  |
|  │ │ 09:15 · 5条消息               │ │  |
|  │ │ 预览: 关于性能优化...         │ │  |
|  │ └────────────────────────────────┘ │  |
|  ├────────────────────────────────────┤  |
|  │ 📅 昨天                            │  |
|  ├────────────────────────────────────┤  |
|  │ ┌────────────────────────────────┐ │  |
|  │ │ [标题] 代码审查对话           │ │  |
|  │ │ 14:20 · 8条消息               │  |
|  │ └────────────────────────────────┘ │  |
|  └────────────────────────────────────┘  |
|                                          |
+------------------------------------------+
```

### 2.4 会话卡片详细设计

```
+------------------------------------------------------------+
|  [标题] 如何使用Python处理文件                              |
|  ──────────────────────────────────────────────────────── |
|  ⏰ 10:30  ·  💬 3条消息  ·  🔥 进行中                     |
|  ──────────────────────────────────────────────────────── |
|  预览: 你好，我想问一下如何使用Python处理Excel文件...      |
|  ──────────────────────────────────────────────────────── |
|                                      [重命名] [删除]       |
+------------------------------------------------------------+

状态说明：
- 进行中：当前正在编辑的会话
- 已完成：历史会话
```

---

## 3. 交互流程设计

### 3.1 主流程图

```
                    ┌─────────────┐
                    │   调试对话   │
                    └──────┬──────┘
                           │
                    点击"历史"按钮
                           │
                           ▼
              ┌────────────────────────┐
              │   打开历史会话抽屉      │
              │   (从右侧滑入)         │
              └───────────┬────────────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
          ▼               ▼               ▼
    ┌───────────┐   ┌───────────┐   ┌───────────┐
    │ 点击会话   │   │ 新建会话   │   │ 搜索会话   │
    │ 切换历史   │   │           │   │           │
    └─────┬─────┘   └─────┬─────┘   └─────┬─────┘
          │               │               │
          ▼               ▼               ▼
    ┌───────────┐   ┌───────────┐   ┌───────────┐
    │ 加载历史   │   │ 创建新会话 │   │ 过滤列表   │
    │ 消息列表   │   │ 并切换     │   │           │
    └─────┬─────┘   └─────┬─────┘   └───────────┘
          │               │
          ▼               ▼
    ┌─────────────────────────┐
    │ 关闭抽屉，显示选中的会话 │
    └─────────────────────────┘
```

### 3.2 会话操作流程

```
会话卡片右键/长按菜单：

┌──────────────┐
│ 📌 置顶      │
│ ✏️ 重命名    │
│ 🗑️ 删除     │
│ 📥 导出     │
└──────────────┘

重命名流程：
1. 点击"重命名" → 标题变为可编辑输入框
2. 修改后按回车或点击外部 → 保存
3. 按Esc → 取消修改

删除流程：
1. 点击"删除" → 弹出确认对话框
2. 确认 → 删除会话并从列表移除
3. 如果删除的是当前会话 → 自动切换到新建会话状态
```

### 3.3 新建会话流程

```
┌─────────────────────────────────────────────┐
│                                             │
│  点击"新建"按钮                              │
│         │                                   │
│         ▼                                   │
│  ┌─────────────────┐                        │
│  │ 当前会话未保存?  │                        │
│  └────────┬────────┘                        │
│           │                                 │
│     ┌─────┴─────┐                          │
│     │           │                          │
│    是          否                          │
│     │           │                          │
│     ▼           │                          │
│  ┌──────────┐   │                          │
│  │ 提示保存 │   │                          │
│  │ 或放弃   │   │                          │
│  └────┬─────┘   │                          │
│       │         │                          │
│       └────┬────┘                          │
│            │                               │
│            ▼                               │
│  ┌─────────────────┐                       │
│  │ 清空当前消息     │                       │
│  │ 创建新会话ID     │                       │
│  │ 关闭抽屉         │                       │
│  │ 聚焦输入框       │                       │
│  └─────────────────┘                       │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 4. 组件结构设计

### 4.1 组件层级

```
page.tsx (主页)
├── ...
└── 调试对话区域 (Card)
    ├── CardHeader
    │   ├── 标题: "调试对话"
    │   └── 操作按钮组
    │       ├── HistoryButton (历史按钮) ← 新增
    │       └── ClearButton (清空按钮)
    ├── AgentChat (聊天组件)
    │   └── ... (现有内容)
    └── ConversationDrawer (历史会话抽屉) ← 新增
        ├── DrawerHeader
        │   ├── 标题: "历史会话"
        │   └── 操作按钮 (新建、关闭)
        ├── SearchInput (搜索框)
        └── ConversationList (会话列表)
            ├── DateGroup (日期分组)
            │   ├── 日期标题
            │   └── ConversationCard[] (会话卡片)
            │       ├── 会话标题
            │       ├── 元信息 (时间、消息数)
            │       ├── 预览文本
            │       └── 操作按钮 (重命名、删除)
            └── EmptyState (空状态)
```

### 4.2 新增组件文件结构

```
frontend/src/components/
├── AgentChat.tsx              (现有，需修改)
├── ConversationDrawer.tsx     (新增 - 抽屉组件)
├── ConversationList.tsx       (新增 - 会话列表)
├── ConversationCard.tsx       (新增 - 会话卡片)
└── ui/
    └── drawer.tsx             (新增 - 抽屉UI组件)
```

### 4.3 组件Props设计

```typescript
// ConversationDrawer.tsx
interface ConversationDrawerProps {
  open: boolean;                              // 是否打开
  onClose: () => void;                        // 关闭回调
  agentName: string;                          // 当前智能体名称
  currentConversationId: string | null;       // 当前会话ID
  onSelectConversation: (id: string) => void; // 选择会话回调
  onNewConversation: () => void;              // 新建会话回调
}

// ConversationList.tsx
interface ConversationListProps {
  conversations: Conversation[];              // 会话列表
  currentId: string | null;                   // 当前会话ID
  onSelect: (id: string) => void;             // 选择回调
  onRename: (id: string, newTitle: string) => void;  // 重命名回调
  onDelete: (id: string) => void;             // 删除回调
  searchQuery: string;                        // 搜索关键词
}

// ConversationCard.tsx
interface ConversationCardProps {
  conversation: Conversation;                 // 会话数据
  isActive: boolean;                          // 是否当前会话
  onSelect: () => void;                       // 选择回调
  onRename: (newTitle: string) => void;       // 重命名回调
  onDelete: () => void;                       // 删除回调
}

// 会话数据结构
interface Conversation {
  id: string;                                 // 会话ID
  agent_name: string;                         // 所属智能体
  title: string;                              // 会话标题
  preview: string;                            // 预览文本
  message_count: number;                      // 消息数量
  created_at: string;                         // 创建时间
  updated_at: string;                         // 更新时间
  is_active?: boolean;                        // 是否当前会话
}

// 消息数据结构 (用于历史存储)
interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thinking?: string;
  toolCalls?: ToolCall[];
  metrics?: PerformanceMetrics;
  timestamp: string;
}
```

---

## 5. 状态管理设计

### 5.1 状态结构

```typescript
// 在 page.tsx 中新增状态
const [conversationDrawerOpen, setConversationDrawerOpen] = useState(false);
const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
const [conversations, setConversations] = useState<Conversation[]>([]);

// 在 AgentChat.tsx 中新增 props
interface AgentChatProps {
  agentName: string;
  shortTermMemory?: number;
  // 新增
  conversationId?: string | null;
  onConversationChange?: (id: string, messages: ChatMessage[]) => void;
}
```

### 5.2 状态流转

```
                    ┌──────────────────────────────┐
                    │       page.tsx               │
                    │  ┌────────────────────────┐  │
                    │  │ conversations          │  │
                    │  │ currentConversationId  │  │
                    │  │ conversationDrawerOpen │  │
                    │  └────────────────────────┘  │
                    └──────────────┬───────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
              ▼                    ▼                    ▼
    ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
    │ ConversationDrawer│ │   AgentChat    │  │  API Calls     │
    │                 │  │                 │  │                 │
    │ 显示会话列表     │  │ 加载/保存消息   │  │ CRUD 操作      │
    │ 处理选择/新建    │  │                 │  │                 │
    └─────────────────┘  └─────────────────┘  └─────────────────┘
```

### 5.3 数据持久化策略

```
存储位置：后端数据库/文件

数据流向：
┌──────────┐     ┌──────────┐     ┌──────────┐
│ 前端状态  │ ←→ │  后端API │ ←→ │ 数据存储  │
└──────────┘     └──────────┘     └──────────┘

保存时机：
1. 每次发送消息后自动保存
2. 切换会话时保存当前会话
3. 关闭页面时保存 (beforeunload)

加载时机：
1. 切换智能体时加载会话列表
2. 选择历史会话时加载消息
3. 页面刷新时恢复上次会话
```

---

## 6. API接口需求

### 6.1 新增API端点

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/agents/{name}/conversations` | 获取会话列表 |
| POST | `/api/agents/{name}/conversations` | 创建新会话 |
| GET | `/api/agents/{name}/conversations/{id}` | 获取会话详情（消息列表） |
| PUT | `/api/agents/{name}/conversations/{id}` | 更新会话（重命名） |
| DELETE | `/api/agents/{name}/conversations/{id}` | 删除会话 |
| POST | `/api/agents/{name}/conversations/{id}/messages` | 添加消息到会话 |

### 6.2 API数据格式

```typescript
// GET /api/agents/{name}/conversations
// Response
{
  "conversations": [
    {
      "id": "conv-123",
      "title": "如何使用Python处理文件",
      "preview": "你好，我想问一下...",
      "message_count": 3,
      "created_at": "2026-03-10T10:30:00Z",
      "updated_at": "2026-03-10T10:45:00Z"
    }
  ],
  "total": 10
}

// GET /api/agents/{name}/conversations/{id}
// Response
{
  "id": "conv-123",
  "title": "如何使用Python处理文件",
  "messages": [
    {
      "id": "msg-1",
      "role": "user",
      "content": "你好，我想问一下如何使用Python处理Excel文件",
      "timestamp": "2026-03-10T10:30:00Z"
    },
    {
      "id": "msg-2",
      "role": "assistant",
      "content": "Python处理Excel文件可以使用...",
      "thinking": "用户想要了解Python处理Excel...",
      "toolCalls": [],
      "metrics": {
        "first_token_latency": 200,
        "total_tokens": 150,
        "total_duration": 3000
      },
      "timestamp": "2026-03-10T10:30:05Z"
    }
  ],
  "created_at": "2026-03-10T10:30:00Z",
  "updated_at": "2026-03-10T10:45:00Z"
}

// POST /api/agents/{name}/conversations
// Request
{
  "title": "新对话"  // 可选，默认自动生成
}
// Response
{
  "id": "conv-456",
  "title": "新对话",
  "messages": [],
  "created_at": "2026-03-10T11:00:00Z"
}

// PUT /api/agents/{name}/conversations/{id}
// Request
{
  "title": "Python Excel处理方案"
}
// Response
{
  "success": true,
  "conversation": { ... }
}

// POST /api/agents/{name}/conversations/{id}/messages
// Request
{
  "role": "user",
  "content": "谢谢你的回答"
}
// Response
{
  "success": true,
  "message": { ... }
}
```

---

## 7. UI样式规范

### 7.1 颜色方案 (延续现有风格)

```css
/* 主色调 */
--emerald-500: #10b981;  /* 主操作按钮、选中状态 */
--blue-500: #3b82f6;     /* 用户消息气泡、链接 */
--purple-500: #8b5cf6;   /* 技能相关 */

/* 抽屉背景 */
background: rgba(15, 15, 20, 0.98);  /* 深色背景 */
border-left: 1px solid rgba(255, 255, 255, 0.05);

/* 会话卡片 */
--card-bg: rgba(255, 255, 255, 0.02);
--card-hover: rgba(255, 255, 255, 0.05);
--card-active: rgba(16, 185, 129, 0.1);
--card-border-active: rgba(16, 185, 129, 0.3);

/* 文字颜色 */
--text-primary: #e5e7eb;    /* 标题 */
--text-secondary: #9ca3af;  /* 预览文本 */
--text-muted: #6b7280;      /* 时间、数量 */
```

### 7.2 尺寸规范

```css
/* 抽屉宽度 */
.drawer-width {
  width: 360px;           /* 桌面端 */
  max-width: 90vw;        /* 移动端 */
}

/* 会话卡片 */
.conversation-card {
  padding: 12px 16px;
  margin: 8px 12px;
  border-radius: 12px;
}

/* 搜索框 */
.search-input {
  height: 40px;
  margin: 12px 16px;
}

/* 按钮 */
.history-button {
  padding: 6px 12px;
  font-size: 12px;
  border-radius: 8px;
}
```

### 7.3 动画效果

```typescript
// 抽屉滑入动画
const drawerVariants = {
  closed: {
    x: "100%",
    opacity: 0,
    transition: { duration: 0.25, ease: "easeOut" }
  },
  open: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.25, ease: "easeOut" }
  }
};

// 会话卡片悬停效果
.card-hover {
  transition: all 0.2s ease;
}
.card-hover:hover {
  background: rgba(255, 255, 255, 0.05);
  transform: translateX(4px);
}
```

---

## 8. 国际化支持

### 8.1 新增翻译Key

```typescript
// 添加到 frontend/src/lib/i18n.ts

// 中文
{
  // 历史会话
  historyConversations: "历史会话",
  newConversation: "新对话",
  searchConversations: "搜索会话...",
  today: "今天",
  yesterday: "昨天",
  last7Days: "7天内",
  earlier: "更早",
  noConversations: "暂无历史会话",
  noConversationsDesc: "开始对话后会自动保存在这里",
  rename: "重命名",
  deleteConversation: "删除会话",
  deleteConfirm: "确定删除此会话？",
  deleteWarning: "删除后无法恢复",
  exportConversation: "导出会话",
  messages: "条消息",
  inProgress: "进行中",
  clearCurrent: "清空当前",
  clearConfirm: "确定清空当前对话？",
  unsavedChanges: "当前对话未保存",
  saveOrDiscard: "是否保存当前对话？",
  save: "保存",
  discard: "放弃",
  conversationTitle: "会话标题",
  editTitle: "编辑标题",
}

// 英文
{
  // History Conversations
  historyConversations: "History",
  newConversation: "New Chat",
  searchConversations: "Search conversations...",
  today: "Today",
  yesterday: "Yesterday",
  last7Days: "Last 7 Days",
  earlier: "Earlier",
  noConversations: "No conversations yet",
  noConversationsDesc: "Your conversations will be saved here",
  rename: "Rename",
  deleteConversation: "Delete Chat",
  deleteConfirm: "Delete this conversation?",
  deleteWarning: "This cannot be undone",
  exportConversation: "Export Chat",
  messages: "messages",
  inProgress: "In Progress",
  clearCurrent: "Clear",
  clearConfirm: "Clear current conversation?",
  unsavedChanges: "Unsaved changes",
  saveOrDiscard: "Save current conversation?",
  save: "Save",
  discard: "Discard",
  conversationTitle: "Conversation Title",
  editTitle: "Edit Title",
}
```

---

## 9. 响应式设计

### 9.1 断点设计

```css
/* 桌面端 (> 1024px) */
- 抽屉固定宽度 360px
- 聊天区域自动收缩

/* 平板端 (768px - 1024px) */
- 抽屉宽度 320px
- 配置面板可折叠

/* 移动端 (< 768px) */
- 抽屉全屏覆盖
- 配置面板隐藏
- 历史按钮移至顶部工具栏
```

### 9.2 移动端适配

```
移动端布局：

+------------------------+
| [返回] 调试对话 [历史] |
+------------------------+
|                        |
|      [消息区域]        |
|                        |
|                        |
+------------------------+
| [输入框]        [发送] |
+------------------------+

点击历史后：

+------------------------+
| [返回] 历史会话   [新建]|
+------------------------+
| [搜索框]               |
+------------------------+
| [会话卡片1]            |
| [会话卡片2]            |
| [会话卡片3]            |
| ...                    |
+------------------------+
```

---

## 10. 实现优先级

### Phase 1: MVP (最小可行产品)
1. 历史按钮 + 抽屉组件基础结构
2. 会话列表展示（不含分组）
3. 切换会话功能
4. 新建会话功能
5. 基础API集成

### Phase 2: 增强功能
1. 时间分组显示
2. 搜索功能
3. 重命名功能
4. 删除功能
5. 国际化支持

### Phase 3: 优化完善
1. 导出会话
2. 置顶功能
3. 响应式优化
4. 动画效果
5. 性能优化（虚拟滚动）

---

## 11. 注意事项

### 11.1 流式输出兼容性

根据项目CLAUDE.md的约束，**不能影响现有的流式输出功能**：

- AgentChat组件的修改必须保留现有的flushSync渲染逻辑
- 会话切换时需要正确处理AbortController
- 新增状态不能干扰streamingContentRef等ref的使用

### 11.2 数据一致性

- 切换会话前需保存当前会话状态
- 确保消息顺序正确
- 处理网络失败时的数据恢复

### 11.3 性能考虑

- 大量会话时使用虚拟滚动
- 消息列表懒加载
- 防抖搜索输入

---

## 12. 代码示例

### 12.1 历史按钮组件

```tsx
// frontend/src/components/HistoryButton.tsx
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/LocaleContext";

interface HistoryButtonProps {
  onClick: () => void;
  hasUnsaved?: boolean;
}

export function HistoryButton({ onClick, hasUnsaved }: HistoryButtonProps) {
  const { t } = useLocale();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="text-xs text-gray-400 hover:text-white hover:bg-white/10"
    >
      <Clock className="w-3.5 h-3.5 mr-1.5" />
      {t("historyConversations")}
      {hasUnsaved && (
        <span className="ml-1.5 w-2 h-2 bg-emerald-500 rounded-full" />
      )}
    </Button>
  );
}
```

### 12.2 抽屉组件框架

```tsx
// frontend/src/components/ConversationDrawer.tsx
"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Search, MoreHorizontal } from "lucide-react";
import { useLocale } from "@/lib/LocaleContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConversationList } from "./ConversationList";

interface ConversationDrawerProps {
  open: boolean;
  onClose: () => void;
  agentName: string;
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
}

export function ConversationDrawer({
  open,
  onClose,
  agentName,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
}: ConversationDrawerProps) {
  const { t } = useLocale();
  const [searchQuery, setSearchQuery] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 加载会话列表
  useEffect(() => {
    if (open && agentName) {
      loadConversations();
    }
  }, [open, agentName]);

  const loadConversations = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/agents/${agentName}/conversations`);
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch (e) {
      console.error("Failed to load conversations:", e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* 遮罩层 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 z-40"
            onClick={onClose}
          />

          {/* 抽屉面板 */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-[360px] max-w-[90vw] bg-[#0f0f14] border-l border-white/5 z-50 flex flex-col"
          >
            {/* 头部 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <h2 className="text-sm font-medium text-gray-200">
                {t("historyConversations")}
              </h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onNewConversation}
                  className="text-xs text-emerald-400 hover:text-emerald-300"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  {t("newConversation")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="text-gray-500 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* 搜索框 */}
            <div className="px-4 py-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("searchConversations")}
                  className="pl-9 bg-white/5 border-white/10"
                />
              </div>
            </div>

            {/* 会话列表 */}
            <div className="flex-1 overflow-y-auto">
              <ConversationList
                conversations={conversations}
                currentId={currentConversationId}
                searchQuery={searchQuery}
                isLoading={isLoading}
                onSelect={(id) => {
                  onSelectConversation(id);
                  onClose();
                }}
                onRename={handleRename}
                onDelete={handleDelete}
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

### 12.3 修改后的调试对话区域

```tsx
// 在 page.tsx 的调试对话区域添加历史按钮

// 状态定义
const [conversationDrawerOpen, setConversationDrawerOpen] = useState(false);
const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);

// JSX 修改
<Card className="sticky top-24 overflow-hidden h-[calc(100vh-180px)] min-h-[500px]">
  <div className="px-5 py-4 border-b border-white/[0.05] flex items-center justify-between bg-white/[0.02]">
    <div className="flex items-center gap-3">
      <Bot size={16} className="text-emerald-400" />
      <span className="font-medium text-sm text-gray-300">{t("debugChat")}</span>
    </div>
    <div className="flex items-center gap-2">
      {/* 历史按钮 */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setConversationDrawerOpen(true)}
        className="text-xs text-gray-400 hover:text-white hover:bg-white/10"
      >
        <Clock className="w-3.5 h-3.5 mr-1.5" />
        {t("historyConversations")}
      </Button>
      {/* 清空按钮 */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleClearChat}
        className="text-xs text-gray-400 hover:text-white hover:bg-white/10"
      >
        <Trash2 className="w-3.5 h-3.5 mr-1.5" />
        {t("clearCurrent")}
      </Button>
    </div>
  </div>
  <div className="h-[calc(100%-57px)]">
    <AgentChat
      agentName={selectedAgent || ""}
      shortTermMemory={shortTermMemory}
      conversationId={currentConversationId}
      onConversationChange={handleConversationChange}
    />
  </div>
</Card>

{/* 历史会话抽屉 */}
<ConversationDrawer
  open={conversationDrawerOpen}
  onClose={() => setConversationDrawerOpen(false)}
  agentName={selectedAgent || ""}
  currentConversationId={currentConversationId}
  onSelectConversation={handleSelectConversation}
  onNewConversation={handleNewConversation}
/>
```

---

## 附录：参考资料

- [ChatGPT UI Design](https://chat.openai.com)
- [Claude AI Interface](https://claude.ai)
- [shadcn/ui Drawer Component](https://ui.shadcn.com/docs/components/drawer)
- [Framer Motion Animation](https://www.framer.com/motion/)
- [Tailwind CSS Responsive Design](https://tailwindcss.com/docs/responsive-design)
