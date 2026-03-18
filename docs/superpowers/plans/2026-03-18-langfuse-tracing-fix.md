# Langfuse Tracing Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable Langfuse tracing for Agent Builder by fixing configuration issues (no code changes required)

**Architecture:** Use existing tracing infrastructure (`src/langfuse_tracer.py`, `src/langfuse_client.py`) with local Docker deployment of Langfuse stack

**Tech Stack:** Python langfuse SDK, Docker Compose, Langfuse 2.x

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `.env` | Modify | Replace placeholder API keys with real keys |
| `docker-compose.langfuse.yml` | No change | Already configured correctly |
| `docker/clickhouse/config.xml` | No change | Already configured correctly |

**No code files will be modified.**

---

## Task 1: Verify Prerequisites

**Files:**
- Verify: System environment

- [ ] **Step 1: Check Docker is installed and running**

Run: `docker --version && docker ps`
Expected: Docker version 20.x+ and no errors

- [ ] **Step 2: Check required ports are available**

Run:
```bash
netstat -tuln | grep -E ':(3000|5432|8123|9000|9001|6379)' || echo "All ports available"
```
Expected: No output (all ports free) or plan to stop conflicting services

- [ ] **Step 3: Verify minimum RAM available**

Run: `free -h`
Expected: At least 8GB total RAM for Langfuse stack

---

## Task 2: Install Python Dependencies

**Files:**
- Verify: `requirements.txt`

- [ ] **Step 1: Verify langfuse is in requirements.txt**

Run: `grep "langfuse" requirements.txt`
Expected: `langfuse>=2.0.0`

- [ ] **Step 2: Install dependencies**

Run: `pip install -r requirements.txt`
Expected: All packages installed successfully

- [ ] **Step 3: Verify langfuse SDK is installed**

Run: `pip show langfuse`
Expected: Shows langfuse package with version 2.x+

---

## Task 3: Start Docker Stack

**Files:**
- Execute: `docker-compose.langfuse.yml`

- [ ] **Step 1: Start all Langfuse services**

Run:
```bash
docker-compose -f docker-compose.langfuse.yml up -d
```
Expected: 6 containers started (langfuse-web, langfuse-worker, postgres, clickhouse, redis, minio)

- [ ] **Step 2: Wait for health checks to pass**

Run:
```bash
sleep 30 && docker-compose -f docker-compose.langfuse.yml ps
```
Expected: All services show "healthy" or "running" status

- [ ] **Step 3: Verify Langfuse web is accessible**

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000`
Expected: HTTP 200 or 302 (redirect to login)

- [ ] **Step 4: Check health endpoint**

Run: `curl -s http://localhost:3000/api/health`
Expected: Returns 200 OK or health status JSON

---

## Task 4: Create Langfuse Project and API Keys

**Files:**
- Manual: Langfuse Web UI at http://localhost:3000**This task requires manual interaction with the Langfuse Web UI.**

- [ ] **Step 1: Open Langfuse Web UI**

Action: Open browser to http://localhost:3000
Expected: Langfuse welcome/setup page

- [ ] **Step 2: Complete initial setup (if first time)**

Action: Follow setup wizard to create admin account
Expected: Able to log in to Langfuse dashboard

- [ ] **Step 3: Create a new Project**

Action:
1. Click "Create Project" or navigate to Settings > Projects
2. Enter project name: "Agent Builder"
3. Click Create
Expected: Project created successfully

- [ ] **Step 4: Create API Keys**

Action:
1. Navigate to Project Settings > API Keys
2. Click "Create New API Key"
3. Copy both PUBLIC KEY and SECRET KEY
Expected: Two keys generated (pk-lf-... and sk-lf-...)

- [ ] **Step 5: Save keys securely**

Action: Save keys to a temporary secure location (not in .env yet)
Expected: Keys available for next task

---

## Task 5: Update Environment Configuration

**Files:**
- Modify: `.env`

- [ ] **Step 1: Backup current .env**

Run: `cp .env .env.backup.$(date +%Y%m%d%H%M%S)`
Expected: Backup file created

- [ ] **Step 2: Update LANGFUSE_PUBLIC_KEY in .env**

Run:
```bash
sed -i 's/^LANGFUSE_PUBLIC_KEY=.*/LANGFUSE_PUBLIC_KEY=pk-lf-YOUR-REAL-PUBLIC-KEY/' .env
```
Note: Replace `pk-lf-YOUR-REAL-PUBLIC-KEY` with the actual key from Task 4

- [ ] **Step 3: Update LANGFUSE_SECRET_KEY in .env**

Run:
```bash
sed -i 's/^LANGFUSE_SECRET_KEY=.*/LANGFUSE_SECRET_KEY=sk-lf-YOUR-REAL-SECRET-KEY/' .env
```
Note: Replace `sk-lf-YOUR-REAL-SECRET-KEY` with the actual key from Task 4

- [ ] **Step 4: Verify LANGFUSE_ENABLED is set**

Run: `grep "LANGFUSE_ENABLED" .env`
Expected: `LANGFUSE_ENABLED=true`

- [ ] **Step 5: Verify configuration**

Run: `grep -E "LANGFUSE_" .env`
Expected: All four variables set with real values (not placeholders)

---

## Task 6: Verify Integration

**Files:**
- Test: `frontend/tests/langfuse-uat.spec.ts`

- [ ] **Step 1: Restart Agent Builder backend**

Run:
```bash
./stop.sh && ./start.sh
```
Expected: Backend starts and shows "[Langfuse] 已启用: http://localhost:3000"

- [ ] **Step 2: Run UAT test suite**

Run:
```bash
cd frontend && npx playwright test langfuse-uat.spec.ts --headed
```
Expected: All tests pass (TC-001 through TC-007)

- [ ] **Step 3: Manually verify traces in Langfuse UI**

Action:
1. Open http://localhost:3000
2. Navigate to Traces
3. Verify trace tree shows:
   - LLM calls as spans
   - Tool calls as nested spans
   - Timing information
Expected: Traces visible with correct structure

- [ ] **Step 4: Verify trace for tool call**

Action:
1. In Agent Builder, send message: "帮我计算 123 * 456"
2. Wait for response
3. Check Langfuse UI for trace with tool span
Expected: Trace shows LLM span + tool span for calculator

---

## Task 7: Final Verification

**Files:**
- Verify: All success criteria

- [ ] **Step 1: Verify all success criteria**

Run each check:
```bash
# 1. SDK installed
pip show langfuse

# 2. Docker containers running
docker ps --filter "name=langfuse" --format "table {{.Names}}\t{{.Status}}"

# 3. Health endpoint
curl http://localhost:3000/api/health
```
Expected: All checks pass

- [ ] **Step 2: Document completion**

Action: Update spec success criteria to checked
Expected: All items in spec marked as complete

---

## Rollback Instructions

If issues arise:

1. **Disable tracing**:
   ```bash
   sed -i 's/^LANGFUSE_ENABLED=.*/LANGFUSE_ENABLED=false/' .env
   ```

2. **Stop Docker**:
   ```bash
   docker-compose -f docker-compose.langfuse.yml down
   ```

3. **Restore backup** (if needed):
   ```bash
   cp .env.backup.YYYYMMDDHHMMSS .env
   ```

---

## Notes

- **No code changes required** - all fixes are configuration only
- **Task 4 is manual** - requires browser interaction with Langfuse UI
- **API keys are sensitive** - never commit real keys to version control
- **Docker stack uses significant resources** - ~8GB RAM recommended
