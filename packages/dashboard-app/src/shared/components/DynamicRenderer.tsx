'use client';

import {
  Button,
  Input,
  Card,
  Badge,
  Text,
  RadioGroup,
  Checkbox,
  Avatar,
} from '@macropaytd/lib-front-ui-components';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Filler,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Line, Pie, Doughnut } from 'react-chartjs-2';

// Register Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Filler,
  Title,
  Tooltip,
  Legend,
);

// ─── Types ─────────────────────────────────────────────────

export interface UIComponentConfig {
  component: string;
  props: Record<string, unknown>;
  children?: (UIComponentConfig | string)[];
}

export interface UIConfig {
  title: string;
  description?: string;
  layout: 'vertical' | 'grid';
  columns?: number;
  components: UIComponentConfig[];
}

// ─── Component Map (basic @macropaytd components) ──────────

const componentMap: Record<
  string,
  React.ComponentType<Record<string, unknown>>
> = {
  Button: Button as unknown as React.ComponentType<Record<string, unknown>>,
  Input: Input as unknown as React.ComponentType<Record<string, unknown>>,
  Card: Card as unknown as React.ComponentType<Record<string, unknown>>,
  Badge: Badge as unknown as React.ComponentType<Record<string, unknown>>,
  Text: Text as unknown as React.ComponentType<Record<string, unknown>>,
  RadioGroup: RadioGroup as unknown as React.ComponentType<
    Record<string, unknown>
  >,
  Checkbox: Checkbox as unknown as React.ComponentType<Record<string, unknown>>,
  Avatar: Avatar as unknown as React.ComponentType<Record<string, unknown>>,
};

// ─── Composite: StatCard ───────────────────────────────────
// Props: { title, value, subtitle?, trend?, trendDirection?, icon? }

function renderStatCard(props: Record<string, unknown>) {
  const title = props.title as string;
  const value = props.value as string;
  const subtitle = props.subtitle as string | undefined;
  const trend = props.trend as string | undefined;
  const trendDirection = props.trendDirection as
    | 'up'
    | 'down'
    | 'neutral'
    | undefined;

  const trendColor =
    trendDirection === 'up'
      ? 'text-emerald-600'
      : trendDirection === 'down'
        ? 'text-red-500'
        : 'text-muted-foreground';

  const trendIcon =
    trendDirection === 'up' ? '↑' : trendDirection === 'down' ? '↓' : '';

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {typeof props.icon === 'string' && props.icon && (
          <span className="text-muted-foreground text-lg">{props.icon}</span>
        )}
      </div>
      <div className="mt-2">
        <p className="text-3xl font-bold tracking-tight">{value}</p>
      </div>
      <div className="mt-1 flex items-center gap-2">
        {trend && (
          <span className={`text-sm font-medium ${trendColor}`}>
            {trendIcon} {trend}
          </span>
        )}
        {subtitle && (
          <span className="text-sm text-muted-foreground">{subtitle}</span>
        )}
      </div>
    </div>
  );
}

// ─── Composite: KPIGrid ────────────────────────────────────
// Props: { items: Array<{ title, value, subtitle?, trend?, trendDirection? }> }

function renderKPIGrid(props: Record<string, unknown>) {
  const items = props.items as Array<{
    title: string;
    value: string;
    subtitle?: string;
    trend?: string;
    trendDirection?: 'up' | 'down' | 'neutral';
    icon?: string;
  }>;

  if (!items || items.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((item, i) => (
        <div key={i}>
          {renderStatCard(item as unknown as Record<string, unknown>)}
        </div>
      ))}
    </div>
  );
}

// ─── Composite: ProgressBar ────────────────────────────────
// Props: { label, value (0-100), color?, showValue? }

function renderProgressBar(props: Record<string, unknown>) {
  const label = props.label as string;
  const value = Math.min(100, Math.max(0, props.value as number));
  const color = (props.color as string) || 'bg-primary';
  const showValue = props.showValue !== false;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium">{label}</span>
        {showValue && (
          <span className="text-sm text-muted-foreground">{value}%</span>
        )}
      </div>
      <div className="h-2.5 w-full rounded-full bg-secondary">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

// ─── Composite: ProgressGroup ──────────────────────────────
// Props: { items: Array<{ label, value, color? }>, title? }

function renderProgressGroup(props: Record<string, unknown>) {
  const items = props.items as Array<{
    label: string;
    value: number;
    color?: string;
  }>;
  const title = props.title as string | undefined;

  if (!items || items.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
      {title && <p className="text-base font-semibold">{title}</p>}
      {items.map((item, i) => (
        <div key={i}>
          {renderProgressBar(item as unknown as Record<string, unknown>)}
        </div>
      ))}
    </div>
  );
}

// ─── Composite: TransactionList ────────────────────────────
// Props: { items: Array<{ title, subtitle?, amount, date?, status? }>, title? }

function renderTransactionList(props: Record<string, unknown>) {
  const items = props.items as Array<{
    title: string;
    subtitle?: string;
    amount: string;
    date?: string;
    status?: 'positive' | 'negative' | 'neutral';
  }>;
  const title = props.title as string | undefined;

  if (!items || items.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      {title && <p className="text-base font-semibold mb-4">{title}</p>}
      <div className="space-y-3">
        {items.map((item, i) => {
          const amountColor =
            item.status === 'positive'
              ? 'text-emerald-600'
              : item.status === 'negative'
                ? 'text-red-500'
                : 'text-foreground';

          return (
            <div
              key={i}
              className="flex items-center justify-between py-2 border-b last:border-0"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.title}</p>
                {item.subtitle && (
                  <p className="text-xs text-muted-foreground">
                    {item.subtitle}
                  </p>
                )}
              </div>
              <div className="text-right ml-4">
                <p className={`text-sm font-semibold ${amountColor}`}>
                  {item.amount}
                </p>
                {item.date && (
                  <p className="text-xs text-muted-foreground">{item.date}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Composite: MiniChart ──────────────────────────────────
// Props: { title, value, data (number[]), type?, color? }

function renderMiniChart(props: Record<string, unknown>) {
  const title = props.title as string;
  const value = props.value as string;
  const data = props.data as number[];
  const color = (props.color as string) || '#4F46E5';

  if (!data || data.length === 0) return null;

  const chartData = {
    labels: data.map((_, i) => String(i)),
    datasets: [
      {
        data,
        borderColor: color,
        backgroundColor: `${color}20`,
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: {
      x: { display: false },
      y: { display: false },
    },
  };

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      <div className="h-[60px] mt-3">
        <Line data={chartData as never} options={chartOptions} />
      </div>
    </div>
  );
}

// ─── Composite: DataSummary ────────────────────────────────
// Props: { title?, columns: Array<{key, label}>, rows: Array<Record>, highlightFirst? }

function renderDataSummary(props: Record<string, unknown>) {
  const title = props.title as string | undefined;
  const columns = props.columns as { key: string; label: string }[];
  const rows = props.rows as Record<string, unknown>[];
  const highlightFirst = props.highlightFirst !== false;

  if (!columns || !rows) return null;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      {title && <p className="text-base font-semibold p-6 pb-3">{title}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="text-left px-4 py-3 font-medium text-muted-foreground"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className="border-b last:border-0 hover:bg-muted/30 transition-colors"
              >
                {columns.map((col, ci) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3 ${ci === 0 && highlightFirst ? 'font-medium' : ''}`}
                  >
                    {formatCellValue(row[col.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    if (value >= 1000) return value.toLocaleString('es-MX');
    if (value < 1 && value > 0) return `${(value * 100).toFixed(0)}%`;
    return String(value);
  }
  return String(value);
}

// ─── Standard Table (improved styling) ─────────────────────

function renderTable(props: Record<string, unknown>) {
  const columns = props.columns as { key: string; label: string }[] | undefined;
  const rows = props.rows as Record<string, unknown>[] | undefined;

  if (!columns || !rows || rows.length === 0) return null;

  return renderDataSummary({ ...props, columns, rows });
}

// ─── Standard Chart ────────────────────────────────────────

function renderChart(props: Record<string, unknown>) {
  const type = props.type as string;
  const title = props.title as string | undefined;
  const data = props.data as {
    labels: string[];
    datasets: Record<string, unknown>[];
  };
  const options = props.options as Record<string, unknown> | undefined;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: { display: !!title, text: title || '', font: { size: 14 } },
      legend: { position: 'bottom' as const },
    },
    scales:
      type !== 'pie' && type !== 'doughnut'
        ? {
            x: {
              title: {
                display: !!(options?.xAxis as Record<string, unknown>)?.label,
                text:
                  ((options?.xAxis as Record<string, unknown>)
                    ?.label as string) || '',
              },
            },
            y: {
              title: {
                display: !!(options?.yAxis as Record<string, unknown>)?.label,
                text:
                  ((options?.yAxis as Record<string, unknown>)
                    ?.label as string) || '',
              },
            },
          }
        : undefined,
  };

  const chartData = {
    labels: data.labels,
    datasets: data.datasets.map((ds) => ({
      ...ds,
      fill: type === 'area',
      tension: type === 'line' || type === 'area' ? 0.3 : undefined,
    })),
  };

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="relative h-[280px] w-full">
        {type === 'bar' && (
          <Bar data={chartData as never} options={chartOptions} />
        )}
        {(type === 'line' || type === 'area') && (
          <Line data={chartData as never} options={chartOptions} />
        )}
        {type === 'pie' && (
          <Pie data={chartData as never} options={chartOptions} />
        )}
        {type === 'doughnut' && (
          <Doughnut data={chartData as never} options={chartOptions} />
        )}
      </div>
    </div>
  );
}

// ─── Recursive Component Renderer ──────────────────────────

function RenderComponent({ config }: { config: UIComponentConfig }) {
  const { component, props, children } = config;

  // Composite components (custom rich renderers)
  switch (component) {
    case 'Table':
    case 'DataSummary':
      return renderTable(props);
    case 'Chart':
      return renderChart(props);
    case 'StatCard':
      return renderStatCard(props);
    case 'KPIGrid':
      return renderKPIGrid(props);
    case 'ProgressBar':
      return renderProgressBar(props);
    case 'ProgressGroup':
      return renderProgressGroup(props);
    case 'TransactionList':
      return renderTransactionList(props);
    case 'MiniChart':
      return renderMiniChart(props);
  }

  // Basic @macropaytd components
  const Component = componentMap[component];

  if (!Component) {
    return (
      <div className="p-2 border border-dashed border-destructive rounded text-sm text-destructive">
        Unknown component: {component}
      </div>
    );
  }

  const renderedChildren = children?.map((child, i) => {
    if (typeof child === 'string') return <span key={i}>{child}</span>;
    return <RenderComponent key={i} config={child} />;
  });

  return <Component {...props}>{renderedChildren}</Component>;
}

// ─── Main DynamicRenderer ──────────────────────────────────

interface DynamicRendererProps {
  config: UIConfig;
}

export default function DynamicRenderer({ config }: DynamicRendererProps) {
  if (!config || !config.components) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        No UI config available to render.
      </div>
    );
  }

  const gridClass =
    config.layout === 'grid'
      ? `grid gap-4 grid-cols-1 md:grid-cols-${config.columns || 2}`
      : 'flex flex-col gap-4';

  return (
    <div className="space-y-6">
      {config.description && (
        <p className="text-sm text-muted-foreground">{config.description}</p>
      )}
      <div className={gridClass}>
        {config.components.map((comp, i) => (
          <RenderComponent key={i} config={comp} />
        ))}
      </div>
    </div>
  );
}

