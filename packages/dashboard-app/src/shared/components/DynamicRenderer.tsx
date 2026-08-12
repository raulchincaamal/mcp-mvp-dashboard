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
  const trendDirection = props.trendDirection as 'up' | 'down' | 'neutral' | undefined;
  const trendColor = trendDirection === 'up' ? '#30d158' : trendDirection === 'down' ? 'var(--danger)' : 'var(--text-tertiary)';
  const trendIcon = trendDirection === 'up' ? '↑' : trendDirection === 'down' ? '↓' : '';

  return (
    <div style={{
      background: 'var(--surface)', backdropFilter: 'var(--surface-blur)', WebkitBackdropFilter: 'var(--surface-blur)',
      border: '1px solid var(--border-color)', borderRadius: 'var(--radius)',
      padding: '1.5rem', boxShadow: 'var(--shadow-sm)',
      animation: 'cardEnter 0.5s var(--ease-out-expo) both',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-tertiary)' }}>{title}</p>
        {typeof props.icon === 'string' && props.icon && (
          <span style={{ fontSize: '1.2rem', color: 'var(--primary)' }}>{props.icon}</span>
        )}
      </div>
      <p style={{ fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.5px', marginTop: '0.5rem', color: 'var(--text)' }}>{value}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
        {trend && <span style={{ fontSize: '0.82rem', fontWeight: 600, color: trendColor }}>{trendIcon} {trend}</span>}
        {subtitle && <span style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>{subtitle}</span>}
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
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
      {items.map((item, i) => (
        <div key={i}>{renderStatCard(item as unknown as Record<string, unknown>)}</div>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</span>
        {showValue && <span style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>{value}%</span>}
      </div>
      <div style={{ height: 8, width: '100%', borderRadius: 99, background: 'var(--surface-3)' }}>
        <div style={{ height: '100%', borderRadius: 99, width: `${value}%`, background: color.startsWith('#') || color.startsWith('rgb') ? color : 'var(--primary)', transition: 'width 0.6s var(--ease-out-expo)' }} />
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
    <div style={{ background: 'var(--surface)', backdropFilter: 'var(--surface-blur)', WebkitBackdropFilter: 'var(--surface-blur)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: '1.5rem', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {title && <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text)' }}>{title}</p>}
      {items.map((item, i) => <div key={i}>{renderProgressBar(item as unknown as Record<string, unknown>)}</div>)}
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
    <div style={{ background: 'var(--surface)', backdropFilter: 'var(--surface-blur)', WebkitBackdropFilter: 'var(--surface-blur)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: '1.5rem', boxShadow: 'var(--shadow-sm)' }}>
      {title && <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text)', marginBottom: '1rem' }}>{title}</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {items.map((item, i) => {
          const amountColor = item.status === 'positive' ? '#30d158' : item.status === 'negative' ? 'var(--danger)' : 'var(--text)';
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: i < items.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</p>
                {item.subtitle && <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{item.subtitle}</p>}
              </div>
              <div style={{ textAlign: 'right', marginLeft: '1rem' }}>
                <p style={{ fontSize: '0.875rem', fontWeight: 600, color: amountColor }}>{item.amount}</p>
                {item.date && <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{item.date}</p>}
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
    <div style={{ background: 'var(--surface)', backdropFilter: 'var(--surface-blur)', WebkitBackdropFilter: 'var(--surface-blur)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: '1.5rem', boxShadow: 'var(--shadow-sm)' }}>
      <p style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-tertiary)' }}>{title}</p>
      <p style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.4px', marginTop: '0.25rem', color: 'var(--text)' }}>{value}</p>
      <div style={{ height: 60, marginTop: '0.75rem' }}>
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
    <div style={{ background: 'var(--surface)', backdropFilter: 'var(--surface-blur)', WebkitBackdropFilter: 'var(--surface-blur)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
      {title && <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text)', padding: '1.5rem 1.5rem 0.75rem' }}>{title}</p>}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
              {columns.map((col) => (
                <th key={col.key} style={{ textAlign: 'left', padding: '0.6rem 1rem', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-tertiary)', background: 'var(--surface-2)' }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--border-color)' : 'none' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                {columns.map((col, ci) => (
                  <td key={col.key} style={{ padding: '0.6rem 1rem', color: 'var(--text-secondary)', fontWeight: ci === 0 && highlightFirst ? 600 : 400 }}>
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
    <div style={{ background: 'var(--surface)', backdropFilter: 'var(--surface-blur)', WebkitBackdropFilter: 'var(--surface-blur)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: '1.5rem', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ position: 'relative', height: 280, width: '100%' }}>
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
      <div style={{ padding: '0.5rem 0.75rem', border: '1.5px dashed var(--danger)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', color: 'var(--danger)', opacity: 0.7 }}>
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
      <div style={{ padding: '1rem', fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
        No UI config available to render.
      </div>
    );
  }

  const isGrid = config.layout === 'grid';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {config.description && (
        <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>{config.description}</p>
      )}
      <div style={isGrid ? { display: 'grid', gridTemplateColumns: `repeat(${config.columns || 2}, 1fr)`, gap: '1rem' } : { display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {config.components.map((comp, i) => (
          <RenderComponent key={i} config={comp} />
        ))}
      </div>
    </div>
  );
}

