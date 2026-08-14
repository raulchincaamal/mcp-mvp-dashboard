# Active Context — MCP MVP Dashboard

## Current State
Phase 1 (MVP local) — pipeline end-to-end validated and working, including conversational NLP fallback.

## Active Architecture: Bedrock Tool-Use Orchestrator
`mcp-main` runs as a **Fastify HTTP server** (port 4000). The primary entry point is `orchestrate()` in `orchestrator.ts`, which runs a **Bedrock tool-use loop**:

1. `normalizeDateExpressions()` transforms relative dates ("este mes") → concrete ranges before anything else
2. Bedrock receives the normalized intent + tool definitions (`query_data`, `generate_ui`)
3. Bedrock calls `query_data` → orchestrator normalizes filters (casing, accents, known value maps) → `mcp-gcp-mock` returns records
4. Bedrock calls `generate_ui` → orchestrator overrides template when needed → injects records + `COMPONENT_CATALOG` → `mcp-ui` returns UIConfig (double-parsed from string)
5. UIConfig cached in Redis (TTL.INTENT = 60 min) and returned

**Fallback**: if Bedrock loop fails → `runHardcodedPipeline()` with local regex parser (no Bedrock needed)

## Key Source Files
| File | Responsibility |
|---|---|
| `packages/mcp-main/src/orchestrator.ts` | **Primary**: Bedrock loop + date normalization + filter normalization + template overrides + local parser fallback |
| `packages/mcp-main/src/index.ts` | Fastify server + MCP stdio server (`--mcp` flag); routes call `orchestrate()` |
| `packages/mcp-main/src/pipeline.ts` | `Pipeline.generateUi()` — sequential pipeline class (unused) |
| `packages/mcp-main/src/mcp-client.ts` | `McpClient` class, `createMcpClients()` |
| `packages/mcp-main/src/cache.ts` | Redis helpers |
| `packages/mcp-gcp-mock/src/index.ts` | MCP Server: `list_datasets`, `query_data` tools |
| `packages/mcp-gcp-mock/scripts/generate-ventas.mjs` | Dataset generator — dates now dynamic up to today |
| `packages/mcp-ui/src/tools/generate-ui.ts` | All template logic: executive, category, credit, table, cards, chart |
| `packages/dashboard-app/src/shared/components/DynamicRenderer.tsx` | UIConfig → React renderer with staggered animations + empty state |
| `packages/dashboard-app/src/app/(pages)/dynamic/page.tsx` | /dynamic page — intent input + loading states + credExpired state |
| `packages/dashboard-app/src/shared/components/Navbar.tsx` | Top navbar with theme switcher (replaces Sidebar) |

## HTTP Endpoints (mcp-main)
| Method | Route | Description |
|---|---|---|
| GET | `/health` | Health check + cache status |
| POST | `/api/generate-ui` | Full pipeline: intent → UIConfig via `orchestrate()` |

## Orchestrator Smart Behaviors
- **Date normalization**: "este mes" → "el mes agosto 2025 (del 2025-08-01 al 2025-08-31)" before Bedrock sees it
- **Chart type normalization**: "pastel/pie/circular" → pie, "dona/donut" → doughnut, "barras" → bar, "líneas" → line
- **GroupBy "mes"**: extracts month from fecha_venta, sorts chronologically ("Enero 2024", "Febrero 2024", etc.)
- **Filter normalization**: known value maps for `estado` (32 states with accents), `estatus_credito`, `canal_venta`; date range clamping for future year hallucinations
- **Template overrides**:
  - All records share one `estatus_credito` → force `credit`
  - General query (ventas/mes/año) + >50 records + Nova chose `chart` → force `executive`
- **Double-parse**: loops `JSON.parse` until result is an object
- **Hint deduplication**: strips existing `[hint:x]` from intent before adding new ones

## Dataset
- 5,000 records, dates from 2024-01-01 to today (regenerated)
- Regenerate: `node packages/mcp-gcp-mock/scripts/generate-ventas.mjs`

## Known Watch Points
- `uncaughtException` handler suppresses ioredis errors
- `COMPONENT_CATALOG` hardcoded in `orchestrator.ts` (10 components)
- MCP servers must be built (`npm run build`) before spawning
- AWS SSO credentials expire → 401 response with clear message to user
- `dev:mcp-main` uses `node dist/index.js` — must rebuild before restarting
- Nova model has date hallucination bias → mitigated by `normalizeDateExpressions()`
