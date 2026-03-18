# Langfuse Tracing Integration Fix

**Date**: 2026-03-18
**Status**: Draft
**Author**: Claude

## Problem Statement

Agent Builder has existing Langfuse tracing code but it's not working:
- `langfuse` Python SDK not installed
- `.env` contains placeholder API keys (`pk-lf-a1b2c3d4e5f6g7h8`)
- Docker stack not running (localhost:3000 returns 404)

Users cannot see traces of LLM calls, tool calls, or conversation flows.

## Requirements

| Requirement | Priority |
|-------------|----------|
| Full traces (LLM + Tools) | Must |
| Local Docker deployment | Must |
| Automated UAT test verification | Must |
| Minimal code changes | Should |

## Solution: Minimal Fix (Approach A)

Fix only what's broken without modifying the existing tracing code.

### Components

#### 1. Dependencies

Add to `requirements.txt`:
```
langfuse>=2.0.0
```

No code changes needed - the SDK provides the client.

#### 2. Docker Setup

Use existing `docker-compose.langfuse.yml`:
- Services: langfuse-web, langfuse-worker, postgres, clickhouse, redis, minio
- Ports: 3000 (Web UI), 5432 (PostgreSQL), 9000/8123 (ClickHouse), 6379 (Redis)

Startup sequence:
1. `docker-compose -f docker-compose.langfuse.yml up -d`
2. Wait ~2 minutes for health checks
3. Access `http://localhost:3000`
4. Create Project via UI
5. Create API Keys via UI
6. Update `.env` with real keys

#### 3. Environment Configuration

Required in `.env`:
```bash
LANGFUSE_HOST=http://localhost:3000
LANGFUSE_PUBLIC_KEY=pk-lf-<real-key>
LANGFUSE_SECRET_KEY=sk-lf-<real-key>
LANGFUSE_ENABLED=true
```

Validation:
- Warn if keys match placeholder pattern (`pk-lf-xxxx`, `sk-lf-xxxx`)
- No code changes to existing tracer

#### 4. Verification

Use existing UAT test:
```bash
cd frontend && npx playwright test langfuse-uat.spec.ts --headed
```

Manual verification:
- Open `http://localhost:3000`
- Navigate to Traces
- Verify trace tree shows LLM calls and tool calls

## Files Changed

| File | Change |
|------|--------|
| `requirements.txt` | Add `langfuse>=2.0.0` |
| `.env` | Replace placeholder keys with real keys (manual) |

**No Python code changes required.**

## Testing Plan

1. **Unit**: N/A (no code changes)
2. **Integration**: Start Docker, verify Langfuse UI accessible
3. **UAT**: Run `langfuse-uat.spec.ts`
   - TC-001: Simple conversation creates trace
   - TC-002: Tool call creates span
   - TC-003: Multi-turn conversation linked by session_id

## Rollback Plan

If issues arise:
1. Set `LANGFUSE_ENABLED=false` in `.env`
2. Tracing disabled, no impact on core functionality

## Success Criteria

- [ ] `pip show langfuse` shows installed package
- [ ] `docker ps` shows 6 langfuse containers running
- [ ] `curl http://localhost:3000/api/health` returns 200
- [ ] Conversation in Agent Builder creates trace in Langfuse UI
- [ ] Tool calls appear as spans under the trace
- [ ] UAT test passes
