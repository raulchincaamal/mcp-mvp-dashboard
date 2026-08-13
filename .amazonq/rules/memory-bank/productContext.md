# Product Context — MCP MVP Dashboard

## Problem Solved
Business users need dashboards from sales data without writing queries or code. They describe what they want in natural language (Spanish) and the system generates the full UI automatically.

## Pipeline Flow (Sequential — pipeline.ts)
```
POST /api/generate-ui { dataset, intent }
  → Pipeline.generateUi()
  → 1. Check Redis cache (SHA-256 hash of request)
  → 2. interpretIntent() → Bedrock ConverseCommand → ParsedIntent
  → 3. getComponentCatalog() → library-context MCP → component list
  → 4. queryData() → mcp-gcp-mock query_data (with merged filters + limit)
  → 5. Build enhanced intent string with [hint:value] brackets
  → 6. uiClient.callTool('generate_ui', ...) → UIConfig
  → 7. Cache UIConfig in Redis (TTL: INTENT = 60 min)
  → dashboard-app /dynamic: DynamicRenderer maps UIConfig → React components
```

## Intent → ParsedIntent (Bedrock output)
```typescript
{
  filters: Record<string, unknown>;   // e.g. { categoria: "Motos" }
  groupBy: string | null;             // e.g. "estado"
  metric: 'count' | 'sum' | 'avg' | 'max' | 'min';
  metricField: string | null;         // e.g. "precio_contado"
  chartType: 'bar' | 'line' | 'pie' | 'doughnut' | 'area' | null;
  template: 'executive' | 'category' | 'credit' | 'table' | 'cards' | 'chart';
  limit: number | null;
  title: string | null;
}
```

## Hint System (pipeline → mcp-ui)
Enhanced intent passed to mcp-ui includes LLM metadata in brackets:
`"gráfica de motos por estado [groupBy:estado] [metric:count] [chartType:bar] [template:chart]"`

Supported hints: `[groupBy:x]`, `[metric:x]`, `[metricField:x]`, `[chartType:x]`, `[template:x]`

## Template Selection
| Template | Trigger keywords | Output components |
|---|---|---|
| `executive` | resumen, dashboard, kpi | KPIGrid + Chart + TransactionList |
| `category` | categoría, por categoría | KPIGrid + Doughnut + Bar |
| `credit` | crédito, estatus, pago | KPIGrid + ProgressGroup + MiniChart + TransactionList |
| `table` | tabla, listado, registros | DataSummary |
| `cards` | card, tarjeta | TransactionList grid |
| `chart` | gráfica, chart, tendencia | Chart (bar/line/doughnut) |

## Cache Strategy (Redis, optional)
- UIConfig cached by SHA-256 hash of `{ dataset, intent, filters, limit }`
- Cache key format: `mcp-dashboard:<prefix>:<sha256>`
- TTL: 60 minutes (TTL.INTENT constant)
- Graceful degradation: pipeline works without Redis

## Dataset: ventas-credito
5,000 credit sales records. Key fields:
`id, fecha_venta, cliente, edad_cliente, genero, estado, ciudad, sucursal, categoria, producto, color, precio_contado, enganche, monto_financiado, tasa_interes, monto_total_credito, plazo_semanas, pago_semanal, semanas_pagadas, estatus_credito, canal_venta, vendedor`

Categories: Motos, Celulares, Bicicletas Eléctricas, Pantallas/TV, Audio, Tablets, Consolas, Climatización, Accesorios
Credit statuses: `al_corriente`, `atrasado`, `liquidado`, `cancelado`
Sales channels: `tienda_fisica`, `en_linea`, `telefono`
