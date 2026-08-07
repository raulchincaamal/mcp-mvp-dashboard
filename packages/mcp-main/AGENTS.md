<!-- @mcp-mvp/mcp-main/AGENTS.md -->

## GLOBAL IMPERATIVE

- **NEVER** manually edit `package-lock.json` — use npm commands
- **NEVER** commit `.env` files — contienen credenciales AWS
- **ALWAYS** update docs when functionality changes
- **ALWAYS** rebuild (`npm run build`) after modifying source files

## [QUICK-REF] — Pipeline Orchestrator

HTTP API (Fastify) que orquesta el pipeline secuencial de generación de dashboards. Spawna los MCP servers como child processes, interpreta intents con AWS Bedrock (Claude Haiku), y expone endpoints REST al frontend.

- **Package**: `@mcp-mvp/mcp-main`
- **Entry**: `node dist/index.js`
- **Port**: 4000 (configurable via `PORT` env var)
- **MCP Clients**: `mcp-gcp-mock`, `mcp-ui`, `library-context`
- **LLM**: AWS Bedrock Claude Haiku 4.5 (para interpretación de intent)

### Arranque

```bash
npm run dev:mcp-main    # Desde la raíz del monorepo
# o
node dist/index.js      # Desde packages/mcp-main/
```

### Configuración (.env)

```env
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_SESSION_TOKEN=...          # Solo si usas SSO/credenciales temporales
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=us.anthropic.claude-haiku-4-5-20251001-v1:0
PORT=4000
```

## [ON-DEMAND] API Endpoints

| Método | Ruta               | Descripción                                             |
| ------ | ------------------ | ------------------------------------------------------- |
| GET    | `/health`          | Health check + estado de MCP servers                    |
| POST   | `/api/generate-ui` | Pipeline completo: LLM + datos + componentes → UIConfig |

### POST /api/generate-ui

Endpoint principal. Interpreta lenguaje natural, aplica filtros, y genera UI dinámica.

**Request Body**:

```typescript
{
  dataset: string;         // "ventas-credito"
  intent: string;          // "gráfica de ventas de motos por estado"
  title?: string;
  layout?: 'vertical' | 'grid';
  columns?: number;
  filters?: Record<string, unknown>;  // Override manual de filtros
  limit?: number;                     // Override manual de límite
}
```

**Response**:

```typescript
{
  success: boolean;
  data: UIConfig; // O error message si success=false
}
```

### POST /api/generate-chart

**Request Body**:

```typescript
{
  dataset: string;
  chartType: 'bar' | 'line' | 'pie' | 'doughnut' | 'area';
  labelField: string;
  valueFields: string[];
  title?: string;
  filters?: Record<string, unknown>;
  limit?: number;
}
```

### POST /api/generate-dashboard

**Request Body**:

```typescript
{
  dataset: string;
  labelField: string;
  metrics: string[];
  title?: string;
  description?: string;
  layout?: 'grid' | 'vertical';
  columns?: number;
  filters?: Record<string, unknown>;
  limit?: number;
}
```

## [ON-DEMAND] Pipeline Flow

```
POST /api/generate-ui { dataset, intent }
  │
  ├─ 1. Intent Interpreter (AWS Bedrock Claude Haiku)
  │     Input:  "gráfica de ventas de motos por estado"
  │     Output: { filters: {categoria: "Motos"}, groupBy: "estado", metric: "count", chartType: "bar", template: "chart" }
  │
  ├─ 2. library-context MCP → Component catalog
  │     Output: [{ name: "StatCard", ... }, { name: "Chart", ... }, ...]
  │
  ├─ 3. mcp-gcp-mock → Query data (with inferred filters + limit)
  │     Output: { records: [...filtered data...] }
  │
  └─ 4. mcp-ui generate_ui → UIConfig
        Input:  enhanced intent + records + catalog
        Output: { title, layout, components: [...] }
```

## [ON-DEMAND] Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     mcp-main (Fastify)                    │
│                      port 4000                           │
├──────────────────────────────────────────────────────────┤
│  Intent Interpreter ──── AWS Bedrock Claude Haiku        │
│  Pipeline            ──── Orchestration logic            │
│  Routes              ──── HTTP endpoints                 │
│  MCP Clients         ──── stdio connections              │
├──────────┬──────────────────┬────────────────────────────┤
│          │                  │                            │
│  mcp-gcp-mock      mcp-ui        library-context        │
│  (datos)           (transform)    (componentes)          │
│  stdio             stdio          stdio                  │
└──────────┴──────────────────┴────────────────────────────┘
```

## [ON-DEMAND] MCP Client Connections

| Server            | Cómo se conecta            | Path                                                                            |
| ----------------- | -------------------------- | ------------------------------------------------------------------------------- |
| `mcp-gcp-mock`    | `node` + path relativo     | `../../mcp-gcp-mock/dist/index.js`                                              |
| `mcp-ui`          | `node` + path relativo     | `../../mcp-ui/dist/index.js`                                                    |
| `library-context` | `node` + node_modules path | `../../../node_modules/@macropaytd/lib-front-mcp-library-context/dist/index.js` |

## [ON-DEMAND] Troubleshooting

### Port already in use (EADDRINUSE)

```bash
# Windows
netstat -ano | grep 4000
taskkill //PID <pid> //F
```

### Bedrock "security token invalid"

Credenciales expiradas (SSO). Renueva desde el portal AWS SSO y actualiza `.env`.

### Bedrock "model end of life"

Actualiza `BEDROCK_MODEL_ID` en `.env` al modelo activo más reciente. Usa geo inference ID (ej: `us.anthropic.claude-haiku-4-5-20251001-v1:0`).

### MCP server "Connection closed"

El server hijo no pudo arrancar. Verifica que los builds están al día: `npm run build`.

