# Progress — MCP MVP Dashboard

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
- **NEW: Aurora theme ECharts** — AuroraChart component with gradient palettes (aurora, neon, fire, ocean)
- **NEW: Smooth loading → presentation transition** — GSAP timeline animations in ResultPresentation
- **NEW: Scroll-driven chart building** — ScrollDrivenChart component with ScrollTrigger scrub
- **NEW: Premium font** — Space Grotesk (tech/modern aesthetic)
- **NEW: Barba.js page transitions** — BarbaWrapper component with GSAP fade/slide
- **NEW: Lenis smooth scroll** — SmoothScroll wrapper for buttery scrolling
- **FIXED: Observatory glow bugs** — Removed aurora glow layers and boxShadow shimmer animations
- **FIXED: Observatory hover issues** — GlassPanel glowOnHover disabled on charts, subtle border highlight instead
- **IMPROVED: Observatory animations** — Varied entry directions (left/right/top/diagonal), multiple easings (back, elastic, power)

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
| `packages/dashboard-app/src/shared/components/DynamicRenderer.tsx` | UIConfig → React, staggered animations, empty state, **ScrollDrivenChart** |
| `packages/dashboard-app/src/shared/components/AuroraChart.tsx` | **ECharts with Aurora theme** + Flint compiler |
| `packages/dashboard-app/src/shared/components/BarbaWrapper.tsx` | **NEW: Page transitions with GSAP** |
| `packages/dashboard-app/src/shared/components/SmoothScroll.tsx` | Lenis smooth scroll wrapper |
| `packages/dashboard-app/src/shared/components/Navbar.tsx` | Top navbar (replaced Sidebar.tsx) |
| `packages/dashboard-app/src/app/(pages)/dynamic/page.tsx` | /dynamic — full UX with all states + **ResultPresentation** |
| `packages/dashboard-app/src/app/layout.tsx` | suppressHydrationWarning, inline theme script, **Space Grotesk font** |
| `packages/dashboard-app/src/app/globals.css` | Design tokens + keyframes + **Space Grotesk** |
