<!-- mcp-mvp-dashboard/AGENTS.md -->

## GLOBAL IMPERATIVE

- **NEVER** manually edit `package-lock.json` — use npm commands
- **NEVER** commit `.env` or `.npmrc` files — contienen credenciales
- **ALWAYS** run `npm run build` after modifying MCP server source code
- **ALWAYS** update AGENTS.md docs when adding tools, endpoints, or changing behavior

## [QUICK-REF] — MCP MVP Dashboard

Monorepo que implementa un pipeline de generación dinámica de dashboards usando Model Context Protocol (MCP). Transforma datos crudos en UIs renderizables a través de un flujo secuencial orquestado.

- **Monorepo**: npm workspaces
- **Node**: >= 18.0.0
- **Packages**: `mcp-gcp-mock`, `mcp-ui`, `mcp-main`, `dashboard-app`

### Pipeline

```
Usuario (intent en español)
    ↓
mcp-main (Fastify API, port 4000)
    ├── AWS Bedrock Claude Haiku → interpreta intent → structured query
    ├── library-context MCP → catálogo de componentes
    ├── mcp-gcp-mock MCP → datos filtrados
    └── mcp-ui MCP → UIConfig declarativo
    ↓
dashboard-app (Next.js, port 3000)
    └── DynamicRenderer → componentes React reales
```

### Quick Start

```bash
npm install                    # Instala todo el monorepo
npm run build                  # Compila los 4 packages
npm run dev:mcp-main           # API en localhost:4000
npm run dev:dashboard          # Frontend en localhost:3000
```

## [ON-DEMAND] Package Map

| Package                  | Rol                                                    | Puerto | Entry           |
| ------------------------ | ------------------------------------------------------ | ------ | --------------- |
| `packages/mcp-gcp-mock`  | Fuente de datos (mock GCP/SAP)                         | stdio  | `dist/index.js` |
| `packages/mcp-ui`        | Transforma datos → JSON configs (Chart, Dashboard, UI) | stdio  | `dist/index.js` |
| `packages/mcp-main`      | Orquestador HTTP + LLM interpreter                     | 4000   | `dist/index.js` |
| `packages/dashboard-app` | Frontend Next.js + DynamicRenderer                     | 3000   | `next dev`      |

## [ON-DEMAND] MCP Servers

### mcp-gcp-mock

- **Tools**: `list_datasets`, `query_data`
- **Data**: `packages/mcp-gcp-mock/data/ventas-credito.json` (5,000 records)
- **Filters**: Exact match + range (`gte`, `lte`, `gt`, `lt`) para fechas y números
- **Docs**: `packages/mcp-gcp-mock/AGENTS.md`

### mcp-ui

- **Tools**: `generate_ui`
- **Output**: `UIConfig` (JSON declarativo)
- **Templates**: executive, category, credit, table, cards, chart
- **Docs**: `packages/mcp-ui/AGENTS.md`

### mcp-main (orquestador)

- **Endpoints**: `/health`, `/api/generate-ui`
- **LLM**: AWS Bedrock Claude Haiku 4.5 (interpreta intents en español)
- **MCP Clients**: Spawna `mcp-gcp-mock`, `mcp-ui`, `library-context` como child processes
- **Docs**: `packages/mcp-main/AGENTS.md`

## [ON-DEMAND] Frontend (dashboard-app)

- **Framework**: Next.js 16 + React 19 + Tailwind 4
- **Architecture**: Template front-template-kiro (FIFO orchestrator, Zustand, i18n)
- **UI Library**: `@macropaytd/lib-front-ui-components`
- **Chart Library**: D3.js
- **Key Component**: `DynamicRenderer` — mapea UIConfig JSON a componentes reales

### Rutas

| Ruta         | Descripción                                                    |
| ------------ | -------------------------------------------------------------- |
| `/`          | Home page                                                      |
| `/dashboard` | Dashboard estático (sample data)                               |
| `/dynamic`   | UI Dinámica — genera UIs desde intent + datos via mcp-main API |

### DynamicRenderer Components

| Component                                  | Tipo        | Descripción                                                                                                         |
| ------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------- |
| `StatCard`                                 | Composite   | Metric card con valor, tendencia, icono                                                                             |
| `KPIGrid`                                  | Composite   | Grid de StatCards                                                                                                   |
| `ProgressBar`                              | Composite   | Barra de progreso con label                                                                                         |
| `ProgressGroup`                            | Composite   | Card con múltiples progress bars                                                                                    |
| `TransactionList`                          | Composite   | Lista de items con monto y fecha                                                                                    |
| `MiniChart`                                | Composite   | Sparkline compacto en card                                                                                          |
| `DataSummary`                              | Composite   | Tabla estilizada con hover                                                                                          |
| `Chart`                                    | D3.js       | Bar, Line, Pie, Doughnut, Area, Bollinger, Stacked Area, Diverging Bar, Radial, Candlestick, Hierarchical, Bar Race |
| `Card`, `Text`, `Badge`, `Button`, `Input` | @macropaytd | Componentes base de la librería                                                                                     |

## [ON-DEMAND] Data Generation

```bash
node packages/mcp-gcp-mock/scripts/generate-ventas.mjs
```

Genera 5,000 registros de ventas a crédito basados en el catálogo real de [macropay.mx/tienda](https://macropay.mx/tienda/).

## [ON-DEMAND] AWS Bedrock Configuration

Required in `packages/mcp-main/.env`:

```env
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_SESSION_TOKEN=...              # Solo para SSO/credenciales temporales
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=us.anthropic.claude-haiku-4-5-20251001-v1:0
PORT=4000
```

## [ON-DEMAND] Scalability Path

| Phase   | Estado     | Descripción                                    |
| ------- | ---------- | ---------------------------------------------- |
| Phase 1 | **Actual** | MVP local — pipeline end-to-end validado       |
| Phase 2 | Próximo    | API Gateway + Event Bus para múltiples canales |
| Phase 3 | Futuro     | Orchestrator stateless + MCP Server Registry   |
| Phase 4 | Futuro     | Observability + CI/CD para UI artifacts        |

