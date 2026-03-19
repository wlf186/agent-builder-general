# User Manual System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a component-driven user manual system with bilingual support (EN/ZH) that auto-syncs documentation with React component code.

**Architecture:** JSDoc `@userGuide` tags embedded in React components are extracted by a TypeScript script into markdown files, which are built into a VitePress static site with i18n support. CI validates docs stay in sync.

**Tech Stack:** TypeScript, VitePress, tsx (for running TS scripts), GitHub Actions

---

## File Structure

```
scripts/
├── extract-user-guide.ts     # NEW: Parse components, generate markdown
└── validate-user-guide.ts    # NEW: Validate @userGuide tags

docs-site/                     # NEW: VitePress static site
├── .vitepress/
│   └── config.ts             # Site config with i18n
├── package.json
├── en/
│   ├── index.md              # Homepage (manual)
│   ├── getting-started.md    # Quick start guide (manual)
│   ├── core/                 # Auto-generated
│   └── advanced/             # Auto-generated
├── zh/
│   ├── index.md              # 首页 (manual)
│   ├── getting-started.md    # 快速开始 (manual)
│   ├── core/                 # Auto-generated
│   └── advanced/             # Auto-generated
└── public/
    └── screenshots/          # Screenshot images

.github/workflows/
└── docs.yml                   # NEW: CI workflow

package.json                   # MODIFY: Add docs scripts

frontend/src/components/*.tsx  # MODIFY: Add @userGuide tags (18 files)
```

---

## Task 1: Create Extraction Script

**Files:**
- Create: `scripts/extract-user-guide.ts`

- [ ] **Step 1: Create the extraction script with data types and parser**

```typescript
// scripts/extract-user-guide.ts
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

// Data model for extracted documentation
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

// Parse @userGuide JSDoc block from component source
function parseUserGuide(source: string, componentName: string): UserGuideDoc | null {
  // Match JSDoc block containing @userGuide
  const jsdocRegex = /\/\*\*[\s\S]*?@userGuide[\s\S]*?\*\//;
  const match = source.match(jsdocRegex);

  if (!match) return null;

  const block = match[0];

  // Extract tag values
  const getTag = (tag: string): string => {
    const regex = new RegExp(`@${tag}\\s+(.+?)(?=@\\w+|\\*\\/)`, 's');
    const m = block.match(regex);
    return m ? m[1].replace(/\s*\*\s*/g, ' ').trim() : '';
  };

  const getList = (tag: string): string[] => {
    const value = getTag(tag);
    if (!value) return [];
    return value
      .split(/\n/)
      .map(line => line.replace(/^\s*\d+\.\s*/, '').replace(/^\s*-\s*/, '').trim())
      .filter(Boolean);
  };

  const category = getTag('category') as 'core' | 'advanced' | 'reference';
  if (!['core', 'advanced', 'reference'].includes(category)) {
    console.error(`Invalid category "${category}" in ${componentName}`);
    return null;
  }

  return {
    component: componentName,
    category,
    title: {
      en: getTag('title.en'),
      zh: getTag('title.zh'),
    },
    description: {
      en: getTag('description.en'),
      zh: getTag('description.zh'),
    },
    steps: {
      en: getList('steps.en'),
      zh: getList('steps.zh'),
    },
    tips: {
      en: getList('tips.en'),
      zh: getList('tips.zh'),
    },
    related: getTag('related').split(',').map(s => s.trim()).filter(Boolean),
    screenshots: getTag('screenshots').split(',').map(s => s.trim()).filter(Boolean),
  };
}

// Convert component name to kebab-case filename
function toKebabCase(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

// Generate markdown for a language
function generateMarkdown(doc: UserGuideDoc, lang: 'en' | 'zh'): string {
  const frontmatter = `---
title: ${doc.title[lang]}
category: ${doc.category}
component: ${doc.component}
related:
${doc.related.map(r => `  - ${r}`).join('\n')}
---
`;

  const title = `# ${doc.title[lang]}\n\n`;
  const description = `${doc.description[lang]}\n\n`;

  let steps = '';
  if (doc.steps && doc.steps[lang] && doc.steps[lang].length > 0) {
    const heading = lang === 'en' ? '## How to Use\n\n' : '## 使用方法\n\n';
    steps = heading + doc.steps[lang].map((s, i) => `${i + 1}. ${s}`).join('\n') + '\n\n';
  }

  let tips = '';
  if (doc.tips && doc.tips[lang] && doc.tips[lang].length > 0) {
    const heading = lang === 'en' ? '## Tips\n\n' : '## 提示\n\n';
    tips = heading + doc.tips[lang].map(t => `- ${t}`).join('\n') + '\n\n';
  }

  let related = '';
  if (doc.related.length > 0) {
    const heading = lang === 'en' ? '## Related\n\n' : '## 相关\n\n';
    related = heading + doc.related.map(r => {
      const kebab = toKebabCase(r);
      return `- [${r}](./${kebab}.md)`;
    }).join('\n') + '\n';
  }

  return frontmatter + title + description + steps + tips + related;
}

// Generate index file for a category
function generateIndex(docs: UserGuideDoc[], category: string, lang: 'en' | 'zh'): string {
  const categoryDocs = docs.filter(d => d.category === category);
  const categoryNames: Record<string, Record<string, string>> = {
    core: { en: 'Core Features', zh: '核心功能' },
    advanced: { en: 'Advanced Features', zh: '高级功能' },
    reference: { en: 'Reference', zh: '参考' },
  };

  let content = `---
title: ${categoryNames[category][lang]}
---
\n`;
  content += `# ${categoryNames[category][lang]}\n\n`;

  for (const doc of categoryDocs) {
    const kebab = toKebabCase(doc.component);
    content += `- [${doc.title[lang]}](./${kebab}.md)\n`;
  }

  return content;
}

// Main extraction function
async function extractUserGuides() {
  const componentsDir = path.resolve(__dirname, '../frontend/src/components');
  const outputDir = path.resolve(__dirname, '../docs-site');

  // Find all TSX files
  const files = await glob('**/*.tsx', { cwd: componentsDir });
  console.log(`Found ${files.length} component files`);

  const docs: UserGuideDoc[] = [];

  for (const file of files) {
    const filePath = path.join(componentsDir, file);
    const source = fs.readFileSync(filePath, 'utf-8');
    const componentName = path.basename(file, '.tsx');

    const doc = parseUserGuide(source, componentName);
    if (doc) {
      docs.push(doc);
      console.log(`✓ Extracted @userGuide from ${componentName}`);
    }
  }

  console.log(`\nExtracted ${docs.length} user guide documents`);

  // Generate markdown files for each language
  for (const lang of ['en', 'zh'] as const) {
    const langDir = path.join(outputDir, lang);

    // Create category directories
    for (const category of ['core', 'advanced', 'reference']) {
      const categoryDir = path.join(langDir, category);
      fs.mkdirSync(categoryDir, { recursive: true });
    }

    // Write component docs
    for (const doc of docs) {
      const markdown = generateMarkdown(doc, lang);
      const filename = toKebabCase(doc.component) + '.md';
      const outputPath = path.join(langDir, doc.category, filename);
      fs.writeFileSync(outputPath, markdown);
      console.log(`  Written: ${lang}/${doc.category}/${filename}`);
    }

    // Write category index files
    for (const category of ['core', 'advanced', 'reference']) {
      const indexContent = generateIndex(docs, category, lang);
      const indexPath = path.join(langDir, category, 'index.md');
      fs.writeFileSync(indexPath, indexContent);
    }
  }

  console.log('\n✅ User guide extraction complete!');
}

extractUserGuides().catch(console.error);
```

- [ ] **Step 2: Install glob dependency**

```bash
cd /home/wremote/claude-dev/agent-builder-general && npm install --save-dev glob @types/glob
```

- [ ] **Step 3: Test extraction script**

```bash
npx tsx scripts/extract-user-guide.ts
```

Expected: Script runs but finds no @userGuide tags yet (outputs "Extracted 0 user guide documents")

- [ ] **Step 4: Commit extraction script**

```bash
git add scripts/extract-user-guide.ts package.json package-lock.json
git commit -m "feat(docs): add user guide extraction script

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Create Validation Script

**Files:**
- Create: `scripts/validate-user-guide.ts`

- [ ] **Step 1: Create the validation script**

```typescript
// scripts/validate-user-guide.ts
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface ValidationResult {
  component: string;
  valid: boolean;
  errors: string[];
}

function validateUserGuide(source: string, componentName: string): ValidationResult {
  const errors: string[] = [];

  // Check for @userGuide tag
  const jsdocRegex = /\/\*\*[\s\S]*?@userGuide[\s\S]*?\*\//;
  const match = source.match(jsdocRegex);

  if (!match) {
    // Not all components need user guides - only validate if tag exists
    return { component: componentName, valid: true, errors: [] };
  }

  const block = match[0];

  const hasTag = (tag: string): boolean => {
    const regex = new RegExp(`@${tag}\\s+`);
    return regex.test(block);
  };

  // Required tags
  const requiredTags = [
    'title.en', 'title.zh',
    'category',
    'description.en', 'description.zh',
  ];

  for (const tag of requiredTags) {
    if (!hasTag(tag)) {
      errors.push(`Missing required tag: @${tag}`);
    }
  }

  // Validate category value
  const categoryMatch = block.match(/@category\s+(core|advanced|reference)/);
  if (!categoryMatch) {
    if (hasTag('category')) {
      errors.push('Invalid @category value. Must be: core, advanced, or reference');
    }
  }

  // Validate steps have both languages if present
  const hasStepsEn = hasTag('steps.en');
  const hasStepsZh = hasTag('steps.zh');
  if (hasStepsEn !== hasStepsZh) {
    errors.push('Steps must have both .en and .zh versions');
  }

  // Validate tips have both languages if present
  const hasTipsEn = hasTag('tips.en');
  const hasTipsZh = hasTag('tips.zh');
  if (hasTipsEn !== hasTipsZh) {
    errors.push('Tips must have both .en and .zh versions');
  }

  return {
    component: componentName,
    valid: errors.length === 0,
    errors,
  };
}

async function validateAllUserGuides() {
  const componentsDir = path.resolve(__dirname, '../frontend/src/components');

  const files = await glob('**/*.tsx', { cwd: componentsDir });
  console.log(`Validating ${files.length} component files...\n`);

  const results: ValidationResult[] = [];
  let validCount = 0;
  let errorCount = 0;

  for (const file of files) {
    const filePath = path.join(componentsDir, file);
    const source = fs.readFileSync(filePath, 'utf-8');
    const componentName = path.basename(file, '.tsx');

    const result = validateUserGuide(source, componentName);
    results.push(result);

    if (result.valid) {
      validCount++;
    } else {
      errorCount++;
      console.log(`❌ ${componentName}:`);
      for (const error of result.errors) {
        console.log(`   - ${error}`);
      }
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Validation complete: ${validCount} valid, ${errorCount} with errors`);

  if (errorCount > 0) {
    process.exit(1);
  }
}

validateAllUserGuides().catch(console.error);
```

- [ ] **Step 2: Test validation script**

```bash
npx tsx scripts/validate-user-guide.ts
```

Expected: All components pass (no @userGuide tags yet)

- [ ] **Step 3: Commit validation script**

```bash
git add scripts/validate-user-guide.ts
git commit -m "feat(docs): add user guide validation script

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Set Up VitePress Site

**Files:**
- Create: `docs-site/package.json`
- Create: `docs-site/.vitepress/config.ts`
- Create: `docs-site/en/index.md`
- Create: `docs-site/en/getting-started.md`
- Create: `docs-site/zh/index.md`
- Create: `docs-site/zh/getting-started.md`

- [ ] **Step 1: Create docs-site directory and package.json**

```bash
mkdir -p docs-site/.vitepress docs-site/public/screenshots
```

```json
// docs-site/package.json
{
  "name": "agent-builder-user-guide",
  "version": "1.0.0",
  "scripts": {
    "dev": "vitepress dev",
    "build": "vitepress build",
    "preview": "vitepress preview"
  },
  "devDependencies": {
    "vitepress": "^1.5.0"
  }
}
```

- [ ] **Step 2: Create VitePress config with i18n**

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
    siteTitle: 'Agent Builder',

    nav: [
      { text: 'Getting Started', link: '/getting-started' },
      { text: 'Core Features', link: '/core/' },
      { text: 'Advanced', link: '/advanced/' },
    ],

    sidebar: {
      '/en/': [
        {
          text: 'Getting Started',
          link: '/en/getting-started',
        },
        {
          text: 'Core Features',
          collapsed: false,
          items: [
            { text: 'Chat Interface', link: '/en/core/chat-interface' },
            { text: 'Managing Conversations', link: '/en/core/conversations' },
            { text: 'Creating Agents', link: '/en/core/sub-agent-selector' },
            { text: 'Knowledge Bases', link: '/en/core/knowledge-base' },
            { text: 'Uploading Documents', link: '/en/core/document-uploader' },
            { text: 'File Attachments', link: '/en/core/file-uploader' },
          ],
        },
        {
          text: 'Advanced',
          collapsed: false,
          items: [
            { text: 'Model Services', link: '/en/advanced/model-service-dialog' },
            { text: 'MCP Services', link: '/en/advanced/mcp-service-dialog' },
            { text: 'Skills', link: '/en/advanced/skill-detail-dialog' },
          ],
        },
      ],
      '/zh/': [
        {
          text: '快速开始',
          link: '/zh/getting-started',
        },
        {
          text: '核心功能',
          collapsed: false,
          items: [
            { text: '聊天界面', link: '/zh/core/chat-chat' },
            { text: '管理对话', link: '/zh/core/conversations' },
            { text: '创建智能体', link: '/zh/core/sub-agent-selector' },
            { text: '知识库', link: '/zh/core/knowledge-base' },
            { text: '上传文档', link: '/zh/core/document-uploader' },
            { text: '文件附件', link: '/zh/core/file-uploader' },
          ],
        },
        {
          text: '高级功能',
          collapsed: false,
          items: [
            { text: '模型服务', link: '/zh/advanced/model-service-dialog' },
            { text: 'MCP服务', link: '/zh/advanced/mcp-service-dialog' },
            { text: '技能', link: '/zh/advanced/skill-detail-dialog' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/anthropics/claude-code' },
    ],
  },
})
```

- [ ] **Step 3: Create English homepage**

```markdown
<!-- docs-site/en/index.md -->
---
layout: home

hero:
  name: Agent Builder
  text: User Guide
  tagline: Build AI agents without coding
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started
    - theme: alt
      text: Core Features
      link: /core/

features:
  - icon: 🤖
    title: Create AI Agents
    details: Build intelligent assistants with natural language prompts
  - icon: 💬
    title: Stream Conversations
    details: Real-time chat with typewriter effect
  - icon: 📚
    title: Knowledge Bases
    details: Upload documents for AI-powered retrieval
  - icon: 🔧
    title: MCP Services
    details: Connect external tools and services
---
```

- [ ] **Step 4: Create English getting-started page**

```markdown
<!-- docs-site/en/getting-started.md -->
---
title: Getting Started
---

# Getting Started

Welcome to Agent Builder! This guide will help you create your first AI agent in 5 minutes.

## What is Agent Builder?

Agent Builder is a platform for creating AI assistants (agents) that can:
- Chat with you in natural language
- Use tools to perform tasks
- Search through your documents
- Work with other agents as a team

## Quick Start

### Step 1: Create an Agent

1. Click the **"Create Agent"** button on the left sidebar
2. Enter a name for your agent (e.g., "My Assistant")
3. Write a description of what your agent should do in the **Persona** field
4. Click **Save** to create your agent

### Step 2: Start Chatting

1. Click on your newly created agent in the sidebar
2. Type a message in the chat input at the bottom
3. Press **Enter** or click **Send**
4. Watch the AI respond with real-time streaming

### Step 3: Add Knowledge (Optional)

1. Click the **Knowledge Base** icon in the agent settings
2. Create a new knowledge base or select an existing one
3. Upload documents (PDF, DOCX, TXT, MD)
4. Your agent can now search these documents for answers

## Next Steps

- Learn about [Chat Interface](/core/chat-interface) features
- Explore [Knowledge Bases](/core/knowledge-base)
- Configure [MCP Services](/advanced/mcp-service-dialog) for tools

## Need Help?

If you encounter issues, check the agent status indicators or contact your administrator.
```

- [ ] **Step 5: Create Chinese homepage**

```markdown
<!-- docs-site/zh/index.md -->
---
layout: home

hero:
  name: Agent Builder
  text: 用户指南
  tagline: 无需编码，构建AI智能体
  actions:
    - theme: brand
      text: 快速开始
      link: /getting-started
    - theme: alt
      text: 核心功能
      link: /core/

features:
  - icon: 🤖
    title: 创建AI智能体
    details: 使用自然语言提示构建智能助手
  - icon: 💬
    title: 流式对话
    details: 打字机效果的实时聊天
  - icon: 📚
    title: 知识库
    details: 上传文档，AI智能检索
  - icon: 🔧
    title: MCP服务
    details: 连接外部工具和服务
---
```

- [ ] **Step 6: Create Chinese getting-started page**

```markdown
<!-- docs-site/zh/getting-started.md -->
---
title: 快速开始
---

# 快速开始

欢迎使用 Agent Builder！本指南将帮助您在5分钟内创建第一个AI智能体。

## 什么是 Agent Builder？

Agent Builder 是一个创建AI助手（智能体）的平台，它可以：
- 用自然语言与您对话
- 使用工具执行任务
- 搜索您的文档
- 与其他智能体协作

## 快速入门

### 第一步：创建智能体

1. 点击左侧边栏的 **"创建智能体"** 按钮
2. 输入智能体名称（如"我的助手"）
3. 在 **人设** 字段中描述智能体的功能
4. 点击 **保存** 创建智能体

### 第二步：开始对话

1. 在侧边栏中点击刚创建的智能体
2. 在底部聊天输入框中输入消息
3. 按 **回车键** 或点击 **发送**
4. 观看AI的实时流式响应

### 第三步：添加知识库（可选）

1. 点击智能体设置中的 **知识库** 图标
2. 创建新知识库或选择现有知识库
3. 上传文档（PDF、DOCX、TXT、MD）
4. 您的智能体现在可以搜索这些文档来回答问题

## 下一步

- 了解 [聊天界面](/core/chat-interface) 功能
- 探索 [知识库](/core/knowledge-base)
- 配置 [MCP服务](/advanced/mcp-service-dialog) 以使用工具

## 需要帮助？

如果遇到问题，请检查智能体状态指示器或联系管理员。
```

- [ ] **Step 7: Create category directories**

```bash
mkdir -p docs-site/en/core docs-site/en/advanced docs-site/zh/core docs-site/zh/advanced
```

- [ ] **Step 8: Install VitePress dependencies**

```bash
cd docs-site && npm install
```

- [ ] **Step 9: Test VitePress dev server**

```bash
cd docs-site && npm run dev &
sleep 5
curl -s http://localhost:5173 | head -20
pkill -f "vitepress"
```

Expected: VitePress starts successfully

- [ ] **Step 10: Commit VitePress setup**

```bash
git add docs-site/
git commit -m "feat(docs): set up VitePress site with i18n support

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Add @userGuide to Core Components (High Priority)

**Files:**
- Modify: `frontend/src/components/AgentChat.tsx`
- Modify: `frontend/src/components/SubAgentSelector.tsx`
- Modify: `frontend/src/components/ConversationDrawer.tsx`
- Modify: `frontend/src/components/KnowledgeBaseSelector.tsx`
- Modify: `frontend/src/components/KnowledgeBaseDialog.tsx`
- Modify: `frontend/src/components/DocumentUploader.tsx`

- [ ] **Step 1: Add @userGuide to AgentChat.tsx**

Add this JSDoc at the top of the file (after the `'use client'` directive - `'use client'` must remain first for Next.js):

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
 */
```

- [ ] **Step 2: Add @userGuide to SubAgentSelector.tsx**

Read the file first, then add appropriate JSDoc with component details.

- [ ] **Step 3: Add @userGuide to ConversationDrawer.tsx**

Read the file first, then add appropriate JSDoc with component details.

- [ ] **Step 4: Add @userGuide to KnowledgeBaseSelector.tsx**

Read the file first, then add appropriate JSDoc with component details.

- [ ] **Step 5: Add @userGuide to KnowledgeBaseDialog.tsx**

Read the file first, then add appropriate JSDoc with component details.

- [ ] **Step 6: Add @userGuide to DocumentUploader.tsx**

Read the file first, then add appropriate JSDoc with component details.

- [ ] **Step 7: Run extraction to verify**

```bash
npx tsx scripts/extract-user-guide.ts
```

Expected: Extracts 6 user guide documents

- [ ] **Step 8: Run validation to verify**

```bash
npx tsx scripts/validate-user-guide.ts
```

Expected: All 6 components pass validation

- [ ] **Step 9: Commit core component documentation**

```bash
git add frontend/src/components/*.tsx
git commit -m "docs: add @userGuide tags to core components (high priority)

- AgentChat: Chat interface documentation
- SubAgentSelector: Agent selection documentation
- ConversationDrawer: Conversation history documentation
- KnowledgeBaseSelector: KB selection documentation
- KnowledgeBaseDialog: KB management documentation
- DocumentUploader: Document upload documentation

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Add @userGuide to Core Components (Medium Priority)

**Files:**
- Modify: `frontend/src/components/ConversationList.tsx`
- Modify: `frontend/src/components/KbDetailPanel.tsx`
- Modify: `frontend/src/components/FileUploader.tsx`
- Modify: `frontend/src/components/InitializationGuideCard.tsx`

- [ ] **Step 1: Add @userGuide to ConversationList.tsx**

Read the file first, then add appropriate JSDoc with component details.

- [ ] **Step 2: Add @userGuide to KbDetailPanel.tsx**

Read the file first, then add appropriate JSDoc with component details.

- [ ] **Step 3: Add @userGuide to FileUploader.tsx**

Read the file first, then add appropriate JSDoc with component details.

- [ ] **Step 4: Add @userGuide to InitializationGuideCard.tsx**

Read the file first, then add appropriate JSDoc with component details.

- [ ] **Step 5: Run extraction and validation**

```bash
npx tsx scripts/extract-user-guide.ts && npx tsx scripts/validate-user-guide.ts
```

- [ ] **Step 6: Commit medium priority documentation**

```bash
git add frontend/src/components/*.tsx
git commit -m "docs: add @userGuide tags to core components (medium priority)

- ConversationList: Conversation list documentation
- KbDetailPanel: KB detail panel documentation
- FileUploader: File upload documentation
- InitializationGuideCard: Setup guide documentation

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 6: Add @userGuide to Advanced Components

**Files:**
- Modify: `frontend/src/components/ModelServiceDialog.tsx`
- Modify: `frontend/src/components/MCPServiceDialog.tsx`
- Modify: `frontend/src/components/SkillDetailDialog.tsx`
- Modify: `frontend/src/components/SkillUploadDialog.tsx`
- Modify: `frontend/src/components/MCPDiagnosticResult.tsx`

- [ ] **Step 1: Add @userGuide to ModelServiceDialog.tsx**

Read the file first, then add appropriate JSDoc with component details.

- [ ] **Step 2: Add @userGuide to MCPServiceDialog.tsx**

Read the file first, then add appropriate JSDoc with component details.

- [ ] **Step 3: Add @userGuide to SkillDetailDialog.tsx**

Read the file first, then add appropriate JSDoc with component details.

- [ ] **Step 4: Add @userGuide to SkillUploadDialog.tsx**

Read the file first, then add appropriate JSDoc with component details.

- [ ] **Step 5: Add @userGuide to MCPDiagnosticResult.tsx**

Read the file first, then add appropriate JSDoc with component details.

- [ ] **Step 6: Run extraction and validation**

```bash
npx tsx scripts/extract-user-guide.ts && npx tsx scripts/validate-user-guide.ts
```

- [ ] **Step 7: Commit advanced component documentation**

```bash
git add frontend/src/components/*.tsx
git commit -m "docs: add @userGuide tags to advanced components

- ModelServiceDialog: Model configuration documentation
- MCPServiceDialog: MCP service documentation
- SkillDetailDialog: Skill details documentation
- SkillUploadDialog: Skill upload documentation
- MCPDiagnosticResult: MCP diagnostics documentation

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 7: Add @userGuide to Reference Components

**Files:**
- Modify: `frontend/src/components/EnvironmentBanner.tsx`
- Modify: `frontend/src/components/EnvironmentErrorDialog.tsx`
- Modify: `frontend/src/components/SubAgentCallCard.tsx`

- [ ] **Step 1: Add @userGuide to EnvironmentBanner.tsx**

Read the file first, then add appropriate JSDoc with component details.

- [ ] **Step 2: Add @userGuide to EnvironmentErrorDialog.tsx**

Read the file first, then add appropriate JSDoc with component details.

- [ ] **Step 3: Add @userGuide to SubAgentCallCard.tsx**

Read the file first, then add appropriate JSDoc with component details.

- [ ] **Step 4: Run extraction and validation**

```bash
npx tsx scripts/extract-user-guide.ts && npx tsx scripts/validate-user-guide.ts
```

- [ ] **Step 5: Commit reference component documentation**

```bash
git add frontend/src/components/*.tsx
git commit -m "docs: add @userGuide tags to reference components

- EnvironmentBanner: Environment status documentation
- EnvironmentErrorDialog: Error dialog documentation
- SubAgentCallCard: Sub-agent call documentation

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 8: Add Langfuse Documentation Page

**Files:**
- Create: `docs-site/en/advanced/langfuse.md`
- Create: `docs-site/zh/advanced/langfuse.md`

- [ ] **Step 1: Create English Langfuse documentation**

```markdown
<!-- docs-site/en/advanced/langfuse.md -->
---
title: Langfuse Tracing
---

# Langfuse Tracing

Langfuse helps you understand how the AI processes your requests. It provides detailed traces of every conversation, including thinking processes, tool calls, and response times.

## What is Langfuse?

Langfuse is an observability tool that tracks:
- What you asked and what the AI responded
- How long each step took
- How many tokens were processed
- Which tools the AI used

## Viewing Traces

### Step 1: Get Your Dashboard URL

Ask your administrator for your Langfuse dashboard URL.

### Step 2: Open the Dashboard

1. Open the URL in your web browser
2. Log in with your credentials (if required)

### Step 3: Browse Conversations

1. Click on **Traces** in the sidebar
2. Select a conversation to view details
3. Expand each step to see the full data

## Understanding Trace Data

| Field | Description |
|-------|-------------|
| **Input** | The message you sent to the AI |
| **Output** | The AI's response |
| **Latency** | How long the step took (in milliseconds) |
| **Tokens** | Number of tokens processed (affects cost) |
| **Tool Calls** | External tools or services used |

## Tips

- Use traces to understand why the AI gave a certain response
- Share trace links with support for faster troubleshooting
- Check latency to identify slow operations
- Monitor token usage to optimize costs

## Related

- [Chat Interface](/core/chat-interface)
```

- [ ] **Step 2: Create Chinese Langfuse documentation**

```markdown
<!-- docs-site/zh/advanced/langfuse.md -->
---
title: Langfuse 追踪
---

# Langfuse 追踪

Langfuse 帮助您了解AI如何处理您的请求。它提供每个对话的详细追踪，包括思考过程、工具调用和响应时间。

## 什么是 Langfuse？

Langfuse 是一个可观测性工具，用于追踪：
- 您的提问和AI的回答
- 每个步骤的耗时
- 处理的Token数量
- AI使用的工具

## 查看追踪记录

### 第一步：获取仪表板URL

向您的管理员获取 Langfuse 仪表板URL。

### 第二步：打开仪表板

1. 在浏览器中打开URL
2. 使用您的凭据登录（如果需要）

### 第三步：浏览对话

1. 点击侧边栏中的 **追踪**
2. 选择一个对话查看详情
3. 展开每个步骤查看完整数据

## 理解追踪数据

| 字段 | 描述 |
|------|------|
| **输入** | 您发送给AI的消息 |
| **输出** | AI的响应 |
| **延迟** | 步骤耗时（毫秒） |
| **Token** | 处理的Token数量（影响成本） |
| **工具调用** | 使用的外部工具或服务 |

## 提示

- 使用追踪了解AI给出特定回答的原因
- 与支持团队分享追踪链接以加快故障排除
- 检查延迟以识别慢速操作
- 监控Token使用量以优化成本

## 相关

- [聊天界面](/core/chat-interface)
```

- [ ] **Step 3: Commit Langfuse documentation**

```bash
git add docs-site/en/advanced/langfuse.md docs-site/zh/advanced/langfuse.md
git commit -m "docs: add Langfuse tracing documentation (EN/ZH)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 9: Update Root Package.json

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add docs scripts to root package.json**

Read current package.json, then add these scripts:

```json
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

- [ ] **Step 2: Test docs:extract script**

```bash
npm run docs:extract
```

Expected: Runs extraction successfully

- [ ] **Step 3: Commit package.json update**

```bash
git add package.json
git commit -m "feat(docs): add docs scripts to root package.json

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 10: Create GitHub Actions Workflow

**Files:**
- Create: `.github/workflows/docs.yml`

- [ ] **Step 1: Create .github/workflows directory if needed**

```bash
mkdir -p .github/workflows
```

- [ ] **Step 2: Create docs.yml workflow**

```yaml
# .github/workflows/docs.yml
name: User Manual

on:
  pull_request:
    paths:
      - 'frontend/src/components/**/*.tsx'
      - 'docs-site/**'
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
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install docs-site dependencies
        run: cd docs-site && npm ci

      - name: Extract user guides
        run: npm run docs:extract

      - name: Check for changes
        run: |
          if git diff --exit-code docs-site/en docs-site/zh; then
            echo "✅ Docs are up to date"
          else
            echo "❌ Docs are out of sync. Run 'npm run docs:extract' and commit changes."
            exit 1
          fi

      - name: Validate bilingual content
        run: npm run docs:validate

  build:
    needs: validate
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install docs-site dependencies
        run: cd docs-site && npm ci

      - name: Extract and build
        run: |
          npm run docs:extract
          npm run docs:build

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: docs-site/.vitepress/dist

  deploy:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 3: Commit workflow**

```bash
git add .github/workflows/docs.yml
git commit -m "ci: add docs workflow for validation and deployment

- Validates @userGuide tags on PR
- Auto-deploys to GitHub Pages on main merge

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 11: Final Verification

- [ ] **Step 1: Run full extraction**

```bash
npm run docs:extract
```

- [ ] **Step 2: Run full validation**

```bash
npm run docs:validate
```

- [ ] **Step 3: Build VitePress site**

```bash
npm run docs:build
```

- [ ] **Step 4: Verify generated files**

```bash
ls -la docs-site/en/core/
ls -la docs-site/zh/core/
```

Expected: All component markdown files present

- [ ] **Step 5: Final commit if any changes**

```bash
git add -A
git status
# If changes, commit them
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Extraction script | `scripts/extract-user-guide.ts` |
| 2 | Validation script | `scripts/validate-user-guide.ts` |
| 3 | VitePress setup | `docs-site/*` |
| 4-7 | @userGuide tags | 18 component files |
| 8 | Langfuse docs | `docs-site/*/advanced/langfuse.md` |
| 9 | Package.json | `package.json` |
| 10 | CI workflow | `.github/workflows/docs.yml` |
| 11 | Verification | - |
