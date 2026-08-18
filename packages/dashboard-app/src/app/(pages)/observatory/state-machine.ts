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

// ── Mock flow for development ──────────────────────────────────────────────
// Call runMockFlow("Dame diagramas de ventas de motos") to simulate the full pipeline

export async function runMockFlow(rawQuery: string) {
  const keywords = rawQuery
    .toLowerCase()
    .replace(/[^a-záéíóúüñ\s]/gi, '')
    .split(/\s+/)
    .filter(w => w.length > 3)
    .slice(0, 4);

  observatory.transition('QUERY_RECEIVED', {
    query: { raw: rawQuery, keywords },
  });

  await delay(1800);
  observatory.transition('ANALYZING');

  await delay(1600);
  observatory.transition('FETCHING_DATA');

  await delay(2000);
  observatory.transition('GENERATING_VISUALIZATIONS');

  await delay(1400);
  observatory.transition('REVEAL', { insights: buildMockInsights() });

  await delay(600);
  observatory.transition('PRESENTATION');
}

function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

function buildMockInsights(): InsightData[] {
  return [
    {
      id: 'sales-trend',
      title: 'Motorcycle Sales',
      subtitle: 'Monthly trend 2024–2026',
      metric: '+24.8%',
      metricLabel: 'vs last period',
      chartType: 'line',
      isPrimary: true,
      chartOptions: {
        animation: true,
        grid: { top: 24, right: 16, bottom: 32, left: 48 },
        xAxis: {
          type: 'category',
          data: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
          axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
          axisLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11 },
          splitLine: { show: false },
        },
        yAxis: {
          type: 'value',
          axisLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11 },
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
        },
        series: [{
          type: 'line',
          data: [42, 58, 71, 65, 89, 103, 118, 134, 127, 142, 156, 171],
          smooth: true,
          symbol: 'none',
          lineStyle: { color: '#49a4d8', width: 2.5 },
          areaStyle: {
            color: {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(73,164,216,0.35)' },
                { offset: 1, color: 'rgba(73,164,216,0.02)' },
              ],
            },
          },
        }],
        tooltip: { trigger: 'axis', backgroundColor: 'rgba(10,14,30,0.85)', borderColor: 'rgba(73,164,216,0.3)', textStyle: { color: '#e4eeff' } },
      },
    },
    {
      id: 'by-model',
      title: 'By Model',
      subtitle: 'Units sold',
      chartType: 'bar',
      chartOptions: {
        animation: true,
        grid: { top: 16, right: 8, bottom: 40, left: 8, containLabel: true },
        xAxis: { type: 'category', data: ['BDS Castoro', 'Veloci Rubak', 'Dinamo TX', 'Breakstorm', 'Edge60'], axisLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 10, rotate: 20 }, axisLine: { show: false }, axisTick: { show: false } },
        yAxis: { type: 'value', axisLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 10 }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } },
        series: [{
          type: 'bar',
          data: [312, 287, 241, 198, 163],
          barMaxWidth: 32,
          itemStyle: {
            color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#49a4d8' }, { offset: 1, color: 'rgba(73,164,216,0.3)' }] },
            borderRadius: [4, 4, 0, 0],
          },
        }],
        tooltip: { trigger: 'axis', backgroundColor: 'rgba(10,14,30,0.85)', borderColor: 'rgba(73,164,216,0.3)', textStyle: { color: '#e4eeff' } },
      },
    },
    {
      id: 'by-region',
      title: 'By Region',
      subtitle: 'Top 5 states',
      chartType: 'bar',
      chartOptions: {
        animation: true,
        grid: { top: 8, right: 8, bottom: 8, left: 8, containLabel: true },
        xAxis: { type: 'value', axisLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 10 }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } },
        yAxis: { type: 'category', data: ['Sinaloa', 'Nuevo León', 'Durango', 'Jalisco', 'CDMX'], axisLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11 }, axisLine: { show: false }, axisTick: { show: false } },
        series: [{
          type: 'bar',
          data: [87, 76, 71, 68, 62],
          barMaxWidth: 20,
          itemStyle: {
            color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: 'rgba(73,164,216,0.3)' }, { offset: 1, color: '#49a4d8' }] },
            borderRadius: [0, 4, 4, 0],
          },
        }],
        tooltip: { trigger: 'axis', backgroundColor: 'rgba(10,14,30,0.85)', borderColor: 'rgba(73,164,216,0.3)', textStyle: { color: '#e4eeff' } },
      },
    },
    {
      id: 'credit-status',
      title: 'Credit Status',
      subtitle: 'Portfolio health',
      chartType: 'pie',
      chartOptions: {
        animation: true,
        series: [{
          type: 'pie',
          radius: ['45%', '72%'],
          center: ['50%', '52%'],
          data: [
            { value: 1187, name: 'Al corriente', itemStyle: { color: '#30d158' } },
            { value: 2444, name: 'Liquidado', itemStyle: { color: '#49a4d8' } },
            { value: 856, name: 'Atrasado', itemStyle: { color: '#ff9f0a' } },
            { value: 513, name: 'Cancelado', itemStyle: { color: '#ff453a' } },
          ],
          label: { show: false },
          emphasis: { scale: true, scaleSize: 6 },
        }],
        tooltip: { trigger: 'item', backgroundColor: 'rgba(10,14,30,0.85)', borderColor: 'rgba(73,164,216,0.3)', textStyle: { color: '#e4eeff' }, formatter: '{b}: {c} ({d}%)' },
        legend: { orient: 'vertical', right: 0, top: 'center', textStyle: { color: 'rgba(255,255,255,0.5)', fontSize: 10 }, itemWidth: 10, itemHeight: 10 },
      },
    },
  ];
}
