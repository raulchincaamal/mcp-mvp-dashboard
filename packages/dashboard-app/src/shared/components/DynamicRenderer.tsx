'use client';

import { useEffect, useRef, useState } from 'react';
import AuroraChart from './AuroraChart';
import MexicoMapChart from './MexicoMapChart';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

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
  D3BollingerBands,
  D3StackedArea,
  D3DivergingBar,
  D3MiniChart,
  D3RadialStackedBar,
  D3Candlestick,
  D3HierarchicalBar,
  D3BarChartRace,
} from './charts';

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

// ─── Icon map: LLM string names → emojis ──────────────────

const ICON_MAP: Record<string, string> = {
  // money
  'money-bill': '💵',
  cash: '💵',
  money: '💵',
  peso: '💵',
  dollar: '💵',
  sales: '💵',
  revenue: '💵',
  monto: '💵',
  ventas: '💵',
  'credit-card': '💳',
  card: '💳',
  credito: '💳',
  credit: '💳',
  creditos: '💳',
  wallet: '👛',
  bank: '🏦',
  coins: '🪙',
  finance: '💰',
  financiado: '💰',
  // data / lists
  list: '📋',
  table: '📋',
  clipboard: '📋',
  registros: '📋',
  records: '📋',
  total: '📋',
  count: '📋',
  chart: '📊',
  'bar-chart': '📊',
  graph: '📊',
  grafica: '📊',
  analytics: '📊',
  stats: '📊',
  pie: '🥧',
  'pie-chart': '🥧',
  distribution: '🥧',
  // time
  calendar: '📅',
  'calendar-week': '📅',
  'calendar-day': '📅',
  date: '📅',
  clock: '🕐',
  time: '🕐',
  semanas: '📅',
  plazo: '📅',
  // status
  check: '✅',
  warning: '⚠️',
  alert: '⚠️',
  error: '❌',
  info: 'ℹ️',
  risk: '⚠️',
  riesgo: '⚠️',
  'trending-up': '📈',
  'trending-down': '📉',
  trend: '📈',
  growth: '📈',
  up: '📈',
  down: '📉',
  liquidado: '✅',
  atrasado: '⚠️',
  cancelado: '❌',
  corriente: '✅',
  // categories
  moto: '🏍️',
  bike: '🏍️',
  motos: '🏍️',
  motorcycle: '🏍️',
  celular: '📱',
  phone: '📱',
  celulares: '📱',
  mobile: '📱',
  tv: '📺',
  tablet: '📱',
  tablets: '📱',
  audio: '🎵',
  consola: '🎮',
  game: '🎮',
  consolas: '🎮',
  ac: '❄️',
  clima: '❄️',
  climatizacion: '❄️',
  accesorios: '🎒',
  bicicleta: '🚲',
  bici: '🚲',
  // people
  user: '👤',
  users: '👥',
  person: '👤',
  team: '👥',
  cliente: '👤',
  clientes: '👥',
  vendedor: '👨‍💼',
  // location
  map: '🗺️',
  location: '📍',
  estado: '📍',
  estados: '📍',
  ciudad: '🏙️',
  store: '🏪',
  sucursal: '🏪',
  // misc
  star: '⭐',
  fire: '🔥',
  bolt: '⚡',
  tag: '🏷️',
  box: '📦',
  package: '📦',
  producto: '📦',
  productos: '📦',
  canal: '📡',
  channel: '📡',
  online: '💻',
  tienda: '🏪',
};

function resolveIcon(icon: string): string {
  if (!icon) return '';
  const key = icon.toLowerCase().trim();
  return ICON_MAP[key] ?? (icon.length <= 4 ? icon : '📌');
}

// ─── Ticker: stock-style number that counts up/down fast ──

function StockTicker({ value }: { value: string }) {
  // Extract numeric part from value string (e.g. "$1,234" → 1234, "156" → 156)
  const parseNum = (v: string) => {
    const n = parseFloat(v.replace(/[^0-9.-]/g, ''));
    return isNaN(n) ? 0 : n;
  };

  const target = parseNum(value);
  const [display, setDisplay] = useState(Math.max(0, target - Math.ceil(target * 0.08)));
  const [dir, setDir] = useState<'up' | 'down' | null>(null);
  const rafRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (target === 0) return;
    const start = Math.max(0, target - Math.ceil(target * 0.08));
    setDisplay(start);
    setDir(null);

    let current = start;
    const step = Math.max(1, Math.ceil((target - start) / 18));

    const tick = () => {
      current = Math.min(target, current + step);
      const going = current < target ? 'up' : null;
      setDir(going);
      setDisplay(current);
      if (current < target) {
        rafRef.current = setTimeout(tick, 40);
      } else {
        // After reaching target, do a few random up/down ticks
        let bounces = 0;
        const bounce = () => {
          if (bounces >= 6) { setDir(null); setDisplay(target); return; }
          const delta = Math.ceil(target * 0.005) || 1;
          const goUp = bounces % 2 === 0;
          setDir(goUp ? 'up' : 'down');
          setDisplay(target + (goUp ? delta : -delta));
          bounces++;
          rafRef.current = setTimeout(bounce, 120);
        };
        rafRef.current = setTimeout(bounce, 80);
      }
    };

    rafRef.current = setTimeout(tick, 120);
    return () => { if (rafRef.current) clearTimeout(rafRef.current); };
  }, [target]);

  // Format display number matching original value format
  const hasCurrency = /[$€£¥]/.test(value);
  const hasComma = value.includes(',');
  const prefix = hasCurrency ? value.match(/^[^0-9]*/)?.[0] ?? '' : '';
  const suffix = value.match(/[^0-9.,]+$/)?.[0] ?? '';

  const formatted = hasComma
    ? Math.round(display).toLocaleString('es-MX')
    : String(Math.round(display));

  const color = dir === 'up' ? '#30d158' : dir === 'down' ? '#ff453a' : 'var(--text-tertiary)';

  return (
    <span style={{ fontSize: '0.72rem', fontWeight: 700, color, letterSpacing: '0.5px', fontVariantNumeric: 'tabular-nums', transition: 'color 0.1s' }}>
      {dir === 'up' ? '▲' : dir === 'down' ? '▼' : '●'} {prefix}{formatted}{suffix}
    </span>
  );
}

const GLASS = {
  background: 'rgba(255,255,255,0.13)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.22)',
  borderRadius: 14,
  boxShadow: '0 4px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.12)',
} as const;

// ─── Composite: StatCard ───────────────────────────────────
// iOS app-icon style: card with icon + ticker, label+value below

function StatCard({ props }: { props: Record<string, unknown> }) {
  const title = props.title as string;
  const value = props.value as string;
  const subtitle = props.subtitle as string | undefined;

  return (
    <div
      style={{
        ...GLASS,
        padding: '1rem 1.1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.3rem',
      }}
    >
      <p style={{
        fontSize: '0.72rem',
        fontWeight: 600,
        color: '#ffffff',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        lineHeight: 1,
      }}>
        {title}
      </p>
      <p style={{
        fontSize: '1.65rem',
        fontWeight: 700,
        color: '#ffffff',
        letterSpacing: '-0.03em',
        lineHeight: 1.1,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </p>
      {subtitle && (
        <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.38)', marginTop: '0.1rem' }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

function renderStatCard(props: Record<string, unknown>) {
  return <StatCard props={props} />;
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
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.min(items.length, 5)}, 1fr)`,
        gap: '0.75rem',
      }}
    >
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
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            fontSize: '0.85rem',
            fontWeight: 500,
            color: 'var(--text-secondary)',
          }}
        >
          {label}
        </span>
        {showValue && (
          <span style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
            {value}%
          </span>
        )}
      </div>
      <div
        style={{
          height: 8,
          width: '100%',
          borderRadius: 99,
          background: 'var(--surface-3)',
        }}
      >
        <div
          style={{
            height: '100%',
            borderRadius: 99,
            width: `${value}%`,
            background:
              color.startsWith('#') || color.startsWith('rgb')
                ? color
                : 'var(--primary)',
            transition: 'width 0.6s var(--ease-out-expo)',
          }}
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
    <div
      style={{
        ...GLASS,
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      {title && (
        <p
          style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text)' }}
        >
          {title}
        </p>
      )}
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
    <div
      style={{
        ...GLASS,
        padding: '1.5rem',
        boxShadow: '0 4px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)',
      }}
    >
        {items.map((item, i) => {
          const amountColor =
            item.status === 'positive'
              ? '#30d158'
              : item.status === 'negative'
                ? 'var(--danger)'
                : 'var(--text)';
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.6rem 0',
                borderBottom:
                  i < items.length - 1
                    ? '1px solid var(--border-color)'
                    : 'none',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: 'var(--text)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.title}
                </p>
                {item.subtitle && (
                  <p
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-tertiary)',
                    }}
                  >
                    {item.subtitle}
                  </p>
                )}
              </div>
              <div style={{ textAlign: 'right', marginLeft: '1rem' }}>
                <p
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: amountColor,
                  }}
                >
                  {item.amount}
                </p>
                {item.date && (
                  <p
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-tertiary)',
                    }}
                  >
                    {item.date}
                  </p>
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
  const data  = props.data as number[];
  const color = (props.color as string) || '#818cf8';

  if (!data || data.length === 0) return null;

  return (
    <div
      style={{
        ...GLASS,
        padding: '1.5rem',
      }}
    >
      <p
        style={{
          fontSize: '0.82rem',
          fontWeight: 500,
          color: 'var(--text-tertiary)',
        }}
      >
        {title}
      </p>
      <p
        style={{
          fontSize: '1.75rem',
          fontWeight: 700,
          letterSpacing: '-0.4px',
          marginTop: '0.25rem',
          color: 'var(--text)',
        }}
      >
        {value}
      </p>
      <div style={{ height: 60, marginTop: '0.75rem' }}>
        <D3MiniChart data={data} color={color} height={60} />
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
    <div
      style={{
        ...GLASS,
        boxShadow: '0 4px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)',
      }}
    >
      {title && (
        <p
          style={{
            fontSize: '0.95rem',
            fontWeight: 600,
            color: 'var(--text)',
            padding: '1.5rem 1.5rem 0.75rem',
          }}
        >
          {title}
        </p>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.85rem',
          }}
        >
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{
                    textAlign: 'left',
                    padding: '0.6rem 1rem',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.4px',
                    color: 'var(--text-tertiary)',
                    background: 'var(--surface-2)',
                  }}
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
                style={{
                  borderBottom:
                    i < rows.length - 1
                      ? '1px solid var(--border-color)'
                      : 'none',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = 'var(--surface-2)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = 'transparent')
                }
              >
                {columns.map((col, ci) => (
                  <td
                    key={col.key}
                    style={{
                      padding: '0.6rem 1rem',
                      color: 'var(--text-secondary)',
                      fontWeight: ci === 0 && highlightFirst ? 600 : 400,
                    }}
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

// ─── Aurora Reveal Animation ───────────────────────────────
// Bidirectional scroll animation with Aurora glow effect

function AuroraReveal({ children, index = 0 }: { children: React.ReactNode; index?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    gsap.set(el, { opacity: 0, y: 30 });

    const trigger = ScrollTrigger.create({
      trigger: el,
      start: 'top 92%',
      once: true,
      onEnter: () => {
        gsap.to(el, { opacity: 1, y: 0, duration: 0.6, delay: index * 0.07, ease: 'power3.out' });
      },
    });

    return () => trigger.kill();
  }, [index]);

  return (
    <div ref={ref}>
      {children}
    </div>
  );
}

// ─── Standard Chart (Aurora ECharts) ────────────────────────

// Map chart type to AuroraChart type
const AURORA_TYPE_MAP: Record<string, 'bar' | 'line' | 'area' | 'pie' | 'doughnut' | 'scatter' | 'radar' | 'funnel' | 'gauge' | 'heatmap' | 'treemap'> = {
  bar: 'bar',
  line: 'line',
  area: 'area',
  pie: 'pie',
  doughnut: 'doughnut',
  scatter: 'scatter',
  radar: 'radar',
  funnel: 'funnel',
  gauge: 'gauge',
  heatmap: 'heatmap',
  treemap: 'treemap',
};

// Scroll-reveal wrapper for charts
function ScrollDrivenChart({ type, data, title, height = 320, index = 0 }: {
  type: 'bar' | 'line' | 'area' | 'pie' | 'doughnut' | 'scatter' | 'radar' | 'funnel' | 'gauge' | 'heatmap' | 'treemap';
  data: { labels: string[]; datasets: { label?: string; data: number[] }[] };
  title?: string;
  height?: number;
  index?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Mount immediately — AuroraChart handles its own animation
    setMounted(true);

    const el = ref.current;
    if (!el) return;
    gsap.fromTo(el,
      { opacity: 0, y: 24, scale: 0.97 },
      { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: 'power3.out', delay: index * 0.06 }
    );
  }, [index]);

  return (
    <div ref={ref} style={{ opacity: 0, willChange: 'transform, opacity' }}>
      {mounted && (
        <AuroraChart type={type} data={data} title={title} height={height} gradient="aurora" />
      )}
    </div>
  );
}

function renderChart(props: Record<string, unknown>, index: number = 0) {
  const type = props.type as string;
  const title = props.title as string | undefined;
  const data = props.data as {
    labels: string[];
    datasets: Record<string, unknown>[];
  };
  const options = props.options as Record<string, unknown> | undefined;

  const xAxisLabel = (options?.xAxis as Record<string, unknown>)?.label as
    | string
    | undefined;
  const yAxisLabel = (options?.yAxis as Record<string, unknown>)?.label as
    | string
    | undefined;

  // New D3 chart types
  const D3_WRAPPER = {
    ...GLASS,
    padding: '1.5rem',
  };
  const D3_TITLE = {
    fontSize: '0.9rem',
    fontWeight: 600,
    color: 'var(--text)',
    marginBottom: '1rem',
  };

  if (type === 'bollinger') {
    const bollingerData = props.data as { date: string; value: number }[];
    const n = (props.n as number) || 20;
    const k = (props.k as number) || 2;
    return (
      <div style={D3_WRAPPER}>
        {title && <p style={D3_TITLE}>{title}</p>}
        <D3BollingerBands
          data={bollingerData}
          n={n}
          k={k}
          title={title}
          xAxisLabel={xAxisLabel}
          yAxisLabel={yAxisLabel}
          height={320}
        />
      </div>
    );
  }

  if (type === 'stacked-area') {
    const stackedData = props.data as {
      label: string;
      [key: string]: string | number;
    }[];
    const keys = props.keys as string[];
    const colors = props.colors as string[] | undefined;
    return (
      <div style={D3_WRAPPER}>
        {title && <p style={D3_TITLE}>{title}</p>}
        <D3StackedArea
          data={stackedData}
          keys={keys}
          colors={colors}
          title={title}
          xAxisLabel={xAxisLabel}
          yAxisLabel={yAxisLabel}
          height={320}
        />
      </div>
    );
  }

  if (type === 'diverging-bar') {
    const divData = props.data as {
      label: string;
      values: { key: string; value: number }[];
    }[];
    const keys = props.keys as string[];
    const colors = props.colors as string[] | undefined;
    const neutralKey = props.neutralKey as string | undefined;
    const negativeLabel = props.negativeLabel as string | undefined;
    const positiveLabel = props.positiveLabel as string | undefined;
    return (
      <div style={D3_WRAPPER}>
        {title && <p style={D3_TITLE}>{title}</p>}
        <D3DivergingBar
          data={divData}
          keys={keys}
          colors={colors}
          neutralKey={neutralKey}
          negativeLabel={negativeLabel}
          positiveLabel={positiveLabel}
          title={title}
          xAxisLabel={xAxisLabel}
        />
      </div>
    );
  }

  if (type === 'radial-stacked-bar') {
    const radialData = props.data as {
      label: string;
      [key: string]: string | number;
    }[];
    const keys = props.keys as string[];
    const colors = props.colors as string[] | undefined;
    return (
      <div style={D3_WRAPPER}>
        {title && <p style={D3_TITLE}>{title}</p>}
        <D3RadialStackedBar
          data={radialData}
          keys={keys}
          colors={colors}
          title={title}
          height={500}
        />
      </div>
    );
  }

  if (type === 'candlestick') {
    // Normalize candlestick data: support both flat array and {labels, datasets} formats
    let candleData: {
      date: string;
      open: number;
      high: number;
      low: number;
      close: number;
    }[];

    const rawData = props.data as unknown;
    if (Array.isArray(rawData) && rawData.length > 0 && 'date' in rawData[0]) {
      // Flat format: [{ date, open, high, low, close }]
      candleData = rawData as {
        date: string;
        open: number;
        high: number;
        low: number;
        close: number;
      }[];
    } else if (
      rawData &&
      typeof rawData === 'object' &&
      'datasets' in (rawData as Record<string, unknown>)
    ) {
      // Legacy format: { labels: [...], datasets: [{ data: [{ x, open, high, low, close }] }] }
      const structured = rawData as {
        labels: string[];
        datasets: {
          data: {
            x: string;
            open: number;
            high: number;
            low: number;
            close: number;
          }[];
        }[];
      };
      const ds = structured.datasets[0];
      if (
        ds &&
        Array.isArray(ds.data) &&
        ds.data.length > 0 &&
        'open' in ds.data[0]
      ) {
        candleData = ds.data.map((d) => ({
          date: d.x,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
        }));
      } else {
        // Fallback: use labels as dates with dummy OHLC from single values
        candleData = structured.labels.map((label, i) => {
          const val = (ds?.data as unknown as number[])?.[i] || 0;
          return { date: label, open: val, high: val, low: val, close: val };
        });
      }
    } else {
      candleData = [];
    }

    return (
      <div style={D3_WRAPPER}>
        {title && <p style={D3_TITLE}>{title}</p>}
        <D3Candlestick
          data={candleData}
          title={title}
          xAxisLabel={xAxisLabel}
          yAxisLabel={yAxisLabel}
          height={360}
        />
      </div>
    );
  }

  if (type === 'hierarchical-bar') {
    const hierData = props.data as {
      name: string;
      value?: number;
      children?: unknown[];
    };
    return (
      <div style={D3_WRAPPER}>
        {title && <p style={D3_TITLE}>{title}</p>}
        <D3HierarchicalBar
          data={hierData as never}
          title={title}
          xAxisLabel={xAxisLabel}
        />
      </div>
    );
  }

  if (type === 'bar-race') {
    const frames = props.frames as {
      label: string;
      items: { name: string; value: number }[];
    }[];
    const maxBars = (props.maxBars as number) || 10;
    const duration = (props.duration as number) || 800;
    const colors = props.colors as string[] | undefined;
    return (
      <div style={D3_WRAPPER}>
        {title && <p style={D3_TITLE}>{title}</p>}
        <D3BarChartRace
          frames={frames}
          title={title}
          maxBars={maxBars}
          duration={duration}
          colors={colors}
          xAxisLabel={xAxisLabel}
        />
      </div>
    );
  }

  if (type === 'sankey') {
    const sankeyData = props.data as { nodes: { name: string }[]; links: { source: string; target: string; value: number }[] };
    return (
      <div style={D3_WRAPPER}>
        {title && <p style={D3_TITLE}>{title}</p>}
        <AuroraChart type="sankey" data={sankeyData} title={undefined} height={400} gradient="aurora" bare />
      </div>
    );
  }

  if (type === 'map') {
    const mapData = (data?.labels ?? []).map((name: string, i: number) => ({
      name,
      value: ((data.datasets?.[0]?.data as unknown as number[])?.[i] as number) ?? 0,
    }));
    return (
      <MexicoMapChart
        data={mapData}
        title={title}
        height={420}
        gradient="aurora"
      />
    );
  }

  // Standard chart types (bar, line, area, pie, doughnut) — use AuroraChart with scroll-driven building
  if (!data || !data.labels || !data.datasets) {
    return (
      <div style={{ padding: '1rem', color: 'var(--text-tertiary)' }}>
        Invalid chart data
      </div>
    );
  }

  const auroraType = AURORA_TYPE_MAP[type] || 'bar';

  return (
    <ScrollDrivenChart
      type={auroraType}
      data={data as { labels: string[]; datasets: { label?: string; data: number[] }[] }}
      title={title}
      height={type === 'pie' || type === 'doughnut' ? 340 : 300}
      index={index}
    />
  );
}

// ─── Recursive Component Renderer ──────────────────────────

function RenderComponent({ config, index = 0 }: { config: UIComponentConfig; index?: number }) {
  const { component, props, children } = config;

  // Composite components (custom rich renderers)
  switch (component) {
    case 'Table':
    case 'DataSummary':
      return renderTable(props);
    case 'Chart':
    case 'BollingerBands':
    case 'StackedArea':
    case 'DivergingBar':
    case 'RadialStackedBar':
    case 'Candlestick':
    case 'HierarchicalBar':
    case 'BarChartRace':
      return renderChart(props, index);
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
      <div
        style={{
          padding: '0.5rem 0.75rem',
          border: '1.5px dashed var(--danger)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.82rem',
          color: 'var(--danger)',
          opacity: 0.7,
        }}
      >
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
  animated?: boolean;
}

export default function DynamicRenderer({
  config,
}: DynamicRendererProps) {
  if (!config || !config.components) {
    return (
      <div
        style={{
          padding: '1rem',
          fontSize: '0.875rem',
          color: 'var(--text-tertiary)',
        }}
      >
        No UI config available to render.
      </div>
    );
  }

  // Empty components — show no-results state
  if (config.components.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1.25rem',
          padding: '4rem 2rem',
          textAlign: 'center',
          animation: 'fadeSlideUp 0.4s cubic-bezier(0.16,1,0.3,1) both',
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            background: 'var(--surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.75rem',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          🔍
        </div>
        <div>
          <p
            style={{
              fontSize: '1rem',
              fontWeight: 700,
              color: 'var(--text)',
              letterSpacing: '-0.2px',
            }}
          >
            Sin resultados
          </p>
          <p
            style={{
              fontSize: '0.875rem',
              color: 'var(--text-tertiary)',
              marginTop: '0.4rem',
              maxWidth: 360,
              lineHeight: 1.5,
            }}
          >
            {config.description ||
              'No se encontraron registros con los filtros aplicados.'}
          </p>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'var(--surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.6rem 1rem',
            fontSize: '0.8rem',
            color: 'var(--text-tertiary)',
          }}
        >
          <span style={{ color: 'var(--primary)' }}>💡</span>
          Intenta con otros términos o sin filtros tan específicos
        </div>
      </div>
    );
  }

  const isGrid = config.layout === 'grid';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {config.description && (
        <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
          {config.description}
        </p>
      )}
      <div
        style={
          isGrid
            ? {
                display: 'grid',
                gridTemplateColumns: `repeat(${config.columns || 2}, 1fr)`,
                gap: '1rem',
              }
            : { display: 'flex', flexDirection: 'column', gap: '1rem' }
        }
      >
        {config.components.map((comp, i) => (
          <AuroraReveal key={i} index={i}>
            <RenderComponent config={comp} index={i} />
          </AuroraReveal>
        ))}
      </div>
    </div>
  );
}
