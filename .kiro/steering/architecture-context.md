# Architecture Context — MCP MVP Dashboard

## Overview

This monorepo implements an MVP for a dynamic chart generation pipeline using MCP (Model Context Protocol) servers. The system transforms raw data into declarative JSON configs that a React frontend renders with Chart.js.

## Pipeline (sequential, NOT a router)

```
MCP GCP Mock (data) → MCP UI (transforms to chart JSON) → Frontend (renders)
```

The flow is always sequential. UI cannot be generated without data first. MCP Main is a pipeline manager, not a router. A router only applies when there are mutually exclusive paths (e.g. multiple independent data sources or multiple output channels).

## Architecture Decisions

1. **JSON declarative output** — MCP UI returns Chart.js-compatible JSON configs, NOT code as text. The frontend is a dumb renderer that maps config to components.
2. **Separate MCPs** — Each MCP has a single responsibility. mcp-gcp-mock handles data, mcp-ui handles transformation to chart configs.
3. **lib-front-mcp-library-context** (external) — Provides component knowledge to the AI. NOT part of this monorepo but complements it by telling the AI what UI components are available.
4. **Chart.js** — Used as charting library since lib-front-ui-components doesn't include charts yet.

## Packages

### packages/mcp-gcp-mock
- Simulates GCP/SAP data with local JSON fixtures
- Tools: `list_datasets`, `query_data`, `describe_dataset`
- Data lives in `data/` folder as JSON files
- In production this becomes a real GCP connector

### packages/mcp-ui
- Transforms raw data records into Chart.js-compatible JSON configs
- Tools: `generate_chart`, `generate_dashboard`, `list_chart_types`
- Infers best chart type based on data characteristics
- Output schema: `ChartConfig` and `DashboardConfig` (see frontend/src/types.ts)

### packages/frontend
- React + Vite + Chart.js (react-chartjs-2)
- `ChartRenderer` — renders a single chart from a `ChartConfig`
- `DashboardRenderer` — renders multiple charts in a grid/vertical layout
- Sample data in `src/sample-data/` for standalone testing

## Chart Config Schema

```typescript
interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'doughnut' | 'area';
  title: string;
  data: { labels: string[]; datasets: ChartDataset[]; };
  options: { responsive: boolean; xAxis?: { label: string }; yAxis?: { label: string }; };
}

interface DashboardConfig {
  title: string;
  description?: string;
  layout: 'grid' | 'vertical';
  columns?: number;
  charts: ChartConfig[];
}
```

## Future Scalability Path

1. **Phase 1 (current)**: MVP local — validate end-to-end flow
2. **Phase 2**: Add API Gateway + Event Bus for multiple channels
3. **Phase 3**: Stateless orchestrator + MCP Server Registry
4. **Phase 4**: Observability + CI/CD for UI artifacts

## Running Locally

```bash
npm install                    # Install all workspace deps
npm run build --workspaces     # Build MCP servers
npm run dev:frontend           # Start frontend at localhost:3000
```

MCPs connect automatically via `.kiro/settings/mcp.json` when this project is open in Kiro.
