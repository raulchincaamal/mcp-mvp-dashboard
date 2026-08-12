# Active Context — MCP MVP Dashboard

## Current State
Phase 1 (MVP local) — pipeline end-to-end validated and working.

## Active Architecture: Sequential Pipeline
`mcp-main` runs as a **Fastify HTTP server** (port 4000). The pipeline is sequential (not Bedrock tool-use loop):

1. `interpretIntent()` calls Bedrock ConverseCommand with a system prompt → returns ParsedIntent JSON
2. `getComponentCatalog()` calls library-context MCP → hardcoded component list augmented by regex
3. `queryData()` calls mcp-gcp-mock with merged filters
4. `uiClient.callTool('generate_ui')` calls mcp-ui with enhanced intent + records + catalog
5. Result cached in Redis and returned

## Key Source Files
| File | Responsibility |
|---|---|
| `packages/mcp-main/src/index.ts` | Fastify server setup, route registration |
| `packages/mcp-main/src/pipeline.ts` | `Pipeline.generateUi()` — sequential orchestration |
| `packages/mcp-main/src/intent-interpreter.ts` | `interpretIntent()` — Bedrock ConverseCommand |
| `packages/mcp-main/src/mcp-client.ts` | `McpClient` class, `createMcpClients()` |
| `packages/mcp-main/src/cache.ts` | Redis helpers: `cacheGet`, `cacheSet`, `generateCacheKey`, TTL constants |
| `packages/mcp-main/src/orchestrator.ts` | (exists — may contain alternate Bedrock tool-use orchestration) |
| `packages/mcp-gcp-mock/src/index.ts` | MCP Server: `list_datasets`, `query_data` tools |
| `packages/mcp-ui/src/index.ts` | MCP Server: `generate_ui` tool |
| `packages/dashboard-app/src/shared/components/DynamicRenderer.tsx` | UIConfig → React renderer |
| `packages/dashboard-app/src/app/(pages)/dynamic/page.tsx` | /dynamic page — intent input + API call |

## HTTP Endpoints (mcp-main)
| Method | Route | Description |
|---|---|---|
| GET | `/health` | Health check + MCP server connection status |
| POST | `/api/generate-ui` | Full pipeline: intent → UIConfig |
| POST | `/api/generate-chart` | Chart-only pipeline |
| POST | `/api/generate-dashboard` | Dashboard pipeline |

## Bedrock Configuration
- Model: `us.anthropic.claude-haiku-4-5-20251001-v1:0`
- Region: `us-east-1`
- Credentials: AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY (+ AWS_SESSION_TOKEN for SSO)
- Fallback on error: executive template, no filters, limit 100

## Known Watch Points
- `uncaughtException` handler suppresses ioredis errors to prevent process crash
- Redis TLS enabled by default (`REDIS_TLS !== 'false'`)
- Component catalog is hardcoded in `pipeline.ts` `parseComponentsFromContext()` + regex augmentation
- MCP servers must be built (`npm run build`) before mcp-main can spawn them as child processes
- AWS SSO credentials expire — update `.env` on expiry

## Roadmap
| Phase | Status | Description |
|---|---|---|
| Phase 1 | **Current** | MVP local — pipeline end-to-end |
| Phase 2 | Next | API Gateway + Event Bus, multi-channel |
| Phase 3 | Future | Stateless orchestrator + MCP Server Registry |
| Phase 4 | Future | Observability + CI/CD for UI artifacts |
