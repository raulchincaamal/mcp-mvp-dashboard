# Progress — MCP MVP Dashboard

## What Works
- Full pipeline: intent → Bedrock → filters → data query → UIConfig → render
- All 6 UIConfig templates (executive, category, credit, table, cards, chart)
- DynamicRenderer with all composite components (StatCard, KPIGrid, ProgressGroup, TransactionList, MiniChart, DataSummary, Chart)
- Redis cache with graceful degradation (works without Redis)
- mcp-main as MCP Server exposing `generate_dashboard` tool
- mcp-gcp-mock with exact + range filters on 5,000 ventas-credito records
- mcp-ui with hint system `[groupBy:x] [metric:x] [chartType:x] [template:x]`
- Bedrock fallback on error (executive template, no filters)
- Component catalog hardcoded + augmented from library-context response

## What's Pending / Not Built
- Phase 2: API Gateway + Event Bus
- Phase 3: MCP Server Registry
- Phase 4: Observability + CI/CD
- Real GCP BigQuery / SAP connector (mcp-gcp-mock is the placeholder)
- Dynamic component catalog (currently hardcoded with regex augmentation)

## File Locations Quick Reference
| File | Purpose |
|---|---|
| `packages/mcp-main/src/index.ts` | MCP Server entry, `generate_dashboard` tool |
| `packages/mcp-main/src/pipeline.ts` | Pipeline orchestration, `Pipeline.generateUi()` |
| `packages/mcp-main/src/intent-interpreter.ts` | Bedrock ConverseCommand, `interpretIntent()` |
| `packages/mcp-main/src/mcp-client.ts` | `McpClient` class, `createMcpClients()` |
| `packages/mcp-main/src/cache.ts` | Redis cache helpers |
| `packages/mcp-gcp-mock/src/index.ts` | MCP Server, `list_datasets` + `query_data` tools |
| `packages/mcp-ui/src/index.ts` | MCP Server, `generate_ui` tool |
| `packages/dashboard-app/src/shared/components/DynamicRenderer.tsx` | UIConfig → React renderer |
| `packages/dashboard-app/src/app/(pages)/dynamic/page.tsx` | /dynamic page — intent input + API call + render |
| `packages/dashboard-app/.env.local` | NEXT_PUBLIC_MCP_API_URL=http://localhost:4000 |
| `packages/mcp-gcp-mock/data/ventas-credito.json` | 5,000 mock sales records |
| `packages/mcp-gcp-mock/scripts/generate-ventas.mjs` | Data regeneration script |
