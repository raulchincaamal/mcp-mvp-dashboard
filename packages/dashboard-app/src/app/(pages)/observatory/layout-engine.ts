import type { InsightData } from './state-machine';

export type LayoutVariant =
  | 'hero'
  | 'bento-asym'
  | 'bento-sym'
  | 'comparison'
  | 'focus'
  | 'minimal'
  | 'procedural';

export type NarrativeArc =
  | 'trend'
  | 'ranking'
  | 'distribution'
  | 'diagnostic'
  | 'comparison'
  | 'detail';

export type NarrativeRole = 'hook' | 'context' | 'detail' | 'cta';

// ── GridSpec ─────────────────────────────────────────────────────────────────

export interface GridCell {
  insightId: string;
  colSpan: number;
  rowSpan: number;
  minH: number;
}

export interface GridSpec {
  cols: number;
  cells: GridCell[];
}

export interface LayoutHint {
  variant: LayoutVariant;
  arc: NarrativeArc;
  seed: number;
  gridSpec?: GridSpec;
}

// ── Chart weight & min height ─────────────────────────────────────────────────

const CHART_WEIGHT: Record<string, number> = {
  map: 4, heatmap: 3, scatter: 3, 'diverging-bar': 3, 'bar-race': 3,
  'hierarchical-bar': 3, 'stacked-area': 2, radar: 2, candlestick: 2,
  bollinger: 2, treemap: 2, area: 2, line: 2,
  bar: 1, doughnut: 1, pie: 1, funnel: 1, gauge: 1, progress: 1,
};

const CHART_MIN_H_SPEC: Record<string, number> = {
  map: 300, heatmap: 280, scatter: 220, candlestick: 260, 'bar-race': 260,
  'hierarchical-bar': 260, 'diverging-bar': 240, radar: 240, 'stacked-area': 220,
  'radial-stacked-bar': 240, bollinger: 220, treemap: 200,
  bar: 200, area: 200, line: 200, doughnut: 200, pie: 200, progress: 180,
};

function chartWeight(ins: InsightData): number {
  const type = (ins.chartOptions as Record<string, unknown>)?._auroraType as string ?? 'bar';
  return CHART_WEIGHT[type] ?? 1;
}

function chartMinH(ins: InsightData): number {
  const type = (ins.chartOptions as Record<string, unknown>)?._auroraType as string ?? 'bar';
  return CHART_MIN_H_SPEC[type] ?? 200;
}

// ── Row helpers ───────────────────────────────────────────────────────────────

const COLS = 12;

/** N equal-width KPI cells per row, last absorbs remainder */
function kpiRow(kpis: InsightData[], perRow: number): GridCell[] {
  const cells: GridCell[] = [];
  for (let i = 0; i < kpis.length; i += perRow) {
    const row = kpis.slice(i, i + perRow);
    const base = Math.floor(COLS / perRow);
    const rem  = COLS - base * row.length;
    row.forEach((ins, j) =>
      cells.push({ insightId: ins.id, colSpan: j === row.length - 1 ? base + rem : base, rowSpan: 1, minH: 72 })
    );
  }
  return cells;
}

/** Distribute charts in rows of maxPerRow, proportional to weight, always summing to COLS */
function chartRows(charts: InsightData[], minSpan: number, maxPerRow: number): GridCell[] {
  const cells: GridCell[] = [];
  for (let i = 0; i < charts.length; i += maxPerRow) {
    const row = charts.slice(i, i + maxPerRow);
    const tw  = row.reduce((s, c) => s + chartWeight(c), 0);
    let rem   = COLS;
    row.forEach((ins, j) => {
      const isLast = j === row.length - 1;
      const span   = isLast
        ? rem
        : Math.max(minSpan, Math.min(rem - minSpan * (row.length - j - 1),
            Math.round((chartWeight(ins) / tw) * COLS)));
      cells.push({ insightId: ins.id, colSpan: span, rowSpan: 1, minH: chartMinH(ins) + 36 });
      rem -= span;
    });
  }
  return cells;
}

// ── buildGridSpec — arc-specific structures ───────────────────────────────────

export function buildGridSpec(insights: InsightData[], arc: NarrativeArc): GridSpec {
  const cells: GridCell[] = [];

  const hook    = insights.find(i => i.narrativeRole === 'hook');
  const context = insights.filter(i => i.narrativeRole === 'context');
  const detail  = insights.filter(i => i.narrativeRole === 'detail');

  // Header always full width
  cells.push({ insightId: '__header__', colSpan: COLS, rowSpan: 1, minH: 52 });

  switch (arc) {

    case 'trend': {
      // ┌──────────────────────────────────────────────────────┐
      // │           HOOK chart — full width, tall              │
      // ├──────────────────────────────────────────────────────┤
      // │  KPI  │  KPI  │  KPI  │  KPI  (below the hero)      │
      // ├──────────────────────┬───────────────────────────────┤
      // │  detail[0]  (6 cols) │  detail[1]  (6 cols)         │
      // └──────────────────────┴───────────────────────────────┘
      if (hook) cells.push({ insightId: hook.id, colSpan: COLS, rowSpan: 1, minH: chartMinH(hook) + 80 });
      cells.push(...kpiRow(context.slice(0, 4), Math.min(context.length, 4)));
      if (detail.length >= 2) {
        cells.push({ insightId: detail[0].id, colSpan: 6, rowSpan: 1, minH: chartMinH(detail[0]) + 36 });
        cells.push({ insightId: detail[1].id, colSpan: 6, rowSpan: 1, minH: chartMinH(detail[1]) + 36 });
        cells.push(...chartRows(detail.slice(2), 3, 3));
      } else {
        cells.push(...chartRows(detail, 3, 3));
      }
      break;
    }

    case 'comparison': {
      // ┌──────────────────────────────────────────────────────┐
      // │  chart[0]  (7 cols)    │  KPI  │  KPI  (5 cols)      │
      // │                        ├────────┴────────────────────┤
      // │                        │  KPI  │  KPI               │
      // ├────────────────────────┴─────────────────────────────┤
      // │  chart[1] (6) │ chart[2] (6)                         │
      // └──────────────────────────────────────────────────────┘
      const all = hook ? [hook, ...detail] : detail;
      const kpisTop = context.slice(0, 4);
      if (all.length > 0 && kpisTop.length > 0) {
        const kpiCols = Math.floor(COLS / Math.max(kpisTop.length, 1));
        cells.push({ insightId: all[0].id, colSpan: COLS - kpiCols * Math.min(kpisTop.length, 2), rowSpan: Math.ceil(kpisTop.length / 2), minH: chartMinH(all[0]) + 36 });
        kpisTop.forEach(ins => cells.push({ insightId: ins.id, colSpan: kpiCols, rowSpan: 1, minH: 72 }));
        cells.push(...chartRows(all.slice(1), 4, 3));
      } else {
        cells.push(...kpiRow(kpisTop, Math.min(kpisTop.length, 4)));
        cells.push(...chartRows(all, 4, 3));
      }
      break;
    }

    case 'diagnostic': {
      // ┌──────────────────────────────────────────────────────┐
      // │  KPI  │  KPI  │  HOOK chart (8 cols, tall)           │
      // │  KPI  │  KPI  │                                      │
      // ├──────────────────────────────────────────────────────┤
      // │  detail[2..] distributed                             │
      // └──────────────────────────────────────────────────────┘
      const kpisLeft = context.slice(0, 4);
      if (hook && kpisLeft.length > 0) {
        const kpiColSpan = 2;
        cells.push({ insightId: hook.id, colSpan: COLS - kpiColSpan * 2, rowSpan: Math.ceil(kpisLeft.length / 2), minH: chartMinH(hook) + 36 });
        kpisLeft.forEach(ins => cells.push({ insightId: ins.id, colSpan: kpiColSpan, rowSpan: 1, minH: 72 }));
        const sideCharts = detail.filter(d => {
          const t = (d.chartOptions as Record<string, unknown>)?._auroraType as string ?? '';
          return t !== 'progress';
        });
        cells.push(...chartRows(sideCharts, 3, 3));
        const remaining = detail.filter(d => !sideCharts.includes(d));
        cells.push(...chartRows(remaining, 3, 3));
      } else {
        cells.push(...kpiRow(kpisLeft, Math.min(kpisLeft.length, 4)));
        if (hook) cells.push({ insightId: hook.id, colSpan: COLS, rowSpan: 1, minH: chartMinH(hook) + 36 });
        cells.push(...chartRows(detail, 3, 3));
      }
      break;
    }

    case 'ranking': {
      // ┌──────────────────────────────────────────────────────┐
      // │  HOOK chart (9 cols, tall) │  detail[0]  (3 cols)    │
      // │                           │  detail[1]  (3 cols)    │
      // ├──────────────────────────────────────────────────────┤
      // │  KPI  │  KPI  │  KPI  │  KPI  (below)               │
      // ├──────────────────────────────────────────────────────┤
      // │  detail[2..] distributed                             │
      // └──────────────────────────────────────────────────────┘
      if (hook) {
        const sideItems = detail.filter(d => {
          const t = (d.chartOptions as Record<string, unknown>)?._auroraType as string ?? '';
          return t !== 'progress';
        }).slice(0, 2);
        cells.push({ insightId: hook.id, colSpan: 9, rowSpan: Math.max(1, sideItems.length), minH: chartMinH(hook) + 60 });
        sideItems.forEach(ins =>
          cells.push({ insightId: ins.id, colSpan: 3, rowSpan: 1, minH: chartMinH(ins) + 36 })
        );
        cells.push(...kpiRow(context.slice(0, 4), Math.min(context.length, 4)));
        const remaining = detail.filter(d => !sideItems.includes(d));
        cells.push(...chartRows(remaining, 3, 3));
      } else {
        cells.push(...kpiRow(context.slice(0, 4), Math.min(context.length, 4)));
        cells.push(...chartRows(detail, 3, 3));
      }
      break;
    }

    case 'distribution': {
      // ┌──────────────────────────────────────────────────────┐
      // │  HOOK  (7 cols)      │  detail[0]  (5 cols)          │
      // ├──────────────────────┴───────────────────────────────┤
      // │  KPI  │  KPI  │  KPI  │  KPI  (below charts)        │
      // ├──────────────────────────────────────────────────────┤
      // │  detail[1] (4) │ detail[2] (4) │ detail[3] (4)       │
      // └──────────────────────────────────────────────────────┘
      if (hook && detail.length > 0) {
        cells.push({ insightId: hook.id, colSpan: 7, rowSpan: 1, minH: chartMinH(hook) + 36 });
        cells.push({ insightId: detail[0].id, colSpan: 5, rowSpan: 1, minH: chartMinH(detail[0]) + 36 });
        cells.push(...kpiRow(context.slice(0, 4), Math.min(context.length, 4)));
        cells.push(...chartRows(detail.slice(1), 3, 3));
      } else if (hook) {
        cells.push({ insightId: hook.id, colSpan: COLS, rowSpan: 1, minH: chartMinH(hook) + 36 });
        cells.push(...kpiRow(context.slice(0, 4), Math.min(context.length, 4)));
        cells.push(...chartRows(detail, 3, 3));
      } else {
        cells.push(...kpiRow(context.slice(0, 4), Math.min(context.length, 4)));
        cells.push(...chartRows(detail, 3, 3));
      }
      break;
    }

    default: {
      // detail / fallback — KPIs intercalados entre charts
      // ┌──────────────────────────────────────────────────────┐
      // │  chart[0] (8 cols)  │  KPI  │  KPI  (4 cols)        │
      // │                     ├────────┴────────────────────── │
      // │                     │  KPI  │  KPI                  │
      // ├──────────────────────────────────────────────────────┤
      // │  charts distributed by weight, max 3 per row         │
      // └──────────────────────────────────────────────────────┘
      const all = hook ? [hook, ...detail] : detail;
      const kpisRight = context.slice(0, 4);
      if (all.length > 0 && kpisRight.length > 0) {
        cells.push({ insightId: all[0].id, colSpan: 8, rowSpan: Math.ceil(kpisRight.length / 2), minH: chartMinH(all[0]) + 36 });
        kpisRight.forEach(ins => cells.push({ insightId: ins.id, colSpan: 2, rowSpan: 1, minH: 72 }));
        cells.push(...chartRows(all.slice(1), 3, 3));
      } else {
        cells.push(...kpiRow(kpisRight, Math.min(kpisRight.length, 4)));
        cells.push(...chartRows(all, 3, 3));
      }
      break;
    }
  }

  return { cols: COLS, cells };
}

// ── Narrative classification ──────────────────────────────────────────────────

const ARC_KEYWORDS: Record<NarrativeArc, RegExp> = {
  trend:        /tendencia|evoluci[oó]n|mensual|semanal|anual|por\s+mes|por\s+semana|por\s+a[nñ]o|hist[oó]rico|crecimiento|tiempo|serie/i,
  ranking:      /top|ranking|m[aá]s\s+vend|mejor|peor|l[ií]der|primero|mayor|menor|m[aá]ximo|m[ií]nimo/i,
  distribution: /distribuci[oó]n|por\s+categor[ií]a|por\s+estado|participaci[oó]n|proporci[oó]n|reparto|breakdown|desglose/i,
  diagnostic:   /cr[eé]dito|estatus|atrasado|morosidad|riesgo|cartera|salud|vencido|cancelado|liquidado|corriente/i,
  comparison:   /comparar|comparaci[oó]n|vs|versus|diferencia|contra|entre\s+\w+\s+y/i,
  detail:       /tabla|listado|registros|detalle|[uú]ltimas?|muestra|ver\s+todo/i,
};

const HOOK_CHART_TYPES: Record<NarrativeArc, string[]> = {
  trend:        ['area', 'line', 'stacked-area', 'bar-race', 'bollinger'],
  ranking:      ['bar', 'treemap', 'hierarchical-bar', 'radial-stacked-bar'],
  distribution: ['treemap', 'doughnut', 'pie', 'map', 'heatmap'],
  diagnostic:   ['diverging-bar', 'gauge', 'funnel', 'bar'],  // progress removed — too small to be hook
  comparison:   ['scatter', 'radar', 'line', 'area', 'bar'],
  detail:       ['bar', 'treemap', 'heatmap'],
};

function intentSeed(intent: string): number {
  return intent.split('').reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) & 0xffff, 0);
}

export function classifyNarrative(intent: string): NarrativeArc {
  const order: NarrativeArc[] = ['comparison', 'diagnostic', 'detail', 'trend', 'ranking', 'distribution'];
  for (const arc of order) {
    if (ARC_KEYWORDS[arc].test(intent)) return arc;
  }
  return 'distribution';
}

export function reorderByNarrative(insights: InsightData[], arc: NarrativeArc): InsightData[] {
  const hookTypes = HOOK_CHART_TYPES[arc];
  const kpis   = insights.filter(i => !i.chartOptions && !i.listItems);
  const lists  = insights.filter(i => !!i.listItems);
  const charts = insights.filter(i => !!i.chartOptions);

  // Find best hook: prefer chart whose _auroraType matches arc's hook types
  const hookChart = charts.find(c => {
    const type = (c.chartOptions as Record<string, unknown>)?._auroraType as string ?? '';
    return hookTypes.includes(type);
  }) ?? charts[0] ?? null;

  const detailCharts = charts.filter(c => c !== hookChart);

  const withRoles = (arr: InsightData[], role: NarrativeRole): InsightData[] =>
    arr.map(i => ({ ...i, narrativeRole: role }));

  return [
    ...withRoles(hookChart ? [hookChart] : [], 'hook'),
    ...withRoles(kpis, 'context'),
    ...withRoles(detailCharts, 'detail'),
    ...withRoles(lists, 'cta'),
  ];
}

export function selectLayout(insights: InsightData[], intent: string): LayoutHint {
  const seed = intentSeed(intent);
  const arc  = classifyNarrative(intent);

  const kpis   = insights.filter(i => !i.chartOptions && !i.listItems);
  const charts = insights.filter(i => !!i.chartOptions);
  const total  = insights.length;

  if (total <= 2)                              return { variant: 'minimal', arc, seed };
  if (charts.length === 0 && kpis.length >= 1) return { variant: 'focus',   arc, seed };

  const gridSpec = buildGridSpec(insights, arc);
  return { variant: 'procedural', arc, seed, gridSpec };
}

export function seededPick<T>(arr: T[], seed: number, offset = 0): T {
  return arr[(seed + offset) % arr.length];
}
