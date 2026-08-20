/**
 * chart-decision.ts
 *
 * Modelo de decisión analítico para selección de chart type.
 * Lógica: objetivo × dimensiones × cardinalidad.
 *
 * Dimensión de análisis = lo que se quiere visualizar (se pierde el análisis si se elimina)
 * Filtro = limita el dataset pero NO es la dimensión principal
 */

// ─── Types ────────────────────────────────────────────────────

export type ChartObjective =
  | 'tendencia'
  | 'comparacion'
  | 'distribucion_geografica'
  | 'relacion'
  | 'participacion'
  | 'ranking';

export interface ChartDimensions {
  hasTiempo: boolean;
  hasEstado: boolean;
  hasProducto: boolean;
  extraDimensions: number;
}

export interface ChartDecision {
  chartType: string;
  objective: ChartObjective;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

// ─── Keyword maps ─────────────────────────────────────────────

const OBJECTIVE_KEYWORDS: Record<ChartObjective, RegExp> = {
  tendencia:
    /evoluci[oó]n|tendencia|crecimiento|hist[oó]rico|este\s+mes|este\s+a[ñn]o|semanal|mensual|diario|por\s+mes|por\s+semana|por\s+d[ií]a|por\s+a[ñn]o|a\s+lo\s+largo|en\s+el\s+tiempo/i,
  comparacion:
    /compar|contra|top\s+\d|mejor|peor|versus|vs\.?|mayor|menor|ranking|m[aá]s\s+vend|menos\s+vend|l[ií]der|ganador/i,
  distribucion_geografica:
    /por\s+estado|d[oó]nde|regi[oó]n|zona|ubicaci[oó]n|mapa|geogr[aá]f/i,
  relacion:
    /relaci[oó]n|afecta|dependencia|conexi[oó]n|correlaci[oó]n|influye|impacto/i,
  participacion:
    /participaci[oó]n|distribuci[oó]n|proporci[oó]n|porcentaje|parte\s+del\s+total|composici[oó]n|breakdown/i,
  ranking:
    /ranking|top\s+\d|mejores|peores|primeros|[uú]ltimos|m[aá]s\s+vendidos|menos\s+vendidos/i,
};

const TIEMPO_KEYWORDS =
  /por\s+(d[ií]a|semana|mes|a[ñn]o)|semanal|mensual|diario|anual|este\s+mes|este\s+a[ñn]o|mes\s+pasado|a[ñn]o\s+pasado|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|fecha|tiempo|periodo/i;

const ESTADO_KEYWORDS =
  /por\s+estado|jalisco|nuevo\s+le[oó]n|cdmx|ciudad\s+de\s+m[eé]xico|veracruz|puebla|guanajuato|chihuahua|sonora|yucat[aá]n|quintana\s+roo|estado|regi[oó]n|zona/i;

const PRODUCTO_KEYWORDS =
  /moto|celular|bicicleta|pantalla|tablet|consola|audio|accesorio|climatizaci[oó]n|categor[ií]a|producto|tipo\s+de\s+venta|cr[eé]dito|contado/i;

// ─── Dimension detector ───────────────────────────────────────

export function detectDimensions(
  intent: string,
  groupBy?: string | null,
): ChartDimensions {
  const hasTiempo =
    TIEMPO_KEYWORDS.test(intent) ||
    groupBy === 'mes' ||
    groupBy === 'fecha_venta';
  const hasEstado =
    ESTADO_KEYWORDS.test(intent) || groupBy === 'estado';
  const hasProducto =
    PRODUCTO_KEYWORDS.test(intent) ||
    groupBy === 'categoria' ||
    groupBy === 'producto';

  const count = [hasTiempo, hasEstado, hasProducto].filter(Boolean).length;
  const extraDimensions = Math.max(0, count - 1);

  return { hasTiempo, hasEstado, hasProducto, extraDimensions };
}

// ─── Objective detector ───────────────────────────────────────

export function detectObjective(intent: string): ChartObjective {
  for (const [objective, pattern] of Object.entries(OBJECTIVE_KEYWORDS)) {
    if (pattern.test(intent)) return objective as ChartObjective;
  }
  if (TIEMPO_KEYWORDS.test(intent)) return 'tendencia';
  if (ESTADO_KEYWORDS.test(intent)) return 'distribucion_geografica';
  return 'comparacion';
}

// ─── Explicit chart request detector ─────────────────────────

function detectExplicitChartRequest(intent: string): string | null {
  const lower = intent.toLowerCase();
  if (/pastel|pie\s+chart|gr[aá]fica\s+de\s+pastel/.test(lower)) return 'pie';
  if (/dona|donut|doughnut/.test(lower)) return 'doughnut';
  if (/l[ií]nea|line\s+chart|gr[aá]fica\s+de\s+l[ií]nea/.test(lower)) return 'line';
  if (/[aá]rea\s+apilada|stacked.area/.test(lower)) return 'stacked-area';
  if (/divergen|diverging/.test(lower)) return 'diverging-bar';
  if (/radial|polar|nightingale/.test(lower)) return 'radial-stacked-bar';
  if (/jer[aá]rquic|drill.?down|hierarchical|treemap/.test(lower)) return 'hierarchical-bar';
  if (/carrera|bar.?race|animad/.test(lower)) return 'bar-race';
  if (/vela|candlestick|ohlc/.test(lower)) return 'candlestick';
  if (/bollinger|banda/.test(lower)) return 'bollinger';
  if (/heatmap|calor/.test(lower)) return 'stacked-area'; // fallback: heatmap → stacked-area
  if (/barra|bar\s+chart|columna/.test(lower)) return 'bar';
  if (/[aá]rea/.test(lower)) return 'area';
  return null;
}

// ─── Decision tree ────────────────────────────────────────────
//
// Prioridades según el modelo:
//
// 1 dimensión producto/tipo  → bar (o radial-stacked-bar para ranking)
// 1 dimensión temporal       → area o line
// 1 dimensión estado         → bar (mapa no disponible aún)
// Producto + tiempo          → stacked-area
// Producto + estado          → bar (heatmap cuando esté disponible)
// Estado + tiempo            → area (línea por estado)
// 3+ dimensiones             → stacked-area o hierarchical-bar
// Participación              → hierarchical-bar (treemap) o doughnut
// Ranking                    → radial-stacked-bar o bar

export function selectChartType(
  intent: string,
  groupBy?: string | null,
  currentChartType?: string | null,
): ChartDecision {
  const dims = detectDimensions(intent, groupBy);
  const objective = detectObjective(intent);

  // Respetar siempre lo que el usuario pidió explícitamente
  const explicit = detectExplicitChartRequest(intent);
  if (explicit) {
    return {
      chartType: explicit,
      objective,
      confidence: 'high',
      reason: 'Usuario especificó el tipo de gráfica explícitamente',
    };
  }

  // ─── Árbol de decisión ────────────────────────────────────

  switch (objective) {

    case 'tendencia': {
      // Producto + tiempo → área apilada (ver evolución por categoría)
      if (dims.hasProducto && dims.hasTiempo && !dims.hasEstado) {
        return {
          chartType: 'stacked-area',
          objective,
          confidence: 'high',
          reason: 'Producto + tiempo → área apilada',
        };
      }
      // Solo tiempo (o tiempo + estado como filtro) → área
      return {
        chartType: 'area',
        objective,
        confidence: 'high',
        reason: 'Tendencia temporal → área',
      };
    }

    case 'distribucion_geografica': {
      // Estado + producto → barras agrupadas (heatmap cuando esté disponible)
      if (dims.hasProducto) {
        return {
          chartType: 'bar',
          objective,
          confidence: 'medium',
          reason: 'Estado + producto → barras (heatmap pendiente)',
        };
      }
      // Solo estado → barras por estado (mapa pendiente)
      return {
        chartType: 'bar',
        objective,
        confidence: 'medium',
        reason: 'Distribución geográfica → barras por estado (mapa pendiente)',
      };
    }

    case 'comparacion': {
      // 3+ dimensiones → barras
      if (dims.extraDimensions >= 2) {
        return {
          chartType: 'bar',
          objective,
          confidence: 'high',
          reason: '3+ dimensiones → barras para comparación clara',
        };
      }
      // Producto + estado → barras agrupadas
      if (dims.hasProducto && dims.hasEstado) {
        return {
          chartType: 'bar',
          objective,
          confidence: 'high',
          reason: 'Producto + estado → barras agrupadas',
        };
      }
      // Solo producto o tipo de venta → barras
      return {
        chartType: 'bar',
        objective,
        confidence: 'high',
        reason: 'Comparación → barras',
      };
    }

    case 'ranking': {
      // Ranking → polar bar (radial) o barras ordenadas
      return {
        chartType: 'radial-stacked-bar',
        objective,
        confidence: 'high',
        reason: 'Ranking → polar bar (Nightingale)',
      };
    }

    case 'participacion': {
      // Producto + tiempo → área apilada
      if (dims.hasProducto && dims.hasTiempo) {
        return {
          chartType: 'stacked-area',
          objective,
          confidence: 'high',
          reason: 'Participación en el tiempo → área apilada',
        };
      }
      // Múltiples dimensiones → treemap (hierarchical-bar)
      if (dims.extraDimensions >= 1) {
        return {
          chartType: 'hierarchical-bar',
          objective,
          confidence: 'medium',
          reason: 'Participación con múltiples dimensiones → treemap',
        };
      }
      // Simple → dona
      return {
        chartType: 'doughnut',
        objective,
        confidence: 'high',
        reason: 'Participación simple → dona',
      };
    }

    case 'relacion': {
      // Producto + estado → barras (heatmap pendiente)
      if (dims.hasEstado && dims.hasProducto) {
        return {
          chartType: 'bar',
          objective,
          confidence: 'medium',
          reason: 'Relación producto-estado → heatmap (fallback: barras)',
        };
      }
      return {
        chartType: 'line',
        objective,
        confidence: 'medium',
        reason: 'Relación entre variables → línea',
      };
    }
  }
}

// ─── System prompt snippet ────────────────────────────────────

export const CHART_DECISION_PROMPT = `
MODELO DE DECISIÓN ANALÍTICO PARA SELECCIÓN DE GRÁFICA:

MÉTRICAS: Ventas (conteo), Monto (suma), Promedio, etc.

DIMENSIONES DE ANÁLISIS (lo que se quiere visualizar):
- TIEMPO: día, semana, mes, año
- PRODUCTO: categoría, tipo de venta (crédito/contado)
- ESTADO: entidad federativa

FILTROS (limitan datos pero NO son la dimensión principal):
- Un estado específico mencionado = filtro, no dimensión
- Una categoría específica mencionada = filtro, no dimensión

REGLAS DE SELECCIÓN:
- 1 dimensión temporal → area o line
- 1 dimensión estado (como análisis) → bar por estado
- 1 dimensión producto/tipo → bar o radial-stacked-bar
- Producto + tiempo → stacked-area (área apilada)
- Producto + estado → bar agrupado (heatmap pendiente)
- Participación/distribución → doughnut (≤5 categorías) o hierarchical-bar
- Ranking/top N → radial-stacked-bar o bar ordenado
- 3+ dimensiones → stacked-area o hierarchical-bar

IMPORTANTE: Si el usuario menciona un estado específico (ej: "en Yucatán"),
ese estado es un FILTRO, no la dimensión de análisis.
La dimensión de análisis es lo que varía en el eje X/Y de la gráfica.
`;
