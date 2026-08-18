<!-- @mcp-mvp/mcp-ui/AGENTS.md -->

## GLOBAL IMPERATIVE

- **NEVER** manually edit `package-lock.json` — use npm commands
- **ALWAYS** update docs when functionality changes
- **ALWAYS** ensure output JSON follows the `ChartConfig`, `DashboardConfig`, or `UIConfig` schemas

## [QUICK-REF] — MCP Server

Transforma datos crudos en configuraciones JSON declarativas para charts, dashboards y UIs dinámicas. El frontend renderiza estos configs directamente sin procesamiento adicional.

- **Package**: `@mcp-mvp/mcp-ui`
- **Entry**: `node dist/index.js`
- **Transport**: stdio
- **Tools**: `generate_ui`

### Configuración IDE

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

### Output Schemas

```typescript
interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'doughnut' | 'area';
  title: string;
  data: { labels: string[]; datasets: ChartDataset[] };
  options: {
    responsive: boolean;
    xAxis?: { label: string };
    yAxis?: { label: string };
  };
}

interface DashboardConfig {
  title: string;
  description?: string;
  layout: 'grid' | 'vertical';
  columns?: number;
  charts: ChartConfig[];
}

interface UIConfig {
  title: string;
  description?: string;
  layout: 'vertical' | 'grid';
  columns?: number;
  components: UIComponentConfig[];
}

interface UIComponentConfig {
  component: string; // StatCard, KPIGrid, ProgressGroup, TransactionList, MiniChart, DataSummary, Chart, Card, Text, Badge, Table
  props: Record<string, unknown>;
  children?: (UIComponentConfig | string)[];
}
```

## [ON-DEMAND] Tools Reference

### generate_ui

Genera un `UIConfig` declarativo con componentes ricos. Usa un sistema de templates inteligentes que selecciona automáticamente la mejor visualización.

**Params**:

```typescript
{
  intent: string;                    // Qué quiere ver el usuario (lenguaje natural + hints del LLM)
  records: Record<string, unknown>[];
  componentCatalog: ComponentSpec[]; // Componentes disponibles
  title?: string;
  layout?: 'vertical' | 'grid';
  columns?: number;
}
```

**Returns**: `UIConfig` JSON

### Templates disponibles

| Template    | Activación                                 | Componentes que genera                                           |
| ----------- | ------------------------------------------ | ---------------------------------------------------------------- |
| `executive` | "resumen", "ejecutivo", "dashboard", "kpi" | KPIGrid + Chart + TransactionList                                |
| `category`  | "categoría", "por categoría"               | KPIGrid por grupo + Doughnut + Bar                               |
| `credit`    | "crédito", "estatus", "pago"               | KPIGrid + ProgressGroup + MiniChart + StatCard + TransactionList |
| `table`     | "tabla", "listado", "registros"            | DataSummary (tabla estilizada)                                   |
| `cards`     | "card", "tarjeta"                          | TransactionList en grid                                          |
| `chart`     | "gráfica", "chart", "tendencia"            | Chart (bar/line/doughnut)                                        |

### Hint System

El intent puede incluir metadata del LLM entre corchetes:

- `[groupBy:estado]` — campo para agrupar
- `[metric:count]` — operación (count, sum, avg, max, min)
- `[metricField:precio_contado]` — campo numérico para la métrica
- `[chartType:bar]` — tipo de gráfico
- `[template:chart]` — template a usar

## [ON-DEMAND] Composite Components

Componentes ricos que `generate_ui` puede producir:

| Component         | Props                                                                        | Descripción                      |
| ----------------- | ---------------------------------------------------------------------------- | -------------------------------- |
| `StatCard`        | `title, value, subtitle?, trend?, trendDirection?(up\|down\|neutral), icon?` | Metric card con tendencia        |
| `KPIGrid`         | `items: StatCard[]`                                                          | Grid de stat cards               |
| `ProgressBar`     | `label, value(0-100), color?`                                                | Barra de progreso                |
| `ProgressGroup`   | `title?, items: ProgressBar[]`                                               | Card con múltiples progress bars |
| `TransactionList` | `title?, items: {title, subtitle?, amount, date?, status?}[]`                | Lista de transacciones           |
| `MiniChart`       | `title, value, data: number[], color?`                                       | Sparkline compacto               |
| `DataSummary`     | `title?, columns: {key, label}[], rows: Record[]`                            | Tabla estilizada                 |
| `Chart`           | `type, title?, data: {labels, datasets}, options?`                           | D3.js chart (multiple types)     |

