# Product Context — MCP MVP Dashboard

## Problem Solved
Business users need dashboards from sales data without writing queries or code. They describe what they want in natural language (Spanish) and the system generates the full UI automatically.

## Pipeline Flow
```
User intent (Spanish)
  → mcp-main HTTP :4000
  → orchestrator.ts: Bedrock ConverseCommand with tool definitions
  → Bedrock decides → calls query_data (mcp-gcp-mock) via tool-use loop
  → Bedrock decides → calls generate_ui (mcp-ui) with records + intent
  → UIConfig returned
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
The enhanced intent passed to mcp-ui includes LLM metadata in brackets:
`"gráfica de motos por estado [groupBy:estado] [metric:count] [chartType:bar] [template:chart]"`

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
- TTL: 60 minutes (INTENT constant)
- Graceful degradation: pipeline works without Redis

## Dataset: ventas-credito
5,000 credit sales records. Key fields:
`id, fecha_venta, cliente, edad_cliente, genero, estado, ciudad, sucursal, categoria, producto, color, precio_contado, enganche, monto_financiado, tasa_interes, monto_total_credito, plazo_semanas, pago_semanal, semanas_pagadas, estatus_credito, canal_venta, vendedor`

Categories: Motos, Celulares, Bicicletas Eléctricas, Pantallas/TV, Audio, Tablets, Consolas, Climatización, Accesorios
