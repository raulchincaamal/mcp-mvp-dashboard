# Progress — MCP MVP Dashboard

## Nova Pro Integration Status

### Fase 1: Validación ✅ COMPLETADA
- Model ID `amazon.nova-pro-v1:0` validado en us-east-1
- Latencia promedio: ~10s (2 llamadas Bedrock secuenciales)
- Intent parsing en español: funciona correctamente
- UIConfig generation: JSON válido y rico
- Features validados: groupBy, chartTypes, topBottom, trendAnalysis, correlation, drillDown
- Arquitectura actual: orquestación manual (NO usa tool use nativo)

### Fase 2: Tool Use Nativo ✅ IMPLEMENTADO
- Nuevo archivo: `orchestrator-tooluse.ts`
- Variable de entorno: `USE_TOOL_USE=true` para activar
- Tools definidos: `query_data`, `generate_dashboard`
- Loop dinámico: Nova Pro decide cuándo usar herramientas
- Pendiente: validación de latencia y calidad de respuestas

### Fase 3: Optimización (PENDIENTE)
- Streaming para mejor UX
- Métricas de observabilidad
- Comparación de rendimiento entre modos

## What Works
- Full pipeline: intent → Bedrock tool-use loop → query_data → generate_ui → UIConfig → render
- All 6 UIConfig templates (executive, category, credit, table, cards, chart)
- DynamicRenderer with staggered animations (`animated` prop, `componentEnter` keyframe injected inline)
- Empty/no-results state with styled card in DynamicRenderer
- Redis cache with graceful degradation
- mcp-gcp-mock with exact + range + array IN filters on 5,000 ventas-credito records
- Dataset regenerated with dates up to today (2024–2026)
- mcp-ui hint system `[groupBy:x] [metric:x] [metricField:x] [chartType:x] [template:x]`
- Bedrock fallback: local regex parser handles conversational Spanish (no Bedrock needed)
- `/health` endpoint with cache status
- `/api/generate-ui` endpoint with 401 on expired AWS credentials
- MCP stdio mode (`--mcp` flag) with `generate_dashboard` tool
- Navbar (replaced Sidebar) — horizontal, theme switcher with localStorage persistence
- Theme persisted in localStorage, applied before first paint (no hydration flash)
- Empty/error/credExpired states on /dynamic page
- Pie/doughnut charts: correct per-segment colors, 320px height, centered maxWidth
- Bar charts: per-bar colors when single dataset; contrasting colors when multiple datasets
- Smart pivoting: 1 categoria → group by estado; 1 estado → group by ciudad; 1 estatus → group by categoria
- Template overrides: credit when all records share estatus_credito; executive for general queries
- Filter normalization: accent-safe estado mapping, known value maps, date range clamping
- Date normalization: "este mes/año/mes pasado" → concrete date ranges before Bedrock
- Conversational parser: 32 estados, relative dates, question patterns, Alexa-style intents
- ProgressGroup: per-item colors (not monochromatic)
- Multiple dataset bar charts: contrasting colors (skip 4 positions in palette)

## What's Pending / Not Built
- Phase 2: API Gateway + Event Bus
- Phase 3: MCP Server Registry
- Phase 4: Observability + CI/CD
- Real GCP BigQuery / SAP connector
- Dynamic component catalog (hardcoded in orchestrator.ts)
- `pipeline.ts` / `Pipeline` class — exists but unused
- `/dashboard` static page — not connected to pipeline

## File Locations Quick Reference
| File | Purpose |
|---|---|
| `packages/mcp-main/src/orchestrator.ts` | **PRIMARY**: full pipeline orchestration |
| `packages/mcp-main/src/index.ts` | Fastify server + MCP stdio |
| `packages/mcp-gcp-mock/scripts/generate-ventas.mjs` | Dataset generator (run to refresh data) |
| `packages/mcp-gcp-mock/data/ventas-credito.json` | 5,000 mock sales records (2024–2026) |
| `packages/mcp-ui/src/tools/generate-ui.ts` | All 6 templates + smart pivot + color logic |
| `packages/dashboard-app/src/shared/components/DynamicRenderer.tsx` | UIConfig → React, staggered animations, empty state |
| `packages/dashboard-app/src/shared/components/Navbar.tsx` | Top navbar (replaced Sidebar.tsx) |
| `packages/dashboard-app/src/app/(pages)/dynamic/page.tsx` | /dynamic — full UX with all states |
| `packages/dashboard-app/src/app/layout.tsx` | suppressHydrationWarning, inline theme script |
| `packages/dashboard-app/src/app/globals.css` | Design tokens + keyframes |
