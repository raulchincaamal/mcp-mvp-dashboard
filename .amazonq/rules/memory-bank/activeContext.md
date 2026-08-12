# Active Context — MCP MVP Dashboard

## Current State
Phase 1 (MVP local) — pipeline end-to-end validated and working, including conversational NLP fallback.

## Active Architecture: Bedrock Tool-Use Orchestrator
`mcp-main` runs as a **Fastify HTTP server** (port 4000). The primary entry point is `orchestrate()` in `orchestrator.ts`, which runs a **Bedrock tool-use loop**:

1. Bedrock receives the user intent + tool definitions (`query_data`, `generate_ui`)
2. Bedrock calls `query_data` → orchestrator normalizes filters (casing, accents) → `mcp-gcp-mock` returns records
3. Bedrock calls `generate_ui` → orchestrator injects full records + `COMPONENT_CATALOG` + overrides template when needed → `mcp-ui` returns UIConfig (double-parsed from string)
4. UIConfig cached in Redis (TTL.INTENT = 60 min) and returned

**Fallback**: if Bedrock loop fails (expired credentials throw 401, other errors → `runHardcodedPipeline()`)
- `runHardcodedPipeline()` uses local regex parser `interpretIntentWithBedrock()` — no Bedrock call needed
- Parser handles: categorías, 32 estados de México (with accent normalization), colores, estatus, canal, fechas relativas ("este mes", "año pasado"), lenguaje conversacional

## Key Source Files
| File | Responsibility |
|---|---|
| `packages/mcp-main/src/index.ts` | Fastify server + MCP stdio server (`--mcp` flag); routes call `orchestrate()` |
| `packages/mcp-main/src/orchestrator.ts` | **Primary**: `orchestrate()` → Bedrock loop + local parser fallback + filter normalization + template override |
| `packages/mcp-main/src/pipeline.ts` | `Pipeline.generateUi()` — sequential pipeline class (unused by current routes) |
| `packages/mcp-main/src/intent-interpreter.ts` | `interpretIntent()` — unused (replaced by local parser in orchestrator) |
| `packages/mcp-main/src/mcp-client.ts` | `McpClient` class, `createMcpClients()` |
| `packages/mcp-main/src/cache.ts` | Redis helpers |
| `packages/mcp-gcp-mock/src/index.ts` | MCP Server: `list_datasets`, `query_data` tools |
| `packages/mcp-ui/src/tools/generate-ui.ts` | All template logic: executive, category, credit, table, cards, chart |
| `packages/dashboard-app/src/shared/components/DynamicRenderer.tsx` | UIConfig → React renderer with staggered animations |
| `packages/dashboard-app/src/app/(pages)/dynamic/page.tsx` | /dynamic page — intent input + loading states + error handling |
| `packages/dashboard-app/src/shared/components/Navbar.tsx` | Top navbar with theme switcher (replaces Sidebar) |

## HTTP Endpoints (mcp-main)
| Method | Route | Description |
|---|---|---|
| GET | `/health` | Health check + cache status |
| POST | `/api/generate-ui` | Full pipeline: intent → UIConfig via `orchestrate()` |

## Orchestrator Smart Behaviors
- **Filter normalization**: capitalizes proper nouns, maps known estado/estatus/canal values to exact dataset strings including accents
- **Template override**: when all records share one `estatus_credito`, forces `[template:credit]` regardless of what Bedrock decides
- **Double-parse**: `mcp-ui` returns JSON.stringify'd config; orchestrator loops `JSON.parse` until object
- **Hint deduplication**: strips existing `[hint:x]` from intent before adding new ones

## Known Watch Points
- `uncaughtException` handler suppresses ioredis errors
- Redis TLS enabled by default (`REDIS_TLS !== 'false'`)
- `COMPONENT_CATALOG` hardcoded in `orchestrator.ts` (10 components)
- MCP servers must be built (`npm run build`) before spawning
- AWS SSO credentials expire → 401 response with clear message to user
- Records NOT sent back to Bedrock after `query_data` (summary only)
- `dev:mcp-main` uses `node dist/index.js` — must rebuild before restarting
