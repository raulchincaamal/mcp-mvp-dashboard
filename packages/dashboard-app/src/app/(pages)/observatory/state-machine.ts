// Observatory State Machine
// Completely decoupled from UI and data fetching logic.
// Connect real backend events by calling transition() from your data layer.

export type ObservatoryState =
  | 'IDLE'
  | 'QUERY_RECEIVED'
  | 'ANALYZING'
  | 'FETCHING_DATA'
  | 'GENERATING_VISUALIZATIONS'
  | 'REVEAL'
  | 'PRESENTATION';

export interface QueryContext {
  raw: string;
  keywords: string[];
  intent?: string;
}

export interface InsightData {
  id: string;
  title: string;
  subtitle?: string;
  metric?: string;
  metricLabel?: string;
  chartType: 'bar' | 'line' | 'pie' | 'scatter' | 'gauge';
  chartOptions: Record<string, unknown> | null; // null = stat card only, no chart
  isPrimary?: boolean;
}

export interface ObservatoryContext {
  state: ObservatoryState;
  query: QueryContext | null;
  statusMessage: string;
  insights: InsightData[];
  error: string | null;
}

type Listener = (ctx: ObservatoryContext) => void;

const STATUS_MESSAGES: Record<ObservatoryState, string> = {
  IDLE: '',
  QUERY_RECEIVED: 'QUERY RECEIVED',
  ANALYZING: 'INTERPRETING REQUEST',
  FETCHING_DATA: 'FINDING RELEVANT DATA',
  GENERATING_VISUALIZATIONS: 'GENERATING VISUALIZATIONS',
  REVEAL: 'ANALYZING DATA',
  PRESENTATION: '',
};

const VALID_TRANSITIONS: Record<ObservatoryState, ObservatoryState[]> = {
  IDLE: ['QUERY_RECEIVED'],
  QUERY_RECEIVED: ['ANALYZING', 'IDLE'],
  ANALYZING: ['FETCHING_DATA', 'IDLE'],
  FETCHING_DATA: ['GENERATING_VISUALIZATIONS', 'IDLE'],
  GENERATING_VISUALIZATIONS: ['REVEAL', 'IDLE'],
  REVEAL: ['PRESENTATION', 'IDLE'],
  PRESENTATION: ['IDLE', 'QUERY_RECEIVED'],
};

class ObservatoryStateMachine {
  private ctx: ObservatoryContext = {
    state: 'IDLE',
    query: null,
    statusMessage: '',
    insights: [],
    error: null,
  };

  private listeners: Set<Listener> = new Set();

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.ctx); // emit current state immediately
    return () => this.listeners.delete(fn);
  }

  getContext(): ObservatoryContext {
    return { ...this.ctx };
  }

  transition(next: ObservatoryState, patch?: Partial<ObservatoryContext>): boolean {
    const allowed = VALID_TRANSITIONS[this.ctx.state];
    if (!allowed.includes(next)) {
      console.warn(`[observatory] invalid transition ${this.ctx.state} → ${next}`);
      return false;
    }
    this.ctx = {
      ...this.ctx,
      ...patch,
      state: next,
      statusMessage: STATUS_MESSAGES[next],
      error: null,
    };
    this.notify();
    return true;
  }

  setError(msg: string) {
    this.ctx = { ...this.ctx, error: msg };
    this.notify();
  }

  private notify() {
    const snapshot = { ...this.ctx };
    this.listeners.forEach(fn => fn(snapshot));
  }
}

// Singleton — import this anywhere
export const observatory = new ObservatoryStateMachine();

// ── Real pipeline flow ────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_MCP_API_URL ?? 'http://localhost:4000';

const AURORA_COLORS = ['#c084fc', '#818cf8', '#67e8f9', '#60a5fa', '#f9a8d4', '#6ee7b7'];

// Theme-aware styles - will be applied at runtime
function getAxisStyle(isDark: boolean) {
  return {
    axisLabel: { 
      color: isDark ? 'rgba(230,236,244,0.7)' : 'rgba(13,21,37,0.7)', 
      fontSize: 10,
    },
    axisLine: { lineStyle: { color: isDark ? 'rgba(230,236,244,0.2)' : 'rgba(13,21,37,0.2)' } },
    splitLine: { lineStyle: { color: isDark ? 'rgba(230,236,244,0.1)' : 'rgba(13,21,37,0.1)' } },
  };
}

function getTooltipStyle(isDark: boolean) {
  return {
    backgroundColor: isDark ? 'rgba(30,33,40,0.95)' : 'rgba(255,255,255,0.95)',
    borderColor: 'rgba(73,164,216,0.3)',
    textStyle: { color: isDark ? '#e6ecf4' : '#0d1525' },
  };
}

function getLegendStyle(isDark: boolean) {
  return {
    textStyle: { color: isDark ? 'rgba(230,236,244,0.7)' : 'rgba(13,21,37,0.7)', fontSize: 10 },
  };
}

function getLabelColor(isDark: boolean) {
  return isDark ? 'rgba(230,236,244,0.8)' : 'rgba(13,21,37,0.8)';
}

function colorFor(i: number) {
  return AURORA_COLORS[i % AURORA_COLORS.length];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function uiConfigToInsights(uiConfig: any): InsightData[] {
  const components: unknown[] = uiConfig?.components ?? [];
  const insights: InsightData[] = [];
  
  // Detect theme - dark and slate are both dark themes
  const theme = typeof document !== 'undefined' 
    ? document.documentElement.getAttribute('data-theme')
    : 'dark';
  const isDark = theme === 'dark' || theme === 'slate';
  
  const AXIS_STYLE = getAxisStyle(isDark);
  const TOOLTIP_STYLE = getTooltipStyle(isDark);

  for (const comp of components) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = comp as any;
    const component: string = c.component ?? '';
    const props = c.props ?? {};
    const idx = insights.length;

    // ── Chart ──────────────────────────────────────────────────────────────
    if (component === 'Chart') {
      const type: string = props.type ?? 'bar';
      const rawData = props.data;

      // Normalize: backend returns array [{category,value}] OR {labels,datasets}
      let labels: string[] = [];
      let values: number[] = [];

      if (Array.isArray(rawData)) {
        // [{category, value, label, count, ...}]
        labels = rawData.map((d: Record<string, unknown>) =>
          String(d.category ?? d.label ?? d.name ?? d.estado ?? d.key ?? ''));
        values = rawData.map((d: Record<string, unknown>) =>
          Number(d.value ?? d.count ?? d.total ?? d.cantidad ?? 0));
      } else if (rawData?.labels) {
        labels = rawData.labels;
        values = rawData.datasets?.[0]?.data ?? [];
      }

      let chartOptions: Record<string, unknown> = {};

      if (type === 'pie' || type === 'doughnut') {
        chartOptions = {
          tooltip: { trigger: 'item', ...TOOLTIP_STYLE, formatter: '{b}: {c} ({d}%)' },
          series: [{
            type: 'pie',
            radius: type === 'doughnut' ? ['30%', '60%'] : '55%',
            center: ['50%', '50%'],
            data: labels.map((name, i) => ({ value: values[i] ?? 0, name, itemStyle: { color: colorFor(i) } })),
            label: { 
              show: true, 
              position: 'outside',
              formatter: (p: { name: string; percent: number }) => p.name.length > 10 ? p.name.slice(0,10) + '..' : p.name,
              fontSize: 9,
              color: getLabelColor(isDark),
            },
            labelLine: { show: true, length: 6, length2: 4 },
            emphasis: { scale: true, scaleSize: 4 },
          }],
        };
      } else if (type === 'line' || type === 'area') {
        chartOptions = {
          grid: { top: 20, right: 12, bottom: 28, left: 40 },
          xAxis: { 
            type: 'category', 
            data: labels, 
            ...AXIS_STYLE, 
            splitLine: { show: false },
            axisLabel: { ...AXIS_STYLE.axisLabel, rotate: labels.length > 6 ? 30 : 0, fontSize: 9 },
          },
          yAxis: { type: 'value', ...AXIS_STYLE },
          tooltip: { trigger: 'axis', ...TOOLTIP_STYLE },
          series: [{
            type: 'line', data: values, smooth: true, symbol: 'circle', symbolSize: 4,
            lineStyle: { color: colorFor(0), width: 2 },
            itemStyle: { color: colorFor(0) },
            ...(type === 'area' ? { areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: colorFor(0) + '40' }, { offset: 1, color: colorFor(0) + '05' }] } } } : {}),
          }],
        };
      } else {
        // bar - vertical
        chartOptions = {
          grid: { top: 12, right: 12, bottom: 36, left: 40 },
          xAxis: { 
            type: 'category', 
            data: labels, 
            ...AXIS_STYLE, 
            axisTick: { show: false }, 
            axisLabel: { 
              ...AXIS_STYLE.axisLabel, 
              rotate: labels.length > 5 ? 35 : 0,
              fontSize: 9,
              interval: 0,
            } 
          },
          yAxis: { type: 'value', ...AXIS_STYLE },
          tooltip: { trigger: 'axis', ...TOOLTIP_STYLE },
          series: [{
            type: 'bar',
            data: values.map((v, i) => ({ 
              value: v, 
              itemStyle: { 
                color: colorFor(i),
                borderRadius: [3, 3, 0, 0],
              } 
            })),
            barMaxWidth: 28,
          }],
        };
      }

      const eType = (type === 'pie' || type === 'doughnut') ? 'pie' : (type === 'line' || type === 'area') ? 'line' : 'bar';
      insights.push({
        id: `chart-${idx}`,
        title: props.title ?? uiConfig.title ?? 'Chart',
        subtitle: props.subtitle ?? undefined,
        chartType: eType as InsightData['chartType'],
        isPrimary: idx === 0,
        chartOptions,
      });
      continue;
    }

    // ── KPIGrid → stat cards only (no chart) ─────────────────────────────
    if (component === 'KPIGrid') {
      const cards: { title?: string; value?: string | number; trend?: string; subtitle?: string; icon?: string }[] =
        props.items ?? props.cards ?? [];
      for (const card of cards.slice(0, 6)) {
        const ci = insights.length;
        insights.push({
          id: `kpi-${ci}`,
          title: card.title ?? 'KPI',
          metric: String(card.value ?? '—'),
          metricLabel: card.subtitle ?? card.trend ?? undefined,
          chartType: 'bar',
          chartOptions: null, // null = no chart, stat card only
        });
      }
      continue;
    }

    // ── ProgressGroup → horizontal bar chart ───────────────────────────────
    if (component === 'ProgressGroup') {
      const items: { label?: string; value?: number; max?: number }[] = props.items ?? [];
      const labels = items.map(it => it.label ?? '').slice(0, 5);
      const values = items.map(it => it.value ?? 0).slice(0, 5);
      insights.push({
        id: `progress-${idx}`,
        title: props.title ?? 'Progress',
        chartType: 'bar',
        chartOptions: {
          grid: { top: 8, right: 50, bottom: 8, left: 8, containLabel: true },
          xAxis: { type: 'value', ...AXIS_STYLE, show: false },
          yAxis: { 
            type: 'category', 
            data: labels, 
            ...AXIS_STYLE, 
            axisTick: { show: false },
            axisLine: { show: false },
          },
          tooltip: { trigger: 'axis', ...TOOLTIP_STYLE },
          series: [{
            type: 'bar',
            data: values.map((v, i) => ({
              value: v,
              itemStyle: {
                color: colorFor(i),
                borderRadius: [0, 4, 4, 0],
              },
            })),
            barWidth: 12,
            label: { show: true, position: 'right', fontSize: 9, color: getLabelColor(isDark) },
          }],
        },
      });
      continue;
    }

    // ── TransactionList → horizontal bar ──────────────────────────────────
    if (component === 'TransactionList') {
      const items: { title?: string; label?: string; amount?: number | string; status?: string }[] = (props.items ?? []).slice(0, 6);
      if (items.length === 0) continue;
      const txLabels = items.map(it => {
        const l = String(it.title ?? it.label ?? '');
        return l.length > 14 ? l.slice(0, 14) + '..' : l;
      });
      const txValues = items.map(it => {
        const raw = String(it.amount ?? '0').replace(/[$,\s]/g, '');
        if (raw.endsWith('K')) return parseFloat(raw) * 1000;
        if (raw.endsWith('M')) return parseFloat(raw) * 1_000_000;
        return parseFloat(raw) || 0;
      });
      insights.push({
        id: `txn-${idx}`,
        title: props.title ?? 'Transactions',
        chartType: 'bar',
        chartOptions: {
          grid: { top: 8, right: 70, bottom: 8, left: 8, containLabel: true },
          xAxis: { type: 'value', ...AXIS_STYLE, show: false },
          yAxis: {
            type: 'category',
            data: txLabels,
            ...AXIS_STYLE,
            axisTick: { show: false },
            axisLine: { show: false },
          },
          tooltip: { trigger: 'axis', ...TOOLTIP_STYLE },
          series: [{
            type: 'bar',
            data: txValues.map((v, i) => ({
              value: v,
              itemStyle: { color: colorFor(i), borderRadius: [0, 4, 4, 0] },
            })),
            barWidth: 12,
            label: {
              show: true, position: 'right', fontSize: 9,
              color: getLabelColor(isDark),
              formatter: (p: { value: number }) => {
                const v = p.value;
                if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
                if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
                return `$${v}`;
              },
            },
          }],
        },
      });
      continue;
    }
  }

  return insights;
}

export async function runMockFlow(rawQuery: string) {
  const keywords = rawQuery
    .toLowerCase()
    .replace(/[^a-záéíóúüñ\s]/gi, '')
    .split(/\s+/)
    .filter(w => w.length > 3)
    .slice(0, 4);

  observatory.transition('QUERY_RECEIVED', { query: { raw: rawQuery, keywords } });
  await delay(600);
  observatory.transition('ANALYZING');
  await delay(800);
  observatory.transition('FETCHING_DATA');

  let uiConfig: unknown;
  try {
    const res = await fetch(`${API_URL}/api/generate-ui`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataset: 'ventas-credito', intent: rawQuery }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    uiConfig = json.data ?? json;
  } catch (err) {
    observatory.setError(String(err));
    observatory.transition('IDLE');
    return;
  }

  observatory.transition('GENERATING_VISUALIZATIONS');
  await delay(600);

  const insights = uiConfigToInsights(uiConfig);
  observatory.transition('REVEAL', { insights });
  await delay(900);
  observatory.transition('PRESENTATION');
}

function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}
