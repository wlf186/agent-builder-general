# User Manual System Design

**Date:** 2026-03-19
**Status:** Draft
**Target Audience:** Non-technical end users

---

## Overview

A user manual system for Agent Builder that enables non-technical users to understand and use the platform through step-by-step guides. The system uses component-driven documentation that auto-syncs with code changes.

## Goals

1. Provide comprehensive user documentation for all UI components
2. Support bilingual content (English + Chinese)
3. Auto-refresh documentation when code changes
4. Enable users to perform UAT independently

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    User Manual System                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐      ┌──────────────────┐                │
│  │ React Components │      │ Static Site      │                │
│  │ (frontend/src/)  │      │ (docs-site/)     │                │
│  │                  │      │                  │                │
│  │ /** @userGuide   │      │  - Guides        │                │
│  │   * @title Chat  │ ───► │  - Reference     │                │
│  │   * @feature ... │      │  - Search        │                │
│  │   */             │      │                  │                │
│  └──────────────────┘      └──────────────────┘                │
│           │                         ▲                          │
│           ▼                         │                          │
│  ┌──────────────────────────────────────────┐                  │
│  │         Extraction Script                │                  │
│  │         (scripts/extract-user-guide.ts)  │                  │
│  │                                          │                  │
│  │  - Parse JSDoc @userGuide tags           │                  │
│  │  - Generate markdown files               │                  │
│  │  - Organize by feature category          │                  │
│  └──────────────────────────────────────────┘                  │
│                                              ▲                 │
│                                              │                 │
│  ┌──────────────────────────────────────────┐                  │
│  │         CI/CD Integration                │                  │
│  │                                          │                  │
│  │  - Pre-commit: Regenerate docs           │                  │
│  │  - PR check: Validate @userGuide tags    │                  │
│  │  - Deploy: Build & publish static site   │                  │
│  └──────────────────────────────────────────┘                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Data Flow:**
1. Developer adds `@userGuide` JSDoc to React component
2. Extraction script parses components and generates markdown
3. VitePress builds browsable documentation
4. CI ensures docs stay in sync with code

---

## JSDoc Format

### Tag Structure

```typescript
/**
 * @userGuide
 * @title.en {English Title}
 * @title.zh {中文标题}
 * @category {core|advanced|reference}
 * @description.en {English description}
 * @description.zh {中文描述}
 * @steps.en
 *   1. {Step 1 in English}
 *   2. {Step 2 in English}
 * @steps.zh
 *   1. {步骤1中文}
 *   2. {步骤2中文}
 * @tips.en
 *   - {English tip}
 * @tips.zh
 *   - {中文提示}
 * @related {ComponentName1, ComponentName2}
 * @screenshots ./screenshots/chat-interface.png
 */
```

### Tag Definitions

| Tag | Required | Description |
|-----|----------|-------------|
| `@userGuide` | Yes | Marks component for doc extraction |
| `@title.en` / `@title.zh` | Yes | Bilingual titles |
| `@category` | Yes | `core` (main workflows), `advanced` (MCP/skills), `reference` (technical) |
| `@description.en` / `@description.zh` | Yes | Bilingual descriptions in end-user language |
| `@steps.en` / `@steps.zh` | For workflows | Bilingual step-by-step instructions |
| `@tips.en` / `@tips.zh` | No | Bilingual hints |
| `@related` | No | Links to related components (no translation needed) |
| `@screenshots` | No | Paths to screenshot images |

### Example

```typescript
/**
 * @userGuide
 * @title.en Chat Interface
 * @title.zh 聊天界面
 * @category core
 * @description.en The main conversation area where you interact with your AI agent.
 *   Type messages, attach files, and see real-time responses with typewriter effect.
 * @description.zh 与AI智能体对话的主要区域。输入消息、附加文件，并观看打字机效果的实时响应。
 *
 * @steps.en
 *   1. Type your message in the text input at the bottom
 *   2. Optionally attach files using the paperclip icon (max 3 files, 100MB each)
 *   3. Press Enter or click Send to submit your message
 *   4. Watch the AI respond with real-time streaming
 *   5. View thinking process and tool calls in expandable sections
 * @steps.zh
 *   1. 在底部的文本输入框中输入消息
 *   2. 可选：使用回形针图标附加文件（最多3个文件，每个100MB）
 *   3. 按回车键或点击发送按钮提交消息
 *   4. 观看AI的实时流式响应
 *   5. 在可展开区域查看思考过程和工具调用
 *
 * @tips.en
 *   - Use Shift+Enter for multi-line messages
 *   - Click on tool calls to see what the agent is doing
 *   - Performance metrics show response time and token usage
 * @tips.zh
 *   - 使用 Shift+Enter 输入多行消息
 *   - 点击工具调用查看智能体的操作
 *   - 性能指标显示响应时间和Token使用量
 *
 * @related KnowledgeBaseSelector, FileUploader
 * @screenshots ./screenshots/chat-interface.png
 */
export function AgentChat({ ... }) { ... }
```

---

## Extraction Script

### Location

`scripts/extract-user-guide.ts`

### Data Model

```typescript
interface UserGuideDoc {
  component: string;
  category: 'core' | 'advanced' | 'reference';
  title: { en: string; zh: string };
  description: { en: string; zh: string };
  steps?: { en: string[]; zh: string[] };
  tips?: { en: string[]; zh: string[] };
  related: string[];
  screenshots: string[];
}
```

### Execution Flow

```
1. GLOB: Scan frontend/src/components/**/*.tsx
       │
       ▼
2. PARSE: Extract JSDoc blocks with @userGuide
       │
       ▼
3. TRANSFORM: Convert to UserGuideDoc objects
       │
       ▼
4. VALIDATE:
   - Required fields present (.en and .zh)
   - Valid category value
   - Related components exist
       │
       ▼
5. GENERATE:
   ├── docs/user-manual/en/{category}/{component}.md
   └── docs/user-manual/zh/{category}/{component}.md
       │
       ▼
6. INDEX: Generate index files (en/index.md, zh/index.md)
```

### Output Structure

```
docs/user-manual/
├── en/
│   ├── index.md
│   ├── core/
│   │   ├── chat-interface.md
│   │   ├── agent-creation.md
│   │   └── knowledge-base.md
│   └── advanced/
│       ├── mcp-services.md
│       └── langfuse-tracing.md
├── zh/
│   ├── index.md
│   ├── core/
│   │   ├── chat-interface.md
│   │   ├── agent-creation.md
│   │   └── knowledge-base.md
│   └── advanced/
│       ├── mcp-services.md
│       └── langfuse-tracing.md
└── screenshots/
    └── chat-interface.png
```

### Generated Markdown Format

```markdown
---
title: Chat Interface
category: core
component: AgentChat
related:
  - KnowledgeBaseSelector
  - FileUploader
---

# Chat Interface

The main conversation area where you interact with your AI agent.
Type messages, attach files, and see real-time responses with typewriter effect.

## How to Use

1. Type your message in the text input at the bottom
2. Optionally attach files using the paperclip icon (max 3 files, 100MB each)
3. Press Enter or click Send to submit your message
4. Watch the AI respond with real-time streaming
5. View thinking process and tool calls in expandable sections

## Tips

- Use Shift+Enter for multi-line messages
- Click on tool calls to see what the agent is doing
- Performance metrics show response time and token usage

## Related

- [Knowledge Base Selector](./knowledge-base-selector.md)
- [File Uploader](./file-uploader.md)
```

---

## Static Site Generator

### Choice: VitePress

**Reasons:**
- Native i18n support
- Fast build times
- Simple configuration
- Works well with existing Next.js project (no conflict)

### Directory Structure

```
docs-site/
├── .vitepress/
│   ├── config.ts          # Site config with i18n
│   └── theme/
│       └── custom.css     # Optional custom styling
├── package.json
├── en/
│   ├── index.md           # Homepage
│   ├── getting-started.md
│   ├── core/
│   │   └── *.md           # Auto-generated from extraction
│   └── advanced/
│       └── *.md
├── zh/
│   ├── index.md
│   ├── getting-started.md
│   ├── core/
│   │   └── *.md
│   └── advanced/
│       └── *.md
└── public/
    └── screenshots/       # Shared screenshots
```

### VitePress Config

```typescript
// docs-site/.vitepress/config.ts
import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Agent Builder User Guide',

  locales: {
    root: {
      label: 'English',
      lang: 'en',
      link: '/en/',
    },
    zh: {
      label: '简体中文',
      lang: 'zh-CN',
      link: '/zh/',
    },
  },

  themeConfig: {
    logo: '/logo.svg',
    nav: [
      { text: 'Getting Started', link: '/getting-started' },
      { text: 'Core Features', link: '/core/' },
      { text: 'Advanced', link: '/advanced/' },
    ],
    sidebar: {
      '/en/': [
        { text: 'Getting Started', link: '/en/getting-started' },
        { text: 'Core Features', items: [
          { text: 'Chat Interface', link: '/en/core/chat-interface' },
          { text: 'Managing Conversations', link: '/en/core/conversations' },
          { text: 'Creating Agents', link: '/en/core/agent-creation' },
          { text: 'Knowledge Bases', link: '/en/core/knowledge-base' },
          { text: 'Uploading Documents', link: '/en/core/document-upload' },
          { text: 'File Attachments', link: '/en/core/file-attachments' },
        ]},
        { text: 'Advanced', items: [
          { text: 'Model Services', link: '/en/advanced/model-services' },
          { text: 'MCP Services', link: '/en/advanced/mcp-services' },
          { text: 'Skills', link: '/en/advanced/skills' },
          { text: 'Langfuse Tracing', link: '/en/advanced/langfuse' },
        ]},
      ],
      '/zh/': [
        { text: '快速开始', link: '/zh/getting-started' },
        { text: '核心功能', items: [
          { text: '聊天界面', link: '/zh/core/chat-interface' },
          { text: '管理对话', link: '/zh/core/conversations' },
          { text: '创建智能体', link: '/zh/core/agent-creation' },
          { text: '知识库', link: '/zh/core/knowledge-base' },
          { text: '上传文档', link: '/zh/core/document-upload' },
          { text: '文件附件', link: '/zh/core/file-attachments' },
        ]},
        { text: '高级功能', items: [
          { text: '模型服务', link: '/zh/advanced/model-services' },
          { text: 'MCP服务', link: '/zh/advanced/mcp-services' },
          { text: '技能', link: '/zh/advanced/skills' },
          { text: 'Langfuse追踪', link: '/zh/advanced/langfuse' },
        ]},
      ],
    },
  },
})
```

### Build Commands

```json
// docs-site/package.json
{
  "scripts": {
    "dev": "vitepress dev",
    "build": "vitepress build",
    "preview": "vitepress preview"
  }
}
```

---

## CI/CD Integration

### Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  1. PRE-COMMIT HOOK (optional)                                  │
│     - Run extraction script                                     │
│     - Stage generated docs if changed                           │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. PR CHECK (GitHub Actions)                                   │
│     - Run extraction script                                     │
│     - Fail if generated docs differ from committed              │
│     - Validate all @userGuide tags have both .en/.zh            │
│     - Check screenshots exist                                   │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. BUILD & DEPLOY (on main merge)                              │
│     - Run extraction script                                     │
│     - Build VitePress site                                      │
│     - Deploy to GitHub Pages / Netlify / etc.                   │
└─────────────────────────────────────────────────────────────────┘
```

### GitHub Actions Workflow

```yaml
# .github/workflows/docs.yml
name: User Manual

on:
  pull_request:
    paths:
      - 'frontend/src/components/**/*.tsx'
      - 'docs/user-manual/**'
  push:
    branches: [main]
    paths:
      - 'frontend/src/components/**/*.tsx'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Extract user guides
        run: npm run docs:extract

      - name: Check for changes
        run: |
          if git diff --exit-code docs/user-manual/; then
            echo "✅ Docs are up to date"
          else
            echo "❌ Docs are out of sync. Run 'npm run docs:extract' and commit changes."
            exit 1
          fi

      - name: Validate bilingual content
        run: npm run docs:validate

  build-and-deploy:
    needs: validate
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build VitePress site
        run: |
          npm run docs:extract
          npm run docs:build

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./docs-site/.vitepress/dist
```

### NPM Scripts

```json
// package.json (root)
{
  "scripts": {
    "docs:extract": "tsx scripts/extract-user-guide.ts",
    "docs:validate": "tsx scripts/validate-user-guide.ts",
    "docs:dev": "cd docs-site && npm run dev",
    "docs:build": "cd docs-site && npm run build",
    "docs:preview": "cd docs-site && npm run preview"
  }
}
```

---

## Components to Document

### Priority Classification

| Priority | Description |
|----------|-------------|
| High | Core user workflows, must have |
| Medium | Important but less frequent |
| Low | Reference/niche use cases |

### Component List

| Category | Component | Priority |
|----------|-----------|----------|
| **Core** | `AgentChat.tsx` | High |
| **Core** | `SubAgentSelector.tsx` | High |
| **Core** | `ConversationDrawer.tsx` | High |
| **Core** | `ConversationList.tsx` | Medium |
| **Core** | `KnowledgeBaseSelector.tsx` | High |
| **Core** | `KnowledgeBaseDialog.tsx` | High |
| **Core** | `KbDetailPanel.tsx` | Medium |
| **Core** | `DocumentUploader.tsx` | High |
| **Core** | `FileUploader.tsx` | Medium |
| **Core** | `InitializationGuideCard.tsx` | Medium |
| **Advanced** | `ModelServiceDialog.tsx` | Medium |
| **Advanced** | `MCPServiceDialog.tsx` | Medium |
| **Advanced** | `SkillDetailDialog.tsx` | Low |
| **Advanced** | `SkillUploadDialog.tsx` | Low |
| **Advanced** | `MCPDiagnosticResult.tsx` | Low |
| **Reference** | `EnvironmentBanner.tsx` | Low |
| **Reference** | `EnvironmentErrorDialog.tsx` | Low |
| **Reference** | `SubAgentCallCard.tsx` | Low |

---

## Manual Structure

### End User Navigation

```
User Manual
│
├── 🏠 Getting Started
│   ├── What is Agent Builder?
│   ├── Quick Start (create first agent in 5 min)
│   └── UI Overview
│
├── 💬 Core Features
│   ├── Chat Interface
│   ├── Managing Conversations
│   ├── Creating & Editing Agents
│   ├── Knowledge Bases (RAG)
│   ├── Uploading Documents
│   └── File Attachments
│
├── ⚙️ Advanced Features
│   ├── Model Services
│   ├── MCP Services
│   ├── Skills
│   └── Langfuse Tracing
│
└── ❓ Help
    ├── FAQ
    └── Troubleshooting
```

### Langfuse Documentation (Advanced Section)

```
Langfuse Tracing
│
├── What is Langfuse?
│   "Langfuse helps you understand how the AI processes your requests."
│
├── Viewing Traces
│   1. Ask your admin for your Langfuse dashboard URL
│   2. Open the URL in your browser
│   3. Select a conversation to view details
│
├── Understanding Trace Data
│   - Input/Output: What you asked and what the AI responded
│   - Latency: How long each step took
│   - Token Usage: How many tokens were processed
│   - Tool Calls: Which tools the AI used
│
└── Tips
    - Use traces to understand why the AI gave a certain response
    - Share trace links with support for troubleshooting
```

---

## File Changes Summary

```
├── scripts/
│   ├── extract-user-guide.ts      # NEW: Extraction script
│   └── validate-user-guide.ts     # NEW: Validation script
├── docs-site/                      # NEW: VitePress site
│   ├── .vitepress/config.ts
│   ├── package.json
│   ├── en/
│   └── zh/
├── .github/workflows/
│   └── docs.yml                    # NEW: CI workflow
├── frontend/src/components/
│   └── *.tsx                       # MODIFY: Add @userGuide tags to 15+ components
└── package.json                    # MODIFY: Add docs scripts
```

---

## Success Criteria

1. **Coverage**: All 18 components documented with `@userGuide` tags
2. **Bilingual**: All user-facing content available in English and Chinese
3. **Sync**: CI validation ensures docs match component code
4. **Usability**: Non-technical users can complete UAT independently
5. **Deploy**: Static site auto-deploys on merge to main
