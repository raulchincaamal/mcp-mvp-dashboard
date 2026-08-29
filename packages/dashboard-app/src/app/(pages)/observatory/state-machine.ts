// Observatory State Machine
// Completely decoupled from UI and data fetching logic.
// Connect real backend events by calling transition() from your data layer.

import { selectLayout, reorderByNarrative, classifyNarrative } from './layout-engine';
import type { LayoutHint } from './layout-engine';

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
  chartType: 'bar' | 'line' | 'pie' | 'scatter' | 'gauge' | 'text';
  chartOptions: Record<string, unknown> | null;
  isPrimary?: boolean;
  narrativeRole?: 'hook' | 'context' | 'detail' | 'cta';
  listItems?: { title: string; subtitle?: string; amount: string; status?: 'positive' | 'negative' | 'neutral' }[];
}

export interface ObservatoryContext {
  state: ObservatoryState;
  query: QueryContext | null;
  statusMessage: string;
  insights: InsightData[];
  layoutHint: LayoutHint | null;
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
    layoutHint: null,
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
      color: isDark ? 'rgba(230,236,244,0.8)' : 'rgba(13,21,37,0.75)', 
      fontSize: 12,
      fontFamily: 'Space Grotesk, sans-serif',
    },
    axisLine: { lineStyle: { color: isDark ? 'rgba(230,236,244,0.15)' : 'rgba(13,21,37,0.15)' } },
    splitLine: { lineStyle: { color: isDark ? 'rgba(230,236,244,0.07)' : 'rgba(13,21,37,0.07)', type: 'dashed' } },
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
  return isDark ? 'rgba(230,236,244,0.9)' : 'rgba(13,21,37,0.85)';
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

  let progressGroupCount = 0;
  // Track chart types seen — max 1 per type (except area/line: max 2)
  const chartTypeSeen: Record<string, number> = {};
  const CHART_TYPE_MAX: Record<string, number> = {
    bar: 1, treemap: 1, doughnut: 1, pie: 1, heatmap: 1, radar: 1,
    scatter: 1, funnel: 1, gauge: 1, map: 1, candlestick: 1, bollinger: 1,
    'stacked-area': 1, 'diverging-bar': 1, 'radial-stacked-bar': 1,
    'hierarchical-bar': 1, 'bar-race': 1,
    area: 2, line: 2, progress: 2,
  };

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

      // ── Tipos nativos de AuroraChart (no necesitan conversión a ECharts) ──
      const AURORA_NATIVE = ['scatter','radar','funnel','gauge','heatmap','treemap'];
      if (type === 'map') {
        // Mexico choropleth map — pass labels+values directly, MexicoMapChart handles rendering
        const datasets = rawData?.datasets ?? [{ data: values }];
        chartOptions = {
          _auroraType: 'map',
          _auroraData: { labels, datasets },
        };
      } else if (AURORA_NATIVE.includes(type)) {
        // Pasar datos tal cual — AuroraChart los consume directamente
        const datasets = rawData?.datasets ?? (Array.isArray(rawData)
          ? [{ data: rawData.map((d: Record<string,unknown>) => Number(d.value ?? d.count ?? 0)) }]
          : [{ data: values }]);
        chartOptions = {
          // Usamos _auroraType para que ScrollPresentation lo lea sin depender de series[0].type
          _auroraType: type,
          _auroraData: { labels, datasets },
        };
      } else if (type === 'candlestick') {
        // Bedrock genera datasets[0].data = [{date, open, high, low, close}]
        const ohlcRaw = rawData?.datasets?.[0]?.data ?? (Array.isArray(rawData) ? rawData : []);
        const ohlcLabels: string[] = [];
        const ohlcData: number[][] = [];
        for (const d of ohlcRaw) {
          const item = d as Record<string, unknown>;
          ohlcLabels.push(String(item.date ?? item.label ?? ''));
          ohlcData.push([
            Number(item.open ?? 0),
            Number(item.close ?? 0),
            Number(item.low ?? 0),
            Number(item.high ?? 0),
          ]);
        }
        const upColor = '#34d399';
        const downColor = '#f87171';
        chartOptions = {
          _auroraType: 'candlestick',
          _auroraData: { labels: ohlcLabels, datasets: [{ data: ohlcData.map(d => d[1]) }] }, // fallback
          backgroundColor: 'transparent',
          tooltip: {
            trigger: 'axis',
            backgroundColor: TOOLTIP_STYLE.backgroundColor,
            borderColor: TOOLTIP_STYLE.borderColor,
            borderWidth: 1,
            textStyle: TOOLTIP_STYLE.textStyle,
            extraCssText: 'backdrop-filter:blur(8px);border-radius:8px;',
            formatter: (params: unknown[]) => {
              const p = (params as {name:string;data:number[]}[])[0];
              if (!p) return '';
              return `${p.name}<br/>O: ${p.data[1].toLocaleString('es-MX')}<br/>C: ${p.data[2].toLocaleString('es-MX')}<br/>L: ${p.data[3].toLocaleString('es-MX')}<br/>H: ${p.data[4].toLocaleString('es-MX')}`;
            },
          },
          grid: { left: 16, right: 16, bottom: 40, top: 16, containLabel: true },
          xAxis: {
            type: 'category',
            data: ohlcLabels,
            axisLine: { lineStyle: { color: AXIS_STYLE.axisLine.lineStyle.color } },
            axisTick: { show: false },
            axisLabel: { color: AXIS_STYLE.axisLabel.color, fontSize: 10, rotate: ohlcLabels.length > 12 ? 35 : 0 },
          },
          yAxis: {
            type: 'value',
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: { color: AXIS_STYLE.axisLabel.color, fontSize: 10 },
            splitLine: { lineStyle: { color: AXIS_STYLE.splitLine.lineStyle.color, type: 'dashed' } },
          },
          series: [{
            type: 'candlestick',
            data: ohlcData,
            itemStyle: {
              color: upColor,
              color0: downColor,
              borderColor: upColor,
              borderColor0: downColor,
            },
          }],
        };
      } else if (type === 'pie' || type === 'doughnut') {
        const total = values.reduce((a, b) => a + b, 0);
        chartOptions = {
          backgroundColor: 'transparent',
          tooltip: {
            trigger: 'item',
            ...TOOLTIP_STYLE,
            textStyle: { ...TOOLTIP_STYLE.textStyle, fontSize: 13 },
            formatter: (p: { name: string; value: number; percent: number }) =>
              `${p.name}<br/><b>${p.value.toLocaleString('es-MX')}</b> (${p.percent.toFixed(1)}%)`,
          },
          legend: {
            orient: 'vertical',
            right: 12,
            top: 'middle',
            itemWidth: 12,
            itemHeight: 12,
            itemGap: 14,
            textStyle: {
              color: getLabelColor(isDark),
              fontSize: 13,
              fontFamily: 'Space Grotesk, sans-serif',
            },
            formatter: (name: string) => {
              const i = labels.indexOf(name);
              const v = values[i] ?? 0;
              const pct = total > 0 ? ((v / total) * 100).toFixed(1) : '0';
              return `${name}  ${pct}%`;
            },
          },
          series: [{
            type: 'pie',
            radius: type === 'doughnut' ? ['38%', '68%'] : ['0%', '65%'],
            center: ['36%', '50%'],
            itemStyle: { borderRadius: 5, borderColor: 'transparent', borderWidth: 2 },
            data: labels.map((name, i) => ({
              value: values[i] ?? 0,
              name,
              itemStyle: { color: colorFor(i) },
            })),
            label: { show: false },
            labelLine: { show: false },
            emphasis: {
              scale: true,
              scaleSize: 8,
              label: {
                show: true,
                fontSize: 15,
                fontWeight: 700,
                color: getLabelColor(isDark),
                formatter: '{b}\n{d}%',
              },
            },
          }],
        };
      } else if (type === 'line' || type === 'area') {
        chartOptions = {
          _auroraType: type,
          _auroraData: { labels, datasets: rawData?.datasets ?? [{ label: '', data: values }] },
          grid: { top: 24, right: 20, bottom: 36, left: 16, containLabel: true },
          xAxis: { 
            type: 'category', 
            data: labels, 
            ...AXIS_STYLE, 
            splitLine: { show: false },
            axisLabel: { ...AXIS_STYLE.axisLabel, rotate: labels.length > 8 ? 35 : 0 },
          },
          yAxis: { type: 'value', ...AXIS_STYLE },
          tooltip: { trigger: 'axis', ...TOOLTIP_STYLE, textStyle: { ...TOOLTIP_STYLE.textStyle, fontSize: 13 } },
          series: [{
            type: 'line', data: values, smooth: true, symbol: 'circle', symbolSize: 6,
            lineStyle: { color: colorFor(0), width: 3 },
            itemStyle: { color: colorFor(0) },
            ...(type === 'area' ? { areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: colorFor(0) + '50' }, { offset: 1, color: colorFor(0) + '05' }] } } } : {}),
          }],
        };
      } else {
        // bar - vertical
        chartOptions = {
          _auroraType: 'bar',
          _auroraData: { labels, datasets: rawData?.datasets ?? [{ label: '', data: values }] },
          grid: { top: 16, right: 16, bottom: 40, left: 16, containLabel: true },
          xAxis: { 
            type: 'category', 
            data: labels, 
            ...AXIS_STYLE, 
            axisTick: { show: false }, 
            axisLabel: { 
              ...AXIS_STYLE.axisLabel, 
              rotate: labels.length > 6 ? 35 : 0,
              interval: 0,
            } 
          },
          yAxis: { type: 'value', ...AXIS_STYLE },
          tooltip: { trigger: 'axis', ...TOOLTIP_STYLE, textStyle: { ...TOOLTIP_STYLE.textStyle, fontSize: 13 } },
          series: [{
            type: 'bar',
            data: values.map((v, i) => ({ 
              value: v, 
              itemStyle: { color: colorFor(i), borderRadius: [4, 4, 0, 0] } 
            })),
            barMaxWidth: 48,
            barCategoryGap: '35%',
          }],
        };
      }

      const eType = (chartOptions._auroraType as string) ||
        ((type === 'pie' || type === 'doughnut') ? 'pie' : (type === 'line' || type === 'area') ? 'line' : 'bar');

      // Deduplicate: skip if we've already seen this chart type too many times
      const typeKey = eType;
      chartTypeSeen[typeKey] = (chartTypeSeen[typeKey] ?? 0) + 1;
      if (chartTypeSeen[typeKey] > (CHART_TYPE_MAX[typeKey] ?? 1)) continue;

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

    // ── ProgressGroup → primero = barras, segundo+ = doughnut ────────────
    if (component === 'ProgressGroup') {
      const items: { label?: string; value?: number }[] = props.items ?? [];
      const pgItems = items.slice(0, 8);
      const pgLabels = pgItems.map(it => it.label ?? '');
      const pgValues = pgItems.map(it => Math.min(100, Math.max(0, it.value ?? 0)));

      progressGroupCount++;

      // Skip if we've already seen too many progress groups
      chartTypeSeen['progress'] = (chartTypeSeen['progress'] ?? 0) + 1;
      if (chartTypeSeen['progress'] > (CHART_TYPE_MAX['progress'] ?? 2)) continue;

      if (progressGroupCount >= 2) {
        insights.push({
          id: `progress-${idx}`,
          title: props.title ?? 'Progress',
          chartType: 'bar',
          chartOptions: {
            _auroraType: 'progress',
            _auroraData: { labels: pgLabels, datasets: [{ data: pgValues }] },
          },
        });
        continue;
      }

      const barH = Math.max(18, Math.min(32, Math.floor(260 / pgItems.length)));
      insights.push({
        id: `progress-${idx}`,
        title: props.title ?? 'Progress',
        chartType: 'bar',
        chartOptions: {
          _auroraType: 'progress',  // keep 'progress' so reorderByNarrative can identify it
          _auroraData: { labels: pgLabels, datasets: [{ label: '', data: pgValues }] },
          backgroundColor: 'transparent',
          grid: { top: 4, right: 52, bottom: 4, left: 4, containLabel: true },
          xAxis: { type: 'value', max: 100, show: false },
          yAxis: {
            type: 'category',
            data: pgLabels,
            axisTick: { show: false },
            axisLine: { show: false },
            axisLabel: {
              color: getLabelColor(isDark),
              fontSize: 13,
              fontFamily: 'Space Grotesk, sans-serif',
              width: 200,
              overflow: 'truncate',
            },
          },
          tooltip: {
            trigger: 'axis',
            ...TOOLTIP_STYLE,
            formatter: (params: { name: string; value: number }[]) =>
              `${params[0].name}: <b>${params[0].value}%</b>`,
          },
          series: [
            // Background track
            {
              type: 'bar',
              data: pgLabels.map(() => 100),
              barWidth: barH,
              itemStyle: {
                color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                borderRadius: [0, barH, barH, 0],
              },
              silent: true,
              z: 1,
            },
            // Value bar
            {
              type: 'bar',
              data: pgValues.map((v, i) => ({
                value: v,
                itemStyle: { color: colorFor(i), borderRadius: [0, barH, barH, 0] },
              })),
              barWidth: barH,
              barGap: '-100%',
              z: 2,
              label: {
                show: true,
                position: 'right',
                fontSize: 13,
                fontWeight: 600,
                color: getLabelColor(isDark),
                formatter: (p: { value: number }) => `${p.value}%`,
              },
            },
          ],
        },
      });
      continue;
    }

    // ── TransactionList → SKIP (not relevant for executives)
    if (component === 'TransactionList') {
      continue;
    }

    // ── MiniChart / StatCard with text content → InsightText card ──
    if (component === 'MiniChart' || (component === 'StatCard' && !props.value)) {
      const ci = insights.length;
      insights.push({
        id: `text-${ci}`,
        title: props.title ?? 'Insight',
        subtitle: props.description ?? props.insight ?? props.text ?? props.subtitle ?? undefined,
        metric: props.value ? String(props.value) : undefined,
        chartType: 'text' as InsightData['chartType'],
        chartOptions: null,
      });
      continue;
    }
  }

  return insights;
}

export const ALEXA_USER_ID = 'alexa-display';
export const ENV_USER_ID = process.env.NEXT_PUBLIC_USER_ID ?? null;

export async function runMockFlow(rawQuery: string, userId = ALEXA_USER_ID, extraFilters?: Record<string, unknown>) {
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
    const body: Record<string, unknown> = { dataset: 'ventas-credito', intent: rawQuery, userId, limit: 500 };
    if (extraFilters) body.filters = extraFilters;
    const res = await fetch(`${API_URL}/api/generate-ui`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[runMockFlow] HTTP ${res.status}:`, body);
      if (res.status === 401) {
        observatory.setError('AWS credentials expired. Please renew your SSO session.');
      } else {
        observatory.setError(`API error ${res.status}: ${body.slice(0, 120)}`);
      }
      observatory.transition('IDLE');
      return;
    }
    const json = await res.json();
    uiConfig = json.data ?? json;
  } catch (err) {
    console.error('[runMockFlow] fetch error:', err);
    observatory.setError(String(err));
    observatory.transition('IDLE');
    return;
  }

  observatory.transition('GENERATING_VISUALIZATIONS');
  await delay(600);

  const arc      = classifyNarrative(rawQuery);
  const insights = reorderByNarrative(uiConfigToInsights(uiConfig), arc);
  const layoutHint = selectLayout(insights, rawQuery);
  observatory.transition('REVEAL', { insights, layoutHint });
  await delay(900);
  observatory.transition('PRESENTATION');
}

function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}
