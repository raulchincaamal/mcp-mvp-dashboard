# Progress — MCP MVP Dashboard

## What Works
- Full pipeline: intent → Bedrock → ParsedIntent → filters → data query → UIConfig → render
- All 6 UIConfig templates (executive, category, credit, table, cards, chart)
- DynamicRenderer with all composite components (StatCard, KPIGrid, ProgressGroup, TransactionList, MiniChart, DataSummary, Chart)
- Redis cache with graceful degradation (works without Redis)
- mcp-gcp-mock with exact + range filters on 5,000 ventas-credito records
- mcp-ui with hint system `[groupBy:x] [metric:x] [metricField:x] [chartType:x] [template:x]`
- Bedrock fallback on error (executive template, no filters, limit 100)
- Component catalog hardcoded (19 components) + regex augmentation from library-context response
- `/health` endpoint with MCP server connection status
- `/api/generate-ui`, `/api/generate-chart`, `/api/generate-dashboard` endpoints

## What's Pending / Not Built
- Phase 2: API Gateway + Event Bus
- Phase 3: MCP Server Registry
- Phase 4: Observability + CI/CD
- Real GCP BigQuery / SAP connector (mcp-gcp-mock is the placeholder)
- Dynamic component catalog (currently hardcoded with regex augmentation)
- `orchestrator.ts` — alternate Bedrock tool-use loop (exists but relationship to pipeline unclear)

## File Locations Quick Reference
| File | Purpose |
|---|---|
| `packages/mcp-main/src/index.ts` | Fastify server, route registration |
| `packages/mcp-main/src/pipeline.ts` | `Pipeline.generateUi()` — sequential orchestration |
| `packages/mcp-main/src/intent-interpreter.ts` | `interpretIntent()` — Bedrock ConverseCommand |
| `packages/mcp-main/src/mcp-client.ts` | `McpClient` class, `createMcpClients()` |
| `packages/mcp-main/src/cache.ts` | Redis helpers: `cacheGet`, `cacheSet`, `generateCacheKey`, TTL |
| `packages/mcp-main/src/orchestrator.ts` | Alternate orchestration (Bedrock tool-use loop) |
| `packages/mcp-gcp-mock/src/index.ts` | MCP Server: `list_datasets` + `query_data` tools |
| `packages/mcp-gcp-mock/data/ventas-credito.json` | 5,000 mock sales records |
| `packages/mcp-gcp-mock/scripts/generate-ventas.mjs` | Data regeneration script |
| `packages/mcp-ui/src/index.ts` | MCP Server: `generate_ui` tool + template system |
| `packages/dashboard-app/src/shared/components/DynamicRenderer.tsx` | UIConfig → React renderer |
| `packages/dashboard-app/src/app/(pages)/dynamic/page.tsx` | /dynamic page — intent input + API call + render |
| `packages/dashboard-app/src/app/(pages)/dashboard/page.tsx` | /dashboard page — static sample data |
| `packages/dashboard-app/.env.local` | `NEXT_PUBLIC_MCP_API_URL=http://localhost:4000` |
| `packages/mcp-main/.env` | AWS + Bedrock + Redis credentials |
| `.amazonq/rules/memory-bank/` | This Memory Bank |
