# External Links Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add User Manual and Langfuse links to sidebar footer with Next.js proxy for access-method independence.

**Architecture:** Next.js rewrites proxy `/docs` and `/langfuse` to local services. Sidebar footer adds "Resources" section with external links. Start/stop scripts manage docs-site process lifecycle.

**Tech Stack:** Next.js rewrites, React state, Bash scripting

---

## File Structure

| File | Purpose |
|------|---------|
| `frontend/next.config.ts` | Add rewrites for /docs and /langfuse proxy |
| `frontend/src/app/page.tsx` | Add sidebar footer "Resources" section |
| `start.sh` | Add `start_docs_site()` function |
| `stop.sh` | Add docs-site cleanup logic |

---

## Task 1: Add Next.js Proxy Configuration

**Files:**
- Modify: `frontend/next.config.ts`

- [ ] **Step 1: Add rewrites for /docs and /langfuse**

Update `frontend/next.config.ts` to add proxy rewrites:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:20881/api/:path*',
      },
      // Docs-site proxy
      {
        source: '/docs/:path*',
        destination: 'http://localhost:4173/:path*',
      },
      {
        source: '/docs',
        destination: 'http://localhost:4173/',
      },
      // Langfuse proxy
      {
        source: '/langfuse/:path*',
        destination: 'http://localhost:3000/:path*',
      },
      {
        source: '/langfuse',
        destination: 'http://localhost:3000/',
      },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 2: Commit**

```bash
git add frontend/next.config.ts
git commit -m "feat: add proxy rewrites for /docs and /langfuse

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Add Sidebar Footer Resources Section

**Files:**
- Modify: `frontend/src/app/page.tsx`

- [ ] **Step 1: Add Activity icon import**

In the lucide-react import block (around line 6-35), add `Activity` icon:

```typescript
import {
  // ... existing imports ...
  ExternalLink,
  Database,
  Activity,  // Add this line
} from "lucide-react";
```

- [ ] **Step 2: Add Resources section state**

Add state variable after other sidebar expanded states (around line 211):

```typescript
const [sidebarResourcesExpanded, setSidebarResourcesExpanded] = useState(true);
```

- [ ] **Step 3: Add Resources section UI**

Insert the Resources section before the sidebar footer (before line 1116 `<div className="mt-auto p-5 border-t border-white/[0.05]">`):

```tsx
          {/* Resources Section - External Links */}
          <div className="p-5 border-t border-white/[0.05]">
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setSidebarResourcesExpanded(!sidebarResourcesExpanded)}
                className="flex items-center gap-2 text-xs text-gray-500 uppercase tracking-wider hover:text-gray-400 transition-colors"
              >
                {sidebarResourcesExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {locale === "zh" ? "资源" : "Resources"}
              </button>
            </div>
            {sidebarResourcesExpanded && (
              <div className="space-y-1.5">
                <a
                  href="/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/5 group cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <BookOpen size={12} className="text-blue-400" />
                    <span className="text-sm text-gray-300">
                      {locale === "zh" ? "用户手册" : "User Manual"}
                    </span>
                  </div>
                  <ExternalLink size={12} className="text-gray-500 group-hover:text-gray-400" />
                </a>
                <a
                  href="/langfuse"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/5 group cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Activity size={12} className="text-orange-400" />
                    <span className="text-sm text-gray-300">Langfuse</span>
                  </div>
                  <ExternalLink size={12} className="text-gray-500 group-hover:text-gray-400" />
                </a>
              </div>
            )}
          </div>
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/page.tsx
git commit -m "feat: add Resources section with User Manual and Langfuse links

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Update Start Script for Docs-Site

**Files:**
- Modify: `start.sh`

- [ ] **Step 1: Add `start_docs_site()` function**

Add this function after `start_langfuse()` function (around line 120):

```bash
# 启动文档站点
start_docs_site() {
    log_info "启动文档站点..."

    DOCS_PORT=4173

    # 检查端口
    if check_port $DOCS_PORT; then
        log_warn "文档站点端口 $DOCS_PORT 已被占用"
        return 0
    fi

    cd docs-site

    # 检查依赖
    if [ ! -d "node_modules" ]; then
        if [ "$1" == "--skip-deps" ]; then
            log_warn "docs-site node_modules 不存在且指定了 --skip-deps"
            cd ..
            return 0
        fi
        log_info "安装文档站点依赖..."
        npm install --silent
    fi

    # 构建检查
    if [ ! -d ".vitepress/dist" ]; then
        log_info "构建文档站点..."
        npm run build
    fi

    # 启动预览服务器
    nohup npm run preview -- --port $DOCS_PORT > ../docs-site.log 2>&1 &
    echo $! > ../docs-site.pid
    log_info "文档站点 PID: $(cat ../docs-site.pid)"

    cd ..

    # 等待启动
    if wait_for_service $DOCS_PORT "文档站点"; then
        log_info "文档站点启动成功 (http://localhost:$DOCS_PORT)"
    else
        log_warn "文档站点启动可能需要更长时间，请稍后访问 http://localhost:$DOCS_PORT"
    fi
}
```

- [ ] **Step 2: Update main() to call start_docs_site**

In the `main()` function, add `start_docs_site` call after `start_langfuse`:

```bash
main() {
    echo ""
    echo "========================================"
    echo "   Agent Builder 系统启动"
    echo "========================================"
    echo ""

    start_langfuse
    echo ""
    start_docs_site $1    # Add this line
    echo ""
    start_backend
    echo ""
    start_frontend $1
```

- [ ] **Step 3: Update final status message**

Update the final echo block to include docs-site:

```bash
    echo ""
    echo "========================================"
    log_info "系统启动完成!"
    echo ""
    echo "  前端: http://localhost:$FRONTEND_PORT"
    echo "  后端: http://localhost:$BACKEND_PORT"
    echo "  文档站点: http://localhost:4173"
    echo "  Langfuse (可观测性): http://localhost:3000"
    echo ""
    echo "  停止服务: ./stop.sh"
    echo "  查看日志: tail -f backend.log | frontend.log | docs-site.log"
    echo "========================================"
```

- [ ] **Step 4: Commit**

```bash
git add start.sh
git commit -m "feat: add docs-site startup to start.sh

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Update Stop Script for Docs-Site

**Files:**
- Modify: `stop.sh`

- [ ] **Step 1: Add docs-site cleanup section**

Add docs-site cleanup before the Langfuse section (around line 59, before `# 停止 Langfuse`):

```bash
# 停止文档站点
if [ -f docs-site.pid ]; then
    PID=$(cat docs-site.pid)
    if kill -0 $PID 2>/dev/null; then
        kill $PID
        log_info "文档站点已停止 (PID: $PID)"
    else
        log_warn "文档站点进程不存在 (PID: $PID)"
    fi
    rm -f docs-site.pid
fi

# 额外清理：通过端口查找并杀掉 docs-site 进程
PID=$(lsof -t -i :4173 2>/dev/null || true)
if [ -n "$PID" ]; then
    kill $PID 2>/dev/null || true
    log_info "清理端口 4173 的进程 (PID: $PID)"
fi
```

- [ ] **Step 2: Commit**

```bash
git add stop.sh
git commit -m "feat: add docs-site cleanup to stop.sh

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Integration Testing

- [ ] **Step 1: Restart the system**

```bash
./stop.sh
./start.sh
```

Verify all services start successfully including docs-site.

- [ ] **Step 2: Verify sidebar links**

1. Open http://localhost:20880
2. Verify "Resources" section appears in sidebar footer
3. Click "User Manual" - should open /docs in new tab
4. Click "Langfuse" - should open /langfuse in new tab

- [ ] **Step 3: Verify Tailscale access**

1. Access http://<tailscale-ip>:20880
2. Verify both links work correctly

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete external links feature with docs-site integration

- Add Next.js proxy rewrites for /docs and /langfuse
- Add Resources section in sidebar footer
- Add docs-site startup/shutdown in start.sh and stop.sh

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Next.js proxy config | `frontend/next.config.ts` |
| 2 | Sidebar footer UI | `frontend/src/app/page.tsx` |
| 3 | Start script | `start.sh` |
| 4 | Stop script | `stop.sh` |
| 5 | Integration test | - |
