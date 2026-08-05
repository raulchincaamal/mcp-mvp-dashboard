# Architecture Context — MCP MVP Dashboard

## Overview

This monorepo implements an MVP for a dynamic chart generation pipeline using MCP (Model Context Protocol) servers. The system transforms raw data into declarative JSON configs that a React frontend renders with Chart.js.

## Original Vision (Whiteboard Diagram)

The project started from a whiteboard architecture with these components:

- **SAP** → Backend/ERP data source
- **GCP** → Cloud platform (infrastructure), receives data from SAP
- **MCP GCP** → MCP server connecting to GCP (assigned IA: Gemini)
- **MCP Main** → Central orchestrator MCP server (assigned IA: Sonnet)
- **MCP UI** → MCP server for the UI layer
- **MCP Builder UI** → Tool to build/configure UI (assigned IA: Sonnet)
- **Alexa** → Voice interface channel
- **Alexa Skills** → Skills communicating with MCP Main
- **Frontend** → Web app (React/HTML)

The numbered flow on the board showed: Alexa → MCP Main → MCP GCP → GCP → SAP, and MCP Main → MCP UI → Frontend.

## Pipeline (sequential, NOT a router)

```
MCP GCP Mock (data) → MCP UI (transforms to chart JSON) → Frontend (renders)
```

The flow is always sequential. UI cannot be generated without data first. MCP Main is a pipeline manager, not a router.

### Why pipeline and not router?

The UI is built WITH data from GCP/SAP. Without data, there's nothing to render. The MCP Main doesn't decide "go to data OR go to UI" — it always executes the full pipeline: get data first, then build UI with that data.

```typescript
// MCP Main is a pipeline manager
async function processRequest(intent: string) {
  const data = await mcpGcp.queryData(intent); // ALWAYS first
  const ui = await mcpUi.generatePage(data); // ALWAYS second, uses data
  return ui;
}
```

### When WOULD a router apply?

A router applies when there are mutually exclusive paths:

1. **Multiple independent data sources** — "sales data" → GCP/SAP, "ticket status" → CRM, "exchange rate" → external API. The router picks ONE source.
2. **Multiple output channels** — Same data rendered differently: Frontend → React, Alexa → SSML/voice, Slack → Block Kit messages.
3. **Actions that don't need data** — "Generate empty login template" → MCP UI directly (no data needed), "Change theme" → config only.

For this MVP, none of those apply yet. The router pattern will emerge when a second independent data source or output channel is added.

## Architecture Decisions

### 1. JSON declarative output (NOT code as text)

**Decision**: MCP UI returns Chart.js-compatible JSON configs that the frontend renders directly.

**Why not code as text?**

- Frontend would need to eval/compile code dynamically — complex and fragile
- JSON is serializable, storable in DB, and validable with JSON Schema
- JSON is framework-agnostic — same config works with any renderer
- JSON is secure — no code execution from external sources
- JSON works across channels (Alexa, Slack, etc.) with different renderers

**The frontend is a "dumb renderer"** — it just maps JSON config to Chart.js components via a switch statement.

### 2. Separate MCPs (not merged)

**Decision**: mcp-gcp-mock and mcp-ui are independent MCP servers, not one combined server.

**Reasoning**:

- Single responsibility — one handles data, the other handles transformation
- Independent scaling in production
- Can replace mcp-gcp-mock with a real GCP connector without touching mcp-ui
- Forces clean interface design between data and presentation

### 3. lib-front-mcp-library-context role

**Decision**: The existing `@macropaytd/lib-front-mcp-library-context` MCP is NOT part of this monorepo but complements it.

**Its role**: Provides the AI with KNOWLEDGE about available UI components (from `lib-front-ui-components`). It tells the AI "here's what components exist and how to use them." MCP UI then uses that knowledge to generate appropriate configs.

**They are complementary, not duplicates**:

- `lib-front-mcp-library-context` → "What components do I have?"
- `mcp-ui` → "Generate chart config using those components with this data"

### 4. Chart.js as charting library

**Decision**: Use Chart.js (via react-chartjs-2) instead of lib-front-ui-components.

**Reason**: lib-front-ui-components doesn't include chart components yet. When it does, we can swap the renderer.

## Packages

### packages/mcp-gcp-mock

- Simulates GCP/SAP data with local JSON fixtures
- Tools: `list_datasets`, `query_data`, `describe_dataset`
- Data lives in `data/` folder as JSON files
- Datasets: ventas-mensuales, usuarios-activos, metricas-producto
- In production this becomes a real GCP connector

### packages/mcp-ui

- Transforms raw data records into Chart.js-compatible JSON configs
- Tools: `generate_chart`, `generate_dashboard`, `list_chart_types`
- Infers best chart type based on data characteristics (e.g. rates → doughnut, time series → line)
- Output schema: `ChartConfig` and `DashboardConfig` (see frontend/src/types.ts)

### packages/frontend

- React + Vite + Chart.js (react-chartjs-2)
- `ChartRenderer` — renders a single chart from a `ChartConfig`
- `DashboardRenderer` — renders multiple charts in a grid/vertical layout
- Sample data in `src/sample-data/` for standalone testing

## Chart Config Schema

```typescript
interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string;
  borderWidth?: number;
}

interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'doughnut' | 'area';
  title: string;
  data: { labels: string[]; datasets: ChartDataset[] };
  options: {
    responsive: boolean;
    xAxis?: { label: string };
    yAxis?: { label: string };
    stacked?: boolean;
  };
}

interface DashboardConfig {
  title: string;
  description?: string;
  layout: 'grid' | 'vertical';
  columns?: number;
  charts: ChartConfig[];
}
```

## End-to-End Flow (MVP)

```
User in Kiro: "Generate a monthly sales dashboard"

1. AI consults lib-front-mcp-library-context
   → Knows what UI components are available

2. AI calls MCP GCP Mock → query_data("ventas-mensuales")
   → Gets: [{ mes: "Enero", total_ventas: 45000 }, ...]

3. AI calls MCP UI → generate_dashboard({ data, metrics, labelField })
   → Returns Chart.js-compatible JSON config

4. AI writes the JSON config or React code in frontend/

5. User sees the result at localhost:3000
```

## Scalability Improvements for Production

### Problems with naive approach

1. **MCP Main as bottleneck** — Single orchestrator = single point of failure
2. **Direct coupling MCP UI → Frontend** — Mixes code generation with deployment
3. **No event/async layer** — Synchronous point-to-point calls, no retry mechanism

### Production architecture additions

1. **API Gateway** — Centralized auth, rate-limiting, routing by channel
2. **Event Bus (SQS/Pub/Sub)** — Decouple channels from orchestrator, enable async + retry
3. **Stateless Orchestrator (N instances)** — Session state in Redis/DynamoDB, auto-scaling
4. **Artifact Store + CI/CD** — MCP Builder UI generates code → artifact store → CI/CD deploys
5. **MCP Server Registry** — Discovery service for available MCP servers and tools
6. **Observability** — OpenTelemetry tracing, structured logs, correlation IDs

### Implementation phases

1. **Phase 1 (current)**: MVP local — validate end-to-end flow
2. **Phase 2**: Add API Gateway + Event Bus for multiple channels
3. **Phase 3**: Stateless orchestrator + MCP Server Registry
4. **Phase 4**: Observability + CI/CD for UI artifacts

## Integration with lib-front-mcp-library-context

When working in Kiro with both MCPs connected:

```json
// .kiro/settings/mcp.json connects mcp-gcp-mock and mcp-ui
// lib-front-mcp-library-context connects from the global/user MCP config
```

The AI uses all three together:

1. `lib-front-mcp-library-context` → knows available components
2. `mcp-gcp-mock` → fetches data
3. `mcp-ui` → transforms data into chart configs using component knowledge

## Running Locally

```bash
npm install                    # Install all workspace deps
npm run build --workspaces     # Build MCP servers
npm run dev:frontend           # Start frontend at localhost:3000
```

MCPs connect automatically via `.kiro/settings/mcp.json` when this project is open in Kiro.

## Tech Stack

- **Runtime**: Node.js >= 18
- **Language**: TypeScript (strict)
- **MCP SDK**: @modelcontextprotocol/sdk ^1.29.0
- **Validation**: Zod ^3.23.0
- **Build**: tsup (MCP servers), Vite (frontend)
- **Frontend**: React 18, Chart.js 4, react-chartjs-2
- **Monorepo**: npm workspaces

