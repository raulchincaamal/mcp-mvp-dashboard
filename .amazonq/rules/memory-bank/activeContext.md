# Active Context — MCP MVP Dashboard

## Current State
Phase 2 (Tool Use Nativo) — implementado, pendiente validación.

## Active Architecture: Dual Orchestrator Mode
`mcp-main` soporta dos modos de orquestación controlados por `USE_TOOL_USE` env var:

### Mode 1: Manual (USE_TOOL_USE=false) - DEFAULT
```
orchestrate()
  ├── interpretIntent() → Bedrock Call #1
  ├── gcpClient.callTool('query_data') → MCP
  └── generateUIConfig() → Bedrock Call #2
```
Latencia: ~10s, 2 llamadas Bedrock fijas.

### Mode 2: Tool Use Nativo (USE_TOOL_USE=true)
```
orchestrate()
  └── Bedrock Tool Use Loop
        ├── Nova decide: query_data → MCP
        └── Nova decide: generate_dashboard → local builder
```
Latencia: variable (1-5 iteraciones), Nova decide cuándo usar herramientas.

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
- **Multiple chart types**: detects ALL chart types in intent, returns array
- **GroupBy "mes"**: extracts month from fecha_venta, sorts chronologically ("Enero 2024", "Febrero 2024", etc.)
- **Session context**: stores last intent/filters in Redis for refinement ("hazlo en verde")
- **Refinement detection**: patterns like "hazlo en", "cámbialo", "agrégale", "quítale" merge with previous context
- **Exclusion filters**: "todo menos motos" → client-side filtering after query
- **Numeric ranges**: "mayores a 50000" → filters with gte/lte/gt/lt
- **Top/Bottom**: "los 5 peores vendedores" → topBottom: {type: "bottom", count: 5}
- **Color themes**: 7 palettes (default, blue, green, dark, light, mono, corporate)
- **Comparisons**: "compara enero vs febrero" → comparison object
- **Percentages**: "qué porcentaje" → showPercentages: true

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
