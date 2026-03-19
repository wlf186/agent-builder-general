# External Links Feature Implementation Plan

> **Status: COMPLETED** (2026-03-19)

**Goal:** Add User Manual and Langfuse links to sidebar footer.

**Architecture:**
- `/docs` 代理到 VitePress docs-site (localhost:4173)，需要配置 `base: '/docs/'`
- Langfuse 直接访问 `http://localhost:3000`（因为 Next.js 应用的 `/_next` 资源路径会与前端冲突）
- Sidebar footer adds "Resources" section with external links
- Start/stop scripts manage docs-site process lifecycle

---

## ⚠️ 重要经验教训

### Langfuse 不能使用代理的原因
Langfuse 是 Next.js 应用，它的静态资源路径是 `/_next/...`。由于前端本身也是 Next.js，代理 `/_next` 路径会冲突。解决方案是直接访问 `http://localhost:3000`。

### VitePress 代理需要配置 base
当 docs-site 被代理到 `/docs` 路径时，VitePress 必须配置 `base: '/docs/'`，否则：
1. 内部链接指向错误路径
2. 静态资源 404
3. 重定向失败

---

## 最终实现

### 文件变更

| 文件 | 变更 |
|------|------|
| `docs-site/.vitepress/config.ts` | 添加 `base: '/docs/'` |
| `docs-site/index.md` | 使用 `withBase('/en/')` 重定向 |
| `frontend/next.config.ts` | 代理 `/docs` 到 `localhost:4173/docs` |
| `frontend/src/app/page.tsx` | Langfuse 链接改为直接访问 `localhost:3000` |

### 关键配置

**VitePress config.ts:**
```typescript
base: '/docs/',
```

**Next.js rewrites:**
```typescript
{
  source: '/docs/:path*',
  destination: 'http://localhost:4173/docs/:path*',
},
{
  source: '/docs',
  destination: 'http://localhost:4173/docs',
},
```

**Docs index.md redirect:**
```javascript
window.location.href = withBase('/en/')
```

**Langfuse link:**
```tsx
<a href="http://localhost:3000" target="_blank">
```
