/**
 * chart-decision.ts
 *
 * Modelo de decisión analítico para selección de chart type.
 * Matriz: objetivo × dimensiones × cardinalidad × modo (single/multi/temporal).
 *
 * CASOS CUBIERTOS:
 *   Temporal solo          "histórico de motos"           → area
 *   Comparación sola       "compara motos y celulares"    → bar (multi-dataset)
 *   Temporal + comparación "histórico de motos y celulares" → line (multi-dataset)
 *   Geográfico solo        "ventas por estado"            → bar
 *   Geográfico + producto  "motos por estado"             → heatmap
 *   Participación simple   "distribución de categorías"   → doughnut / treemap
 *   Participación temporal "participación por mes"        → stacked-area
 *   Ranking                "top 10 estados"               → bar (horizontal)
 *   Ranking animado        "evolución del ranking"        → bar-race
 *   Crédito / salud        "salud crediticia por estado"  → diverging-bar
 *   Correlación            "precio vs plazo"              → scatter
 *   Conversión             "embudo de créditos"           → funnel
 *   Desempeño KPI          "% cumplimiento"               → gauge
 *   Multidimensional       "comparar en varias métricas"  → radar
 *   Jerarquía              "categoría → producto"         → hierarchical-bar
 *   Volatilidad financiera "bandas de bollinger"          → bollinger
 *   OHLC                   "velas de precio"              → candlestick
 */

// ─── Types ────────────────────────────────────────────────────

export type ChartObjective =
  | 'tendencia'
  | 'comparacion'
  | 'comparacion_temporal'   // multi-serie + tiempo
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
  isMultiSerie: boolean;   // 2+ categorías/estados en filtro
  extraDimensions: number;
}

export interface ChartDecision {
  chartType: string;
  objective: ChartObjective;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  multiDataset: boolean;   // hint para el prompt: generar datasets separados
}

// ─── Keyword maps ─────────────────────────────────────────────

const OBJECTIVE_KEYWORDS: Partial<Record<ChartObjective, RegExp>> = {
  tendencia:
    /evoluci[oó]n|tendencia|crecimiento|hist[oó]rico|a\\s+lo\\s+largo|en\\s+el\\s+tiempo|c[oó]mo\\s+ha\\s+(ido|cambiado|variado)/i,
  comparacion:
    /compar|contra|versus|vs\\.?|diferencia\\s+entre|cu[aá]l\\s+(es\\s+m[aá]s|tiene\\s+m[aá]s)|mejor|peor|ganador|l[ií]der/i,
  distribucion_geografica:
    /por\\s+estado|d[oó]nde|regi[oó]n|zona|ubicaci[oó]n|mapa|geogr[aá]f|en\\s+qu[eé]\\s+estado/i,
  participacion:
    /participaci[oó]n|distribuci[oó]n|proporci[oó]n|porcentaje|parte\\s+del\\s+total|composici[oó]n|breakdown|cu[aá]nto\\s+representa/i,
  ranking:
    /ranking|top\\s+\\d|mejores|peores|primeros|[uú]ltimos|m[aá]s\\s+vendidos|menos\\s+vendidos|mayor\\s+venta|menor\\s+venta/i,
  conversion:
    /embudo|funnel|conversi[oó]n|etapa|paso|proceso|flujo|pipeline/i,
  desempeno:
    /gauge|medidor|veloc[ií]metro|indicador\\s+de\\s+meta|cumplimiento|porcentaje\\s+de\\s+meta|kpi\\s+circular|qu[eé]\\s+tan\\s+bien/i,
  correlacion:
    /correlaci[oó]n|scatter|dispersi[oó]n|relaci[oó]n\\s+entre|precio\\s+vs|monto\\s+vs|edad\\s+vs|a\\s+mayor|a\\s+menor/i,
  salud_credito:
    /salud|cartera|morosidad|riesgo|divergen|positivo\\s+vs\\s+negativo|bien\\s+vs\\s+mal/i,
  jerarquia:
    /jer[aá]rquic|drill.?down|hierarchical|desglose|nivel|subcategor[ií]a|dentro\\s+de/i,
  volatilidad:
    /bollinger|banda|volatilidad|desviaci[oó]n|vela|candlestick|ohlc/i,
  relacion:
    /relaci[oó]n|afecta|dependencia|conexi[oó]n|influye|impacto/i,
};

const TIEMPO_KEYWORDS =
  /por\\s+(d[ií]a|semana|mes|a[ñn]o)|semanal|mensual|diario|anual|este\\s+mes|este\\s+a[ñn]o|mes\\s+pasado|a[ñn]o\\s+pasado|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|fecha|tiempo|periodo|hist[oó]rico|evoluci[oó]n|tendencia|crecimiento/i;

const ESTADO_KEYWORDS =
  /por\\s+estado|jalisco|nuevo\\s+le[oó]n|cdmx|ciudad\\s+de\\s+m[eé]xico|veracruz|puebla|guanajuato|chihuahua|sonora|yucat[aá]n|quintana\\s+roo|estado|regi[oó]n|zona/i;

const PRODUCTO_KEYWORDS =
  /moto|celular|bicicleta|pantalla|tablet|consola|audio|accesorio|climatizaci[oó]n|categor[ií]a|producto/i;

const RANKING_TEMPORAL_KEYWORDS =
  /evoluci[oó]n\\s+del\\s+ranking|c[oó]mo\\s+ha\\s+cambiado\\s+el\\s+ranking|ranking\\s+a\\s+lo\\s+largo|carrera|animad/i;

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
  // Multi-serie + tiempo → comparacion_temporal (highest priority)
  if (dims.isMultiSerie && dims.hasTiempo) return 'comparacion_temporal';
  // Multi-serie sin tiempo → comparacion
  if (dims.isMultiSerie) return 'comparacion';

  // Explicit objective keywords (ordered by specificity)
  for (const [objective, pattern] of Object.entries(OBJECTIVE_KEYWORDS)) {
    if (pattern && pattern.test(intent)) return objective as ChartObjective;
  }

  // Fallback from dimensions
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
  if (/pastel|pie\\s+chart|gr[aá]fica\\s+de\\s+pastel/.test(lower)) return 'pie';
  if (/dona|donut|doughnut/.test(lower)) return 'doughnut';
  if (/l[ií]nea|line\\s+chart|gr[aá]fica\\s+de\\s+l[ií]nea/.test(lower)) return 'line';
  if (/[aá]rea\\s+apilada|stacked.area/.test(lower)) return 'stacked-area';
  if (/divergen|diverging/.test(lower)) return 'diverging-bar';
  if (/radial|polar|nightingale/.test(lower)) return 'radial-stacked-bar';
  if (/jer[aá]rquic|drill.?down|hierarchical/.test(lower)) return 'hierarchical-bar';
  if (/treemap|mapa\\s+de\\s+[aá]rbol|cuadros/.test(lower)) return 'treemap';
  if (/carrera|bar.?race|animad/.test(lower)) return 'bar-race';
  if (/vela|candlestick|ohlc/.test(lower)) return 'candlestick';
  if (/bollinger|banda/.test(lower)) return 'bollinger';
  if (/heatmap|mapa\\s+de\\s+calor/.test(lower)) return 'heatmap';
  if (/embudo|funnel|conversi[oó]n/.test(lower)) return 'funnel';
  if (/gauge|medidor|veloc[ií]metro/.test(lower)) return 'gauge';
  if (/scatter|dispersi[oó]n|nube\\s+de\\s+puntos/.test(lower)) return 'scatter';
  if (/radar|ara[ñn]a|tela\\s+de\\s+ara[ñn]a/.test(lower)) return 'radar';
  if (/barra|bar\\s+chart|columna/.test(lower)) return 'bar';
  if (/[aá]rea/.test(lower)) return 'area';
  return null;
}

// ─── Decision tree ────────────────────────────────────────────
//
// MATRIZ COMPLETA:
//
//  Objetivo                  | Condición adicional              | Chart
//  --------------------------|----------------------------------|------------------
//  comparacion_temporal      | multi-serie + tiempo             | line (multi-ds)
//  comparacion               | multi-serie, sin tiempo          | bar (multi-ds)
//  comparacion               | 3+ dimensiones                   | radar
//  comparacion               | producto + estado                | bar agrupado
//  tendencia                 | solo tiempo                      | area
//  tendencia                 | tiempo + groupBy temporal        | area
//  participacion_temporal    | producto + tiempo                | stacked-area
//  participacion             | producto + tiempo                | stacked-area
//  participacion             | multi-dim                        | treemap
//  participacion             | simple                           | doughnut
//  distribucion_geografica   | + producto                       | heatmap
//  distribucion_geografica   | solo estado                      | bar
//  ranking                   | temporal (evolución ranking)     | bar-race
//  ranking                   | simple                           | bar
//  salud_credito             | por estado/categoria             | diverging-bar
//  jerarquia                 | 2 campos categóricos             | hierarchical-bar
//  correlacion               | 2 campos numéricos               | scatter
//  conversion                | etapas                           | funnel
//  desempeno                 | KPI único                        | gauge
//  volatilidad               | OHLC                             | candlestick
//  volatilidad               | serie temporal                   | bollinger
//  relacion                  | estado + producto                | heatmap
//  relacion                  | 2 variables                      | scatter

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
    return {
      chartType: explicit,
      objective,
      confidence: 'high',
      reason: 'Usuario especificó el tipo de gráfica explícitamente',
      multiDataset: false,
    };
  }

  switch (objective) {

    // ── Temporal + multi-serie: "histórico de motos y celulares" ──
    case 'comparacion_temporal': {
      return {
        chartType: 'line',
        objective,
        confidence: 'high',
        reason: 'Múltiples series + tiempo → líneas multi-dataset',
        multiDataset: true,
      };
    }

    // ── Comparación sin tiempo: "compara motos y celulares" ──
    case 'comparacion': {
      if (dims.extraDimensions >= 2 || (!dims.isMultiSerie && dims.hasProducto && dims.hasEstado && dims.hasTiempo)) {
        return { chartType: 'radar', objective, confidence: 'medium', reason: '3+ dimensiones → radar multidimensional', multiDataset: false };
      }
      if (dims.hasProducto && dims.hasEstado) {
        return { chartType: 'bar', objective, confidence: 'high', reason: 'Producto + estado → barras agrupadas', multiDataset: true };
      }
      return {
        chartType: 'bar',
        objective,
        confidence: 'high',
        reason: dims.isMultiSerie ? 'Multi-serie sin tiempo → barras agrupadas' : 'Comparación → barras',
        multiDataset: dims.isMultiSerie,
      };
    }

    // ── Tendencia temporal simple: "histórico de motos" ──
    case 'tendencia': {
      return { chartType: 'area', objective, confidence: 'high', reason: 'Tendencia temporal → área', multiDataset: false };
    }

    // ── Participación en el tiempo: "distribución por mes" ──
    case 'participacion_temporal': {
      return { chartType: 'stacked-area', objective, confidence: 'high', reason: 'Participación temporal → área apilada', multiDataset: false };
    }

    // ── Participación estática ──
    case 'participacion': {
      if (dims.hasProducto && dims.hasTiempo) {
        return { chartType: 'stacked-area', objective, confidence: 'high', reason: 'Participación en el tiempo → área apilada', multiDataset: false };
      }
      if (dims.extraDimensions >= 1) {
        return { chartType: 'treemap', objective, confidence: 'high', reason: 'Participación multi-dim → treemap', multiDataset: false };
      }
      return { chartType: 'doughnut', objective, confidence: 'high', reason: 'Participación simple → dona', multiDataset: false };
    }

    // ── Distribución geográfica ──
    case 'distribucion_geografica': {
      if (dims.hasProducto) {
        return { chartType: 'heatmap', objective, confidence: 'high', reason: 'Estado + producto → heatmap', multiDataset: false };
      }
      return { chartType: 'map', objective, confidence: 'high', reason: 'Distribución geográfica sin producto → mapa coroplético', multiDataset: false };
    }

    // ── Ranking ──
    case 'ranking': {
      if (RANKING_TEMPORAL_KEYWORDS.test(intent) || (dims.hasTiempo && dims.hasProducto)) {
        return { chartType: 'bar-race', objective, confidence: 'high', reason: 'Ranking + tiempo → carrera de barras animada', multiDataset: false };
      }
      return { chartType: 'bar', objective, confidence: 'high', reason: 'Ranking → barras ordenadas', multiDataset: false };
    }

    // ── Ranking temporal (alias) ──
    case 'ranking_temporal': {
      return { chartType: 'bar-race', objective, confidence: 'high', reason: 'Ranking temporal → bar-race', multiDataset: false };
    }

    // ── Salud crediticia ──
    case 'salud_credito': {
      return { chartType: 'diverging-bar', objective, confidence: 'high', reason: 'Salud/riesgo crediticio → barras divergentes', multiDataset: false };
    }

    // ── Jerarquía / drill-down ──
    case 'jerarquia': {
      return { chartType: 'hierarchical-bar', objective, confidence: 'high', reason: 'Jerarquía → barras jerárquicas', multiDataset: false };
    }

    // ── Correlación ──
    case 'correlacion': {
      return { chartType: 'scatter', objective, confidence: 'high', reason: 'Correlación entre variables → scatter', multiDataset: false };
    }

    // ── Relación ──
    case 'relacion': {
      if (dims.hasEstado && dims.hasProducto) {
        return { chartType: 'heatmap', objective, confidence: 'high', reason: 'Relación producto-estado → heatmap', multiDataset: false };
      }
      return { chartType: 'scatter', objective, confidence: 'medium', reason: 'Relación entre variables → scatter', multiDataset: false };
    }

    // ── Conversión / embudo ──
    case 'conversion': {
      return { chartType: 'funnel', objective, confidence: 'high', reason: 'Proceso/embudo → funnel', multiDataset: false };
    }

    // ── Desempeño KPI ──
    case 'desempeno': {
      return { chartType: 'gauge', objective, confidence: 'high', reason: 'Indicador de desempeño → gauge', multiDataset: false };
    }

    // ── Volatilidad / financiero ──
    case 'volatilidad': {
      if (/vela|candlestick|ohlc/i.test(intent)) {
        return { chartType: 'candlestick', objective, confidence: 'high', reason: 'OHLC → candlestick', multiDataset: false };
      }
      return { chartType: 'bollinger', objective, confidence: 'high', reason: 'Volatilidad temporal → bollinger', multiDataset: false };
    }
  }
}

// ─── System prompt snippet (used in interpretIntent) ──────────

export const CHART_DECISION_PROMPT = `
MODELO DE DECISIÓN PARA SELECCIÓN DE GRÁFICA — MATRIZ COMPLETA:

DIMENSIONES:
- TIEMPO: histórico, evolución, tendencia, semanal, mensual, anual, por mes/semana/año
- PRODUCTO: categoría, tipo de producto (motos, celulares, etc.)
- ESTADO: entidad federativa, región, zona
- MULTI-SERIE: 2+ categorías o 2+ estados en el mismo intent

REGLAS DE SELECCIÓN (en orden de prioridad):

1. MULTI-SERIE + TIEMPO  → chartType: "line"  (líneas paralelas, una por serie)
   Ejemplo: "compara el histórico de motos y celulares", "evolución de motos vs celulares"

2. MULTI-SERIE sin tiempo → chartType: "bar"  (barras agrupadas, un dataset por serie)
   Ejemplo: "compara motos y celulares", "motos vs celulares por estado"

3. TIEMPO solo (1 categoría o sin filtro) → chartType: "area"
   Ejemplo: "histórico de motos", "evolución mensual de ventas"

4. TIEMPO + múltiples categorías como dimensión (groupBy=categoria) → chartType: "stacked-area"
   Ejemplo: "participación de categorías por mes", "cómo han crecido las categorías"

5. ESTADO + PRODUCTO → chartType: "heatmap"
   Ejemplo: "motos por estado", "ventas por categoría y estado"

6. ESTADO solo (análisis geográfico, sin producto) → chartType: "map"
   Ejemplo: "ventas por estado", "qué estados venden más", "distribución geográfica"

7. PARTICIPACIÓN simple (≤5 items) → chartType: "doughnut"
   Ejemplo: "distribución de estatus", "qué porcentaje es cada canal"

8. PARTICIPACIÓN con muchos items (>5) → chartType: "treemap"
   Ejemplo: "distribución por categoría", "composición del portafolio"

9. RANKING simple → chartType: "bar" (ordenado descendente)
   Ejemplo: "top 10 estados", "mejores vendedores"

10. RANKING + TIEMPO (evolución del ranking) → chartType: "bar-race"
    Ejemplo: "cómo ha evolucionado el ranking de categorías", "carrera de ventas"

11. SALUD CREDITICIA / DIVERGENTE → chartType: "diverging-bar"
    Ejemplo: "salud de cartera por estado", "riesgo vs salud por categoría"

12. JERARQUÍA / DRILL-DOWN → chartType: "hierarchical-bar"
    Ejemplo: "desglose por categoría y producto", "categoría dentro de estado"

13. CORRELACIÓN entre 2 variables numéricas → chartType: "scatter"
    Ejemplo: "precio vs plazo", "monto vs semanas pagadas"

14. COMPARACIÓN MULTIDIMENSIONAL (3+ métricas) → chartType: "radar"
    Ejemplo: "compara categorías en varias métricas", "perfil de cada estado"

15. EMBUDO / CONVERSIÓN → chartType: "funnel"
    Ejemplo: "embudo de créditos", "proceso de venta"

16. KPI / INDICADOR ÚNICO → chartType: "gauge"
    Ejemplo: "% de morosidad", "cumplimiento de meta"

17. VOLATILIDAD / OHLC → chartType: "candlestick" o "bollinger"
    Ejemplo: "velas de precio", "bandas de bollinger del monto"

FILTROS vs DIMENSIONES:
- Estado específico mencionado (ej: "en Jalisco") = FILTRO, no dimensión
- Categoría específica mencionada (ej: "de motos") = FILTRO, no dimensión
- 2+ categorías mencionadas (ej: "motos y celulares") = MULTI-SERIE → comparación
`;
