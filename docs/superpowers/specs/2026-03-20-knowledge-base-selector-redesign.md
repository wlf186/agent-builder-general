# Knowledge Base Selector UI Redesign

**Date**: 2026-03-20
**Status**: Draft
**Author**: Claude (Brainstorming Session)

## Problem Statement

The current `KnowledgeBaseSelector` component has significant issues:

1. **Visual inconsistency**: White background style conflicts with the dark theme used by `SubAgentSelector` and other components
2. **Poor interaction**: Dropdown has limited height (`max-h-60`), descriptions are truncated, no search functionality
3. **Missing information**: No document count, chunk count, or other metadata displayed
4. **No quick actions**: Cannot create new knowledge base or view details directly from selector

## Goals

- Unify visual style with `SubAgentSelector` (dark theme, glassmorphism)
- Provide rich interaction: search, full descriptions, metadata badges
- Enable quick actions: create new, view details
- Extract reusable component for future similar selectors

## Solution: MultiSelectPanel Component

### Architecture

Create a generic `MultiSelectPanel<T>` component that both `KnowledgeBaseSelector` and `SubAgentSelector` will use.

```
components/
├── ui/
│   └── MultiSelectPanel.tsx    ← NEW: Generic multi-select panel
├── KnowledgeBaseSelector.tsx   ← REFACTOR: Use MultiSelectPanel
└── SubAgentSelector.tsx        ← REFACTOR: Use MultiSelectPanel
```

### Component Interface

```typescript
interface MultiSelectPanelProps<T> {
  // Display configuration
  title: string;              // "知识库配置" / "子 Agent 配置"
  icon: ReactNode;            // Icon element
  color: ThemeColor;          // "emerald" | "indigo" | etc.

  // Data
  items: T[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;

  // Item rendering
  getId: (item: T) => string;
  getTitle: (item: T) => string;
  getDescription: (item: T) => string;
  getBadges?: (item: T) => Badge[];

  // Optional features
  searchPlaceholder?: string;
  emptyMessage?: string;
  hint?: string;
  onCreateNew?: () => void;
  onItemClick?: (item: T) => void;

  // State
  disabled?: boolean;
  loading?: boolean;
  defaultExpanded?: boolean;
}

interface Badge {
  label: string;
  variant?: 'default' | 'primary' | 'secondary';
}
```

### Visual Design

**Panel Structure:**
- Collapsible header with icon, title, count badge, expand/collapse indicator
- Hint section (optional)
- Selected items section with detailed cards
- Search input
- Available items list with checkboxes
- "Create new" button (optional)

**Styling:**
- Dark theme: `bg-white/[0.02]`, `border-white/[0.08]`
- Theme color accents: emerald for knowledge base, indigo for sub-agents
- Smooth expand/collapse animation via Framer Motion

### Features for KnowledgeBaseSelector

| Feature | Implementation |
|---------|----------------|
| Search | Filter by name and description |
| Document count | Badge showing "X 文档" |
| Chunk count | Badge showing "X 分块" |
| Full description | Display in card, not truncated |
| Create new | Call `onCreateNew` callback |
| View details | Call `onItemClick` to open KbDetailPanel |

### Data Mapping

```typescript
// KnowledgeBaseSelector usage
<MultiSelectPanel<KnowledgeBase>
  title="知识库配置"
  icon={<Database />}
  color="emerald"
  items={knowledgeBases}
  selectedIds={selectedIds}
  onChange={onChange}
  getId={(kb) => kb.kb_id}
  getTitle={(kb) => kb.name}
  getDescription={(kb) => kb.description || "暂无描述"}
  getBadges={(kb) => [
    { label: `${kb.doc_count} 文档` },
    { label: `${kb.chunk_count} 分块` },
  ]}
  searchPlaceholder="搜索知识库..."
  hint="选择知识库后，智能体将基于私有文档内容回答问题"
  onCreateNew={onCreateKb}
  onItemClick={(kb) => onSelectKb(kb)}
/>
```

## Implementation Plan

### Phase 1: Create MultiSelectPanel Component
1. Create `components/ui/MultiSelectPanel.tsx`
2. Implement all features: expand/collapse, search, selection, badges
3. Add Framer Motion animations
4. Support theme color variants

### Phase 2: Refactor KnowledgeBaseSelector
1. Replace current implementation with MultiSelectPanel
2. Map KnowledgeBase data to component props
3. Add create/view callbacks
4. Test all interactions

### Phase 3: Refactor SubAgentSelector
1. Replace current implementation with MultiSelectPanel
2. Map SubAgentInfo data to component props
3. Preserve cycle dependency error handling
4. Verify feature parity

### Phase 4: Testing & Polish
1. Visual regression testing
2. Interaction testing (search, select, create)
3. Accessibility review
4. Performance check (large lists)

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `components/ui/MultiSelectPanel.tsx` | NEW | Generic multi-select panel component |
| `components/KnowledgeBaseSelector.tsx` | REFACTOR | Use MultiSelectPanel |
| `components/SubAgentSelector.tsx` | REFACTOR | Use MultiSelectPanel |

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| SubAgentSelector regression | Thorough testing, feature comparison checklist |
| Performance with many items | Virtual scrolling if > 100 items |
| Accessibility | ARIA labels, keyboard navigation |

## Success Criteria

- [ ] Visual consistency: Both selectors use identical styling
- [ ] Search works for knowledge bases
- [ ] All metadata (doc count, chunk count) displayed
- [ ] Create new knowledge base from selector
- [ ] View knowledge base details from selector
- [ ] SubAgentSelector maintains all existing functionality
