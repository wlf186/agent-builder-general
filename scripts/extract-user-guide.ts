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

// Component to category mapping (populated during extraction)
const componentCategories = new Map<string, string>();

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
      // Look up the category for the related component
      const relatedCategory = componentCategories.get(r) || 'core';
      return `- [${r}](/${lang}/${relatedCategory}/${kebab})`;
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

  // Build component to category mapping for cross-category links
  for (const doc of docs) {
    componentCategories.set(doc.component, doc.category);
  }

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
