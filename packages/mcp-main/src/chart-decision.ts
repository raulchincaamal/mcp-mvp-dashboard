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
  | 'volatilidad';

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

  if (dims.hasTiempo && dims.hasProducto) return 'participacion_temporal';
  if (dims.hasTiempo) return 'tendencia';
  if (dims.hasEstado && dims.hasProducto) return 'distribucion_geografica';
  if (dims.hasEstado) return 'distribucion_geografica';
  if (dims.hasProducto) return 'comparacion';
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

// ─── Decision tree ────────────────────────────────────────────

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
MODELO DE DECISIÓN PARA SELECCIÓN DE GRÁFICA — MATRIZ COMPLETA:

DIMENSIONES:
- TIEMPO: histórico, evolución, tendencia, semanal, mensual, anual, por mes/semana/año
- PRODUCTO: categoría, tipo de producto (motos, celulares, etc.)
- ESTADO: entidad federativa, región, zona, cobertura geográfica
- MULTI-SERIE: 2+ categorías o 2+ estados en el mismo intent

REGLAS DE SELECCIÓN (en orden de prioridad):

1. MULTI-SERIE + TIEMPO  → chartType: "line"  (líneas paralelas, una por serie)
   Ejemplo: "compara el histórico de motos y celulares"

2. MULTI-SERIE sin tiempo → chartType: "scatter" (correlación precio vs plazo) + charts secundarios: area, line, bar multi-dataset
   Ejemplo: "compara motos y celulares", "ventas de celulares y motos"

3. TIEMPO solo → chartType: "area"
   Ejemplo: "histórico de motos", "evolución mensual de ventas"

4. TIEMPO + categorías como dimensión → chartType: "stacked-area"
   Ejemplo: "participación de categorías por mes"

5. ESTADO + PRODUCTO → chartType: "map" (mapa principal filtrado por ese producto)
   El heatmap categoría × estado se incluye como chart SECUNDARIO en el dashboard.
   Ejemplo: "motos por estado", "ventas de celulares por estado"

6. ESTADO solo (sin producto, sin tiempo) → chartType: "map"
   Aplica cuando: groupBy=estado, o el intent habla de distribución/cobertura/presencia geográfica
   Ejemplo: "ventas por estado", "qué estados venden más", "distribución geográfica",
            "cobertura por estado", "presencia en estados", "mapa de ventas",
            "en qué estados", "alcance geográfico", "ranking de estados"

7. PARTICIPACIÓN simple (≤5 items) → chartType: "doughnut"
8. PARTICIPACIÓN con muchos items (>5) → chartType: "treemap"
9. RANKING simple → chartType: "bar"
10. RANKING geográfico (top estados, sin producto) → chartType: "map"
11. RANKING + TIEMPO → chartType: "bar-race"
12. SALUD CREDITICIA → chartType: "diverging-bar"
13. JERARQUÍA → chartType: "hierarchical-bar"
14. CORRELACIÓN → chartType: "scatter"
15. COMPARACIÓN MULTIDIMENSIONAL → chartType: "radar"
16. EMBUDO → chartType: "funnel"
17. KPI ÚNICO → chartType: "gauge"
18. VOLATILIDAD/OHLC → chartType: "candlestick" o "bollinger"

FILTROS vs DIMENSIONES:
- Estado específico (ej: "en Jalisco") = FILTRO, no dimensión → NO usar map
- 2+ categorías (ej: "motos y celulares") = MULTI-SERIE → comparación
- groupBy: "estado" sin filtro de categoría = dimensión geográfica → usar map
`;
