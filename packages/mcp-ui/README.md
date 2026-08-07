# @mcp-mvp/mcp-ui

MCP Server que transforma datos crudos en configuraciones JSON declarativas para charts, dashboards y UIs dinamicas. El frontend renderiza estos configs directamente sin procesamiento adicional.

## Rol en el Pipeline

```
mcp-main → [generate_ui] → mcp-ui → UIConfig JSON → dashboard-app (DynamicRenderer)
```

## Tools

| Tool          | Input                               | Output     |
| ------------- | ----------------------------------- | ---------- |
| `generate_ui` | records + intent + componentCatalog | `UIConfig` |

## Output Schemas

### ChartConfig

```typescript
{
  type: 'bar' | 'line' | 'pie' | 'doughnut' | 'area';
  title: string;
  data: { labels: string[]; datasets: ChartDataset[] };
  options: { responsive: boolean; xAxis?: { label }; yAxis?: { label } };
}
```

### DashboardConfig

```typescript
{
  title: string;
  description?: string;
  layout: 'grid' | 'vertical';
  columns?: number;
  charts: ChartConfig[];
}
```

### UIConfig

```typescript
{
  title: string;
  description?: string;
  layout: 'vertical' | 'grid';
  columns?: number;
  components: UIComponentConfig[];
}
```

## Templates Inteligentes

`generate_ui` selecciona automaticamente el template basado en el intent:

| Template    | Activacion                    | Componentes                                 |
| ----------- | ----------------------------- | ------------------------------------------- |
| `executive` | "resumen", "dashboard", "kpi" | KPIGrid + Chart + TransactionList           |
| `category`  | "categoria", "por categoria"  | KPIGrid por grupo + Doughnut + Bar          |
| `credit`    | "credito", "estatus", "pago"  | KPIs + ProgressGroup + MiniChart + StatCard |
| `table`     | "tabla", "listado"            | DataSummary                                 |
| `cards`     | "card", "tarjeta"             | TransactionList grid                        |
| `chart`     | "grafica", "tendencia"        | Chart (bar/line/doughnut)                   |

## Hint System

El intent puede incluir metadata del LLM (inyectada por mcp-main):

```
"grafica de motos por estado [groupBy:estado] [metric:count] [chartType:bar] [template:chart]"
```

Hints soportados: `[groupBy:...]`, `[metric:...]`, `[metricField:...]`, `[chartType:...]`, `[template:...]`

## Componentes que genera

| Componente        | Props principales                                       |
| ----------------- | ------------------------------------------------------- |
| `StatCard`        | title, value, subtitle, trend, trendDirection, icon     |
| `KPIGrid`         | items: StatCard[]                                       |
| `ProgressBar`     | label, value (0-100), color                             |
| `ProgressGroup`   | title, items: ProgressBar[]                             |
| `TransactionList` | title, items: {title, subtitle, amount, date, status}[] |
| `MiniChart`       | title, value, data: number[], color                     |
| `DataSummary`     | title, columns: {key, label}[], rows                    |
| `Chart`           | type, title, data: {labels, datasets}, options          |

## Build

```bash
npm run build    # Compila con tsup → dist/index.js
npm run dev      # Watch mode
```

## Configuracion MCP

```json
{
  "mcpServers": {
    "mcp-ui": {
      "command": "node",
      "args": ["packages/mcp-ui/dist/index.js"]
    }
  }
}
```

