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
  map: 340, heatmap: 320, scatter: 260, candlestick: 300, 'bar-race': 300,
  'hierarchical-bar': 300, 'diverging-bar': 280, radar: 280, 'stacked-area': 260,
  'radial-stacked-bar': 280, bollinger: 260, treemap: 240,
  bar: 240, area: 240, line: 240, doughnut: 240, pie: 240, progress: 200,
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

// ── buildGridSpec — arc-specific structures with A/B/C schemas ────────────────

export function buildGridSpec(insights: InsightData[], arc: NarrativeArc, seed = 0): GridSpec {
  const cells: GridCell[] = [];

  const hook    = insights.find(i => i.narrativeRole === 'hook');
  const context = insights.filter(i => i.narrativeRole === 'context');
  const detail  = insights.filter(i => i.narrativeRole === 'detail');

  const schema = seed % 3; // 0=A, 1=B, 2=C

  cells.push({ insightId: '__header__', colSpan: COLS, rowSpan: 1, minH: 52 });

  switch (arc) {

    case 'trend': {
      if (schema === 0) {
        // A: Hook full-width tall → KPIs → details 6+6
        if (hook) cells.push({ insightId: hook.id, colSpan: COLS, rowSpan: 1, minH: chartMinH(hook) + 80 });
        cells.push(...kpiRow(context.slice(0, 4), Math.min(context.length, 4)));
        if (detail.length >= 2) {
          cells.push({ insightId: detail[0].id, colSpan: 6, rowSpan: 1, minH: chartMinH(detail[0]) + 36 });
          cells.push({ insightId: detail[1].id, colSpan: 6, rowSpan: 1, minH: chartMinH(detail[1]) + 36 });
          cells.push(...chartRows(detail.slice(2), 3, 3));
        } else {
          cells.push(...chartRows(detail, 3, 3));
        }
      } else if (schema === 1) {
        // B: Hook 8cols + KPIs apilados derecha (4cols) → details abajo
        const kpisRight = context.slice(0, 4);
        if (hook && kpisRight.length > 0) {
          cells.push({ insightId: hook.id, colSpan: 8, rowSpan: Math.ceil(kpisRight.length / 2), minH: chartMinH(hook) + 60 });
          kpisRight.forEach(ins => cells.push({ insightId: ins.id, colSpan: 4, rowSpan: 1, minH: 72 }));
        } else {
          if (hook) cells.push({ insightId: hook.id, colSpan: COLS, rowSpan: 1, minH: chartMinH(hook) + 60 });
          cells.push(...kpiRow(context.slice(0, 4), Math.min(context.length, 4)));
        }
        cells.push(...chartRows(detail, 3, 3));
      } else {
        // C: Hook derecha tall (9cols) + KPIs en columna izq (3cols) → details 4+4+4
        const kpisLeft = context.slice(0, 4);
        if (hook && kpisLeft.length > 0) {
          cells.push({ insightId: hook.id, colSpan: 9, rowSpan: Math.max(2, kpisLeft.length), minH: chartMinH(hook) + 80 });
          kpisLeft.forEach(ins => cells.push({ insightId: ins.id, colSpan: 3, rowSpan: 1, minH: 72 }));
        } else {
          if (hook) cells.push({ insightId: hook.id, colSpan: COLS, rowSpan: 1, minH: chartMinH(hook) + 60 });
          cells.push(...kpiRow(context.slice(0, 4), Math.min(context.length, 4)));
        }
        cells.push(...chartRows(detail, 4, 3));
      }
      break;
    }

    case 'comparison': {
      const all = hook ? [hook, ...detail] : detail;
      const kpisTop = context.slice(0, 4);
      if (schema === 0) {
        // A: Hook 7cols + KPIs apilados derecha → charts abajo
        if (all.length > 0 && kpisTop.length > 0) {
          const kpiCols = Math.floor(COLS / Math.max(kpisTop.length, 1));
          cells.push({ insightId: all[0].id, colSpan: COLS - kpiCols * Math.min(kpisTop.length, 2), rowSpan: Math.ceil(kpisTop.length / 2), minH: chartMinH(all[0]) + 36 });
          kpisTop.forEach(ins => cells.push({ insightId: ins.id, colSpan: kpiCols, rowSpan: 1, minH: 72 }));
          cells.push(...chartRows(all.slice(1), 4, 3));
        } else {
          cells.push(...kpiRow(kpisTop, Math.min(kpisTop.length, 4)));
          cells.push(...chartRows(all, 4, 3));
        }
      } else if (schema === 1) {
        // B: KPIs arriba full-width → 2 charts iguales 6+6 → resto
        cells.push(...kpiRow(kpisTop, Math.min(kpisTop.length, 4)));
        if (all.length >= 2) {
          cells.push({ insightId: all[0].id, colSpan: 6, rowSpan: 1, minH: chartMinH(all[0]) + 36 });
          cells.push({ insightId: all[1].id, colSpan: 6, rowSpan: 1, minH: chartMinH(all[1]) + 36 });
          cells.push(...chartRows(all.slice(2), 3, 3));
        } else {
          cells.push(...chartRows(all, 4, 3));
        }
      } else {
        // C: Hook full-width → detail side-by-side 5+7 → KPIs abajo
        if (all.length > 0) cells.push({ insightId: all[0].id, colSpan: COLS, rowSpan: 1, minH: chartMinH(all[0]) + 60 });
        if (all.length >= 3) {
          cells.push({ insightId: all[1].id, colSpan: 5, rowSpan: 1, minH: chartMinH(all[1]) + 36 });
          cells.push({ insightId: all[2].id, colSpan: 7, rowSpan: 1, minH: chartMinH(all[2]) + 36 });
          cells.push(...chartRows(all.slice(3), 3, 3));
        } else {
          cells.push(...chartRows(all.slice(1), 4, 3));
        }
        cells.push(...kpiRow(kpisTop, Math.min(kpisTop.length, 4)));
      }
      break;
    }

    case 'diagnostic': {
      const kpisLeft = context.slice(0, 4);
      if (schema === 0) {
        // A: Hook derecha (8cols) + KPIs izq apilados (2cols×2) → details abajo
        if (hook && kpisLeft.length > 0) {
          cells.push({ insightId: hook.id, colSpan: COLS - 4, rowSpan: Math.ceil(kpisLeft.length / 2), minH: chartMinH(hook) + 36 });
          kpisLeft.forEach(ins => cells.push({ insightId: ins.id, colSpan: 2, rowSpan: 1, minH: 72 }));
          cells.push(...chartRows(detail, 3, 3));
        } else {
          cells.push(...kpiRow(kpisLeft, Math.min(kpisLeft.length, 4)));
          if (hook) cells.push({ insightId: hook.id, colSpan: COLS, rowSpan: 1, minH: chartMinH(hook) + 36 });
          cells.push(...chartRows(detail, 3, 3));
        }
      } else if (schema === 1) {
        // B: Hook full-width → KPIs → details 3 por fila
        if (hook) cells.push({ insightId: hook.id, colSpan: COLS, rowSpan: 1, minH: chartMinH(hook) + 60 });
        cells.push(...kpiRow(kpisLeft, Math.min(kpisLeft.length, 4)));
        cells.push(...chartRows(detail, 3, 3));
      } else {
        // C: KPIs arriba → Hook 8cols + detail[0] 4cols → resto
        cells.push(...kpiRow(kpisLeft, Math.min(kpisLeft.length, 4)));
        if (hook && detail.length > 0) {
          cells.push({ insightId: hook.id, colSpan: 8, rowSpan: 1, minH: chartMinH(hook) + 36 });
          cells.push({ insightId: detail[0].id, colSpan: 4, rowSpan: 1, minH: chartMinH(detail[0]) + 36 });
          cells.push(...chartRows(detail.slice(1), 3, 3));
        } else {
          if (hook) cells.push({ insightId: hook.id, colSpan: COLS, rowSpan: 1, minH: chartMinH(hook) + 36 });
          cells.push(...chartRows(detail, 3, 3));
        }
      }
      break;
    }

    case 'ranking': {
      if (schema === 0) {
        // A: Hook 9cols + 2 details apilados derecha → KPIs → resto
        if (hook) {
          const sideItems = detail.filter(d => {
            const t = (d.chartOptions as Record<string, unknown>)?._auroraType as string ?? '';
            return t !== 'progress';
          }).slice(0, 2);
          cells.push({ insightId: hook.id, colSpan: 9, rowSpan: Math.max(1, sideItems.length), minH: chartMinH(hook) + 60 });
          sideItems.forEach(ins => cells.push({ insightId: ins.id, colSpan: 3, rowSpan: 1, minH: chartMinH(ins) + 36 }));
          cells.push(...kpiRow(context.slice(0, 4), Math.min(context.length, 4)));
          cells.push(...chartRows(detail.filter(d => !sideItems.includes(d)), 3, 3));
        } else {
          cells.push(...kpiRow(context.slice(0, 4), Math.min(context.length, 4)));
          cells.push(...chartRows(detail, 3, 3));
        }
      } else if (schema === 1) {
        // B: Hook full-width → KPIs en fila → details
        if (hook) cells.push({ insightId: hook.id, colSpan: COLS, rowSpan: 1, minH: chartMinH(hook) + 60 });
        cells.push(...kpiRow(context.slice(0, 4), Math.min(context.length, 4)));
        cells.push(...chartRows(detail, 3, 3));
      } else {
        // C: KPIs arriba → Hook 7cols + detail[0] 5cols → resto abajo
        cells.push(...kpiRow(context.slice(0, 4), Math.min(context.length, 4)));
        if (hook && detail.length > 0) {
          cells.push({ insightId: hook.id, colSpan: 7, rowSpan: 1, minH: chartMinH(hook) + 60 });
          cells.push({ insightId: detail[0].id, colSpan: 5, rowSpan: 1, minH: chartMinH(detail[0]) + 36 });
          cells.push(...chartRows(detail.slice(1), 3, 3));
        } else {
          if (hook) cells.push({ insightId: hook.id, colSpan: COLS, rowSpan: 1, minH: chartMinH(hook) + 60 });
          cells.push(...chartRows(detail, 3, 3));
        }
      }
      break;
    }

    case 'distribution': {
      if (schema === 0) {
        // A: Hook 7cols + detail[0] 5cols → KPIs → resto
        if (hook && detail.length > 0) {
          cells.push({ insightId: hook.id, colSpan: 7, rowSpan: 1, minH: chartMinH(hook) + 36 });
          cells.push({ insightId: detail[0].id, colSpan: 5, rowSpan: 1, minH: chartMinH(detail[0]) + 36 });
          cells.push(...kpiRow(context.slice(0, 4), Math.min(context.length, 4)));
          cells.push(...chartRows(detail.slice(1), 3, 3));
        } else {
          if (hook) cells.push({ insightId: hook.id, colSpan: COLS, rowSpan: 1, minH: chartMinH(hook) + 36 });
          cells.push(...kpiRow(context.slice(0, 4), Math.min(context.length, 4)));
          cells.push(...chartRows(detail, 3, 3));
        }
      } else if (schema === 1) {
        // B: KPIs arriba → Hook grande centro (8cols) + detail[0] (4cols) → resto 4+4+4
        cells.push(...kpiRow(context.slice(0, 4), Math.min(context.length, 4)));
        if (hook && detail.length > 0) {
          cells.push({ insightId: hook.id, colSpan: 8, rowSpan: 1, minH: chartMinH(hook) + 60 });
          cells.push({ insightId: detail[0].id, colSpan: 4, rowSpan: 1, minH: chartMinH(detail[0]) + 36 });
          cells.push(...chartRows(detail.slice(1), 4, 3));
        } else {
          if (hook) cells.push({ insightId: hook.id, colSpan: COLS, rowSpan: 1, minH: chartMinH(hook) + 36 });
          cells.push(...chartRows(detail, 3, 3));
        }
      } else {
        // C: Hook full-width → KPIs → details 3 iguales
        if (hook) cells.push({ insightId: hook.id, colSpan: COLS, rowSpan: 1, minH: chartMinH(hook) + 60 });
        cells.push(...kpiRow(context.slice(0, 4), Math.min(context.length, 4)));
        cells.push(...chartRows(detail, 4, 3));
      }
      break;
    }

    default: {
      const all = hook ? [hook, ...detail] : detail;
      const kpisRight = context.slice(0, 4);
      if (schema === 0) {
        // A: Hook 8cols + KPIs derecha (2cols×2) → charts abajo
        if (all.length > 0 && kpisRight.length > 0) {
          cells.push({ insightId: all[0].id, colSpan: 8, rowSpan: Math.ceil(kpisRight.length / 2), minH: chartMinH(all[0]) + 36 });
          kpisRight.forEach(ins => cells.push({ insightId: ins.id, colSpan: 2, rowSpan: 1, minH: 72 }));
          cells.push(...chartRows(all.slice(1), 3, 3));
        } else {
          cells.push(...kpiRow(kpisRight, Math.min(kpisRight.length, 4)));
          cells.push(...chartRows(all, 3, 3));
        }
      } else if (schema === 1) {
        // B: Hook full-width → KPIs → details
        if (all.length > 0) cells.push({ insightId: all[0].id, colSpan: COLS, rowSpan: 1, minH: chartMinH(all[0]) + 60 });
        cells.push(...kpiRow(kpisRight, Math.min(kpisRight.length, 4)));
        cells.push(...chartRows(all.slice(1), 3, 3));
      } else {
        // C: KPIs arriba → Hook 6cols + detail[0] 6cols → resto
        cells.push(...kpiRow(kpisRight, Math.min(kpisRight.length, 4)));
        if (all.length >= 2) {
          cells.push({ insightId: all[0].id, colSpan: 6, rowSpan: 1, minH: chartMinH(all[0]) + 36 });
          cells.push({ insightId: all[1].id, colSpan: 6, rowSpan: 1, minH: chartMinH(all[1]) + 36 });
          cells.push(...chartRows(all.slice(2), 3, 3));
        } else {
          cells.push(...chartRows(all, 3, 3));
        }
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
  diagnostic:   ['diverging-bar', 'gauge', 'funnel', 'bar'],
  comparison:   ['scatter', 'radar', 'line', 'area', 'bar'],
  detail:       ['bar', 'treemap', 'heatmap'],
};

function intentSeed(intent: string): number {
  // Use a better hash that's more sensitive to small variations
  let h = 0x811c9dc5;
  for (let i = 0; i < intent.length; i++) {
    h ^= intent.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h;
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

  const gridSpec = buildGridSpec(insights, arc, seed);
  return { variant: 'procedural', arc, seed, gridSpec };
}

export function seededPick<T>(arr: T[], seed: number, offset = 0): T {
  return arr[(seed + offset) % arr.length];
}
