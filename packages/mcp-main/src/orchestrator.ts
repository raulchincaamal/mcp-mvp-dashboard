﻿﻿import {
  BedrockRuntimeClient,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime';
import type { McpClient } from './mcp-client.js';
import { generateCacheKey, cacheGet, cacheSet, TTL } from './cache.js';
import { selectChartType, validateChartDecision, CHART_DECISION_PROMPT } from './chart-decision.js';

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION,
});
const MODEL_ID = process.env.BEDROCK_MODEL_ID!;

// ─── Normalize string: lowercase + strip accents ─────────────
function stripAccents(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ─── Estado normalization map (no-accent key → accented value) ───
const ESTADO_MAP: Record<string, string> = {
  'aguascalientes': 'Aguascalientes', 'baja california': 'Baja California',
  'baja california sur': 'Baja California Sur', 'campeche': 'Campeche',
  'chiapas': 'Chiapas', 'chihuahua': 'Chihuahua',
  'ciudad de mexico': 'Ciudad de México', 'cdmx': 'Ciudad de México',
  'df': 'Ciudad de México', 'distrito federal': 'Ciudad de México',
  'coahuila': 'Coahuila', 'coahuila de zaragoza': 'Coahuila', 'colima': 'Colima',
  'durango': 'Durango', 'guanajuato': 'Guanajuato', 'guerrero': 'Guerrero',
  'hidalgo': 'Hidalgo', 'jalisco': 'Jalisco', 'guadalajara': 'Jalisco',
  'mexico': 'México', 'estado de mexico': 'México', 'edomex': 'México',
  'edo mex': 'México', 'michoacan': 'Michoacán', 'morelia': 'Michoacán',
  'morelos': 'Morelos', 'nayarit': 'Nayarit', 'nuevo leon': 'Nuevo León',
  'monterrey': 'Nuevo León', 'oaxaca': 'Oaxaca', 'puebla': 'Puebla',
  'queretaro': 'Querétaro', 'quintana roo': 'Quintana Roo', 'cancun': 'Quintana Roo',
  'san luis potosi': 'San Luis Potosí', 'sinaloa': 'Sinaloa', 'culiacan': 'Sinaloa',
  'sonora': 'Sonora', 'hermosillo': 'Sonora', 'tabasco': 'Tabasco',
  'tamaulipas': 'Tamaulipas', 'tlaxcala': 'Tlaxcala',
  'veracruz': 'Veracruz', 'xalapa': 'Veracruz',
  'yucatan': 'Yucatán', 'merida': 'Yucatán', 'zacatecas': 'Zacatecas',
};

// ─── Categoria normalization map ──────────────────────────────
const CATEGORIA_MAP: Record<string, string> = {
  'motos': 'Motos', 'moto': 'Motos', 'motocicleta': 'Motos', 'motocicletas': 'Motos',
  'celulares': 'Celulares', 'celular': 'Celulares', 'telefono': 'Celulares',
  'telefonos': 'Celulares', 'smartphone': 'Celulares', 'smartphones': 'Celulares',
  'iphone': 'Celulares', 'android': 'Celulares',
  'bicicletas electricas': 'Bicicletas Eléctricas', 'bicicleta electrica': 'Bicicletas Eléctricas',
  'bicicletas': 'Bicicletas Eléctricas', 'bicicleta': 'Bicicletas Eléctricas', 'ebike': 'Bicicletas Eléctricas',
  'pantallas': 'Pantallas/TV', 'pantalla': 'Pantallas/TV', 'tv': 'Pantallas/TV',
  'television': 'Pantallas/TV', 'televisor': 'Pantallas/TV', 'pantallas/tv': 'Pantallas/TV',
  'audio': 'Audio', 'bocinas': 'Audio', 'bocina': 'Audio', 'altavoz': 'Audio',
  'tablets': 'Tablets', 'tablet': 'Tablets', 'ipad': 'Tablets',
  'consolas': 'Consolas', 'consola': 'Consolas', 'videojuegos': 'Consolas',
  'playstation': 'Consolas', 'xbox': 'Consolas', 'nintendo': 'Consolas',
  'climatizacion': 'Climatización', 'climatización': 'Climatización',
  'aire acondicionado': 'Climatización', 'ventilador': 'Climatización',
  'accesorios': 'Accesorios', 'accesorio': 'Accesorios',
};

function normalizeEstado(raw: string): string {
  const key = stripAccents(raw.trim());
  // Exact match
  if (ESTADO_MAP[key]) return ESTADO_MAP[key];
  // Partial match: check if any map key starts with or contains the input
  for (const [mapKey, value] of Object.entries(ESTADO_MAP)) {
    if (mapKey.startsWith(key) || key.startsWith(mapKey)) return value;
  }
  // Capitalize as fallback
  return raw.trim().replace(/\b\w/g, c => c.toUpperCase());
}

function normalizeCategoria(raw: string): string {
  const key = stripAccents(raw.trim());
  if (CATEGORIA_MAP[key]) return CATEGORIA_MAP[key];
  // Partial match
  for (const [mapKey, value] of Object.entries(CATEGORIA_MAP)) {
    if (key.includes(mapKey) || mapKey.includes(key)) return value;
  }
  return raw.trim().replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Component catalog ────────────────────────────────────────

const COMPONENT_CATALOG = [
  {
    name: 'StatCard',
    description: 'Metric card with title, large value, trend arrow, and icon',
  },
  { name: 'KPIGrid', description: 'Grid of StatCards for key metrics' },
  {
    name: 'Chart',
    description:
      'Chart supporting types: bar, line, area, pie, doughnut, scatter, radar, funnel, gauge, hexbin-map, treemap, map, bollinger, stacked-area, diverging-bar, radial-stacked-bar, candlestick, hierarchical-bar, bar-race, sankey, calendar-heatmap, sunburst, boxplot, theme-river',
  },
  { name: 'DataSummary', description: 'Styled data table with hover effects' },
  {
    name: 'TransactionList',
    description: 'List of items with title, amount, date, status',
  },
  { name: 'ProgressGroup', description: 'Card with multiple progress bars' },
  { name: 'MiniChart', description: 'Compact insight text card with title and descriptive text bullets. Use for key findings, anomalies, or recommendations derived from the data. Props: { title: string, description: string (use \\n to separate bullet points) }' },
];

// ─── Orchestrator ─────────────────────────────────────────────

export interface OrchestrationParams {
  intent: string;
  dataset?: string;
  filters?: Record<string, unknown>;
  limit?: number;
}

export async function orchestrate(
  params: OrchestrationParams,
): Promise<unknown> {
  const dataset = params.dataset ?? 'ventas-credito';

  const { gcpClient, uiClient } = await import('./mcp-client.js').then((m) =>
    m.createMcpClients(),
  );

  try {
    // Step 1: Interpret intent
    console.log(`[orchestrator] interpreting intent with model: ${MODEL_ID}`);
    const parsedIntent = await interpretIntent(params.intent);
    console.log('[orchestrator] parsed intent:', JSON.stringify(parsedIntent));

    // Cache check (after interpretation so granularity is included in key)
    const cacheKey = generateCacheKey('ui', {
      dataset,
      intent: params.intent,
      filters: params.filters,
      limit: params.limit,
      granularity: (parsedIntent as Record<string, unknown>).granularity,
    });
    const cached = await cacheGet<unknown>(cacheKey);
    if (cached) {
      console.log('[orchestrator] cache hit');
      return cached;
    }

    // Step 2: Query real data
    const filters: Record<string, unknown> = {
      ...parsedIntent.filters,
      ...params.filters,
    };
    for (const [key, value] of Object.entries(filters)) {
      if (Array.isArray(value) && value.length >= 8) delete filters[key];
    }

    // If groupBy=fecha_venta and no explicit date mentioned in intent, remove fecha_venta filter
    // (Bedrock tends to hallucinate date filters for temporal intents)
    if (parsedIntent.groupBy === 'fecha_venta' && filters.fecha_venta) {
      const hasExplicitDate = /enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|\d{4}|este mes|mes pasado|este a[n?]o/i.test(params.intent);
      if (!hasExplicitDate) {
        delete filters.fecha_venta;
        console.log('[orchestrator] removed hallucinated fecha_venta filter (temporal groupBy, no explicit date in intent)');
      }
    }

    // Normalize filters: accents, casing, aliases
    // If ciudad is actually a state alias (e.g. "monterrey" → Nuevo León), promote to estado
    if (typeof filters.ciudad === 'string') {
      const ciudadKey = stripAccents(filters.ciudad.trim());
      if (ESTADO_MAP[ciudadKey]) {
        filters.estado = ESTADO_MAP[ciudadKey];
        delete filters.ciudad;
        console.log(`[orchestrator] ciudad alias promoted to estado → "${filters.estado}"`);
      }
    }
    // Normalize estado: string or array
    if (typeof filters.estado === 'string') {
      filters.estado = normalizeEstado(filters.estado);
      console.log(`[orchestrator] estado normalized → "${filters.estado}"`);
    } else if (Array.isArray(filters.estado)) {
      filters.estado = (filters.estado as string[]).map(normalizeEstado);
      console.log(`[orchestrator] estado[] normalized → ${JSON.stringify(filters.estado)}`);
    }
    // Normalize categoria: string or array
    if (typeof filters.categoria === 'string') {
      filters.categoria = normalizeCategoria(filters.categoria);
      console.log(`[orchestrator] categoria normalized → "${filters.categoria}"`);
    } else if (Array.isArray(filters.categoria)) {
      filters.categoria = (filters.categoria as string[]).map(normalizeCategoria);
      console.log(`[orchestrator] categoria[] normalized → ${JSON.stringify(filters.categoria)}`);
    }
    // Normalize estatus_credito: string or array
    const ESTATUS_MAP: Record<string, string> = {
      'al_corriente': 'al_corriente', 'corriente': 'al_corriente', 'vigente': 'al_corriente',
      'atrasado': 'atrasado', 'vencido': 'atrasado', 'mora': 'atrasado', 'debe': 'atrasado',
      'liquidado': 'liquidado', 'pagado': 'liquidado', 'saldado': 'liquidado', 'terminado': 'liquidado',
      'cancelado': 'cancelado', 'baja': 'cancelado',
    };
    const normalizeEstatus = (v: string) => ESTATUS_MAP[stripAccents(v).replace(/\s+/g, '_')] ?? v;
    if (typeof filters.estatus_credito === 'string') {
      filters.estatus_credito = normalizeEstatus(filters.estatus_credito);
    } else if (Array.isArray(filters.estatus_credito)) {
      filters.estatus_credito = (filters.estatus_credito as string[]).map(normalizeEstatus);
    }
    // Normalize canal_venta
    const CANAL_MAP: Record<string, string> = {
      'tienda_fisica': 'tienda_fisica', 'tienda': 'tienda_fisica', 'fisica': 'tienda_fisica', 'presencial': 'tienda_fisica',
      'en_linea': 'en_linea', 'online': 'en_linea', 'internet': 'en_linea', 'web': 'en_linea', 'linea': 'en_linea',
      'telefono': 'telefono', 'llamada': 'telefono', 'call': 'telefono',
    };
    if (typeof filters.canal_venta === 'string') {
      filters.canal_venta = CANAL_MAP[stripAccents(filters.canal_venta).replace(/\s+/g, '_')] ?? filters.canal_venta;
    }
    // Normalize fecha_venta range: if Bedrock gives a month name instead of range object, convert it
    if (typeof filters.fecha_venta === 'string') {
      const MES_MAP: Record<string, string> = {
        'enero':'01','febrero':'02','marzo':'03','abril':'04','mayo':'05','junio':'06',
        'julio':'07','agosto':'08','septiembre':'09','octubre':'10','noviembre':'11','diciembre':'12',
      };
      const mesKey = stripAccents(filters.fecha_venta.trim());
      if (MES_MAP[mesKey]) {
        const now = new Date();
        const year = now.getFullYear();
        const mm = MES_MAP[mesKey];
        const lastDay = new Date(year, parseInt(mm), 0).getDate();
        filters.fecha_venta = { gte: `${year}-${mm}-01`, lte: `${year}-${mm}-${lastDay}` };
        console.log(`[orchestrator] fecha_venta month string → range ${JSON.stringify(filters.fecha_venta)}`);
      }
    }

    // Default: if no fecha_venta filter, apply last 3 months relative to dataset max date
    // Exception: category dashboard intents should use full dataset for richer analysis
    const isCategoryDashboard = /dashboard completo de/i.test(params.intent) && parsedIntent.filters.categoria;
    const isLastDayIntent = /ultimo\s*d[ií]a|ayer|hoy|last\s*day/i.test(params.intent);
    if (!filters.fecha_venta && !isLastDayIntent && parsedIntent.groupBy !== 'fecha_venta' && !isCategoryDashboard) {
      // Probe dataset max date so window is always relative to actual data, not system clock
      const probeResult = (await gcpClient.callTool('query_data', { dataset, limit: 50 })) as { records?: Record<string, unknown>[] };
      const probeDates = (probeResult.records ?? [])
        .map(r => String(r.fecha_venta ?? '')).filter(d => /^\d{4}-\d{2}-\d{2}/.test(d)).sort((a, b) => b.localeCompare(a));
      const maxDate = probeDates[0] ? new Date(probeDates[0]) : new Date();
      const threeMonthsAgo = new Date(maxDate.getFullYear(), maxDate.getMonth() - 3, maxDate.getDate());
      const pad = (n: number) => String(n).padStart(2, '0');
      const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
      filters.fecha_venta = { gte: fmt(threeMonthsAgo), lte: fmt(maxDate) };
      console.log(`[orchestrator] no date filter → last 3 months from dataset max ${fmt(maxDate)}: ${JSON.stringify(filters.fecha_venta)}`);
    }

    const limit = params.limit ?? parsedIntent.limit ?? (isCategoryDashboard ? 500 : 200);

    console.log(
      `[orchestrator] querying data — filters: ${JSON.stringify(filters)}, limit: ${limit}`,
    );
    const queryResult = (await gcpClient.callTool('query_data', {
      dataset,
      ...(Object.keys(filters).length > 0 ? { filters } : {}),
      limit,
    })) as { records?: Record<string, unknown>[]; totalRecords?: number };

    const records =
      queryResult.records ??
      (queryResult as unknown as Record<string, unknown>[]);
    console.log(
      `[orchestrator] got ${Array.isArray(records) ? records.length : 0} records`,
    );

    // If 0 records and intent mentions "ultimo dia" / "ayer" / "hoy", find the most recent date with data
    let finalRecords = Array.isArray(records) ? records : [];
    let finalDateRange = filters.fecha_venta as { gte?: string; lte?: string } | undefined;
    if (finalRecords.length === 0 && isLastDayIntent) {
      console.log('[orchestrator] 0 records for last-day query — fetching most recent date with data');
      const allRecent = (await gcpClient.callTool('query_data', {
        dataset,
        limit: 5000,
      })) as { records?: Record<string, unknown>[] };
      const allRecs = allRecent.records ?? [];
      if (allRecs.length > 0) {
        // Find most recent fecha_venta
        const dates = allRecs
          .map(r => String(r.fecha_venta ?? ''))
          .filter(d => /^\d{4}-\d{2}-\d{2}/.test(d))
          .sort((a, b) => b.localeCompare(a));
        const mostRecent = dates[0]?.slice(0, 10);
        if (mostRecent) {
          console.log(`[orchestrator] most recent date with data: ${mostRecent}`);
          // Apply categoria filter if present
          const dayFilters: Record<string, unknown> = { fecha_venta: { gte: mostRecent, lte: mostRecent } };
          if (filters.categoria) dayFilters.categoria = filters.categoria;
          const dayResult = (await gcpClient.callTool('query_data', {
            dataset,
            filters: dayFilters,
            limit: 500,
          })) as { records?: Record<string, unknown>[] };
          finalRecords = dayResult.records ?? [];
          finalDateRange = { gte: mostRecent, lte: mostRecent };
          console.log(`[orchestrator] found ${finalRecords.length} records for most recent day ${mostRecent}`);
        }
      }
    }

    // Step 3: Generate UIConfig with Bedrock (LLM knows all D3 chart formats)
    if (!Array.isArray(records) || records.length === 0) {
      console.log('[orchestrator] 0 records  returning empty-state UIConfig');
      const emptyConfig = {
        title: 'Sin resultados',
        description: 'No se encontraron registros para los filtros seleccionados. Intenta con otros criterios.',
        layout: 'vertical',
        components: [{
          component: 'KPIGrid',
          props: { items: [{ title: 'Total Registros', value: '0', subtitle: 'Sin datos para este filtro', trendDirection: 'neutral', icon: 'search' }] }
        }]
      };
      await cacheSet(cacheKey, emptyConfig, TTL.INTENT);
      return emptyConfig;
    }
    console.log('[orchestrator] generating UIConfig with Bedrock');
    const uiConfig = await generateUIConfig(
      params.intent,
      parsedIntent,
      finalRecords,
      finalDateRange,
    );

    await cacheSet(cacheKey, uiConfig, TTL.INTENT);
    return uiConfig;
  } finally {
    await gcpClient.disconnect();
    await uiClient.disconnect();
  }
}

// ─── Step 1: Interpret intent ─────────────────────────────────

async function interpretIntent(intent: string): Promise<{
  filters: Record<string, unknown>;
  groupBy: string | null;
  metric: string;
  metricField: string | null;
  chartType: string | null;
  template: string;
  limit: number | null;
  title: string | null;
}> {
  const fallback = {
    filters: {},
    groupBy: null,
    metric: 'sum',
    metricField: 'monto_total_credito',
    chartType: null,
    template: 'executive',
    limit: null,
    granularity: null as string | null,
    title: null,
  };

  try {
    const response = await bedrockClient.send(
      new ConverseCommand({
        modelId: MODEL_ID,
        system: [
          {
            text: `Eres un intérprete de intents para el sistema de dashboards de Macropay, empresa mexicana de ventas a crédito de productos (motos, celulares, bicicletas eléctricas, pantallas, tablets, consolas, audio, accesorios). Tu trabajo es convertir lo que pide el usuario en una consulta estructurada JSON.

IMPORTANTE: El usuario puede escribir sin acentos, en minúsculas, con errores ortográficos o abreviaciones. Debes interpretar correctamente aunque el texto no tenga acentos ni mayúsculas.

Responde SOLO con JSON válido, sin markdown, sin explicaciones.
Estructura exacta:
{"filters":{},"groupBy":null,"metric":"sum","metricField":"monto_total_credito","chartType":null,"template":"executive","limit":null,"title":null}

Campos disponibles: id, fecha_venta, cliente, edad_cliente, genero, estado, ciudad, sucursal, categoria, producto, precio_contado, monto_total_credito, estatus_credito, canal_venta, vendedor.

Categorías válidas (escríbelas EXACTAMENTE así en filters.categoria):
- Motos (también: moto, motocicleta, motos)
- Celulares (también: celular, telefono, iphone, smartphone)
- Bicicletas Eléctricas (también: bicicleta, bici, ebike)
- Pantallas/TV (también: pantalla, tv, television, tele)
- Audio (también: bocina, altavoz, sonido)
- Tablets (también: tablet, ipad)
- Consolas (también: consola, videojuegos, playstation, xbox)
- Climatización (también: aire acondicionado, ventilador, clima)
- Accesorios (también: accesorio)

Estados de México (escríbelos EXACTAMENTE así en filters.estado, con acento):
Aguascalientes, Baja California, Baja California Sur, Campeche, Chiapas, Chihuahua, Ciudad de México, Coahuila, Colima, Durango, Guanajuato, Guerrero, Hidalgo, Jalisco, México, Michoacán, Morelos, Nayarit, Nuevo León, Oaxaca, Puebla, Querétaro, Quintana Roo, San Luis Potosí, Sinaloa, Sonora, Tabasco, Tamaulipas, Tlaxcala, Veracruz, Yucatán, Zacatecas.
Alias: cdmx/df → Ciudad de México, edomex/edo mex → México, monterrey → Nuevo León, guadalajara → Jalisco, cancun → Quintana Roo, merida → Yucatán.

Estatus de crédito (escríbelos EXACTAMENTE así en filters.estatus_credito):
- al_corriente (también: corriente, vigente, al dia, al día)
- atrasado (también: vencido, mora, debe, atrasados)
- liquidado (también: pagado, saldado, terminado, liquidados)
- cancelado (también: baja, cancelados)

Canales de venta (escríbelos EXACTAMENTE así en filters.canal_venta):
- tienda_fisica (también: tienda, fisica, presencial)
- en_linea (también: online, internet, web, linea)
- telefono (también: llamada, call)

Reglas de interpretación:
- "por estado/categoría/mes/vendedor/semana/año" → groupBy con ese campo
- "semanal/por semana" → groupBy:"fecha_venta", granularity implícita: week
- "mensual/por mes" → groupBy:"fecha_venta", granularity implícita: month
- "anual/por año" → groupBy:"fecha_venta", granularity implícita: year
- estado específico mencionado → filters.estado (es FILTRO, no groupBy)
- categoría específica mencionada → filters.categoria (es FILTRO, no groupBy)
- "tabla/listado/registros" → template:table
- "grafica/chart/tendencia/semanal/mensual/anual/evolucion" → template:chart
- "credito/estatus/pago/morosidad/atrasado" → template:credit
- "por categoria/analisis" → template:category
- "resumen/dashboard/kpi/ejecutivo/general" → template:executive
- número mencionado (últimas 10, top 20) → limit
- genera un título descriptivo en español → title

FILTROS MÚLTIPLES Y COMBINADOS (muy importante):
- Si se mencionan 2+ categorías → filters.categoria debe ser un ARRAY: ["Motos", "Celulares"]
- Si se mencionan 2+ estados → filters.estado debe ser un ARRAY: ["Jalisco", "Yucatán"]
- Si se mencionan 2+ estatus → filters.estatus_credito debe ser un ARRAY: ["atrasado", "cancelado"]
- - REGLA CRITICA: Si el intent pide datos "semanales", "mensuales", "anuales", "por semana", "por mes", "evolucion", "tendencia" SIN mencionar un mes o anio especifico, NO pongas filtro de fecha_venta. El groupBy=fecha_venta ya agrupa temporalmente.
Mes específico mencionado (enero, febrero, agosto, etc.) → filters.fecha_venta como rango: {"gte":"YYYY-MM-01","lte":"YYYY-MM-31"}
  Usa el año más reciente disponible (2025 o 2026) si no se especifica año.
  Meses: enero=01, febrero=02, marzo=03, abril=04, mayo=05, junio=06, julio=07, agosto=08, septiembre=09, octubre=10, noviembre=11, diciembre=12
- Año específico → filters.fecha_venta: {"gte":"YYYY-01-01","lte":"YYYY-12-31"}
- "este mes" → rango del mes actual, "mes pasado" → rango del mes anterior
- Combina TODOS los filtros mencionados simultáneamente en el mismo objeto filters

DISTINCIÓN CLAVE — dimensión vs filtro:
- Dimensión (groupBy) = lo que varía en el eje de la gráfica. Se pierde el análisis si se elimina.
- Filtro (filters) = limita el dataset pero NO aparece en el eje.
Ejemplos:
  "ventas semanales de celulares en yucatan" → groupBy:"fecha_venta", filters:{categoria:"Celulares", estado:"Yucatán"}
  "ventas por estado" → groupBy:"estado", filters:{}
  "ventas de motos por estado" → groupBy:"estado", filters:{categoria:"Motos"}
  "creditos atrasados en jalisco" → groupBy:null, filters:{estatus_credito:"atrasado", estado:"Jalisco"}, template:"credit"
  "evolucion mensual de ventas" → groupBy:"fecha_venta", filters:{}, template:"chart"
  "cuantas motos se vendieron" → groupBy:null, filters:{categoria:"Motos"}, metric:"count", metricField:null
  "ventas de motos" → groupBy:null, filters:{categoria:"Motos"}, metric:"sum", metricField:"monto_total_credito"

REGLA DE MÉTRICA (muy importante):
- Por defecto usa metric:"sum" y metricField:"monto_total_credito" para mostrar el valor financiero real
- Usa metric:"count" SOLO cuando el usuario pide explícitamente cantidad, número, cuántos, conteo
- Palabras que activan count: "cuántos", "cuantas", "número de", "cantidad de", "conteo", "registros"
- Palabras que activan sum de monto: "ventas", "ingresos", "monto", "valor", "facturación", "total", "dinero"
  "ventas de celulares y motos en yucatan" → groupBy:null, filters:{categoria:["Celulares","Motos"], estado:"Yucatán"}
  "creditos atrasados de motos en agosto" → groupBy:null, filters:{categoria:"Motos", estatus_credito:"atrasado", fecha_venta:{gte:"2025-08-01",lte:"2025-08-31"}}, template:"credit"
  "ventas de celulares y motos atrasadas de yucatan en agosto" → filters:{categoria:["Celulares","Motos"], estatus_credito:"atrasado", estado:"Yucatán", fecha_venta:{gte:"2025-08-01",lte:"2025-08-31"}}
${CHART_DECISION_PROMPT}`,
          },
        ],
        messages: [{ role: 'user', content: [{ text: intent }] }],
        inferenceConfig: { maxTokens: 512, temperature: 0 },
      }),
    );

    const block = response.output?.message?.content?.[0];
    if (!block || !('text' in block)) return fallback;
    const clean = block
      .text!.replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();
    const parsed = { ...fallback, ...JSON.parse(clean) };
    // Default metric to sum/monto_total_credito unless user explicitly asked for count
    if (!parsed.metric || parsed.metric === 'count') {
      const countKeywords = /cu[aá]ntos?|n[uú]mero\s+de|cantidad\s+de|conteo|registros/i;
      if (!countKeywords.test(intent)) {
        parsed.metric = 'sum';
        parsed.metricField = parsed.metricField ?? 'monto_total_credito';
      }
    }

    // Infer temporal granularity from intent
    if (parsed.groupBy === 'fecha_venta' && !parsed.granularity) {
      if (/\ba[ñn]o\b|anio\b|anual|por\s+a[ñn]o|por\s+anio/i.test(intent)) parsed.granularity = 'year';
      else if (/\bmes\b|mensual|por\s+mes/i.test(intent)) parsed.granularity = 'month';
      else if (/\bseman/i.test(intent)) parsed.granularity = 'week';
      else parsed.granularity = 'month';
    }

    // "top N" de grupos → limit aplica al chart, no a los registros
    // Siempre traer suficientes registros para agregar correctamente
    const isTopN = /top\s*\d|mejores?\s*\d|peores?\s*\d|primeros?\s*\d|\d\s*m[aá]s\s+vend/i.test(intent);
    if (isTopN) {
      parsed.topN = parsed.limit;  // guardar el N para el chart
      parsed.limit = 5000;         // traer todos los registros para agregar bien
    } else if (parsed.groupBy === 'fecha_venta') {
      parsed.limit = 5000; // always override Bedrock limit for temporal groupBy
    } else if (!parsed.limit) {
      parsed.limit = 200;
    }

    // Force template:chart when groupBy is temporal
    if (parsed.groupBy === 'fecha_venta') {
      parsed.template = 'chart';
    }

    // Override chartType con modelo de decisión analítico
    const decision = selectChartType(intent, parsed.groupBy, parsed.chartType, parsed.filters);
    if (!parsed.chartType || decision.confidence === 'high') {
      parsed.chartType = decision.chartType;
      parsed.multiDataset = decision.multiDataset;
      console.log(`[orchestrator] chart-decision: ${decision.chartType} (${decision.objective}) multiDataset=${decision.multiDataset} — ${decision.reason}`);
    }

    // Post-decision validation (Rules A–J)
    const validation = validateChartDecision(parsed.chartType, intent, parsed.groupBy, parsed.filters);
    if (validation.action !== 'allow') {
      console.log(`[orchestrator] chart-validation: ${validation.action} ${parsed.chartType} → ${validation.chartType} — ${validation.reason}`);
      parsed.chartType = validation.chartType;
    }

    // Si el chartType es especializado, forzar template:chart para que no lo sobreescriban
    const STANDARD_TYPES = ['bar', 'line', 'area', 'pie', 'doughnut'];
    if (parsed.chartType && !STANDARD_TYPES.includes(parsed.chartType) &&
        !['candlestick','bollinger','stacked-area','diverging-bar','radial-stacked-bar','hierarchical-bar','bar-race'].includes(parsed.template)) {
      parsed.template = 'chart';
      console.log(`[orchestrator] template forced to 'chart' for specialized chartType: ${parsed.chartType}`);
    }
    return parsed;
  } catch (err) {
    console.log(
      '[orchestrator] intent interpretation failed:',
      (err as Error).message,
    );
    return fallback;
  }
}

// ─── Step 3: Generate UIConfig with Bedrock ───────────────────


function buildCompactSystemPrompt(chartType: string | null, template: string): string {
  const chartSchema = chartType && !['bar','line','area','pie','doughnut'].includes(chartType) ? '' :
    `- Chart: { type: "bar"|"line"|"area"|"pie"|"doughnut", title?, data: { labels: [], datasets: [{ label, data: [], backgroundColor }] } }`;
  return `Genera un UIConfig JSON para Macropay (ventas a credito MXN).
Responde SOLO con JSON valido, sin markdown.

Schema: { "title": "string", "layout": "vertical", "components": [{ "component": "NombreComponente", "props": {...} }] }

Componentes:
- KPIGrid: { items: [{ title, value, subtitle?, trendDirection?: "up"|"down"|"neutral", icon? }] }
${chartSchema}
- Chart (area/line multi-serie): { type: "area"|"line", title?, data: { labels: [], datasets: [{ label, data: [], backgroundColor }] } }
- ProgressGroup: { title?, items: [{ label, value (0-100), color? }] }
- TransactionList: { title?, items: [{ title, subtitle?, amount, date?, status?: "positive"|"negative"|"neutral" }] }
- DataSummary: { title?, columns: [{ key, label }], rows: [...] }

Reglas:
- Usa aggregations.groupBy.data para el chart principal (labels y values)
- Usa aggregations.numericSummaries para KPIGrid
- Usa aggregations.crossAggregation.data para charts multi-serie (si existe)
- Formatea montos: >=1M -> "$1.2M", >=1K -> "$45.3K"
- NUNCA generes arrays vacios
- Genera EXACTAMENTE 5 componentes: KPIGrid + Chart principal + ProgressGroup + Chart treemap + TransactionList
- Colores: ["#5bb8f5","#22d3ee","#a78bfa","#34d399","#fbbf24","#f472b6","#60a5fa","#4ade80"]`;
}

async function generateUIConfig(
  intent: string,
  parsedIntent: Awaited<ReturnType<typeof interpretIntent>>,
  records: Record<string, unknown>[],
  dateRange?: { gte?: string; lte?: string },
): Promise<unknown> {
  const totalRecords = records.length;
  // Comparison mode: reduce sample to avoid token overflow with multi-dataset charts
  const isComparison = (parsedIntent as Record<string, unknown>).multiDataset === true ||
    (Array.isArray(parsedIntent.filters.categoria) && (parsedIntent.filters.categoria as string[]).length > 1) ||
    (Array.isArray(parsedIntent.filters.estado) && (parsedIntent.filters.estado as string[]).length > 1);
  const isRichTemplate = isComparison || parsedIntent.template === 'category';
  const sampleSize = isRichTemplate ? 8 : (totalRecords < 50 ? 10 : 20);
  const sampleRecords = records.slice(0, sampleSize);

  // Compute basic aggregations to help Bedrock
  const aggregations = computeAggregations(records, parsedIntent);

  const systemPrompt = `Eres un experto en visualización de datos para Macropay, una empresa mexicana de ventas a crédito de productos como motos, celulares, bicicletas eléctricas, pantallas, tablets, consolas, audio y accesorios.

Tu rol es generar dashboards claros, informativos y visualmente ricos para que los equipos de ventas, cobranza y dirección puedan tomar decisiones rápidas. El usuario final puede ser un gerente, un analista o un agente de Alexa que pide información en lenguaje natural.

Contexto del negocio:
- Los créditos tienen estatus: al_corriente (bueno), atrasado (riesgo), liquidado (completado), cancelado (perdido)
- Los canales de venta son: tienda_fisica, en_linea, telefono
- Las ventas se distribuyen en los 32 estados de México
- Los montos están en pesos mexicanos (MXN)
- Un crédito atrasado representa riesgo de cartera vencida
- El monto_total_credito incluye intereses; precio_contado es el valor sin financiamiento

Componentes disponibles para renderizar:
${COMPONENT_CATALOG.map((c) => `- ${c.name}: ${c.description}`).join('\n')}

UIConfig schema:
{
  "title": "string",
  "description": "string (opcional)",
  "layout": "vertical",
  "components": [{ "component": "NombreComponente", "props": { ... } }]
}

Props por componente:
- KPIGrid: { items: [{ title, value, subtitle?, trend?, trendDirection?: "up"|"down"|"neutral", icon? }] }
- Chart (standard): { type: "bar"|"line"|"pie"|"doughnut"|"area", title?, data: { labels: [], datasets: [{ label, data: [], backgroundColor }] } }
- Chart (scatter): { type: "scatter", title?, data: { labels: ["x1","x2",...], datasets: [{ label, data: [y1,y2,...] }] } }
  labels = valores del eje X (numéricos como strings), data = valores del eje Y. Usa 2 campos numéricos del dataset.
- Chart (radar): { type: "radar", title?, data: { labels: ["dim1","dim2",...], datasets: [{ label: "serie", data: [v1,v2,...] }] } }
  labels = dimensiones/categorías (eje radial), cada dataset es una serie. Ideal para comparar múltiples categorías en varias métricas.
- Chart (funnel): { type: "funnel", title?, data: { labels: ["Etapa1","Etapa2",...], datasets: [{ data: [v1,v2,...] }] } }
  Ordena de mayor a menor automáticamente. Usa para mostrar conversión por etapas (ej: total → activos → al_corriente → liquidados).
- Chart (gauge): { type: "gauge", title?, data: { labels: ["Nombre del indicador"], datasets: [{ data: [valor_0_a_100] }] } }
  Un solo valor entre 0 y 100. Ideal para % de cumplimiento, % morosidad, % liquidados.
- Chart (hexbin-map): { type: "hexbin-map", title?, data: [{ name: string, lon: number, lat: number, value: number, size?: number }] }
  Mapa de México con hexágonos. Cada punto tiene coordenadas geográficas (lon/lat en grados decimales) y un valor numérico.
  El tamaño del hexágono representa la densidad (cantidad de puntos en esa celda) y el color representa el valor promedio.
  Usa SOLO cuando el análisis sea geográfico con datos de lat/lon por registro. Si no tienes lat/lon, usa Chart type:"map" en su lugar.
  Coordenadas aproximadas por estado: Ciudad de México (lon:-99.1, lat:19.4), Jalisco (lon:-103.3, lat:20.7), Nuevo León (lon:-100.3, lat:25.7), Yucatán (lon:-89.6, lat:20.9), Veracruz (lon:-96.1, lat:19.2), Chihuahua (lon:-106.1, lat:28.6), Sonora (lon:-110.9, lat:29.1), Oaxaca (lon:-96.7, lat:17.1), Guerrero (lon:-99.5, lat:17.4), Puebla (lon:-98.2, lat:19.0).
- Chart (treemap): { type: "treemap", title?, data: { labels: ["nombre1","nombre2",...], datasets: [{ data: [v1,v2,...] }] } }
  labels = nombres de los nodos, data = tamaños. Ideal para distribución proporcional de categorías.
- Chart (map): { type: "map", title?, data: { labels: ["Estado1","Estado2",...], datasets: [{ data: [v1,v2,...] }] } }
  labels = nombres exactos de los 32 estados de México (con acento), data = valores numéricos por estado.
  Usa SOLO cuando el groupBy o el análisis principal sea por estado geográfico sin otra dimensión.
  NUNCA uses map cuando hay un filtro de estado activo (singleEstado) — en ese caso usa bar por ciudad o categoría.
  Nombres válidos: Aguascalientes, Baja California, Baja California Sur, Campeche, Chiapas, Chihuahua, Ciudad de México, Coahuila, Colima, Durango, Guanajuato, Guerrero, Hidalgo, Jalisco, México, Michoacán, Morelos, Nayarit, Nuevo León, Oaxaca, Puebla, Querétaro, Quintana Roo, San Luis Potosí, Sinaloa, Sonora, Tabasco, Tamaulipas, Tlaxcala, Veracruz, Yucatán, Zacatecas.
  Para generar OHLC: agrupa registros por fecha. open=primer valor del día, high=máximo, low=mínimo, close=último valor. USA LOS DATOS REALES de aggregations.
- Chart (bollinger): { type: "bollinger", title?, data: [{ date: "YYYY-MM-DD", value: number }], n?: 20, k?: 2 }
  Genera una serie temporal con un valor por fecha (suma o promedio del campo numérico por día).
- Chart (stacked-area): { type: "stacked-area", title?, data: [{ label: "periodo", serie1: number, serie2: number, ... }], keys: ["serie1","serie2",...], colors?: [] }
  Cada objeto tiene un label (eje X) y un valor numérico por cada serie (eje Y apilado).
  REQUISITO: stacked-area requiere mínimo 2 series (keys.length >= 2). Si solo hay 1 serie, usa type:"area" en su lugar.
- Chart (diverging-bar): { type: "diverging-bar", title?, data: [{ label: "categoría", values: [{ key: "segmento", value: number }] }], keys: ["seg_negativo1","seg_negativo2","seg_positivo1","seg_positivo2"], neutralKey?: "neutral", negativeLabel?: "← Más riesgo", positiveLabel?: "Más salud →" }
  IMPORTANTE: los keys DEBEN estar ordenados de más negativo a más positivo. El componente normaliza automáticamente a porcentajes y usa colores espectrales divergentes (rojo→amarillo→verde→azul). Los values son conteos o sumas absolutas — la normalización se hace en el frontend. Incluye negativeLabel y positiveLabel para dar contexto al usuario.
- Chart (radial-stacked-bar): { type: "radial-stacked-bar", title?, data: [{ label: "categoría", serie1: number, serie2: number }], keys: ["serie1","serie2",...], colors?: [] }
- Chart (hierarchical-bar): { type: "hierarchical-bar", title?, data: { name: "Root", children: [{ name: "Grupo", value?: number, children?: [...] }] } }
  Construye un árbol jerárquico de 2-3 niveles con sumas por nivel.
- Chart (bar-race): { type: "bar-race", title?, frames: [{ label: "periodo", items: [{ name: "categoría", value: number }] }], maxBars?: 10, duration?: 800 }
  Genera frames temporales. Cada frame muestra el ranking acumulado hasta ese periodo. Los items deben estar ordenados por value descendente.
- Chart (sankey): { type: "sankey", title?, data: { nodes: [{ name: string }], links: [{ source: string, target: string, value: number }] } }
  Flujo entre dimensiones. Ideal para mostrar cómo se distribuyen las ventas: canal_venta → categoria → estatus_credito.
  REGLA: todos los nombres en links.source y links.target deben existir en nodes. value = monto_total_credito o conteo.
- Chart (calendar-heatmap): { type: "calendar-heatmap", title?, data: { labels: ["YYYY-MM-DD", ...], datasets: [{ data: [value, ...] }] } }
  Mapa de calor en formato calendario. labels = fechas ISO, data = valor por día (monto o conteo).
  Ideal para detectar estacionalidad, días pico, patrones semanales. Usa fieldSummaries de fecha_venta.
- Chart (sunburst): { type: "sunburst", title?, data: { labels: ["Categoria/Producto", ...], datasets: [{ data: [value, ...] }] } }
  Jerarquía circular con drill-down. labels en formato "Padre/Hijo" (ej: "Motos/BAJAJ PULSAR").
  Ideal para mostrar composición: categoría → producto. Usa fieldSummaries.categoria y fieldSummaries.producto.
- Chart (boxplot): { type: "boxplot", title?, data: { labels: ["categoria1", ...], datasets: [{ label: "cat", data: [min, Q1, median, Q3, max] }] } }
  Distribución estadística de precios o montos por categoría. Cada dataset es una categoría con 5 valores precomputados.
  Usa numericSummaries para derivar min/max y estima Q1/Q3 como avg±(max-min)*0.25.
- Chart (theme-river): { type: "theme-river", title?, data: { labels: ["YYYY-MM", ...], datasets: [{ label: "serie", data: [value, ...] }] } }
  Evolución fluida de la composición en el tiempo. Cada dataset es una serie (categoría/canal/estatus).
  Usa crossAggregation.data si existe. Requiere mínimo 2 series y 4+ puntos temporales.
- DataSummary: { title?, columns: [{ key, label }], rows: [...] }
- TransactionList: { title?, items: [{ title, subtitle?, amount, date?, status?: "positive"|"negative"|"neutral" }] }
- ProgressGroup: { title?, items: [{ label, value (0-100), color? }] }
- StatCard: { title, value, subtitle?, trend?, trendDirection?, icon? }
- MiniChart: { title: string, description: string } — usa \\n para separar bullets. Ideal para insights clave, anomalias o recomendaciones derivadas de los datos. Ejemplo: { title: "Insight Clave", description: "67% de creditos al corriente\\nProducto top: BAJAJ PULSAR\\nEstado con mayor morosidad: Guerrero" }

IMPORTANTE PARA CHARTS ESPECIALIZADOS:
- Para candlestick: DEBES generar datos OHLC reales agrupando los registros por fecha. Usa aggregations para derivar open/high/low/close. NUNCA generes data vacía [].
- Para bar-race: Genera frames acumulativos — cada frame es la suma hasta ese periodo.
- Para hierarchical-bar: Usa 2 campos categóricos para crear padre → hijos.
- Para stacked-area y radial-stacked-bar: Usa un campo temporal como eje X y un campo categórico para las series.
- Si el filtro no encuentra datos, OMITE el filtro y usa todos los registros disponibles.

REGLA CRÍTICA — CHART TYPE OBLIGATORIO:
Si el userMessage especifica un "ChartType forzado", DEBES usar ESE tipo en el Chart principal, sin excepción.
Esta regla tiene prioridad sobre cualquier template o instrucción posterior.
Los tipos válidos son: bar, line, area, pie, doughnut, scatter, radar, funnel, gauge, hexbin-map, treemap,
bollinger, stacked-area, diverging-bar, radial-stacked-bar, candlestick, hierarchical-bar, bar-race.

FILOSOFÍA DE VISUALIZACIÓN:
Siempre genera dashboards RICOS y COMPLETOS. El usuario quiere entender sus datos en profundidad. Cada dashboard debe contar una historia completa con múltiples perspectivas. NUNCA generes menos de 6 componentes. Más charts = mejor dashboard.

REGLAS ANTI-CHART-INÚTIL (obligatorias):
- NUNCA uses map cuando hay un filtro de estado activo (singleEstado en el contexto) — usa bar por ciudad o categoría
- NUNCA uses area/line con 1 solo punto temporal — si el rango es ≤ 1 mes y hay pocas fechas, usa bar comparativo
- NUNCA uses stacked-area con 1 sola serie — degrada a area simple
- Los valores del hexbin-map DEBEN ser puntos reales con lat/lon del dataset, nunca inventados
- NUNCA uses hexbin-map si no tienes coordenadas lat/lon por registro — usa map en su lugar

REGLA CRÍTICA — NO REPETIR INFORMACIÓN:
- NUNCA uses dos charts que muestren exactamente la misma dimensión y métrica
- Si ya tienes un bar por estado, el siguiente chart debe ser por categoría, canal, producto u otra dimensión
- Si ya tienes un doughnut de estatus_credito, no uses otro pie/doughnut de estatus_credito
- Si ya tienes un treemap de categoría, no uses otro bar de categoría con los mismos datos
- Cada componente debe aportar una perspectiva DIFERENTE del dataset
- Prefiere cruzar 2 dimensiones (hexbin-map, stacked-area, diverging-bar) sobre repetir 1 dimensión

DIVERSIDAD DE CHARTS (obligatorio):
- NUNCA uses doughnut más de 1 vez por dashboard
- NUNCA uses bar más de 2 veces por dashboard
- Prefiere treemap sobre doughnut cuando hay más de 4 categorías
- Prefiere area/line sobre bar cuando hay datos temporales
- Usa al menos 2 tipos de chart diferentes por dashboard
- Si ya usaste doughnut, el siguiente chart de distribución debe ser treemap o bar

REGLAS DE VISUALIZACIÓN (obligatorias):
1. SIEMPRE incluye un KPIGrid con 4-5 métricas de resumen
2. SIEMPRE incluye al menos 3 Charts de TIPOS DIFERENTES con perspectivas distintas
3. SIEMPRE incluye un TransactionList con las últimas 6-8 operaciones
4. Usa aggregations.groupBy.data para labels/values del Chart principal — los values son MONTOS en MXN (sum de monto_total_credito) salvo que metric sea "count"
   REGLA CRÍTICA DE MÉTRICAS: En TODOS los charts (bar, treemap, doughnut, area, line, map, etc.), usa SIEMPRE el campo [sum] de monto_total_credito como valor, NO el campo [count]. Solo usa [count] cuando el usuario pida explícitamente "cuántos", "cantidad", "número de". Los valores de fieldSummaries.topValues tienen tanto [count] como [sum] — usa [sum].
   REGLA CRÍTICA DE MÉTRICAS: En TODOS los charts (bar, treemap, doughnut, area, line, map, etc.), usa SIEMPRE el campo [sum] de monto_total_credito como valor, NO el campo [count]. Solo usa [count] cuando el usuario pida explícitamente "cuántos", "cantidad", "número de". Los valores de fieldSummaries.topValues tienen tanto [count] como [sum] — usa [sum].
5. Usa aggregations.numericSummaries para los valores de KPIGrid — prioriza monto_total_credito sobre conteos
6. Usa aggregations.fieldSummaries[campo].topValues para charts de distribución secundarios — usa el campo [sum] (monto_total_credito) de cada topValue como valor del chart, NO el campo [count]. El campo [sum] ya está pre-calculado en cada topValue.
7. Responde SOLO con el JSON del UIConfig, sin markdown, sin explicaciones
8. Formatea montos: >= 1M → "$1.2M", >= 1K → "$45.3K", resto → "$1,234"

COLORES para charts (usa estos exactos):
["#5bb8f5","#22d3ee","#a78bfa","#34d399","#fbbf24","#f472b6","#60a5fa","#4ade80","#fb923c","#e879f9","#f5455a","#10d97e","#38bdf8","#818cf8","#fde68a"]`;

  const dateRangeLabel = dateRange
    ? (() => {
        const from = dateRange.gte ? new Date(dateRange.gte) : null;
        const to   = dateRange.lte ? new Date(dateRange.lte) : null;
        const fmt  = (d: Date) => d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
        if (from && to) return `${fmt(from)} – ${fmt(to)}`;
        if (from) return `desde ${fmt(from)}`;
        if (to)   return `hasta ${fmt(to)}`;
        return null;
      })()
    : null;

  const topN = (parsedIntent as Record<string, unknown>).topN as number | null;

  // ─── Context flags for smart template instructions ────────
  const filterCategoria = parsedIntent.filters.categoria;
  const filterEstado = parsedIntent.filters.estado;
  const filterEstatus = parsedIntent.filters.estatus_credito;
  const singleCategoria = typeof filterCategoria === 'string';
  const singleEstado = typeof filterEstado === 'string';
  const singleEstatus = typeof filterEstatus === 'string';
  const multiCategoria = Array.isArray(filterCategoria) && filterCategoria.length > 1;
  const multiEstado = Array.isArray(filterEstado) && filterEstado.length > 1;

  // When filtered to 1 categoria, generate a rich single-category dashboard
  const categoriaCtx = singleCategoria
    ? `FILTRO ACTIVO: categoria="${filterCategoria}". Este es un dashboard de UNA SOLA CATEGORIA — genera analisis profundo de esa categoria.
REGLAS OBLIGATORIAS para dashboard de categoria unica:
1. NUNCA uses Chart treemap/doughnut/pie agrupado por categoria — solo hay una.
2. Genera minimo 6 componentes con estas perspectivas DIFERENTES:
   a. KPIGrid: total ventas, monto total, promedio precio, % al_corriente, top producto
   b. Chart area o line: evolucion mensual de ventas de ${filterCategoria} (usa crossAggregation.data o groupBy temporal)
   c. Chart bar: top 8 productos de ${filterCategoria} por volumen (usa fieldSummaries.producto.topValues)
   d. Chart treemap: distribucion geografica — top 10 estados (usa fieldSummaries.estado.topValues)
   e. ProgressGroup: distribucion de estatus_credito — colores: al_corriente="#10d97e", liquidado="#5bb8f5", atrasado="#fbbf24", cancelado="#f5455a"
   f. TransactionList: ultimas 6 ventas de ${filterCategoria}
3. Opcionalmente agrega: Chart hexbin-map (distribución geográfica de densidad), Chart diverging-bar (salud crediticia por estado), ProgressGroup canal_venta`
    : '';
  const estadoCtx = singleEstado
    ? `FILTRO ACTIVO: estado="${filterEstado}". Este es un dashboard de UN SOLO ESTADO — genera analisis profundo de ese estado.
REGLAS OBLIGATORIAS para dashboard de estado unico:
1. NUNCA uses Chart agrupado por estado — solo hay uno. NUNCA uses Chart type:"map".
2. Genera minimo 6 componentes con estas perspectivas DIFERENTES:
   a. KPIGrid: total ventas, monto total, promedio precio, % al_corriente, top categoria
   b. Chart area o line: evolucion mensual de ventas en ${filterEstado} (usa crossAggregation.data o groupBy temporal)
   c. Chart bar: top 8 ciudades o sucursales en ${filterEstado} (usa fieldSummaries.ciudad.topValues o fieldSummaries.sucursal.topValues)
   d. Chart treemap: distribucion por categoria en ${filterEstado} (usa fieldSummaries.categoria.topValues)
   e. ProgressGroup: distribucion de estatus_credito — colores: al_corriente="#10d97e", liquidado="#5bb8f5", atrasado="#fbbf24", cancelado="#f5455a"
   f. TransactionList: ultimas 6 ventas en ${filterEstado}`
    : '';
  const estatusCtx = singleEstatus
    ? `FILTRO ACTIVO: estatus_credito="${filterEstatus}". NUNCA uses ProgressGroup de estatus_credito — solo hay un estatus. En su lugar usa ProgressGroup por canal_venta o categoria.`
    : '';

  // Multi-value filters → comparison mode: generate multi-dataset charts
  const multiCategoriaList = multiCategoria ? (filterCategoria as string[]).join(', ') : '';
  const multiEstadoList = multiEstado ? (filterEstado as string[]).join(', ') : '';
  const isMultiDataset = (parsedIntent as Record<string, unknown>).multiDataset === true;
  const hasTiempoFilter = (parsedIntent as Record<string, unknown>).granularity != null ||
    parsedIntent.groupBy === 'fecha_venta';

  const comparisonCtx = multiCategoria
    ? `MODO COMPARACION ACTIVO: comparando ${(filterCategoria as string[]).length} categorias: [${multiCategoriaList}].
REGLAS OBLIGATORIAS — genera EXACTAMENTE estos 4 charts:
1. Chart scatter: correlacion precio_contado vs plazo_semanas. Un dataset por categoria (${multiCategoriaList}).
   USA MAXIMO 8 PUNTOS POR DATASET. labels = primeros 8 valores de precio_contado (strings), datasets[i].data = plazo_semanas correspondientes.
2. Chart area: evolucion mensual. Un dataset por categoria. Usa crossAggregation.data si existe.
3. Chart line: tendencia monto_total_credito por mes. Un dataset por categoria. Usa crossAggregation.data si existe.
4. Chart bar: comparacion por estado (top 6 estados). Un dataset por categoria.
Ademas: KPIGrid con totales por categoria.`
    : multiEstado
    ? `MODO COMPARACION ACTIVO: comparando ${(filterEstado as string[]).length} estados: [${multiEstadoList}].
REGLAS OBLIGATORIAS — genera EXACTAMENTE estos 4 charts:
1. Chart scatter: correlacion precio_contado vs plazo_semanas. Un dataset por estado (${multiEstadoList}).
   USA MAXIMO 8 PUNTOS POR DATASET.
2. Chart area: evolucion mensual. Un dataset por estado. Usa crossAggregation.data si existe.
3. Chart line: tendencia monto_total_credito por mes. Un dataset por estado.
4. Chart bar: comparacion por categoria. Un dataset por estado.
Ademas: KPIGrid con totales por estado.`
    : isMultiDataset
    ? `MODO MULTI-DATASET ACTIVO: el chart principal debe tener datasets separados por cada serie detectada.
   Usa fieldSummaries para calcular los valores por serie.`
    : '';

  const filterCtxBlock = [categoriaCtx, estadoCtx, estatusCtx, comparisonCtx].filter(Boolean).join('\n');

  // When singleCategoria or singleEstado is active, override template to use the rich single-filter instructions
  const effectiveTemplate = singleCategoria ? '__singleCategoria__'
    : singleEstado ? '__singleEstado__'
    : parsedIntent.template;

  const userMessage = `Intent del usuario: "${intent}"
Template sugerido: ${parsedIntent.template}
GroupBy detectado: ${parsedIntent.groupBy ?? 'ninguno'}
Métrica: ${parsedIntent.metric}${parsedIntent.metricField ? ` de ${parsedIntent.metricField}` : ''}
${dateRangeLabel ? `Rango de fechas evaluado: ${dateRangeLabel} — DEBES incluir este rango en el campo "description" del UIConfig (ej: "Análisis del período ${dateRangeLabel}").` : ''}
${parsedIntent.chartType ? `ChartType forzado: ${parsedIntent.chartType} — USA ESTE TIPO en el Chart principal, es OBLIGATORIO. No uses bar ni doughnut si el tipo forzado es diferente.` : ''}
${topN ? `Top N solicitado: ${topN} — muestra SOLO los ${topN} primeros grupos en el chart (ordenados de mayor a menor). El KPIGrid debe reflejar el total de todos los registros, no solo los top ${topN}.` : ''}

CONTEXTO DE LOS DATOS (${totalRecords} registros totales):
${JSON.stringify({ ...aggregations, groupBy: aggregations.groupBy ? { ...(aggregations.groupBy as Record<string,unknown>), data: ((aggregations.groupBy as Record<string,unknown>).data as unknown[])?.slice(0, isRichTemplate ? 8 : 20) } : undefined, crossAggregation: aggregations.crossAggregation ? { ...(aggregations.crossAggregation as Record<string,unknown>), data: ((aggregations.crossAggregation as Record<string,unknown>).data as unknown[])?.slice(0, isRichTemplate ? 6 : 12) } : undefined }, null, 2)}

Muestra de registros (${sampleRecords.length} de ${totalRecords}):
${JSON.stringify(sampleRecords, null, 2)}

INSTRUCCIONES SEGÚN TEMPLATE:
${filterCtxBlock ? filterCtxBlock + '\n' : ''}
${
  parsedIntent.chartType && !['bar','line','area','pie','doughnut'].includes(parsedIntent.chartType)
    ? `El ChartType forzado es "${parsedIntent.chartType}". Genera mínimo 5 componentes:
1. KPIGrid: 3-4 métricas de resumen (total registros, monto total, promedio)
2. Chart ${parsedIntent.chartType}: chart principal con los datos más relevantes para el intent.
   Usa el schema correcto para este tipo según las Props definidas arriba.
   Usa aggregations para poblar los datos reales.
${parsedIntent.chartType === 'map' ? `3. ProgressGroup: distribución de estatus_credito — calcula % reales desde fieldSummaries.estatus_credito.topValues, colores: al_corriente="#10d97e", liquidado="#5bb8f5", atrasado="#fbbf24", cancelado="#f5455a"
4. ProgressGroup: distribución por canal_venta — calcula % reales desde fieldSummaries.canal_venta.topValues, colores: ["#a78bfa","#22d3ee","#fbbf24"]
5. Chart treemap: distribución por categoría (top 8 categorías, valor = conteo)
6. TransactionList: últimas 6 operaciones` : `3. ProgressGroup: distribución de estatus_credito — calcula % reales desde fieldSummaries.estatus_credito.topValues, colores: al_corriente="#10d97e", liquidado="#5bb8f5", atrasado="#fbbf24", cancelado="#f5455a"
4. Chart treemap: distribución por categoría (top 8 categorías, valor = conteo)
5. TransactionList: últimas 6 operaciones`}`
    : effectiveTemplate === '__singleCategoria__'
    ? categoriaCtx
    : effectiveTemplate === '__singleEstado__'
    ? estadoCtx
    : effectiveTemplate === 'candlestick'
          ? `Genera un dashboard de VELAS/CANDLESTICK con KPIGrid + Chart candlestick (OHLC por fecha: open=primer valor, high=max, low=min, close=ultimo) + TransactionList.`
          : effectiveTemplate === 'bollinger'
            ? `Genera un dashboard de BANDAS DE BOLLINGER con KPIGrid + Chart bollinger (data: [{date,value}]) + TransactionList.`
            : effectiveTemplate === 'stacked-area'
              ? `Genera un dashboard de AREA APILADA con KPIGrid + Chart stacked-area (data:[{label,serie1,serie2,...}], keys:[...]) + TransactionList.`
              : effectiveTemplate === 'diverging-bar'
                ? `Genera un dashboard DIVERGENTE con KPIGrid + Chart diverging-bar (keys ordenados neg→pos: ["cancelado","atrasado","al_corriente","liquidado"], negativeLabel, positiveLabel) + TransactionList.`
                : effectiveTemplate === 'radial-stacked-bar'
                  ? `Genera un dashboard RADIAL con KPIGrid + Chart radial-stacked-bar (data:[{label,serie1,serie2}], keys:[...]) + TransactionList.`
                  : effectiveTemplate === 'hierarchical-bar'
                    ? `Genera un dashboard JERARQUICO con KPIGrid + Chart hierarchical-bar (data:{name,children:[{name,value,children:[...]}]}) + TransactionList.`
                    : effectiveTemplate === 'bar-race'
                      ? `Genera un dashboard de CARRERA DE BARRAS con KPIGrid + Chart bar-race (frames:[{label,items:[{name,value}]}], maxBars:10) + TransactionList.`
                      : effectiveTemplate === 'table'
                        ? `Genera minimo 4 componentes: KPIGrid + DataSummary (columnas relevantes) + 2 charts de distribucion variados.`
                        : `Genera el dashboard mas util, rico y variado posible para este intent. Minimo 6 componentes con perspectivas completamente diferentes entre si. Usa los datos de aggregations para elegir los charts mas informativos. INCLUYE al menos 1 componente MiniChart con insights clave derivados de los datos (anomalias, tendencias, recomendaciones en bullets).`
}

IMPORTANTE: Usa los datos reales de aggregations. Si fieldSummaries.estado.uniqueValues > 5, usa Chart bar para estado, nunca KPIGrid por estado. NUNCA generes arrays de datos vacíos — siempre usa los registros disponibles para calcular valores reales.

Si aggregations.crossAggregation está disponible, ÚSALO para charts multi-serie temporales (area, line, stacked-area):
- crossAggregation.data = array de { label: "YYYY-MM", serie1: N, serie2: N, ... } con datos REALES
- crossAggregation.series = lista de series disponibles
- NUNCA inventes valores para charts multi-serie si crossAggregation existe — usa sus datos directamente

Genera el UIConfig JSON ahora.`;

  const response = await bedrockClient.send(
    new ConverseCommand({
      modelId: MODEL_ID,
      system: [{ text: (() => { console.log(`[generateUIConfig] totalRecords=${totalRecords} -> ${totalRecords < 100 ? 'COMPACT' : 'FULL'} prompt`); return totalRecords < 100 ? buildCompactSystemPrompt(parsedIntent.chartType, parsedIntent.template) : systemPrompt; })() }],
      messages: [{ role: 'user', content: [{ text: userMessage }] }],
      inferenceConfig: { maxTokens: 8192, temperature: 0 },
    }),
  );

  const block = response.output?.message?.content?.[0];
  if (!block || !('text' in block))
    throw new Error('Bedrock did not return UIConfig');

  const raw = block
    .text!.replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  try {
    const parsed = JSON.parse(raw);
    const uiConfig = (parsed as Record<string, unknown>).uiConfig ?? parsed;
    const repaired = repairEmptyCharts(uiConfig, aggregations, parsedIntent);
    return sanitizeUIConfig(repaired, parsedIntent, aggregations);
  } catch {
    const lastBracket = raw.lastIndexOf('},');
    if (lastBracket > 0) {
      try {
        const recovered = raw.slice(0, lastBracket + 1) + ']}';
        const parsed = JSON.parse(recovered);
        const uiConfig = (parsed as Record<string, unknown>).uiConfig ?? parsed;
        const repaired = repairEmptyCharts(uiConfig, aggregations, parsedIntent);
        return sanitizeUIConfig(repaired, parsedIntent, aggregations);
      } catch {
        /* fall through */
      }
    }
    throw new Error(`Bedrock returned invalid JSON: ${raw.slice(0, 200)}`);
  }
}

// ─── All 32 Mexico states ───────────────────────────────────────────────

const ALL_ESTADOS = [
  'Aguascalientes','Baja California','Baja California Sur','Campeche','Chiapas','Chihuahua',
  'Ciudad de México','Coahuila','Colima','Durango','Guanajuato','Guerrero','Hidalgo','Jalisco',
  'México','Michoacán','Morelos','Nayarit','Nuevo León','Oaxaca','Puebla','Querétaro',
  'Quintana Roo','San Luis Potosí','Sinaloa','Sonora','Tabasco','Tamaulipas','Tlaxcala',
  'Veracruz','Yucatán','Zacatecas',
];

// ─── Post-processor: remove charts that make no sense given active filters ──

function sanitizeUIConfig(
  uiConfig: unknown,
  parsedIntent: { filters: Record<string, unknown>; groupBy: string | null },
  aggregations: Record<string, unknown>,
): unknown {
  const config = uiConfig as Record<string, unknown>;
  if (!Array.isArray(config?.components)) return uiConfig;

  const filterCategoria = parsedIntent.filters.categoria;
  const filterEstado    = parsedIntent.filters.estado;
  const filterEstatus   = parsedIntent.filters.estatus_credito;
  const singleCategoria = typeof filterCategoria === 'string';
  const singleEstado    = typeof filterEstado === 'string';
  const singleEstatus   = typeof filterEstatus === 'string';

  // Pre-compute fallback data for replacements
  const fieldSummaries = (aggregations.fieldSummaries ?? {}) as Record<string, { topValues: { value: string; count: number; sum?: number }[] }>;
  const productoTop = fieldSummaries.producto?.topValues?.slice(0, 8) ?? [];
  const estadoTop   = fieldSummaries.estado?.topValues?.slice(0, 10) ?? [];
  const canalTop    = fieldSummaries.canal_venta?.topValues?.slice(0, 3) ?? [];
  const estatusTop  = fieldSummaries.estatus_credito?.topValues ?? [];
  // Use monto sum when available, else count
  const metricVal = (item: { count: number; sum?: number }) => item.sum ?? item.count;

  config.components = (config.components as Record<string, unknown>[]).map(comp => {
    if (comp.component !== 'Chart') return comp;
    const props = comp.props as Record<string, unknown>;
    const type  = props.type as string;
    const data  = props.data as { labels?: unknown[]; datasets?: unknown[] } | undefined;
    const labels = data?.labels ?? [];

    // ── Rule 0b: map with singleEstado filter — replace with bar by ciudad or categoria ──
    if (type === 'map' && singleEstado) {
      console.log(`[sanitize] replacing map (singleEstado) → bar by ciudad/categoria`);
      const ciudadTop = fieldSummaries.ciudad?.topValues?.slice(0, 8) ?? [];
      const catTop2   = fieldSummaries.categoria?.topValues?.slice(0, 8) ?? [];
      const source    = ciudadTop.length >= 3 ? ciudadTop : catTop2;
      const groupLabel = ciudadTop.length >= 3 ? 'Ciudad' : 'Categoría';
      if (source.length > 0) {
        return {
          ...comp,
          props: {
            ...props,
            type: 'bar',
            data: {
              labels: source.map(s => s.value),
              datasets: [{ label: 'Ventas', data: source.map(s => s.count), backgroundColor: '#5bb8f5' }],
            },
            title: props.title ?? `Ventas por ${groupLabel} — ${filterEstado}`,
          },
        };
      }
    }

    // ── Rule 0: map with < 32 states — fill missing states with real data or 0 ──
    if (type === 'map') {
      const existingLabels = (labels as string[]);
      const existingValues = (data?.datasets?.[0] as { data?: number[] } | undefined)?.data ?? [];
      // Build lookup from existing data
      const valueMap: Record<string, number> = {};
      existingLabels.forEach((l, i) => { valueMap[l] = existingValues[i] ?? 0; });
      // Also pull from fieldSummaries.estado if available
      const estadoSummary = fieldSummaries.estado?.topValues ?? [];
      estadoSummary.forEach(({ value: v, count: c }) => {
        if (!(v in valueMap)) valueMap[v] = c;
      });
      // Fill all 32 states
      const fullLabels = ALL_ESTADOS;
      const fullValues = fullLabels.map(s => valueMap[s] ?? 0);
      if (existingLabels.length < 32) {
        console.log(`[sanitize] expanding map from ${existingLabels.length} → 32 states`);
        return {
          ...comp,
          props: {
            ...props,
            data: {
              labels: fullLabels,
              datasets: [{ label: (data?.datasets?.[0] as { label?: string } | undefined)?.label ?? 'Ventas', data: fullValues }],
            },
          },
        };
      }
    }

    // ── Rule 1: treemap/doughnut/pie/radar with 1 label and singleCategoria filter ──
    // Only replace if the single label IS the filtered category (useless chart)
    if (singleCategoria && ['treemap', 'doughnut', 'pie', 'radar'].includes(type) && (labels as unknown[]).length <= 1) {
      const singleLabel = String((labels as unknown[])[0] ?? '');
      const isFilteredCat = singleLabel === filterCategoria || singleLabel === '';
      if (!isFilteredCat) return comp; // has valid data, keep it
      console.log(`[sanitize] replacing ${type} (1 label = filtered categoria) → bar by producto`);
      if (productoTop.length > 0) {
        return {
          ...comp,
          props: {
            ...props,
            type: 'bar',
            data: {
              labels: productoTop.map(p => p.value),
              datasets: [{ label: 'Ventas', data: productoTop.map(p => p.count), backgroundColor: '#5bb8f5' }],
            },
            title: props.title ?? `Ventas por Producto — ${filterCategoria}`,
          },
        };
      }
      if (estadoTop.length > 0) {
        return {
          ...comp,
          props: {
            ...props,
            type: 'bar',
            data: {
              labels: estadoTop.map(e => e.value),
              datasets: [{ label: 'Ventas', data: estadoTop.map(e => e.count), backgroundColor: '#a78bfa' }],
            },
            title: props.title ?? `Ventas por Estado — ${filterCategoria}`,
          },
        };
      }
    }

    // ── Rule 2: treemap/doughnut/pie with singleCategoria — only replace if labels are the category itself ──
    // Do NOT replace if Bedrock already generated valid multi-label data (estados, productos, etc.)
    if (singleCategoria && ['treemap', 'doughnut', 'pie'].includes(type)) {
      const labelCount = (labels as unknown[]).length;
      // Only intervene if: 0 labels, or all labels equal the filtered category
      const allLabelsAreCategory = labelCount > 0 && (labels as string[]).every(l => l === filterCategoria);
      if (labelCount === 0 || allLabelsAreCategory) {
        console.log(`[sanitize] replacing ${type} (labels = filtered categoria) → bar by producto`);
        if (productoTop.length > 0) {
          return {
            ...comp,
            props: {
              ...props,
              type: 'bar',
              data: {
                labels: productoTop.map(p => p.value),
                datasets: [{ label: 'Ventas', data: productoTop.map(p => p.count), backgroundColor: '#34d399' }],
              },
              title: props.title ?? `Ventas por Producto — ${filterCategoria}`,
            },
          };
        }
        if (estadoTop.length > 0) {
          return {
            ...comp,
            props: {
              ...props,
              type: 'bar',
              data: {
                labels: estadoTop.map(e => e.value),
                datasets: [{ label: 'Ventas', data: estadoTop.map(e => e.count), backgroundColor: '#34d399' }],
              },
              title: props.title ?? `Ventas por Estado — ${filterCategoria}`,
            },
          };
        }
      }
      // Has valid multi-label data — keep the chart as-is
    }

    // ── Rule 3: ProgressGroup with singleEstatus — replace with canal_venta ──
    if (singleEstatus && comp.component === 'ProgressGroup') {
      const items = (props.items ?? []) as { label: string }[];
      const allSameEstatus = items.length <= 1 || items.every(it =>
        it.label?.toLowerCase().replace(/\s/g, '_') === (filterEstatus as string)
      );
      if (allSameEstatus && canalTop.length > 0) {
        console.log(`[sanitize] replacing ProgressGroup (single estatus) → canal_venta`);
        const total = canalTop.reduce((s, c) => s + c.count, 0) || 1;
        const CANAL_COLORS = ['#a78bfa', '#22d3ee', '#fbbf24'];
        return {
          ...comp,
          props: {
            ...props,
            title: 'Distribución por Canal de Venta',
            items: canalTop.map((c, i) => ({
              label: c.value,
              value: Math.round((c.count / total) * 100),
              color: CANAL_COLORS[i % CANAL_COLORS.length],
            })),
          },
        };
      }
    }

    // ── Rule 4: singleEstado — bar/hexbin-map grouped by estado with 1 label ──
    if (singleEstado && ['bar', 'hexbin-map'].includes(type) && (labels as unknown[]).length <= 1) {
      console.log(`[sanitize] replacing ${type} (1 label, single estado) → bar by categoria`);
      const catTop = fieldSummaries.categoria?.topValues?.slice(0, 8) ?? [];
      if (catTop.length > 0) {
        return {
          ...comp,
          props: {
            ...props,
            type: 'bar',
            data: {
              labels: catTop.map(c => c.value),
              datasets: [{ label: 'Ventas', data: catTop.map(c => c.count), backgroundColor: '#fbbf24' }],
            },
            title: `Ventas por Categoría — ${filterEstado}`,
          },
        };
      }
    }

    // ── Rule 5b: stacked-area with only 1 key — degrade to area ──
    if (type === 'stacked-area') {
      const keys = props.keys as string[] | undefined;
      if (!keys || keys.length < 2) {
        console.log(`[sanitize] stacked-area with <2 keys → area`);
        const areaData = props.data as { label: string; [k: string]: unknown }[] | undefined;
        const key0 = keys?.[0] ?? 'value';
        return {
          ...comp,
          props: {
            ...props,
            type: 'area',
            data: {
              labels: (areaData ?? []).map(d => d.label),
              datasets: [{
                label: key0,
                data: (areaData ?? []).map(d => Number(d[key0] ?? 0)),
                backgroundColor: 'rgba(73,164,216,0.3)',
                borderColor: '#5bb8f5',
              }],
            },
          },
        };
      }
    }

    // ── Rule 5: hexbin-map with singleCategoria — replace with treemap by producto ──
    if (singleCategoria && type === 'hexbin-map') {
      console.log(`[sanitize] replacing hexbin-map (single categoria) → treemap by producto`);
      if (productoTop.length > 0) {
        return {
          ...comp,
          props: {
            ...props,
            type: 'treemap',
            data: {
              labels: productoTop.map(p => p.value),
              datasets: [{ data: productoTop.map(p => p.count) }],
            },
            title: `Distribución por Producto — ${filterCategoria}`,
          },
        };
      }
      // fallback: bar by estado
      if (estadoTop.length > 0) {
        return {
          ...comp,
          props: {
            ...props,
            type: 'bar',
            data: {
              labels: estadoTop.map(e => e.value),
              datasets: [{ label: 'Ventas', data: estadoTop.map(e => e.count), backgroundColor: '#22d3ee' }],
            },
            title: `Ventas por Estado — ${filterCategoria}`,
          },
        };
      }
    }

    return comp;
  });

  // ── Rule 6b: area/line with all datasets having identical repeated values — convert to bar ──
  config.components = (config.components as Record<string, unknown>[]).map(comp => {
    if (comp.component !== 'Chart') return comp;
    const props = comp.props as Record<string, unknown>;
    const type = props.type as string;
    if (!['area', 'line'].includes(type)) return comp;
    const data = props.data as { labels?: unknown[]; datasets?: { data?: number[] }[] } | undefined;
    const datasets = data?.datasets ?? [];
    const allDuplicated = datasets.length > 0 && datasets.every(ds => {
      const vals = ds.data ?? [];
      return vals.length <= 1 || vals.every(v => v === vals[0]);
    });
    if (allDuplicated) {
      console.log(`[sanitize] ${type} with duplicated values → bar`);
      return { ...comp, props: { ...props, type: 'bar' } };
    }
    return comp;
  });

    // -- Rule 6: max 1 bar chart -- convert excess bars to treemap --
  let barCount = 0;
  config.components = (config.components as Record<string, unknown>[]).map(comp => {
    if (comp.component !== 'Chart') return comp;
    const props = comp.props as Record<string, unknown>;
    const type = props.type as string;
    const data = props.data as { labels?: string[]; datasets?: { data?: number[] }[] } | undefined;
    const labels = data?.labels ?? [];

    if (type === 'bar') {
      barCount++;
      if (barCount > 2) {
        const values = data?.datasets?.[0]?.data ?? [];
        console.log('[sanitize] converting excess bar to treemap');
        return {
          ...comp,
          props: {
            ...props,
            type: 'treemap',
            data: {
              labels: labels as string[],
              datasets: [{ data: values }],
            },
          },
        };
      }
    }
    return comp;
  });

// ── Rule 7: deduplicate charts — same type OR same dimension data ──
  // Fingerprint = type + sorted first 3 labels (catches same data with different titles)
  function chartFingerprint(comp: Record<string, unknown>): string {
    const props = comp.props as Record<string, unknown>;
    const type = props.type as string;
    const data = props.data as { labels?: string[] } | undefined;
    const labels = (data?.labels ?? []).slice(0, 3).sort().join('|');
    return `${type}::${labels}`;
  }

  const seenFingerprints = new Set<string>();
  const chartTypeCounts: Record<string, number> = {};
  // Max allowed per type
  const TYPE_MAX: Record<string, number> = {
    bar: 1, doughnut: 1, pie: 1, treemap: 1, area: 2, line: 2,
    'hexbin-map': 1, radar: 1, scatter: 1, funnel: 1, gauge: 1, map: 1,
  };
  const FALLBACK_TYPES = ['treemap', 'radar', 'area', 'bar', 'funnel'];
  const usedTypes = new Set<string>();

  config.components = (config.components as Record<string, unknown>[]).map(comp => {
    if (comp.component !== 'Chart') return comp;
    const props = comp.props as Record<string, unknown>;
    const type = props.type as string;
    const fp = chartFingerprint(comp);

    chartTypeCounts[type] = (chartTypeCounts[type] ?? 0) + 1;
    const maxAllowed = TYPE_MAX[type] ?? 2;
    const isDuplicate = seenFingerprints.has(fp) || chartTypeCounts[type] > maxAllowed;

    if (isDuplicate) {
      const alt = FALLBACK_TYPES.find(t => t !== type && !usedTypes.has(t) && (chartTypeCounts[t] ?? 0) < (TYPE_MAX[t] ?? 2));
      if (alt) {
        console.log(`[sanitize] duplicate/excess ${type} (fp=${fp}) → ${alt}`);
        usedTypes.add(alt);
        chartTypeCounts[alt] = (chartTypeCounts[alt] ?? 0) + 1;
        return { ...comp, props: { ...props, type: alt } };
      }
      console.log(`[sanitize] duplicate ${type} — no alternative, keeping`);
    }

    seenFingerprints.add(fp);
    usedTypes.add(type);
    return comp;
  });

  // ── Rule 8: max 1 doughnut/pie per dashboard — convert extras to treemap ──
  let doughnutCount = 0;
  config.components = (config.components as Record<string, unknown>[]).map(comp => {
    if (comp.component !== 'Chart') return comp;
    const props = comp.props as Record<string, unknown>;
    const type = props.type as string;
    if (type === 'doughnut' || type === 'pie') {
      doughnutCount++;
      if (doughnutCount > 1) {
        console.log(`[sanitize] extra ${type} → treemap`);
        return { ...comp, props: { ...props, type: 'treemap' } };
      }
    }
    return comp;
  });

  return config;
}

// ─── Repair empty charts using pre-computed aggregations ──────

function repairEmptyCharts(
  uiConfig: unknown,
  aggregations: Record<string, unknown>,
  parsedIntent: { groupBy: string | null; metric: string; metricField: string | null },
): unknown {
  const config = uiConfig as Record<string, unknown>;
  if (!Array.isArray(config?.components)) return uiConfig;

  const groupByAgg = aggregations.groupBy as { data?: { label: string; value: number }[] } | undefined;
  if (!groupByAgg?.data?.length) return uiConfig;

  const labels = groupByAgg.data.map(d => d.label);
  const values = groupByAgg.data.map(d => d.value);

  const COLORS = ['#5bb8f5','#22d3ee','#a78bfa','#34d399','#fbbf24','#f472b6','#60a5fa','#4ade80','#fb923c','#e879f9','#f5455a','#10d97e','#38bdf8','#818cf8','#fde68a'];

  config.components = (config.components as Record<string, unknown>[]).map(comp => {
    if (comp.component !== 'Chart') return comp;
    const props = comp.props as Record<string, unknown>;
    const data = props.data as Record<string, unknown> | undefined;

    // Detect empty: labels array is empty or missing
    const existingLabels = (data as Record<string, unknown> | undefined)?.labels;
    const isEmpty = !existingLabels || (Array.isArray(existingLabels) && existingLabels.length === 0);
    // Also detect if data is an array but empty
    const isEmptyArray = Array.isArray(data) && data.length === 0;

    if (!isEmpty && !isEmptyArray) return comp;

    console.log(`[orchestrator] repairing empty Chart — injecting ${labels.length} groupBy data points`);

    const bgColors = labels.length === 1 ? COLORS[0] : COLORS.slice(0, labels.length);
    return {
      ...comp,
      props: {
        ...props,
        data: {
          labels,
          datasets: [{
            label: parsedIntent.metricField ?? 'Monto Total Crédito',
            data: values,
            backgroundColor: bgColors,
            borderColor: bgColors,
            borderWidth: 2,
          }],
        },
      },
    };
  });

  return config;
}

// ─── Aggregation helper ───────────────────────────────────────

function computeAggregations(
  records: Record<string, unknown>[],
  parsedIntent: {
    groupBy: string | null;
    metric: string;
    metricField: string | null;
  },
): Record<string, unknown> {
  if (records.length === 0) return {};

  const first = records[0];
  const fields = Object.keys(first);
  const stringFields = fields.filter((f) => typeof first[f] === 'string');
  const numericFields = fields.filter((f) => typeof first[f] === 'number');

  const agg: Record<string, unknown> = {
    totalRecords: records.length,
  };

    // ─── String fields: cardinality + top values (with monto sum) ──────────────
  const fieldSummaries: Record<string, unknown> = {};
  const montoField = numericFields.includes('monto_total_credito') ? 'monto_total_credito'
    : numericFields.includes('precio_contado') ? 'precio_contado' : null;
  for (const field of stringFields) {
    const counts: Record<string, number> = {};
    const montoSums: Record<string, number> = {};
    for (const r of records) {
      const key = String(r[field] ?? '');
      counts[key] = (counts[key] ?? 0) + 1;
      if (montoField) montoSums[key] = (montoSums[key] ?? 0) + Number(r[montoField] ?? 0);
    }
    // Sort by monto sum (financial value) when available, else by count
    const sorted = Object.entries(counts).sort((a, b) =>
      montoField ? (montoSums[b[0]] ?? 0) - (montoSums[a[0]] ?? 0) : b[1] - a[1]
    );
    fieldSummaries[field] = {
      uniqueValues: sorted.length,
      topValues: sorted
        .slice(0, 10)
        .map(([value, count]) => ({ value, count, sum: montoField ? Math.round(montoSums[value] ?? 0) : count })),
    };
  }
  agg.fieldSummaries = fieldSummaries;

  // ─── Numeric fields: min, max, sum, avg ───────────────────
  const numericSummaries: Record<string, unknown> = {};
  for (const field of numericFields) {
    const values = records.map((r) => Number(r[field] ?? 0));
    const sum = values.reduce((a, b) => a + b, 0);
    numericSummaries[field] = {
      sum: Math.round(sum),
      avg: Math.round(sum / values.length),
      min: Math.min(...values),
      max: Math.max(...values),
    };
  }
  agg.numericSummaries = numericSummaries;

  // ─── Cross aggregation: fecha_venta × top categorical field ─
  // Provides Bedrock with real multi-series temporal data
  const crossField = ['categoria', 'estado', 'canal_venta'].find(
    f => stringFields.includes(f) && (fieldSummaries[f] as { uniqueValues: number }).uniqueValues > 1
  );
  if (crossField) {
    const topCrossValues = ((fieldSummaries[crossField] as { topValues: { value: string }[] }).topValues ?? [])
      .slice(0, 5).map(v => v.value);
    const crossGroups: Record<string, Record<string, number>> = {};
    // Use monto_total_credito sum for cross aggregation (financial value over count)
    const crossMetricField = numericFields.includes('monto_total_credito') ? 'monto_total_credito' : null;
    for (const record of records) {
      const dateRaw = String(record['fecha_venta'] ?? '');
      const d = new Date(dateRaw);
      if (isNaN(d.getTime())) continue;
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const serieKey = String(record[crossField] ?? '');
      if (!topCrossValues.includes(serieKey)) continue;
      if (!crossGroups[monthKey]) crossGroups[monthKey] = {};
      const addValue = crossMetricField ? Number(record[crossMetricField] ?? 0) : 1;
      crossGroups[monthKey][serieKey] = (crossGroups[monthKey][serieKey] ?? 0) + addValue;
    }
    const sortedMonths = Object.keys(crossGroups).sort();
    agg.crossAggregation = {
      xField: 'fecha_venta',
      serieField: crossField,
      metric: crossMetricField ? 'sum_monto_total_credito' : 'count',
      series: topCrossValues,
      data: sortedMonths.map(month => ({
        label: month,
        ...Object.fromEntries(topCrossValues.map(s => [s, Math.round(crossGroups[month]?.[s] ?? 0)])),
      })),
    };
  }

  // ─── GroupBy aggregation (from parsed intent) ─────────────
  if (parsedIntent.groupBy) {
    const field = parsedIntent.groupBy;
    const isDateField = field === 'fecha_venta';
    const granularity = (parsedIntent as Record<string, unknown>).granularity as string | null;
    const groups: Record<string, number> = {};

    for (const record of records) {
      let key: string;
      if (isDateField) {
        const d = new Date(String(record[field] ?? ''));
        if (!isNaN(d.getTime())) {
          if (granularity === 'year') {
            key = `${d.getFullYear()}`;
          } else if (granularity === 'week') {
            const jan4 = new Date(d.getFullYear(), 0, 4);
            const weekNum = Math.ceil(((d.getTime() - jan4.getTime()) / 86400000 + jan4.getDay() + 1) / 7);
            key = `${d.getFullYear()}-S${String(weekNum).padStart(2, '0')}`;
          } else {
            // month (default)
            key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          }
        } else {
          key = String(record[field] ?? 'N/A');
        }
      } else {
        key = String(record[field] ?? 'N/A');
      }

      if (parsedIntent.metric === 'count' && !parsedIntent.metricField) {
        groups[key] = (groups[key] ?? 0) + 1;
      } else {
        // Prefer monto_total_credito as default metric field for financial value
        const mField = parsedIntent.metricField ?? (numericFields.includes('monto_total_credito') ? 'monto_total_credito' : null);
        if (mField) {
          groups[key] = (groups[key] ?? 0) + Number(record[mField] ?? 0);
        } else {
          groups[key] = (groups[key] ?? 0) + 1;
        }
      }
    }

    const sortedGroups = Object.entries(groups).sort(([a], [b]) =>
      isDateField ? a.localeCompare(b) : groups[b] - groups[a],
    );
    const maxSlice = granularity === 'week' ? 12 : granularity === 'year' ? 10 : 36;
    const effectiveMetricField = parsedIntent.metricField ?? (numericFields.includes('monto_total_credito') ? 'monto_total_credito' : null);
    agg.groupBy = {
      field,
      granularity: granularity ?? (isDateField ? 'month' : 'value'),
      metric: parsedIntent.metric,
      metricField: effectiveMetricField,
      uniqueGroups: sortedGroups.length,
      data: sortedGroups.slice(0, maxSlice).map(([label, value]) => ({ label, value: Math.round(value) })),
    };
  }

  return agg;
}
