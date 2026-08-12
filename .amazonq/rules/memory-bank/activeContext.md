# Active Context — MCP MVP Dashboard

## Current State
Phase 1 (MVP local) — pipeline end-to-end validated and working.

## Active Architecture: Bedrock Tool-Use Orchestrator
`mcp-main` runs as a **Fastify HTTP server** (port 4000). The primary entry point is `orchestrate()` in `orchestrator.ts`, which runs a **Bedrock tool-use loop**:

1. Bedrock receives the user intent + tool definitions (`query_data`, `generate_ui`)
2. Bedrock calls `query_data` → `mcp-gcp-mock` returns records (summary only sent back to Bedrock)
3. Bedrock calls `generate_ui` → orchestrator injects full records + `COMPONENT_CATALOG` → `mcp-ui` returns UIConfig
4. UIConfig cached in Redis (TTL.INTENT = 60 min) and returned

**Fallback**: if Bedrock loop fails → `runHardcodedPipeline()` (same as old `Pipeline.generateUi()` logic, inline in orchestrator.ts)

`pipeline.ts` and `Pipeline` class still exist but are **not used** by the current HTTP routes.

## Key Source Files
| File | Responsibility |
|---|---|
| `packages/mcp-main/src/index.ts` | Fastify server + MCP stdio server (`--mcp` flag); routes call `orchestrate()` |
| `packages/mcp-main/src/orchestrator.ts` | **Primary**: `orchestrate()` → Bedrock tool-use loop → `runBedrockLoop()` + `runHardcodedPipeline()` fallback |
| `packages/mcp-main/src/pipeline.ts` | `Pipeline.generateUi()` — sequential pipeline class (unused by current routes) |
| `packages/mcp-main/src/intent-interpreter.ts` | `interpretIntent()` — Bedrock ConverseCommand (used by pipeline.ts fallback path) |
| `packages/mcp-main/src/mcp-client.ts` | `McpClient` class, `createMcpClients()` |
| `packages/mcp-main/src/cache.ts` | Redis helpers: `cacheGet`, `cacheSet`, `generateCacheKey`, `initCache`, `isCacheConnected`, TTL |
| `packages/mcp-gcp-mock/src/index.ts` | MCP Server: `list_datasets`, `query_data` tools |
| `packages/mcp-ui/src/index.ts` | MCP Server: `generate_ui` tool |
| `packages/dashboard-app/src/shared/components/DynamicRenderer.tsx` | UIConfig → React renderer |
| `packages/dashboard-app/src/app/(pages)/dynamic/page.tsx` | /dynamic page — intent input + API call |

## HTTP Endpoints (mcp-main)
| Method | Route | Description |
|---|---|---|
| GET | `/health` | Health check + cache status |
| POST | `/api/generate-ui` | Full pipeline: intent → UIConfig via `orchestrate()` |

## MCP Mode (--mcp flag)
When started with `--mcp`, `index.ts` exposes a `generate_dashboard` MCP tool (stdio) that calls `orchestrate()` and returns a shareable dashboard URL (`DASHBOARD_URL/dashboard?key=<hash>`).

## Bedrock Configuration
- Model: `us.anthropic.claude-haiku-4-5-20251001-v1:0`
- Region: `us-east-1`
- Credentials: AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY (+ AWS_SESSION_TOKEN for SSO)
- Tool-use loop: max 10 iterations; Nova model forces `query_data` first then `generate_ui`; Claude uses `any` then `auto`
- Fallback on loop failure: `runHardcodedPipeline()` → `interpretIntentWithBedrock()` + direct MCP calls

## Known Watch Points
- `uncaughtException` handler suppresses ioredis errors to prevent process crash
- Redis TLS enabled by default (`REDIS_TLS !== 'false'`)
- `COMPONENT_CATALOG` is hardcoded in `orchestrator.ts` (10 components)
- MCP servers must be built (`npm run build`) before they can be spawned as child processes
- AWS SSO credentials expire — update `.env` on expiry
- Records are NOT sent back to Bedrock after `query_data` (only a summary) to avoid context overflow

## Roadmap
| Phase | Status | Description |
|---|---|---|
| Phase 1 | **Current** | MVP local — pipeline end-to-end |
| Phase 2 | Next | API Gateway + Event Bus, multi-channel |
| Phase 3 | Future | Stateless orchestrator + MCP Server Registry |
| Phase 4 | Future | Observability + CI/CD for UI artifacts |
