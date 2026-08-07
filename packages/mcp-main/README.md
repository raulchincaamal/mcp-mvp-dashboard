# @mcp-mvp/mcp-main

Pipeline orchestrator — HTTP API (Fastify) que orquesta la generacion dinamica de dashboards. Spawna MCP servers como child processes, interpreta intents con AWS Bedrock (Claude Haiku), y expone endpoints REST al frontend.

## Rol en el Pipeline

```
dashboard-app → POST /api/generate-ui → mcp-main
    ├── Bedrock Claude Haiku (interpreta intent)
    ├── library-context (catalogo de componentes)
    ├── mcp-gcp-mock (datos filtrados)
    └── mcp-ui (genera UIConfig)
        → Response JSON → dashboard-app
```

## Endpoints

| Metodo | Ruta               | Descripcion                          |
| ------ | ------------------ | ------------------------------------ |
| GET    | `/health`          | Health check + estado de MCP servers |
| POST   | `/api/generate-ui` | Pipeline completo con LLM → UIConfig |

## POST /api/generate-ui

Endpoint principal. Interpreta lenguaje natural via LLM y genera UI dinamica.

### Request

```json
{
  "dataset": "ventas-credito",
  "intent": "grafica de ventas de motos por estado",
  "title": "Ventas de Motos",
  "layout": "vertical",
  "columns": 2,
  "filters": {},
  "limit": 100
}
```

Solo `dataset` e `intent` son requeridos. El LLM infiere filtros, agrupacion, metrica y template automaticamente.

### Response

```json
{
  "success": true,
  "data": {
    "title": "Ventas de Motos por Estado",
    "layout": "vertical",
    "columns": 2,
    "components": [
      { "component": "Chart", "props": { "type": "bar", ... } }
    ]
  }
}
```

## Flujo interno de generate-ui

1. **Intent Interpreter** (Bedrock Claude Haiku) — convierte texto a query estructurada
2. **Component Catalog** (library-context MCP) — obtiene componentes disponibles
3. **Query Data** (mcp-gcp-mock) — aplica filtros inferidos por el LLM
4. **Generate UI** (mcp-ui) — produce UIConfig con template inteligente

## MCP Clients

| Server          | Conexion     | Resolucion                                                             |
| --------------- | ------------ | ---------------------------------------------------------------------- |
| mcp-gcp-mock    | stdio (node) | `../../mcp-gcp-mock/dist/index.js`                                     |
| mcp-ui          | stdio (node) | `../../mcp-ui/dist/index.js`                                           |
| library-context | stdio (node) | `node_modules/@macropaytd/lib-front-mcp-library-context/dist/index.js` |

## Configuracion

### .env (requerido)

```env
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_SESSION_TOKEN=...          # Solo para SSO
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=us.anthropic.claude-haiku-4-5-20251001-v1:0
PORT=4000
```

### Credenciales AWS

Si usas SSO corporativo, las credenciales son temporales (expiran cada 1-12h). Renueva desde el portal AWS SSO > "Command line or programmatic access".

## Build & Run

```bash
npm run build    # Compila con tsup → dist/index.js
npm run start    # Ejecuta dist/index.js
npm run dev      # Watch mode + auto-restart
```

Desde la raiz del monorepo:

```bash
npm run dev:mcp-main
```

## Troubleshooting

| Error                      | Causa                      | Solucion                                                  |
| -------------------------- | -------------------------- | --------------------------------------------------------- |
| `EADDRINUSE :4000`         | Otra instancia corriendo   | Mata el proceso: `netstat -ano \| grep 4000` + `taskkill` |
| `security token invalid`   | Credenciales expiradas     | Renueva desde portal SSO                                  |
| `model end of life`        | Model ID obsoleto          | Actualiza BEDROCK_MODEL_ID en .env                        |
| `Invocation not supported` | Necesita inference profile | Usa geo ID: `us.anthropic.claude-...`                     |
| `Connection closed` (MCP)  | Build desactualizado       | Ejecuta `npm run build` en el MCP afectado                |

