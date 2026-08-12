# Progress — MCP MVP Dashboard

## What Works
- Full pipeline: intent → Bedrock tool-use loop → query_data → generate_ui → UIConfig → render
- All 6 UIConfig templates (executive, category, credit, table, cards, chart)
- DynamicRenderer with staggered animations (`animated` prop, `componentEnter` keyframe injected inline)
- Redis cache with graceful degradation
- mcp-gcp-mock with exact + range + array IN filters on 5,000 ventas-credito records
- mcp-ui hint system `[groupBy:x] [metric:x] [metricField:x] [chartType:x] [template:x]`
- Bedrock fallback: local regex parser (no Bedrock needed) handles conversational Spanish
- `/health` endpoint with cache status
- `/api/generate-ui` endpoint with 401 on expired AWS credentials
- MCP stdio mode (`--mcp` flag) with `generate_dashboard` tool
- Navbar (replaced Sidebar) — horizontal, theme switcher with localStorage persistence
- Theme persisted in localStorage, applied before first paint via inline script (no hydration flash)
- Empty/error/credExpired states on /dynamic page
- Pie/doughnut charts: correct per-segment colors, 320px height, centered maxWidth
- Bar charts: per-bar colors when single dataset
- Smart pivoting: when data is filtered to 1 category → groups by estado; 1 estado → groups by ciudad; 1 estatus → groups by categoria
- Template override: orchestrator forces `credit` template when all records share same estatus_credito
- Filter normalization: accent-safe estado mapping, proper noun capitalization
- Conversational parser: 32 estados (CDMX, Edomex, Monterrey aliases), relative dates (este mes, año pasado), question patterns (qué estado, quién vende)

## What's Pending / Not Built
- Phase 2: API Gateway + Event Bus
- Phase 3: MCP Server Registry
- Phase 4: Observability + CI/CD
- Real GCP BigQuery / SAP connector
- Dynamic component catalog (hardcoded in orchestrator.ts)
- `pipeline.ts` / `Pipeline` class — exists but unused

## File Locations Quick Reference
| File | Purpose |
|---|---|
| `packages/mcp-main/src/orchestrator.ts` | **PRIMARY**: Bedrock loop + local parser + filter normalization + template override |
| `packages/mcp-main/src/index.ts` | Fastify server + MCP stdio |
| `packages/mcp-main/src/pipeline.ts` | Sequential pipeline (unused) |
| `packages/mcp-main/src/mcp-client.ts` | McpClient, createMcpClients() |
| `packages/mcp-main/src/cache.ts` | Redis helpers |
| `packages/mcp-gcp-mock/src/tools/query-data.ts` | Filter engine (exact, range, array IN) |
| `packages/mcp-gcp-mock/data/ventas-credito.json` | 5,000 mock sales records |
| `packages/mcp-ui/src/tools/generate-ui.ts` | All 6 templates + smart pivot logic |
| `packages/dashboard-app/src/shared/components/DynamicRenderer.tsx` | UIConfig → React, staggered animations |
| `packages/dashboard-app/src/shared/components/Navbar.tsx` | Top navbar (replaced Sidebar.tsx) |
| `packages/dashboard-app/src/app/(pages)/layout.tsx` | Uses Navbar, paddingTop: 56 |
| `packages/dashboard-app/src/app/(pages)/dynamic/page.tsx` | /dynamic — full UX with all states |
| `packages/dashboard-app/src/app/layout.tsx` | suppressHydrationWarning, inline theme script |
| `packages/dashboard-app/src/app/globals.css` | Design tokens + keyframes incl. componentEnter |
