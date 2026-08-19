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
  chartOptions: Record<string, unknown>; // ECharts option object
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

const AXIS_STYLE = {
  axisLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11 },
  axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
  splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
};

const TOOLTIP_STYLE = {
  backgroundColor: 'rgba(10,14,30,0.85)',
  borderColor: 'rgba(73,164,216,0.3)',
  textStyle: { color: '#e4eeff' },
};

function colorFor(i: number) {
  return AURORA_COLORS[i % AURORA_COLORS.length];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function uiConfigToInsights(uiConfig: any): InsightData[] {
  const components: unknown[] = uiConfig?.components ?? [];
  const insights: InsightData[] = [];

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
          legend: { orient: 'vertical', right: 0, top: 'center', textStyle: { color: 'rgba(255,255,255,0.5)', fontSize: 10 }, itemWidth: 10, itemHeight: 10 },
          series: [{
            type: 'pie',
            radius: type === 'doughnut' ? ['45%', '72%'] : '65%',
            center: ['45%', '52%'],
            data: labels.map((name, i) => ({ value: values[i] ?? 0, name, itemStyle: { color: colorFor(i) } })),
            label: { show: false },
            emphasis: { scale: true, scaleSize: 6 },
          }],
        };
      } else if (type === 'line' || type === 'area') {
        chartOptions = {
          grid: { top: 24, right: 16, bottom: 32, left: 48 },
          xAxis: { type: 'category', data: labels, ...AXIS_STYLE, splitLine: { show: false } },
          yAxis: { type: 'value', ...AXIS_STYLE },
          tooltip: { trigger: 'axis', ...TOOLTIP_STYLE },
          series: [{
            type: 'line', data: values, smooth: true, symbol: 'none',
            lineStyle: { color: colorFor(0), width: 2.5 },
            ...(type === 'area' ? { areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: colorFor(0) + '55' }, { offset: 1, color: colorFor(0) + '05' }] } } } : {}),
          }],
        };
      } else {
        // bar
        chartOptions = {
          grid: { top: 16, right: 8, bottom: 40, left: 8, containLabel: true },
          xAxis: { type: 'category', data: labels, ...AXIS_STYLE, axisTick: { show: false }, axisLabel: { ...AXIS_STYLE.axisLabel, rotate: labels.length > 8 ? 30 : 0 } },
          yAxis: { type: 'value', ...AXIS_STYLE },
          tooltip: { trigger: 'axis', ...TOOLTIP_STYLE },
          series: [{
            type: 'bar',
            data: values.map((v, i) => ({ value: v, itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: colorFor(i) }, { offset: 1, color: colorFor(i) + '55' }] }, borderRadius: [4, 4, 0, 0] } })),
            barMaxWidth: 36,
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

    // ── KPIGrid → gauge por card ────────────────────────────────────────────
    if (component === 'KPIGrid') {
      // backend uses items OR cards
      const cards: { title?: string; value?: string | number; trend?: string; subtitle?: string }[] =
        props.items ?? props.cards ?? [];
      for (const card of cards.slice(0, 4)) {
        const numVal = parseFloat(String(card.value ?? 0).replace(/[^0-9.]/g, '')) || 0;
        const ci = insights.length;
        insights.push({
          id: `kpi-${ci}`,
          title: card.title ?? 'KPI',
          metric: String(card.value ?? '—'),
          metricLabel: card.subtitle ?? card.trend ?? undefined,
          chartType: 'gauge',
          chartOptions: {
            series: [{
              type: 'gauge', radius: '85%', startAngle: 200, endAngle: -20,
              min: 0, max: numVal * 1.5 || 100, splitNumber: 4,
              axisLine: { lineStyle: { width: 10, color: [[1, colorFor(ci)]] } },
              pointer: { show: false }, axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false },
              detail: { valueAnimation: true, formatter: String(card.value ?? '—'), color: colorFor(ci), fontSize: 22, fontWeight: 700, offsetCenter: [0, '10%'] },
              data: [{ value: numVal, name: card.title ?? '' }],
              title: { offsetCenter: [0, '40%'], color: 'rgba(255,255,255,0.5)', fontSize: 11 },
            }],
          },
        });
      }
      continue;
    }

    // ── ProgressGroup → horizontal bar chart ───────────────────────────────
    if (component === 'ProgressGroup') {
      const items: { label?: string; value?: number; max?: number }[] = props.items ?? [];
      const labels = items.map(it => it.label ?? '');
      const values = items.map(it => it.value ?? 0);
      insights.push({
        id: `progress-${idx}`,
        title: props.title ?? 'Progress',
        chartType: 'bar',
        chartOptions: {
          grid: { top: 8, right: 8, bottom: 8, left: 8, containLabel: true },
          xAxis: { type: 'value', ...AXIS_STYLE },
          yAxis: { type: 'category', data: labels, ...AXIS_STYLE, axisTick: { show: false } },
          tooltip: { trigger: 'axis', ...TOOLTIP_STYLE },
          series: [{
            type: 'bar',
            data: values.map((v, i) => ({
              value: v,
              itemStyle: {
                color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: colorFor(i) + '55' }, { offset: 1, color: colorFor(i) }] },
                borderRadius: [0, 4, 4, 0],
              },
            })),
            barMaxWidth: 20,
          }],
        },
      });
      continue;
    }

    // ── TransactionList → table-style bar ──────────────────────────────────
    if (component === 'TransactionList') {
      const items: { label?: string; amount?: number | string; status?: string }[] = (props.items ?? []).slice(0, 8);
      if (items.length === 0) continue;
      const labels = items.map(it => it.label ?? '');
      const values = items.map(it => parseFloat(String(it.amount ?? 0).replace(/[^0-9.]/g, '')) || 0);
      insights.push({
        id: `txn-${idx}`,
        title: props.title ?? 'Transactions',
        chartType: 'bar',
        chartOptions: {
          grid: { top: 8, right: 8, bottom: 8, left: 8, containLabel: true },
          xAxis: { type: 'value', ...AXIS_STYLE },
          yAxis: { type: 'category', data: labels, ...AXIS_STYLE, axisTick: { show: false } },
          tooltip: { trigger: 'axis', ...TOOLTIP_STYLE },
          series: [{
            type: 'bar',
            data: values.map((v, i) => ({
              value: v,
              itemStyle: {
                color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: colorFor(i) + '44' }, { offset: 1, color: colorFor(i) }] },
                borderRadius: [0, 4, 4, 0],
              },
            })),
            barMaxWidth: 18,
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
