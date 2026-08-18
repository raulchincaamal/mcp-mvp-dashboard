# MCP MVP Dashboard

Pipeline de generacion dinamica de dashboards usando Model Context Protocol (MCP). Transforma datos crudos en UIs renderizables a traves de un flujo secuencial orquestado con interpretacion de lenguaje natural via AWS Bedrock.

## Arquitectura

```
┌─────────────────┐     ┌──────────────────────┐     ┌──────────────────────┐
│    Usuario      │     │    dashboard-app     │     │      mcp-main        │
│   (Browser)     │────►│   Next.js + React    │────►│   Fastify API :4000  │
│                 │     │   DynamicRenderer    │     │   Pipeline Manager   │
└─────────────────┘     └──────────────────────┘     └───────┬──────┬───────┘
                                                             │      │
                                              ┌──────────────┘      └──────────────┐
                                              │              │                      │
                                              ▼              ▼                      ▼
                                   ┌────────────────┐ ┌────────────────┐ ┌──────────────────┐
                                   │ mcp-gcp-mock   │ │    mcp-ui      │ │ library-context  │
                                   │ (datos)        │ │ (transform)    │ │ (componentes)    │
                                   └────────────────┘ └────────────────┘ └──────────────────┘
                                              │                                     │
                                              ▼                                     ▼
                                   ┌────────────────┐              ┌──────────────────────────┐
                                   │ ventas-credito  │              │ @macropaytd/lib-front-*  │
                                   │ (5,000 records) │              │ (catalogo componentes)   │
                                   └────────────────┘              └──────────────────────────┘
```

## Flujo del Pipeline

1. **Usuario** escribe un intent en lenguaje natural (ej: "grafica de ventas de motos por estado")
2. **mcp-main** envia el intent a **AWS Bedrock Claude Haiku** que lo interpreta como query estructurada
3. **mcp-main** consulta **library-context** para obtener el catalogo de componentes disponibles
4. **mcp-main** consulta **mcp-gcp-mock** con los filtros inferidos por el LLM
5. **mcp-main** envia datos + catalogo + intent a **mcp-ui** que genera un `UIConfig` declarativo
6. **dashboard-app** recibe el `UIConfig` y lo renderiza con el `DynamicRenderer`

## Packages

| Package                  | Descripcion                                           | Tecnologia                              |
| ------------------------ | ----------------------------------------------------- | --------------------------------------- |
| `packages/mcp-gcp-mock`  | MCP Server — fuente de datos mock (simula GCP/SAP)    | Node.js, MCP SDK, JSON fixtures         |
| `packages/mcp-ui`        | MCP Server — transforma datos en configs de UI/Charts | Node.js, MCP SDK, D3 schema             |
| `packages/mcp-main`      | Orquestador HTTP — pipeline manager + LLM interpreter | Fastify, AWS Bedrock, MCP Client        |
| `packages/dashboard-app` | Frontend — renderiza UIs dinamicas desde JSON configs | Next.js 16, React 19, D3.js, Tailwind 4 |

## Requisitos

- Node.js >= 18
- npm >= 9
- Cuenta AWS con acceso a Bedrock (Claude Haiku 4.5)
- Token de GitHub Packages para `@macropaytd/*` (en `.npmrc`)

## Instalacion

```bash
# Clonar el repositorio
git clone <repo-url>
cd mcp-mvp-dashboard

# Instalar dependencias (requiere .npmrc con token @macropaytd)
npm install

# Compilar todos los packages
npm run build
```

## Configuracion

### 1. GitHub Packages (.npmrc en la raiz)

```
@macropaytd:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=TOKEN
```

### 2. AWS Bedrock (packages/mcp-main/.env)

```env
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_SESSION_TOKEN=...          # Solo para SSO/credenciales temporales
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=us.anthropic.claude-haiku-4-5-20251001-v1:0
PORT=4000
```

## Uso

```bash
# Terminal 1: API del pipeline (puerto 4000)
npm run dev:mcp-main

# Terminal 2: Frontend (puerto 3000)
npm run dev:dashboard
```

Abre `http://localhost:3000/dynamic` y escribe un intent como:

- "resumen ejecutivo de ventas en Julio"
- "grafica de cantidad de motos vendidas por estado"
- "tabla de las ultimas 20 ventas de celulares"
- "estatus de creditos atrasados"
- "analisis por categoria"

## API Endpoints

| Metodo | Ruta               | Descripcion                                             |
| ------ | ------------------ | ------------------------------------------------------- |
| GET    | `/health`          | Health check + estado de conexiones MCP                 |
| POST   | `/api/generate-ui` | Pipeline completo: LLM + datos + componentes → UIConfig |

### Ejemplo: POST /api/generate-ui

```bash
curl -X POST http://localhost:4000/api/generate-ui \
  -H "Content-Type: application/json" \
  -d '{
    "dataset": "ventas-credito",
    "intent": "grafica de ventas de motos por estado"
  }'
```

Respuesta:

```json
{
  "success": true,
  "data": {
    "title": "Ventas de Motos por Estado",
    "layout": "vertical",
    "components": [
      { "component": "Chart", "props": { "type": "bar", "data": {...} } }
    ]
  }
}
```

## Dataset: ventas-credito

5,000 registros de ventas a credito basados en el catalogo real de [macropay.mx/tienda](https://macropay.mx/tienda/).

**Categorias**: Motos, Celulares, Bicicletas Electricas, Pantallas/TV, Audio, Tablets, Consolas, Climatizacion, Accesorios

**Campos principales**: `id`, `fecha_venta`, `cliente`, `estado`, `ciudad`, `sucursal`, `categoria`, `producto`, `precio_contado`, `enganche`, `monto_financiado`, `monto_total_credito`, `plazo_semanas`, `pago_semanal`, `semanas_pagadas`, `estatus_credito`, `canal_venta`, `vendedor`

Para regenerar datos:

```bash
node packages/mcp-gcp-mock/scripts/generate-ventas.mjs
```

## UI Dinamica: Componentes

El `DynamicRenderer` soporta estos componentes:

| Componente                        | Descripcion                                     |
| --------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `StatCard`                        | Metric card con valor grande, tendencia y icono |
| `KPIGrid`                         | Grid responsivo de StatCards                    |
| `ProgressGroup`                   | Card con barras de progreso                     |
| `TransactionList`                 | Lista de items con monto, fecha y status        |
| `MiniChart`                       | Sparkline compacto dentro de una card           |
| `DataSummary`                     | Tabla estilizada con hover effects              |
| `Chart`                           | D3.js                                           | Bar, Line, Pie, Doughnut, Area, Bollinger, Stacked Area, Diverging Bar, Radial, Candlestick, Hierarchical, Bar Race |
| `Card`, `Text`, `Badge`, `Button` | Componentes base @macropaytd                    |

## Templates Inteligentes

El LLM (Bedrock) interpreta el intent y selecciona el template mas adecuado:

| Template  | Cuando se activa              | Resultado                         |
| --------- | ----------------------------- | --------------------------------- |
| Executive | "resumen", "dashboard", "kpi" | KPIGrid + Chart + TransactionList |
| Category  | "por categoria", "analisis"   | KPIs por grupo + Doughnut + Bar   |
| Credit    | "credito", "estatus", "pago"  | KPIs + ProgressGroup + MiniChart  |
| Table     | "tabla", "listado"            | DataSummary estilizado            |
| Chart     | "grafica", "tendencia"        | Chart con agrupacion inteligente  |

## Scripts

| Comando                 | Descripcion                        |
| ----------------------- | ---------------------------------- |
| `npm run build`         | Compila todos los packages         |
| `npm run dev:dashboard` | Arranca frontend (puerto 3000)     |
| `npm run dev:mcp-main`  | Arranca API pipeline (puerto 4000) |
| `npm run dev:mcp-gcp`   | Watch mode para mcp-gcp-mock       |
| `npm run dev:mcp-ui`    | Watch mode para mcp-ui             |

## Roadmap

| Fase    | Estado  | Descripcion                                    |
| ------- | ------- | ---------------------------------------------- |
| Phase 1 | Actual  | MVP local — pipeline end-to-end validado       |
| Phase 2 | Proximo | API Gateway + Event Bus para multiples canales |
| Phase 3 | Futuro  | Orchestrator stateless + MCP Server Registry   |
| Phase 4 | Futuro  | Observability + CI/CD para UI artifacts        |

## Documentacion por Package

Cada package tiene su propio `AGENTS.md` con documentacion detallada de tools, schemas y configuracion:

- [`packages/mcp-gcp-mock/AGENTS.md`](packages/mcp-gcp-mock/AGENTS.md)
- [`packages/mcp-ui/AGENTS.md`](packages/mcp-ui/AGENTS.md)
- [`packages/mcp-main/AGENTS.md`](packages/mcp-main/AGENTS.md)

