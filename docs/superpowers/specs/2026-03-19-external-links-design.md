# External Links Feature Design

**Date:** 2026-03-19
**Status:** Draft
**Scope:** Add User Manual and Langfuse links to Agent Builder main page sidebar footer

---

## Overview

Add two external resource links (User Manual, Langfuse) to the bottom of the left sidebar on the Agent Builder main page. Links use relative paths proxied through Next.js to work regardless of access method (localhost or Tailscale IP).

---

## Requirements

1. **Sidebar Footer Links**: Two links at bottom of left sidebar
   - User Manual → `/docs`
   - Langfuse → `/langfuse`

2. **Access Method Independence**: Links work via localhost or Tailscale IP

3. **Service Sync**: docs-site starts/stops with Agent Builder (like Langfuse)

---

## Architecture

### URL Flow

```
Client (localhost:20880 or Tailscale IP:20880)
    │
    ├── /docs/* ──────────────────► Next.js Rewrite ──► localhost:4173 (docs-site preview)
    │
    └── /langfuse/* ──────────────► Next.js Rewrite ──► localhost:3000 (Langfuse)
```

Since rewriting happens server-side in Next.js, clients always use relative paths regardless of their access method.

---

## Components

### 1. Sidebar Footer Section

**File:** `frontend/src/app/page.tsx`

**Location:** Bottom of left sidebar, after Knowledge Bases section

**UI Structure:**
```
┌─────────────────────────────────┐
│  [Existing sections...]         │
│  Knowledge Bases                │
│  ├─ KB items...                 │
├─────────────────────────────────┤
│  Resources           [chevron]  │  ← Collapsible section
│  ├─ 📚 User Manual        [↗]   │  ← Opens /docs in new tab
│  └─ 📊 Langfuse           [↗]   │  ← Opens /langfuse in new tab
└─────────────────────────────────┘
```

**Implementation:**
- Add new collapsible section "Resources" / "资源"
- Use `BookOpen` icon for User Manual, `Activity` or `LineChart` for Langfuse
- Use `ExternalLink` icon to indicate external links
- Links open in new tab (`target="_blank"`)
- Follow existing sidebar styling patterns

### 2. Next.js Proxy Configuration

**File:** `frontend/next.config.ts`

**Add rewrites:**
```typescript
async rewrites() {
  return [
    {
      source: '/docs/:path*',
      destination: 'http://localhost:4173/:path*',
    },
    {
      source: '/docs',
      destination: 'http://localhost:4173/',
    },
    {
      source: '/langfuse/:path*',
      destination: 'http://localhost:3000/:path*',
    },
    {
      source: '/langfuse',
      destination: 'http://localhost:3000/',
    },
  ];
}
```

### 3. Start Script

**File:** `start.sh`

**Add function `start_docs_site()`:**
```bash
start_docs_site() {
    log_info "启动文档站点..."

    DOCS_PORT=4173

    # Check if port is occupied
    if check_port $DOCS_PORT; then
        log_warn "文档站点端口 $DOCS_PORT 已被占用"
        return 0
    fi

    cd docs-site

    # Check dependencies
    if [ ! -d "node_modules" ]; then
        log_info "安装文档站点依赖..."
        npm install --silent
    fi

    # Build if needed
    if [ ! -d ".vitepress/dist" ]; then
        log_info "构建文档站点..."
        npm run build
    fi

    # Start preview server
    nohup npm run preview -- --port $DOCS_PORT > ../docs-site.log 2>&1 &
    echo $! > ../docs-site.pid

    cd ..

    # Wait for startup
    if wait_for_service $DOCS_PORT "文档站点"; then
        log_info "文档站点启动成功 (http://localhost:$DOCS_PORT)"
    else
        log_warn "文档站点启动可能需要更长时间"
    fi
}
```

**Update main() call order:**
```bash
start_langfuse
start_docs_site    # New
start_backend
start_frontend
```

**Update final status message:**
```bash
echo "  文档站点: http://localhost:4173"
```

### 4. Stop Script

**File:** `stop.sh`

**Add docs-site cleanup:**
```bash
# Stop docs-site
if [ -f docs-site.pid ]; then
    kill $(cat docs-site.pid) 2>/dev/null || true
    rm docs-site.pid
    log_info "文档站点已停止"
fi

# Also kill by port as backup
if lsof -i :4173 > /dev/null 2>&1; then
    fuser -k 4173/tcp 2>/dev/null || true
fi
```

---

## Error Handling

1. **Service Not Running**: If docs-site or Langfuse is not running, the proxy returns 502. User sees browser error page. This is acceptable - links are only valid when services are up.

2. **Port Conflicts**: Start script checks port availability and warns if occupied.

3. **Build Missing**: Start script auto-builds docs-site if dist directory missing.

---

## Testing Checklist

- [ ] Links appear in sidebar footer
- [ ] Links open in new tab
- [ ] `/docs` proxied correctly to docs-site
- [ ] `/langfuse` proxied correctly to Langfuse
- [ ] Works via localhost:20880
- [ ] Works via Tailscale IP:20880
- [ ] `start.sh` starts docs-site
- [ ] `stop.sh` stops docs-site
- [ ] Docs-site auto-builds if needed

---

## Files Changed

| File | Change |
|------|--------|
| `frontend/src/app/page.tsx` | Add sidebar footer links section |
| `frontend/next.config.ts` | Add rewrites for /docs and /langfuse |
| `start.sh` | Add `start_docs_site()` function |
| `stop.sh` | Add docs-site stop logic |

---

## No Backend Changes

This feature requires no modifications to `backend.py` or any `src/` modules.
