/**
 * chart-decision.ts
 *
 * Modelo de decisión analítico para selección de chart type.
 * Matriz: objetivo × dimensiones × cardinalidad × modo (single/multi/temporal).
 */

// ─── Types ────────────────────────────────────────────────────

export type ChartObjective =
  | 'tendencia'
  | 'comparacion'
  | 'comparacion_temporal'
  | 'distribucion_geografica'
  | 'relacion'
  | 'participacion'
  | 'participacion_temporal'
  | 'ranking'
  | 'ranking_temporal'
  | 'conversion'
  | 'desempeno'
  | 'correlacion'
  | 'salud_credito'
  | 'jerarquia'
  | 'volatilidad'
  | 'flujo'
  | 'estacionalidad'
  | 'dispersion_distribucion'
  | 'composicion_temporal';

export interface ChartDimensions {
  hasTiempo: boolean;
  hasEstado: boolean;
  hasProducto: boolean;
  isMultiSerie: boolean;
  extraDimensions: number;
}

export interface ChartDecision {
  chartType: string;
  objective: ChartObjective;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  multiDataset: boolean;
}

// ─── Keyword maps ─────────────────────────────────────────────

const OBJECTIVE_KEYWORDS: Partial<Record<ChartObjective, RegExp>> = {
  tendencia:
    /evoluci[oó]n|tendencia|crecimiento|hist[oó]rico|a\s+lo\s+largo|en\s+el\s+tiempo|c[oó]mo\s+ha\s+(ido|cambiado|variado)/i,
  comparacion:
    /compar|contra|versus|vs\.?|diferencia\s+entre|cu[aá]l\s+(es\s+m[aá]s|tiene\s+m[aá]s)|mejor|peor|ganador|l[ií]der/i,
  distribucion_geografica:
    /por\s+estado|d[oó]nde|regi[oó]n|zona|ubicaci[oó]n|mapa|geogr[aá]f|en\s+qu[eé]\s+estado|cobertura|presencia|alcance\s+geogr|estados?\s+de\s+m[eé]xico|entidad|municipio/i,
  participacion:
    /participaci[oó]n|distribuci[oó]n|proporci[oó]n|porcentaje|parte\s+del\s+total|composici[oó]n|breakdown|cu[aá]nto\s+representa/i,
  ranking:
    /ranking|top\s+\d|mejores|peores|primeros|[uú]ltimos|m[aá]s\s+vendidos|menos\s+vendidos|mayor\s+venta|menor\s+venta/i,
  conversion:
    /embudo|funnel|conversi[oó]n|etapa|paso|proceso|flujo|pipeline/i,
  desempeno:
    /gauge|medidor|veloc[ií]metro|indicador\s+de\s+meta|cumplimiento|porcentaje\s+de\s+meta|kpi\s+circular|qu[eé]\s+tan\s+bien/i,
  correlacion:
    /correlaci[oó]n|scatter|dispersi[oó]n|relaci[oó]n\s+entre|precio\s+vs|monto\s+vs|edad\s+vs|a\s+mayor|a\s+menor/i,
  salud_credito:
    /salud|cartera|morosidad|riesgo|divergen|positivo\s+vs\s+negativo|bien\s+vs\s+mal/i,
  jerarquia:
    /jer[aá]rquic|drill.?down|hierarchical|desglose|nivel|subcategor[ií]a|dentro\s+de/i,
  volatilidad:
    /bollinger|banda|volatilidad|desviaci[oó]n|vela|candlestick|ohlc/i,
  flujo:
    /flujo|sankey|de\s+d[oó]nde\s+viene|c[oó]mo\s+llega|canal.*categor|categor.*canal|origen.*destino|destino.*origen/i,
  estacionalidad:
    /calendario|por\s+d[ií]a|d[ií]as\s+de\s+la\s+semana|estacional|d[ií]a\s+del\s+mes|calor\s+por\s+d[ií]a|actividad\s+diaria/i,
  dispersion_distribucion:
    /boxplot|caja\s+y\s+bigote|distribuci[oó]n\s+de\s+precios|dispersi[oó]n\s+de\s+montos|rango\s+de\s+precios|outlier|valor\s+at[ií]pico/i,
  composicion_temporal:
    /theme.?river|r[ií]o\s+tem[aá]tico|flujo\s+temporal|evoluci[oó]n\s+de\s+la\s+composici[oó]n|c[oó]mo\s+cambia\s+la\s+mezcla/i,
  relacion:
    /relaci[oó]n|afecta|dependencia|conexi[oó]n|influye|impacto/i,
};

const TIEMPO_KEYWORDS =
  /por\s+(d[ií]a|semana|mes|a[ñn]o)|semanal|mensual|diario|anual|este\s+mes|este\s+a[ñn]o|mes\s+pasado|a[ñn]o\s+pasado|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|fecha|tiempo|periodo|hist[oó]rico|evoluci[oó]n|tendencia|crecimiento/i;

const ESTADO_KEYWORDS =
  /por\s+estado|jalisco|nuevo\s+le[oó]n|cdmx|ciudad\s+de\s+m[eé]xico|veracruz|puebla|guanajuato|chihuahua|sonora|yucat[aá]n|quintana\s+roo|estado|regi[oó]n|zona|aguascalientes|baja\s+california|campeche|chiapas|coahuila|colima|durango|guerrero|hidalgo|michoac[aá]n|morelos|nayarit|oaxaca|quer[eé]taro|san\s+luis|sinaloa|tabasco|tamaulipas|tlaxcala|zacatecas/i;

const PRODUCTO_KEYWORDS =
  /moto|celular|bicicleta|pantalla|tablet|consola|audio|accesorio|climatizaci[oó]n|categor[ií]a|producto/i;

const RANKING_TEMPORAL_KEYWORDS =
  /evoluci[oó]n\s+del\s+ranking|c[oó]mo\s+ha\s+cambiado\s+el\s+ranking|ranking\s+a\s+lo\s+largo|carrera|animad/i;

// Intents que claramente piden análisis geográfico sin otra dimensión
const MAP_STRONG_KEYWORDS =
  /ventas?\s+por\s+estado|distribuci[oó]n\s+(geogr[aá]f|por\s+estado)|mapa\s+de\s+ventas|cobertura\s+por\s+estado|presencia\s+en\s+estados|en\s+qu[eé]\s+estados?|por\s+entidad|alcance\s+geogr[aá]f|estados?\s+con\s+m[aá]s|estados?\s+con\s+menos|ranking\s+de\s+estados/i;

// ─── Dimension detector ───────────────────────────────────────

export function detectDimensions(
  intent: string,
  groupBy?: string | null,
  filters?: Record<string, unknown>,
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

  const filterCategoria = filters?.categoria;
  const filterEstado = filters?.estado;
  const isMultiSerie =
    (Array.isArray(filterCategoria) && filterCategoria.length > 1) ||
    (Array.isArray(filterEstado) && filterEstado.length > 1);

  const count = [hasTiempo, hasEstado, hasProducto].filter(Boolean).length;
  const extraDimensions = Math.max(0, count - 1);

  return { hasTiempo, hasEstado, hasProducto, isMultiSerie, extraDimensions };
}

// ─── Objective detector ───────────────────────────────────────

export function detectObjective(
  intent: string,
  dims: ChartDimensions,
): ChartObjective {
  if (dims.isMultiSerie && dims.hasTiempo) return 'comparacion_temporal';
  if (dims.isMultiSerie) return 'comparacion';

  for (const [objective, pattern] of Object.entries(OBJECTIVE_KEYWORDS)) {
    if (pattern && pattern.test(intent)) return objective as ChartObjective;
  }

  if (dims.hasTiempo && dims.hasProducto) return 'composicion_temporal';
  if (dims.hasTiempo) return 'tendencia';
  if (dims.hasEstado && dims.hasProducto) return 'distribucion_geografica';
  if (dims.hasEstado) return 'distribucion_geografica';
  if (dims.hasProducto) return 'comparacion';
  return 'comparacion';
}

// ─── Explicit chart request detector ─────────────────────────

function detectExplicitChartRequest(intent: string): string | null {
  const lower = intent.toLowerCase();
  if (/sankey|flujo|de\s+d[oó]nde\s+viene|canal.*categor/i.test(lower)) return 'sankey';
  if (/calendario|calor\s+por\s+d[ií]a|estacional|actividad\s+diaria/i.test(lower)) return 'calendar-heatmap';
  if (/sunburst|sol|jerarqu[ií]a\s+circular|drill.?down\s+circular/i.test(lower)) return 'sunburst';
  if (/boxplot|caja\s+y\s+bigote|distribuci[oó]n\s+de\s+precios/i.test(lower)) return 'boxplot';
  if (/theme.?river|r[ií]o\s+tem[aá]tico|evoluci[oó]n\s+de\s+la\s+composici[oó]n/i.test(lower)) return 'theme-river';
  if (/pastel|pie\s+chart|gr[aá]fica\s+de\s+pastel/.test(lower)) return 'pie';
  if (/dona|donut|doughnut/.test(lower)) return 'doughnut';
  if (/l[ií]nea|line\s+chart|gr[aá]fica\s+de\s+l[ií]nea/.test(lower)) return 'line';
  if (/[aá]rea\s+apilada|stacked.area/.test(lower)) return 'stacked-area';
  if (/divergen|diverging/.test(lower)) return 'diverging-bar';
  if (/radial|polar|nightingale/.test(lower)) return 'radial-stacked-bar';
  if (/jer[aá]rquic|drill.?down|hierarchical/.test(lower)) return 'hierarchical-bar';
  if (/treemap|mapa\s+de\s+[aá]rbol|cuadros/.test(lower)) return 'treemap';
  if (/carrera|bar.?race|animad/.test(lower)) return 'bar-race';
  if (/vela|candlestick|ohlc/.test(lower)) return 'candlestick';
  if (/bollinger|banda/.test(lower)) return 'bollinger';
  if (/heatmap|mapa\s+de\s+calor/.test(lower)) return 'heatmap';
  if (/embudo|funnel|conversi[oó]n/.test(lower)) return 'funnel';
  if (/gauge|medidor|veloc[ií]metro/.test(lower)) return 'gauge';
  if (/scatter|dispersi[oó]n|nube\s+de\s+puntos/.test(lower)) return 'scatter';
  if (/radar|ara[ñn]a|tela\s+de\s+ara[ñn]a/.test(lower)) return 'radar';
  if (/barra|bar\s+chart|columna/.test(lower)) return 'bar';
  if (/[aá]rea/.test(lower)) return 'area';
  return null;
}

// ─── Cardinality limits ──────────────────────────────────────

const CARDINALITY_LIMITS: Record<string, { max: number; fallback: string }> = {
  pie:      { max: 6,  fallback: 'bar' },
  doughnut: { max: 6,  fallback: 'bar' },
  radar:    { max: 8,  fallback: 'bar' },
  funnel:   { max: 10, fallback: 'bar' },
};

// Chart types that require specific data structures
const CHART_DATA_REQUIREMENTS: Record<string, { needsTwoNumeric?: boolean; needsTime?: boolean; needsGeo?: boolean; needsOHLC?: boolean; needsSequential?: boolean }> = {
  scatter:          { needsTwoNumeric: true },
  candlestick:      { needsOHLC: true },
  bollinger:        { needsTime: true },
  map:              { needsGeo: true },
  'bar-race':       { needsTime: true },
  'stacked-area':   { needsTime: true },
  'theme-river':    { needsTime: true },
  'calendar-heatmap': { needsTime: true },
  'sankey':         { needsTwoNumeric: false },
};

/**
 * Post-Bedrock deterministic validator.
 * Implements Rules A–J from the chart selection framework.
 * Returns ALLOW, MODIFY (with new chartType), or FALLBACK.
 */
export function validateChartDecision(
  proposedChart: string,
  intent: string,
  groupBy: string | null | undefined,
  filters: Record<string, unknown> | undefined,
  labelCount?: number,
): { action: 'allow' | 'modify' | 'fallback'; chartType: string; reason: string } {
  const dims = detectDimensions(intent, groupBy, filters);

  // Rule E — chart requires data structure not available
  const req = CHART_DATA_REQUIREMENTS[proposedChart];
  if (req) {
    if (req.needsTwoNumeric && !dims.hasProducto && !dims.hasTiempo) {
      return { action: 'modify', chartType: 'bar', reason: 'Scatter requiere 2 variables numéricas — fallback a bar' };
    }
    if (req.needsOHLC) {
      const hasOHLC = /precio|monto|venta|financiad|contado/i.test(intent);
      if (!hasOHLC) return { action: 'modify', chartType: 'line', reason: 'Candlestick requiere OHLC — fallback a line' };
    }
    if (req.needsGeo && !dims.hasEstado && groupBy !== 'estado') {
      return { action: 'modify', chartType: 'bar', reason: 'Map requiere dimensión geográfica — fallback a bar' };
    }
    if (req.needsTime && !dims.hasTiempo && groupBy !== 'fecha_venta') {
      return { action: 'modify', chartType: 'bar', reason: `${proposedChart} requiere dimensión temporal — fallback a bar` };
    }
  }

  // Rule F — cardinality limits
  const limit = CARDINALITY_LIMITS[proposedChart];
  if (limit && labelCount !== undefined && labelCount > limit.max) {
    return { action: 'modify', chartType: limit.fallback, reason: `${proposedChart} con ${labelCount} categorías supera límite de ${limit.max} — fallback a ${limit.fallback}` };
  }

  // Rule: map with single estado filter is useless
  if (proposedChart === 'map' && filters?.estado && !Array.isArray(filters.estado)) {
    return { action: 'modify', chartType: 'bar', reason: 'Map con filtro de estado único — fallback a bar por ciudad/categoría' };
  }

  // Rule: ranking intent → prefer bar over map unless explicitly geographic
  if (proposedChart === 'map' && OBJECTIVE_KEYWORDS.ranking?.test(intent) && !dims.hasEstado) {
    return { action: 'modify', chartType: 'bar', reason: 'Ranking sin dimensión geográfica — bar es más claro que map' };
  }

  // Rule: stacked-area needs ≥2 series
  if (proposedChart === 'stacked-area' && !dims.isMultiSerie && !dims.hasProducto) {
    return { action: 'modify', chartType: 'area', reason: 'stacked-area con 1 serie — degradar a area' };
  }

  // Rule: pie/doughnut for temporal data is wrong
  if ((proposedChart === 'pie' || proposedChart === 'doughnut') && dims.hasTiempo && !dims.hasProducto) {
    return { action: 'modify', chartType: 'line', reason: 'Pie/doughnut con datos temporales — usar line' };
  }

  // Rule: gauge only for single percentage/rate KPI
  if (proposedChart === 'gauge' && dims.hasEstado && groupBy === 'estado') {
    return { action: 'modify', chartType: 'bar', reason: 'Gauge no aplica para comparación por estado — usar bar' };
  }

  return { action: 'allow', chartType: proposedChart, reason: 'Validación OK' };
}

export function selectChartType(
  intent: string,
  groupBy?: string | null,
  currentChartType?: string | null,
  filters?: Record<string, unknown>,
): ChartDecision {
  const dims = detectDimensions(intent, groupBy, filters);
  const objective = detectObjective(intent, dims);

  // 1. Explicit user request always wins
  const explicit = detectExplicitChartRequest(intent);
  if (explicit) {
    return { chartType: explicit, objective, confidence: 'high', reason: 'Usuario especificó el tipo explícitamente', multiDataset: false };
  }

  switch (objective) {

    case 'comparacion_temporal':
      return { chartType: 'line', objective, confidence: 'high', reason: 'Multi-serie + tiempo → líneas', multiDataset: true };

    case 'comparacion': {
      if (dims.extraDimensions >= 2 || (!dims.isMultiSerie && dims.hasProducto && dims.hasEstado && dims.hasTiempo))
        return { chartType: 'radar', objective, confidence: 'medium', reason: '3+ dimensiones → radar', multiDataset: false };
      if (dims.hasProducto && dims.hasEstado)
        return { chartType: 'bar', objective, confidence: 'high', reason: 'Producto + estado → barras agrupadas', multiDataset: true };
      if (dims.isMultiSerie)
        return { chartType: 'scatter', objective, confidence: 'high', reason: 'Comparación multi-serie → scatter precio vs plazo + charts secundarios', multiDataset: true };
      return { chartType: 'bar', objective, confidence: 'high', reason: 'Comparación → barras', multiDataset: false };
    }

    case 'tendencia':
      return { chartType: 'area', objective, confidence: 'high', reason: 'Tendencia temporal → área', multiDataset: false };

    case 'participacion_temporal': {
      // If filtered to a single categoria or single estado, there's only 1 series → use area
      const singleFilter = (filters?.categoria && !Array.isArray(filters.categoria)) ||
                           (filters?.estado && !Array.isArray(filters.estado));
      if (singleFilter)
        return { chartType: 'area', objective, confidence: 'high', reason: 'Participación temporal con filtro único → área simple', multiDataset: false };
      return { chartType: 'stacked-area', objective, confidence: 'high', reason: 'Participación temporal → área apilada', multiDataset: false };
    }

    case 'composicion_temporal': {
      const singleFilter2 = (filters?.categoria && !Array.isArray(filters.categoria)) ||
                            (filters?.estado && !Array.isArray(filters.estado));
      if (singleFilter2)
        return { chartType: 'area', objective, confidence: 'high', reason: 'Composición temporal con filtro único → área simple', multiDataset: false };
      return { chartType: 'theme-river', objective, confidence: 'high', reason: 'Composición temporal multi-serie → theme river', multiDataset: false };
    }

    case 'participacion': {
      if (dims.hasProducto && dims.hasTiempo)
        return { chartType: 'stacked-area', objective, confidence: 'high', reason: 'Participación en el tiempo → área apilada', multiDataset: false };
      if (dims.extraDimensions >= 1)
        return { chartType: 'treemap', objective, confidence: 'high', reason: 'Participación multi-dim → treemap', multiDataset: false };
      return { chartType: 'doughnut', objective, confidence: 'high', reason: 'Participación simple → dona', multiDataset: false };
    }

    case 'distribucion_geografica': {
      // Con producto → mapa principal (distribución geográfica filtrada por producto)
      // El heatmap queda como chart secundario en el dashboard
      if (dims.hasTiempo)
        return { chartType: 'area', objective, confidence: 'high', reason: 'Estado + tiempo → área temporal', multiDataset: false };
      return { chartType: 'map', objective, confidence: 'high', reason: 'Distribución geográfica → mapa coroplético', multiDataset: false };
    }

    case 'ranking': {
      // groupBy=estado sin producto → mapa (ranking geográfico)
      if ((groupBy === 'estado' || MAP_STRONG_KEYWORDS.test(intent)) && !dims.hasProducto && !dims.hasTiempo)
        return { chartType: 'map', objective, confidence: 'high', reason: 'Ranking geográfico por estado → mapa', multiDataset: false };
      if (RANKING_TEMPORAL_KEYWORDS.test(intent) || (dims.hasTiempo && dims.hasProducto))
        return { chartType: 'bar-race', objective, confidence: 'high', reason: 'Ranking + tiempo → bar-race', multiDataset: false };
      return { chartType: 'bar', objective, confidence: 'high', reason: 'Ranking → barras ordenadas', multiDataset: false };
    }

    case 'ranking_temporal':
      return { chartType: 'bar-race', objective, confidence: 'high', reason: 'Ranking temporal → bar-race', multiDataset: false };

    case 'salud_credito':
      return { chartType: 'diverging-bar', objective, confidence: 'high', reason: 'Salud crediticia → barras divergentes', multiDataset: false };

    case 'flujo':
      return { chartType: 'sankey', objective, confidence: 'high', reason: 'Flujo entre dimensiones → sankey', multiDataset: false };

    case 'estacionalidad':
      return { chartType: 'calendar-heatmap', objective, confidence: 'high', reason: 'Actividad diaria/estacional → calendar heatmap', multiDataset: false };

    case 'dispersion_distribucion':
      return { chartType: 'boxplot', objective, confidence: 'high', reason: 'Distribución de valores → boxplot', multiDataset: false };

    case 'jerarquia':
      return { chartType: 'hierarchical-bar', objective, confidence: 'high', reason: 'Jerarquía → barras jerárquicas', multiDataset: false };

    case 'correlacion':
      return { chartType: 'scatter', objective, confidence: 'high', reason: 'Correlación → scatter', multiDataset: false };

    case 'relacion': {
      if (dims.hasEstado && dims.hasProducto)
        return { chartType: 'heatmap', objective, confidence: 'high', reason: 'Relación producto-estado → heatmap', multiDataset: false };
      return { chartType: 'scatter', objective, confidence: 'medium', reason: 'Relación entre variables → scatter', multiDataset: false };
    }

    case 'conversion':
      return { chartType: 'funnel', objective, confidence: 'high', reason: 'Embudo → funnel', multiDataset: false };

    case 'desempeno':
      return { chartType: 'gauge', objective, confidence: 'high', reason: 'KPI único → gauge', multiDataset: false };

    case 'volatilidad':
      return /vela|candlestick|ohlc/i.test(intent)
        ? { chartType: 'candlestick', objective, confidence: 'high', reason: 'OHLC → candlestick', multiDataset: false }
        : { chartType: 'bollinger', objective, confidence: 'high', reason: 'Volatilidad → bollinger', multiDataset: false };
  }
}

// ─── System prompt snippet ────────────────────────────────────

export const CHART_DECISION_PROMPT = `
MODELO DE DECISION PARA SELECCION DE GRAFICA — REGLAS MAESTRAS:

PRIORIDAD 0 — REGLA MAESTRA:
El tipo de chart se determina por la INTENCION ANALITICA y la ESTRUCTURA DE DATOS, NO por palabras aisladas.
Nunca seleccionar un chart solo porque una palabra clave aparece en el prompt.
Nunca inventar dimensiones, categorias, valores o jerarquias que no existan en los datos.

MATRIZ DE DECISION (intencion -> chart):
- Comparar categorias / ranking                  -> bar (vertical <=8 items, horizontal >8, ordenado mayor->menor)
- Evolucion temporal (>3 puntos)                 -> line
- Tendencia temporal + volumen/acumulado         -> area
- Composicion de un total (<=6 items)            -> doughnut
- Composicion de un total (>6 items)             -> treemap
- Correlacion entre 2 variables numericas        -> scatter
- Comparar multiples metricas de varias entidades -> radar (min 3, max 8 metricas)
- Conversion entre etapas secuenciales           -> funnel
- KPI unico / % de cumplimiento                  -> gauge
- Distribucion en 2 dimensiones                  -> heatmap
- Progreso porcentual de varias categorias       -> ProgressGroup
- Composicion jerarquica                         -> treemap
- Datos financieros OHLC                         -> candlestick
- Distribucion geografica por estado             -> map
- Ranking geografico (top estados)               -> bar (NO map)
- Participacion temporal multi-serie             -> stacked-area
- Salud crediticia / riesgo divergente           -> diverging-bar
- Flujo entre dimensiones (canal->categoria->estatus) -> sankey
- Actividad diaria / estacionalidad por dia      -> calendar-heatmap
- Jerarquia circular con drill-down              -> sunburst
- Distribucion estadistica de precios/montos     -> boxplot
- Evolucion fluida de composicion temporal       -> theme-river

REGLAS ESPECIFICAS:

BAR: comparar categorias, Top N, Bottom N, ranking, ventas por producto/sucursal/estado cuando objetivo es RANKING.
NUNCA usar pie para rankings. NUNCA usar bar para composicion de un total.

LINE: X=tiempo, Y=metrica, mas de 3 puntos temporales. Comparacion temporal multi-serie (2024 vs 2025 por mes) -> line multi-series.

AREA: igual que line pero cuando se quiere enfatizar volumen/magnitud. NO usar para porcentajes/tasas -> usar line.

PIE/DOUGHNUT: SOLO cuando los valores son partes de un mismo total. Maximo 6 categorias. Si >6 -> bar o treemap.
NUNCA para datos temporales, rankings, o comparaciones entre entidades independientes.

SCATTER: SOLO cuando existen 2 variables numericas independientes y el usuario pregunta por relacion/correlacion.
NUNCA para categorias.

RADAR: SOLO para entidades x multiples metricas (minimo 3, maximo 8 metricas).
NUNCA para ventas por estado o ventas mensuales.

FUNNEL: SOLO cuando existe una secuencia logica de etapas. Las etapas deben tener orden logico.

GAUGE: SOLO para una sola metrica con rango/meta interpretable (%, tasa, score).
NUNCA para comparaciones entre multiples entidades.

HEATMAP: SOLO cuando existen 2 dimensiones categoricas/temporales + valor numerico (ej: estado x mes x ventas).

MAP: usar cuando la dimension principal es geografica Y el objetivo es distribucion espacial.
Estado especifico como FILTRO (ej: "en Jalisco") -> NO usar map.
"Top 10 estados" con objetivo ranking -> usar BAR, no map.
groupBy=estado sin filtro de categoria -> map.

CANDLESTICK: SOLO cuando existen datos OHLC (open, high, low, close). NUNCA para ventas mensuales simples.

REGLAS DE VALIDACION (aplicar despues de seleccionar):

A. La pregunta manda sobre el tipo de dato:
   "Cual vende mas?" -> BAR
   "Como evoluciono?" -> LINE
   "Que porcentaje representa?" -> DOUGHNUT
   "Existe relacion?" -> SCATTER
   "Como se distribuye geograficamente?" -> MAP
   "Cual es el porcentaje actual?" -> GAUGE

B. Validar que los datos soporten el chart antes de seleccionarlo.

C. Fallback universal: BAR (el chart generalista mas seguro).

D. NUNCA inventar dimensiones que no existan en el dataset.

E. NO usar un chart si el dataset no lo soporta estructuralmente.

F. Limites de cardinalidad:
   1 categoria -> KPI/Gauge
   2-6 categorias -> Pie/Doughnut posible
   7-15 categorias -> Bar
   >15 categorias -> Bar horizontal + Top N
   Pie >6 categorias = PROHIBIDO
   Radar >8 metricas = PROHIBIDO

G. Time series siempre en orden temporal ASC (enero, febrero, marzo...).

H. Comparacion temporal (2024 vs 2025 por mes) -> Line multi-series.
   Comparacion agregada (total 2024 vs total 2025) -> Bar.

I. Pregunta simple -> 1 chart. No generar 4 charts para responder "cual fue la moto mas vendida?".

J. Si la pregunta tiene multiples intenciones -> 1 chart por intencion, maximo 3 charts.

DIMENSIONES:
- TIEMPO: historico, evolucion, tendencia, semanal, mensual, anual, por mes/semana/anio
- PRODUCTO: categoria, tipo de producto (motos, celulares, etc.)
- ESTADO: entidad federativa, region, zona, cobertura geografica
- MULTI-SERIE: 2+ categorias o 2+ estados en el mismo intent

REGLAS DE SELECCION (en orden de prioridad):
1. MULTI-SERIE + TIEMPO -> chartType: "line"
2. MULTI-SERIE sin tiempo -> chartType: "scatter" + charts secundarios
3. TIEMPO solo -> chartType: "area"
4. TIEMPO + categorias como dimension -> chartType: "stacked-area"
5. ESTADO + PRODUCTO -> chartType: "map"
6. ESTADO solo (sin producto, sin tiempo) -> chartType: "map"
7. PARTICIPACION simple (<=5 items) -> chartType: "doughnut"
8. PARTICIPACION con muchos items (>5) -> chartType: "treemap"
9. RANKING simple -> chartType: "bar"
10. RANKING geografico (top estados, sin producto) -> chartType: "map"
11. RANKING + TIEMPO -> chartType: "bar-race"
12. SALUD CREDITICIA -> chartType: "diverging-bar"
13. JERARQUIA -> chartType: "hierarchical-bar"
14. CORRELACION -> chartType: "scatter"
15. COMPARACION MULTIDIMENSIONAL -> chartType: "radar"
16. EMBUDO -> chartType: "funnel"
17. KPI UNICO -> chartType: "gauge"
18. VOLATILIDAD/OHLC -> chartType: "candlestick" o "bollinger"
19. FLUJO entre dimensiones -> chartType: "sankey"
20. ESTACIONALIDAD / actividad diaria -> chartType: "calendar-heatmap"
21. JERARQUIA CIRCULAR -> chartType: "sunburst"
22. DISTRIBUCION ESTADISTICA de precios -> chartType: "boxplot"
23. COMPOSICION TEMPORAL fluida -> chartType: "theme-river"

FILTROS vs DIMENSIONES:
- Estado especifico (ej: "en Jalisco") = FILTRO, no dimension -> NO usar map
- 2+ categorias (ej: "motos y celulares") = MULTI-SERIE -> comparacion
- groupBy: "estado" sin filtro de categoria = dimension geografica -> usar map
`;
