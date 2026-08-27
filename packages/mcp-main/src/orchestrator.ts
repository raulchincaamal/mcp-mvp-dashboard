import {
  BedrockRuntimeClient,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime';
import type { McpClient } from './mcp-client.js';
import { generateCacheKey, cacheGet, cacheSet, TTL } from './cache.js';
import { selectChartType, CHART_DECISION_PROMPT } from './chart-decision.js';

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION,
});
const MODEL_ID = process.env.BEDROCK_MODEL_ID!;

// â”€â”€â”€ Normalize string: lowercase + strip accents â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function stripAccents(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// â”€â”€â”€ Estado normalization map (no-accent key â†’ accented value) â”€â”€â”€
const ESTADO_MAP: Record<string, string> = {
  'aguascalientes': 'Aguascalientes', 'baja california': 'Baja California',
  'baja california sur': 'Baja California Sur', 'campeche': 'Campeche',
  'chiapas': 'Chiapas', 'chihuahua': 'Chihuahua',
  'ciudad de mexico': 'Ciudad de MÃ©xico', 'cdmx': 'Ciudad de MÃ©xico',
  'df': 'Ciudad de MÃ©xico', 'distrito federal': 'Ciudad de MÃ©xico',
  'coahuila': 'Coahuila', 'coahuila de zaragoza': 'Coahuila', 'colima': 'Colima',
  'durango': 'Durango', 'guanajuato': 'Guanajuato', 'guerrero': 'Guerrero',
  'hidalgo': 'Hidalgo', 'jalisco': 'Jalisco', 'guadalajara': 'Jalisco',
  'mexico': 'MÃ©xico', 'estado de mexico': 'MÃ©xico', 'edomex': 'MÃ©xico',
  'edo mex': 'MÃ©xico', 'michoacan': 'MichoacÃ¡n', 'morelia': 'MichoacÃ¡n',
  'morelos': 'Morelos', 'nayarit': 'Nayarit', 'nuevo leon': 'Nuevo LeÃ³n',
  'monterrey': 'Nuevo LeÃ³n', 'oaxaca': 'Oaxaca', 'puebla': 'Puebla',
  'queretaro': 'QuerÃ©taro', 'quintana roo': 'Quintana Roo', 'cancun': 'Quintana Roo',
  'san luis potosi': 'San Luis PotosÃ­', 'sinaloa': 'Sinaloa', 'culiacan': 'Sinaloa',
  'sonora': 'Sonora', 'hermosillo': 'Sonora', 'tabasco': 'Tabasco',
  'tamaulipas': 'Tamaulipas', 'tlaxcala': 'Tlaxcala',
  'veracruz': 'Veracruz', 'xalapa': 'Veracruz',
  'yucatan': 'YucatÃ¡n', 'merida': 'YucatÃ¡n', 'zacatecas': 'Zacatecas',
};

// â”€â”€â”€ Categoria normalization map â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const CATEGORIA_MAP: Record<string, string> = {
  'motos': 'Motos', 'moto': 'Motos', 'motocicleta': 'Motos', 'motocicletas': 'Motos',
  'celulares': 'Celulares', 'celular': 'Celulares', 'telefono': 'Celulares',
  'telefonos': 'Celulares', 'smartphone': 'Celulares', 'smartphones': 'Celulares',
  'iphone': 'Celulares', 'android': 'Celulares',
  'bicicletas electricas': 'Bicicletas ElÃ©ctricas', 'bicicleta electrica': 'Bicicletas ElÃ©ctricas',
  'bicicletas': 'Bicicletas ElÃ©ctricas', 'bicicleta': 'Bicicletas ElÃ©ctricas', 'ebike': 'Bicicletas ElÃ©ctricas',
  'pantallas': 'Pantallas/TV', 'pantalla': 'Pantallas/TV', 'tv': 'Pantallas/TV',
  'television': 'Pantallas/TV', 'televisor': 'Pantallas/TV', 'pantallas/tv': 'Pantallas/TV',
  'audio': 'Audio', 'bocinas': 'Audio', 'bocina': 'Audio', 'altavoz': 'Audio',
  'tablets': 'Tablets', 'tablet': 'Tablets', 'ipad': 'Tablets',
  'consolas': 'Consolas', 'consola': 'Consolas', 'videojuegos': 'Consolas',
  'playstation': 'Consolas', 'xbox': 'Consolas', 'nintendo': 'Consolas',
  'climatizacion': 'ClimatizaciÃ³n', 'climatizaciÃ³n': 'ClimatizaciÃ³n',
  'aire acondicionado': 'ClimatizaciÃ³n', 'ventilador': 'ClimatizaciÃ³n',
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

// â”€â”€â”€ Component catalog â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const COMPONENT_CATALOG = [
  {
    name: 'StatCard',
    description: 'Metric card with title, large value, trend arrow, and icon',
  },
  { name: 'KPIGrid', description: 'Grid of StatCards for key metrics' },
  {
    name: 'Chart',
    description:
      'Chart supporting types: bar, line, area, pie, doughnut, scatter, radar, funnel, gauge, heatmap, treemap, map, bollinger, stacked-area, diverging-bar, radial-stacked-bar, candlestick, hierarchical-bar, bar-race',
  },
  { name: 'DataSummary', description: 'Styled data table with hover effects' },
  {
    name: 'TransactionList',
    description: 'List of items with title, amount, date, status',
  },
  { name: 'ProgressGroup', description: 'Card with multiple progress bars' },
  { name: 'MiniChart', description: 'Compact sparkline chart inside a card' },
];

// â”€â”€â”€ Orchestrator â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
      const hasExplicitDate = /enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|\d{4}|este mes|mes pasado|este a[n�]o/i.test(params.intent);
      if (!hasExplicitDate) {
        delete filters.fecha_venta;
        console.log('[orchestrator] removed hallucinated fecha_venta filter (temporal groupBy, no explicit date in intent)');
      }
    }

    // Normalize filters: accents, casing, aliases
    // If ciudad is actually a state alias (e.g. "monterrey" â†’ Nuevo LeÃ³n), promote to estado
    if (typeof filters.ciudad === 'string') {
      const ciudadKey = stripAccents(filters.ciudad.trim());
      if (ESTADO_MAP[ciudadKey]) {
        filters.estado = ESTADO_MAP[ciudadKey];
        delete filters.ciudad;
        console.log(`[orchestrator] ciudad alias promoted to estado â†’ "${filters.estado}"`);
      }
    }
    // Normalize estado: string or array
    if (typeof filters.estado === 'string') {
      filters.estado = normalizeEstado(filters.estado);
      console.log(`[orchestrator] estado normalized â†’ "${filters.estado}"`);
    } else if (Array.isArray(filters.estado)) {
      filters.estado = (filters.estado as string[]).map(normalizeEstado);
      console.log(`[orchestrator] estado[] normalized â†’ ${JSON.stringify(filters.estado)}`);
    }
    // Normalize categoria: string or array
    if (typeof filters.categoria === 'string') {
      filters.categoria = normalizeCategoria(filters.categoria);
      console.log(`[orchestrator] categoria normalized â†’ "${filters.categoria}"`);
    } else if (Array.isArray(filters.categoria)) {
      filters.categoria = (filters.categoria as string[]).map(normalizeCategoria);
      console.log(`[orchestrator] categoria[] normalized â†’ ${JSON.stringify(filters.categoria)}`);
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
        console.log(`[orchestrator] fecha_venta month string â†’ range ${JSON.stringify(filters.fecha_venta)}`);
      }
    }

    // Default: if no fecha_venta filter, apply last 3 months relative to dataset max date
    const isLastDayIntent = /ultimo\s*d[iÃ­]a|ayer|hoy|last\s*day/i.test(params.intent);
    if (!filters.fecha_venta && !isLastDayIntent && parsedIntent.groupBy !== 'fecha_venta') {
      // Probe dataset max date so window is always relative to actual data, not system clock
      const probeResult = (await gcpClient.callTool('query_data', { dataset, limit: 50 })) as { records?: Record<string, unknown>[] };
      const probeDates = (probeResult.records ?? [])
        .map(r => String(r.fecha_venta ?? '')).filter(d => /^\d{4}-\d{2}-\d{2}/.test(d)).sort((a, b) => b.localeCompare(a));
      const maxDate = probeDates[0] ? new Date(probeDates[0]) : new Date();
      const threeMonthsAgo = new Date(maxDate.getFullYear(), maxDate.getMonth() - 3, maxDate.getDate());
      const pad = (n: number) => String(n).padStart(2, '0');
      const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
      filters.fecha_venta = { gte: fmt(threeMonthsAgo), lte: fmt(maxDate) };
      console.log(`[orchestrator] no date filter â†’ last 3 months from dataset max ${fmt(maxDate)}: ${JSON.stringify(filters.fecha_venta)}`);
    }

    const limit = params.limit ?? parsedIntent.limit ?? 200;

    console.log(
      `[orchestrator] querying data â€” filters: ${JSON.stringify(filters)}, limit: ${limit}`,
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
      console.log('[orchestrator] 0 records for last-day query â€” fetching most recent date with data');
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

// â”€â”€â”€ Step 1: Interpret intent â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    metric: 'count',
    metricField: null,
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
            text: `Eres un intÃ©rprete de intents para el sistema de dashboards de Macropay, empresa mexicana de ventas a crÃ©dito de productos (motos, celulares, bicicletas elÃ©ctricas, pantallas, tablets, consolas, audio, accesorios). Tu trabajo es convertir lo que pide el usuario en una consulta estructurada JSON.

IMPORTANTE: El usuario puede escribir sin acentos, en minÃºsculas, con errores ortogrÃ¡ficos o abreviaciones. Debes interpretar correctamente aunque el texto no tenga acentos ni mayÃºsculas.

Responde SOLO con JSON vÃ¡lido, sin markdown, sin explicaciones.
Estructura exacta:
{"filters":{},"groupBy":null,"metric":"count","metricField":null,"chartType":null,"template":"executive","limit":null,"title":null}

Campos disponibles: id, fecha_venta, cliente, edad_cliente, genero, estado, ciudad, sucursal, categoria, producto, precio_contado, monto_total_credito, estatus_credito, canal_venta, vendedor.

CategorÃ­as vÃ¡lidas (escrÃ­belas EXACTAMENTE asÃ­ en filters.categoria):
- Motos (tambiÃ©n: moto, motocicleta, motos)
- Celulares (tambiÃ©n: celular, telefono, iphone, smartphone)
- Bicicletas ElÃ©ctricas (tambiÃ©n: bicicleta, bici, ebike)
- Pantallas/TV (tambiÃ©n: pantalla, tv, television, tele)
- Audio (tambiÃ©n: bocina, altavoz, sonido)
- Tablets (tambiÃ©n: tablet, ipad)
- Consolas (tambiÃ©n: consola, videojuegos, playstation, xbox)
- ClimatizaciÃ³n (tambiÃ©n: aire acondicionado, ventilador, clima)
- Accesorios (tambiÃ©n: accesorio)

Estados de MÃ©xico (escrÃ­belos EXACTAMENTE asÃ­ en filters.estado, con acento):
Aguascalientes, Baja California, Baja California Sur, Campeche, Chiapas, Chihuahua, Ciudad de MÃ©xico, Coahuila, Colima, Durango, Guanajuato, Guerrero, Hidalgo, Jalisco, MÃ©xico, MichoacÃ¡n, Morelos, Nayarit, Nuevo LeÃ³n, Oaxaca, Puebla, QuerÃ©taro, Quintana Roo, San Luis PotosÃ­, Sinaloa, Sonora, Tabasco, Tamaulipas, Tlaxcala, Veracruz, YucatÃ¡n, Zacatecas.
Alias: cdmx/df â†’ Ciudad de MÃ©xico, edomex/edo mex â†’ MÃ©xico, monterrey â†’ Nuevo LeÃ³n, guadalajara â†’ Jalisco, cancun â†’ Quintana Roo, merida â†’ YucatÃ¡n.

Estatus de crÃ©dito (escrÃ­belos EXACTAMENTE asÃ­ en filters.estatus_credito):
- al_corriente (tambiÃ©n: corriente, vigente, al dia, al dÃ­a)
- atrasado (tambiÃ©n: vencido, mora, debe, atrasados)
- liquidado (tambiÃ©n: pagado, saldado, terminado, liquidados)
- cancelado (tambiÃ©n: baja, cancelados)

Canales de venta (escrÃ­belos EXACTAMENTE asÃ­ en filters.canal_venta):
- tienda_fisica (tambiÃ©n: tienda, fisica, presencial)
- en_linea (tambiÃ©n: online, internet, web, linea)
- telefono (tambiÃ©n: llamada, call)

Reglas de interpretaciÃ³n:
- "por estado/categorÃ­a/mes/vendedor/semana/aÃ±o" â†’ groupBy con ese campo
- "semanal/por semana" â†’ groupBy:"fecha_venta", granularity implÃ­cita: week
- "mensual/por mes" â†’ groupBy:"fecha_venta", granularity implÃ­cita: month
- "anual/por aÃ±o" â†’ groupBy:"fecha_venta", granularity implÃ­cita: year
- estado especÃ­fico mencionado â†’ filters.estado (es FILTRO, no groupBy)
- categorÃ­a especÃ­fica mencionada â†’ filters.categoria (es FILTRO, no groupBy)
- "tabla/listado/registros" â†’ template:table
- "grafica/chart/tendencia/semanal/mensual/anual/evolucion" â†’ template:chart
- "credito/estatus/pago/morosidad/atrasado" â†’ template:credit
- "por categoria/analisis" â†’ template:category
- "resumen/dashboard/kpi/ejecutivo/general" â†’ template:executive
- nÃºmero mencionado (Ãºltimas 10, top 20) â†’ limit
- genera un tÃ­tulo descriptivo en espaÃ±ol â†’ title

FILTROS MÃšLTIPLES Y COMBINADOS (muy importante):
- Si se mencionan 2+ categorÃ­as â†’ filters.categoria debe ser un ARRAY: ["Motos", "Celulares"]
- Si se mencionan 2+ estados â†’ filters.estado debe ser un ARRAY: ["Jalisco", "YucatÃ¡n"]
- Si se mencionan 2+ estatus â†’ filters.estatus_credito debe ser un ARRAY: ["atrasado", "cancelado"]
- - REGLA CRITICA: Si el intent pide datos "semanales", "mensuales", "anuales", "por semana", "por mes", "evolucion", "tendencia" SIN mencionar un mes o anio especifico, NO pongas filtro de fecha_venta. El groupBy=fecha_venta ya agrupa temporalmente.
Mes especÃ­fico mencionado (enero, febrero, agosto, etc.) â†’ filters.fecha_venta como rango: {"gte":"YYYY-MM-01","lte":"YYYY-MM-31"}
  Usa el aÃ±o mÃ¡s reciente disponible (2025 o 2026) si no se especifica aÃ±o.
  Meses: enero=01, febrero=02, marzo=03, abril=04, mayo=05, junio=06, julio=07, agosto=08, septiembre=09, octubre=10, noviembre=11, diciembre=12
- AÃ±o especÃ­fico â†’ filters.fecha_venta: {"gte":"YYYY-01-01","lte":"YYYY-12-31"}
- "este mes" â†’ rango del mes actual, "mes pasado" â†’ rango del mes anterior
- Combina TODOS los filtros mencionados simultÃ¡neamente en el mismo objeto filters

DISTINCIÃ“N CLAVE â€” dimensiÃ³n vs filtro:
- DimensiÃ³n (groupBy) = lo que varÃ­a en el eje de la grÃ¡fica. Se pierde el anÃ¡lisis si se elimina.
- Filtro (filters) = limita el dataset pero NO aparece en el eje.
Ejemplos:
  "ventas semanales de celulares en yucatan" â†’ groupBy:"fecha_venta", filters:{categoria:"Celulares", estado:"YucatÃ¡n"}
  "ventas por estado" â†’ groupBy:"estado", filters:{}
  "ventas de motos por estado" â†’ groupBy:"estado", filters:{categoria:"Motos"}
  "creditos atrasados en jalisco" â†’ groupBy:null, filters:{estatus_credito:"atrasado", estado:"Jalisco"}, template:"credit"
  "evolucion mensual de ventas" â†’ groupBy:"fecha_venta", filters:{}, template:"chart"
  "cuantas motos se vendieron" â†’ groupBy:null, filters:{categoria:"Motos"}, metric:"count"
  "ventas de celulares y motos en yucatan" â†’ groupBy:null, filters:{categoria:["Celulares","Motos"], estado:"YucatÃ¡n"}
  "creditos atrasados de motos en agosto" â†’ groupBy:null, filters:{categoria:"Motos", estatus_credito:"atrasado", fecha_venta:{gte:"2025-08-01",lte:"2025-08-31"}}, template:"credit"
  "ventas de celulares y motos atrasadas de yucatan en agosto" â†’ filters:{categoria:["Celulares","Motos"], estatus_credito:"atrasado", estado:"YucatÃ¡n", fecha_venta:{gte:"2025-08-01",lte:"2025-08-31"}}
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

    // Infer temporal granularity from intent
    if (parsed.groupBy === 'fecha_venta' && !parsed.granularity) {
      if (/\ba[Ã±n]o\b|anio\b|anual|por\s+a[Ã±n]o|por\s+anio/i.test(intent)) parsed.granularity = 'year';
      else if (/\bmes\b|mensual|por\s+mes/i.test(intent)) parsed.granularity = 'month';
      else if (/\bseman/i.test(intent)) parsed.granularity = 'week';
      else parsed.granularity = 'month';
    }

    // "top N" de grupos â†’ limit aplica al chart, no a los registros
    // Siempre traer suficientes registros para agregar correctamente
    const isTopN = /top\s*\d|mejores?\s*\d|peores?\s*\d|primeros?\s*\d|\d\s*m[aÃ¡]s\s+vend/i.test(intent);
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

    // Override chartType con modelo de decisiÃ³n analÃ­tico
    const decision = selectChartType(intent, parsed.groupBy, parsed.chartType, parsed.filters);
    if (!parsed.chartType || decision.confidence === 'high') {
      parsed.chartType = decision.chartType;
      parsed.multiDataset = decision.multiDataset;
      console.log(`[orchestrator] chart-decision: ${decision.chartType} (${decision.objective}) multiDataset=${decision.multiDataset} â€” ${decision.reason}`);
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

// â”€â”€â”€ Step 3: Generate UIConfig with Bedrock â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


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
- Genera EXACTAMENTE 3 componentes: KPIGrid + Chart principal + TransactionList
- Colores: ["#49a4d8","#7C3AED","#059669","#D97706","#DC2626","#2563EB","#6366F1","#0891B2"]`;
}

async function generateUIConfig(
  intent: string,
  parsedIntent: Awaited<ReturnType<typeof interpretIntent>>,
  records: Record<string, unknown>[],
  dateRange?: { gte?: string; lte?: string },
): Promise<unknown> {
  const totalRecords = records.length;
  const sampleRecords = records.slice(0, totalRecords < 50 ? 10 : 20);

  // Compute basic aggregations to help Bedrock
  const aggregations = computeAggregations(records, parsedIntent);

  const systemPrompt = `Eres un experto en visualizaciÃ³n de datos para Macropay, una empresa mexicana de ventas a crÃ©dito de productos como motos, celulares, bicicletas elÃ©ctricas, pantallas, tablets, consolas, audio y accesorios.

Tu rol es generar dashboards claros, informativos y visualmente ricos para que los equipos de ventas, cobranza y direcciÃ³n puedan tomar decisiones rÃ¡pidas. El usuario final puede ser un gerente, un analista o un agente de Alexa que pide informaciÃ³n en lenguaje natural.

Contexto del negocio:
- Los crÃ©ditos tienen estatus: al_corriente (bueno), atrasado (riesgo), liquidado (completado), cancelado (perdido)
- Los canales de venta son: tienda_fisica, en_linea, telefono
- Las ventas se distribuyen en los 32 estados de MÃ©xico
- Los montos estÃ¡n en pesos mexicanos (MXN)
- Un crÃ©dito atrasado representa riesgo de cartera vencida
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
  labels = valores del eje X (numÃ©ricos como strings), data = valores del eje Y. Usa 2 campos numÃ©ricos del dataset.
- Chart (radar): { type: "radar", title?, data: { labels: ["dim1","dim2",...], datasets: [{ label: "serie", data: [v1,v2,...] }] } }
  labels = dimensiones/categorÃ­as (eje radial), cada dataset es una serie. Ideal para comparar mÃºltiples categorÃ­as en varias mÃ©tricas.
- Chart (funnel): { type: "funnel", title?, data: { labels: ["Etapa1","Etapa2",...], datasets: [{ data: [v1,v2,...] }] } }
  Ordena de mayor a menor automÃ¡ticamente. Usa para mostrar conversiÃ³n por etapas (ej: total â†’ activos â†’ al_corriente â†’ liquidados).
- Chart (gauge): { type: "gauge", title?, data: { labels: ["Nombre del indicador"], datasets: [{ data: [valor_0_a_100] }] } }
  Un solo valor entre 0 y 100. Ideal para % de cumplimiento, % morosidad, % liquidados.
- Chart (heatmap): { type: "heatmap", title?, data: { labels: ["col1","col2",...], datasets: [{ label: "fila1", data: [v1,v2,...] }, { label: "fila2", data: [...] }] } }
  labels = eje X (ej: categorÃ­as), datasets[i].label = eje Y (ej: estados), datasets[i].data = valores por columna.
  CRÃTICO: los valores del heatmap DEBEN calcularse desde fieldSummaries reales cruzando 2 campos. NUNCA interpoles ni inventes valores â€” si no tienes el cruce exacto, usa los conteos de fieldSummaries.categoria.topValues y fieldSummaries.estado.topValues para aproximar.
- Chart (treemap): { type: "treemap", title?, data: { labels: ["nombre1","nombre2",...], datasets: [{ data: [v1,v2,...] }] } }
  labels = nombres de los nodos, data = tamaÃ±os. Ideal para distribuciÃ³n proporcional de categorÃ­as.
- Chart (map): { type: "map", title?, data: { labels: ["Estado1","Estado2",...], datasets: [{ data: [v1,v2,...] }] } }
  labels = nombres exactos de los 32 estados de MÃ©xico (con acento), data = valores numÃ©ricos por estado.
  Usa SOLO cuando el groupBy o el anÃ¡lisis principal sea por estado geogrÃ¡fico sin otra dimensiÃ³n.
  NUNCA uses map cuando hay un filtro de estado activo (singleEstado) â€” en ese caso usa bar por ciudad o categorÃ­a.
  Nombres vÃ¡lidos: Aguascalientes, Baja California, Baja California Sur, Campeche, Chiapas, Chihuahua, Ciudad de MÃ©xico, Coahuila, Colima, Durango, Guanajuato, Guerrero, Hidalgo, Jalisco, MÃ©xico, MichoacÃ¡n, Morelos, Nayarit, Nuevo LeÃ³n, Oaxaca, Puebla, QuerÃ©taro, Quintana Roo, San Luis PotosÃ­, Sinaloa, Sonora, Tabasco, Tamaulipas, Tlaxcala, Veracruz, YucatÃ¡n, Zacatecas.
  Para generar OHLC: agrupa registros por fecha. open=primer valor del dÃ­a, high=mÃ¡ximo, low=mÃ­nimo, close=Ãºltimo valor. USA LOS DATOS REALES de aggregations.
- Chart (bollinger): { type: "bollinger", title?, data: [{ date: "YYYY-MM-DD", value: number }], n?: 20, k?: 2 }
  Genera una serie temporal con un valor por fecha (suma o promedio del campo numÃ©rico por dÃ­a).
- Chart (stacked-area): { type: "stacked-area", title?, data: [{ label: "periodo", serie1: number, serie2: number, ... }], keys: ["serie1","serie2",...], colors?: [] }
  Cada objeto tiene un label (eje X) y un valor numÃ©rico por cada serie (eje Y apilado).
  REQUISITO: stacked-area requiere mÃ­nimo 2 series (keys.length >= 2). Si solo hay 1 serie, usa type:"area" en su lugar.
- Chart (diverging-bar): { type: "diverging-bar", title?, data: [{ label: "categorÃ­a", values: [{ key: "segmento", value: number }] }], keys: ["seg_negativo1","seg_negativo2","seg_positivo1","seg_positivo2"], neutralKey?: "neutral", negativeLabel?: "â† MÃ¡s riesgo", positiveLabel?: "MÃ¡s salud â†’" }
  IMPORTANTE: los keys DEBEN estar ordenados de mÃ¡s negativo a mÃ¡s positivo. El componente normaliza automÃ¡ticamente a porcentajes y usa colores espectrales divergentes (rojoâ†’amarilloâ†’verdeâ†’azul). Los values son conteos o sumas absolutas â€” la normalizaciÃ³n se hace en el frontend. Incluye negativeLabel y positiveLabel para dar contexto al usuario.
- Chart (radial-stacked-bar): { type: "radial-stacked-bar", title?, data: [{ label: "categorÃ­a", serie1: number, serie2: number }], keys: ["serie1","serie2",...], colors?: [] }
- Chart (hierarchical-bar): { type: "hierarchical-bar", title?, data: { name: "Root", children: [{ name: "Grupo", value?: number, children?: [...] }] } }
  Construye un Ã¡rbol jerÃ¡rquico de 2-3 niveles con sumas por nivel.
- Chart (bar-race): { type: "bar-race", title?, frames: [{ label: "periodo", items: [{ name: "categorÃ­a", value: number }] }], maxBars?: 10, duration?: 800 }
  Genera frames temporales. Cada frame muestra el ranking acumulado hasta ese periodo. Los items deben estar ordenados por value descendente.
- DataSummary: { title?, columns: [{ key, label }], rows: [...] }
- TransactionList: { title?, items: [{ title, subtitle?, amount, date?, status?: "positive"|"negative"|"neutral" }] }
- ProgressGroup: { title?, items: [{ label, value (0-100), color? }] }
- StatCard: { title, value, subtitle?, trend?, trendDirection?, icon? }

IMPORTANTE PARA CHARTS ESPECIALIZADOS:
- Para candlestick: DEBES generar datos OHLC reales agrupando los registros por fecha. Usa aggregations para derivar open/high/low/close. NUNCA generes data vacÃ­a [].
- Para bar-race: Genera frames acumulativos â€” cada frame es la suma hasta ese periodo.
- Para hierarchical-bar: Usa 2 campos categÃ³ricos para crear padre â†’ hijos.
- Para stacked-area y radial-stacked-bar: Usa un campo temporal como eje X y un campo categÃ³rico para las series.
- Si el filtro no encuentra datos, OMITE el filtro y usa todos los registros disponibles.

REGLA CRÃTICA â€” CHART TYPE OBLIGATORIO:
Si el userMessage especifica un "ChartType forzado", DEBES usar ESE tipo en el Chart principal, sin excepciÃ³n.
Esta regla tiene prioridad sobre cualquier template o instrucciÃ³n posterior.
Los tipos vÃ¡lidos son: bar, line, area, pie, doughnut, scatter, radar, funnel, gauge, heatmap, treemap,
bollinger, stacked-area, diverging-bar, radial-stacked-bar, candlestick, hierarchical-bar, bar-race.

FILOSOFÃA DE VISUALIZACIÃ“N:
Siempre genera dashboards RICOS y COMPLETOS. El usuario quiere entender sus datos en profundidad. Cada dashboard debe contar una historia completa con mÃºltiples perspectivas. NUNCA generes menos de 6 componentes. MÃ¡s charts = mejor dashboard.

REGLAS ANTI-CHART-INÃšTIL (obligatorias):
- NUNCA uses map cuando hay un filtro de estado activo (singleEstado en el contexto) â€” usa bar por ciudad o categorÃ­a
- NUNCA uses area/line con 1 solo punto temporal â€” si el rango es â‰¤ 1 mes y hay pocas fechas, usa bar comparativo
- NUNCA uses stacked-area con 1 sola serie â€” degrada a area simple
- Los valores del heatmap DEBEN ser reales desde fieldSummaries, nunca interpolados

REGLA CRÃTICA â€” NO REPETIR INFORMACIÃ“N:
- NUNCA uses dos charts que muestren exactamente la misma dimensiÃ³n y mÃ©trica
- Si ya tienes un bar por estado, el siguiente chart debe ser por categorÃ­a, canal, producto u otra dimensiÃ³n
- Si ya tienes un doughnut de estatus_credito, no uses otro pie/doughnut de estatus_credito
- Si ya tienes un treemap de categorÃ­a, no uses otro bar de categorÃ­a con los mismos datos
- Cada componente debe aportar una perspectiva DIFERENTE del dataset
- Prefiere cruzar 2 dimensiones (heatmap, stacked-area, diverging-bar) sobre repetir 1 dimensiÃ³n

DIVERSIDAD DE CHARTS (obligatorio):
- NUNCA uses doughnut mÃ¡s de 1 vez por dashboard
- NUNCA uses bar mÃ¡s de 2 veces por dashboard
- Prefiere treemap sobre doughnut cuando hay mÃ¡s de 4 categorÃ­as
- Prefiere area/line sobre bar cuando hay datos temporales
- Usa al menos 2 tipos de chart diferentes por dashboard
- Si ya usaste doughnut, el siguiente chart de distribuciÃ³n debe ser treemap o bar

REGLAS DE VISUALIZACIÃ“N (obligatorias):
1. SIEMPRE incluye un KPIGrid con 4-5 mÃ©tricas de resumen
2. SIEMPRE incluye al menos 3 Charts de TIPOS DIFERENTES con perspectivas distintas
3. SIEMPRE incluye un TransactionList con las Ãºltimas 6-8 operaciones
4. Usa aggregations.groupBy.data para labels/values del Chart principal
5. Usa aggregations.numericSummaries para los valores de KPIGrid
6. Usa aggregations.fieldSummaries[campo].topValues para charts de distribuciÃ³n
7. Responde SOLO con el JSON del UIConfig, sin markdown, sin explicaciones
8. Formatea montos: >= 1M â†’ "$1.2M", >= 1K â†’ "$45.3K", resto â†’ "$1,234"

COLORES para charts (usa estos exactos):
["#49a4d8","#7C3AED","#059669","#D97706","#DC2626","#2563EB","#6366F1","#0891B2","#10B981","#F59E0B","#EF4444","#EC4899","#14B8A6","#8B5CF6","#F97316"]`;

  const dateRangeLabel = dateRange
    ? (() => {
        const from = dateRange.gte ? new Date(dateRange.gte) : null;
        const to   = dateRange.lte ? new Date(dateRange.lte) : null;
        const fmt  = (d: Date) => d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
        if (from && to) return `${fmt(from)} â€“ ${fmt(to)}`;
        if (from) return `desde ${fmt(from)}`;
        if (to)   return `hasta ${fmt(to)}`;
        return null;
      })()
    : null;

  const topN = (parsedIntent as Record<string, unknown>).topN as number | null;

  // â”€â”€â”€ Context flags for smart template instructions â”€â”€â”€â”€â”€â”€â”€â”€
  const filterCategoria = parsedIntent.filters.categoria;
  const filterEstado = parsedIntent.filters.estado;
  const filterEstatus = parsedIntent.filters.estatus_credito;
  const singleCategoria = typeof filterCategoria === 'string';
  const singleEstado = typeof filterEstado === 'string';
  const singleEstatus = typeof filterEstatus === 'string';
  const multiCategoria = Array.isArray(filterCategoria) && filterCategoria.length > 1;
  const multiEstado = Array.isArray(filterEstado) && filterEstado.length > 1;

  // When filtered to 1 categoria, treemap/radar by categoria makes no sense â†’ use producto or estado instead
  const categoriaCtx = singleCategoria
    ? `FILTRO ACTIVO: categoria="${filterCategoria}". NUNCA uses Chart treemap/radar/doughnut agrupado por categorÃ­a â€” solo hay una. En su lugar agrupa por: producto (top 8), estado (top 10), o canal_venta.`
    : '';
  const estadoCtx = singleEstado
    ? `FILTRO ACTIVO: estado="${filterEstado}". NUNCA uses Chart agrupado por estado â€” solo hay uno. NUNCA uses Chart type:"map" â€” con un solo estado el mapa es inÃºtil. En su lugar agrupa por: ciudad (top 8), sucursal (top 8), o categoria.`
    : '';
  const estatusCtx = singleEstatus
    ? `FILTRO ACTIVO: estatus_credito="${filterEstatus}". NUNCA uses ProgressGroup de estatus_credito â€” solo hay un estatus. En su lugar usa ProgressGroup por canal_venta o categoria.`
    : '';

  // Multi-value filters â†’ comparison mode: generate multi-dataset charts
  const multiCategoriaList = multiCategoria ? (filterCategoria as string[]).join(', ') : '';
  const multiEstadoList = multiEstado ? (filterEstado as string[]).join(', ') : '';
  const isMultiDataset = (parsedIntent as Record<string, unknown>).multiDataset === true;
  const hasTiempoFilter = (parsedIntent as Record<string, unknown>).granularity != null ||
    parsedIntent.groupBy === 'fecha_venta';

  const comparisonCtx = multiCategoria
    ? `MODO COMPARACIÃ“N ACTIVO: se estÃ¡n comparando ${(filterCategoria as string[]).length} categorÃ­as: [${multiCategoriaList}].
REGLAS OBLIGATORIAS para el dashboard de comparaciÃ³n â€” genera EXACTAMENTE estos 4 charts en este orden:
1. Chart scatter: correlaciÃ³n precio_contado vs plazo_semanas. Un dataset por categorÃ­a (${multiCategoriaList}).
   labels = valores de precio_contado (como strings numÃ©ricos), datasets[i].data = valores de plazo_semanas.
   Usa los registros de la muestra para poblar los puntos. Cada dataset tiene el label de su categorÃ­a.
2. Chart area: evoluciÃ³n mensual de ventas. Un dataset por categorÃ­a (${multiCategoriaList}).
   Usa fieldSummaries.fecha_venta o agrupa los registros por mes. Eje X = meses, eje Y = conteo.
3. Chart line: tendencia de monto_total_credito por mes. Un dataset por categorÃ­a (${multiCategoriaList}).
   Eje X = meses, eje Y = suma de monto_total_credito por mes.
4. Chart bar: comparaciÃ³n directa por estado (top 8 estados). Un dataset por categorÃ­a (${multiCategoriaList}).
   Eje X = estados, cada dataset = conteo de ventas de esa categorÃ­a por estado.
AdemÃ¡s incluye:
- KPIGrid: una StatCard por categorÃ­a con su total individual + StatCards de totales generales.
- TransactionList: Ãºltimas 6-8 operaciones.
NUNCA uses treemap ni doughnut de una sola serie para comparar.`
    : multiEstado
    ? `MODO COMPARACIÃ“N ACTIVO: se estÃ¡n comparando ${(filterEstado as string[]).length} estados: [${multiEstadoList}].
REGLAS OBLIGATORIAS para el dashboard de comparaciÃ³n â€” genera EXACTAMENTE estos 4 charts en este orden:
1. Chart scatter: correlaciÃ³n precio_contado vs plazo_semanas. Un dataset por estado (${multiEstadoList}).
2. Chart area: evoluciÃ³n mensual de ventas. Un dataset por estado (${multiEstadoList}).
3. Chart line: tendencia de monto_total_credito por mes. Un dataset por estado (${multiEstadoList}).
4. Chart bar: comparaciÃ³n directa por categorÃ­a. Un dataset por estado (${multiEstadoList}).
- KPIGrid: una StatCard por estado con su total individual.
- TransactionList: Ãºltimas 6-8 operaciones.
NUNCA uses un chart de un solo dataset cuando hay mÃºltiples estados a comparar.`
    : isMultiDataset
    ? `MODO MULTI-DATASET ACTIVO: el chart principal debe tener datasets separados por cada serie detectada.
   Usa fieldSummaries para calcular los valores por serie.`
    : '';

  const filterCtxBlock = [categoriaCtx, estadoCtx, estatusCtx, comparisonCtx].filter(Boolean).join('\n');

  const userMessage = `Intent del usuario: "${intent}"
Template sugerido: ${parsedIntent.template}
GroupBy detectado: ${parsedIntent.groupBy ?? 'ninguno'}
MÃ©trica: ${parsedIntent.metric}${parsedIntent.metricField ? ` de ${parsedIntent.metricField}` : ''}
${dateRangeLabel ? `Rango de fechas evaluado: ${dateRangeLabel} â€” DEBES incluir este rango en el campo "description" del UIConfig (ej: "AnÃ¡lisis del perÃ­odo ${dateRangeLabel}").` : ''}
${parsedIntent.chartType ? `ChartType forzado: ${parsedIntent.chartType} â€” USA ESTE TIPO en el Chart principal, es OBLIGATORIO. No uses bar ni doughnut si el tipo forzado es diferente.` : ''}
${topN ? `Top N solicitado: ${topN} â€” muestra SOLO los ${topN} primeros grupos en el chart (ordenados de mayor a menor). El KPIGrid debe reflejar el total de todos los registros, no solo los top ${topN}.` : ''}

CONTEXTO DE LOS DATOS (${totalRecords} registros totales):
${JSON.stringify({ ...aggregations, groupBy: aggregations.groupBy ? { ...(aggregations.groupBy as Record<string,unknown>), data: ((aggregations.groupBy as Record<string,unknown>).data as unknown[])?.slice(0, 20) } : undefined, crossAggregation: aggregations.crossAggregation ? { ...(aggregations.crossAggregation as Record<string,unknown>), data: ((aggregations.crossAggregation as Record<string,unknown>).data as unknown[])?.slice(0, 12) } : undefined }, null, 2)}

Muestra de registros (${sampleRecords.length} de ${totalRecords}):
${JSON.stringify(sampleRecords, null, 2)}

INSTRUCCIONES SEGÃšN TEMPLATE:
${filterCtxBlock ? filterCtxBlock + '\n' : ''}
${
  parsedIntent.chartType && !['bar','line','area','pie','doughnut'].includes(parsedIntent.chartType)
    ? `El ChartType forzado es "${parsedIntent.chartType}". Genera mÃ­nimo 5 componentes:
1. KPIGrid: 3-4 mÃ©tricas de resumen (total registros, monto total, promedio)
2. Chart ${parsedIntent.chartType}: chart principal con los datos mÃ¡s relevantes para el intent.
   Usa el schema correcto para este tipo segÃºn las Props definidas arriba.
   Usa aggregations para poblar los datos reales.
${parsedIntent.chartType === 'map' ? `3. ProgressGroup: distribuciÃ³n de estatus_credito â€” calcula % reales desde fieldSummaries.estatus_credito.topValues, colores: al_corriente="#0CF49B", liquidado="#60a5fa", atrasado="#fb923c", cancelado="#f472b6"
4. ProgressGroup: distribuciÃ³n por canal_venta â€” calcula % reales desde fieldSummaries.canal_venta.topValues, colores: ["#c084fc","#67e8f9","#fcd34d"]
5. Chart heatmap: categorÃ­a Ã— estado (top 5 categorÃ­as Ã— top 8 estados, valor = conteo)
6. TransactionList: Ãºltimas 6 operaciones` : `3. ProgressGroup: distribuciÃ³n de estatus_credito â€” calcula % reales desde fieldSummaries.estatus_credito.topValues, colores: al_corriente="#0CF49B", liquidado="#60a5fa", atrasado="#fb923c", cancelado="#f472b6"
4. Chart heatmap: categorÃ­a Ã— estado (top 5 categorÃ­as Ã— top 8 estados, valor = conteo)
5. TransactionList: Ãºltimas 6 operaciones`}`
    : parsedIntent.template === 'executive'
    ? `Genera un dashboard COMPLETO con mÃ­nimo 6 componentes:
1. KPIGrid: total ventas, monto total, promedio precio, % morosidad, total liquidados
2. Chart bar: ventas por estado (top 10, usa fieldSummaries.estado.topValues)
3. ProgressGroup: distribuciÃ³n de estatus_credito â€” calcula % reales desde fieldSummaries.estatus_credito.topValues, colores: al_corriente="#0CF49B", liquidado="#60a5fa", atrasado="#fb923c", cancelado="#f472b6"
4. Chart area: evoluciÃ³n mensual de ventas (usa aggregations.groupBy si hay datos temporales, si no usa fieldSummaries.fecha_venta o genera tendencia con los datos disponibles)
5. Chart treemap: distribuciÃ³n por categorÃ­a (usa fieldSummaries.categoria.topValues)
6. TransactionList: Ãºltimas 6-8 operaciones de la muestra`
    : parsedIntent.template === 'category'
      ? `Genera mÃ­nimo 6 componentes:
1. KPIGrid: total ventas, monto total, promedio, top categorÃ­a
2. Chart treemap: distribuciÃ³n por categorÃ­a (tamaÃ±o = monto total)
3. ProgressGroup: top categorÃ­as por % de participaciÃ³n en ventas â€” calcula % reales desde fieldSummaries.categoria.topValues, colores aurora: ["#c084fc","#67e8f9","#6ee7b7","#fcd34d","#f9a8d4","#818cf8","#fb923c","#60a5fa"]
4. Chart heatmap: categorÃ­a Ã— estado (top 6 categorÃ­as Ã— top 8 estados, valor = conteo)
5. Chart radar: comparaciÃ³n multidimensional por categorÃ­a (usa top 6 categorÃ­as, mÃ©tricas: conteo, monto promedio, % al_corriente)
6. TransactionList: Ãºltimas 6 operaciones`
      : parsedIntent.template === 'credit'
        ? `Genera mÃ­nimo 6 componentes:
1. KPIGrid: totales por estatus, monto en riesgo, % atrasados
2. ProgressGroup: distribuciÃ³n de estatus_credito â€” calcula % reales desde fieldSummaries.estatus_credito.topValues, colores: al_corriente="#0CF49B", liquidado="#60a5fa", atrasado="#fb923c", cancelado="#f472b6"
3. Chart diverging-bar: salud crediticia por estado (top 10 estados, keys: ["cancelado","atrasado","al_corriente","liquidado"], negativeLabel: "â† MÃ¡s riesgo", positiveLabel: "MÃ¡s salud â†’")
4. Chart treemap: distribuciÃ³n por categorÃ­a de crÃ©ditos atrasados
5. ProgressGroup: distribuciÃ³n por canal_venta â€” calcula % reales desde fieldSummaries.canal_venta.topValues, colores: ["#c084fc","#67e8f9","#fcd34d"]
6. TransactionList: crÃ©ditos con mayor riesgo`
        : parsedIntent.template === 'candlestick'
          ? `Genera un dashboard de VELAS/CANDLESTICK:
1. KPIGrid: periodos totales, valor mÃ¡ximo (high), valor mÃ­nimo (low), variaciÃ³n total (close final - open inicial)
2. Chart candlestick: Agrupa los registros por fecha_venta. Para cada fecha calcula:
   - open: primer valor del campo numÃ©rico (monto_total_credito, precio_contado, o monto_financiado segÃºn el intent)
   - high: valor mÃ¡ximo de ese dÃ­a
   - low: valor mÃ­nimo de ese dÃ­a
   - close: Ãºltimo valor de ese dÃ­a
   Genera al menos 10-30 velas. Usa aggregations y la muestra para derivar los OHLC reales.
   El formato DEBE ser: data: [{ date: "YYYY-MM-DD", open: N, high: N, low: N, close: N }]`
          : parsedIntent.template === 'bollinger'
            ? `Genera un dashboard de BANDAS DE BOLLINGER:
1. KPIGrid: promedio, mÃ¡ximo, mÃ­nimo, total periodos
2. Chart bollinger: Serie temporal con un valor por fecha.
   data: [{ date: "YYYY-MM-DD", value: number }]
   Agrupa por fecha_venta y suma el campo numÃ©rico relevante. Genera al menos 15+ puntos.`
            : parsedIntent.template === 'stacked-area'
              ? `Genera un dashboard de ÃREA APILADA:
1. KPIGrid: total, categorÃ­as, top serie
2. Chart stacked-area: Usa un campo temporal (fecha_venta por mes/semana) como eje X, y un campo categÃ³rico para las series.
   data: [{ label: "periodo", serie1: number, serie2: number, ... }], keys: ["serie1", ...]`
              : parsedIntent.template === 'diverging-bar'
                ? `Genera un dashboard DIVERGENTE (estilo Observable):
1. KPIGrid: total registros, % en estatus negativo (cancelado+atrasado), % en estatus positivo (liquidado+al_corriente)
2. Chart diverging-bar:
   - Usa estatus_credito como segmentos divergentes
   - Usa otro campo categÃ³rico (estado, categoria, sucursal segÃºn groupBy) como categorÃ­as (eje Y)
   - keys DEBEN estar ordenados de mÃ¡s negativo a mÃ¡s positivo: ["cancelado", "atrasado", "al_corriente", "liquidado"]
   - values: conteo de registros por combinaciÃ³n categorÃ­a+estatus
   - Incluye negativeLabel: "â† MÃ¡s riesgo" y positiveLabel: "MÃ¡s salud â†’"
   - NO incluyas neutralKey si no hay segmento neutro claro
   - El frontend normaliza automÃ¡ticamente a porcentajes y usa colores espectrales
   Ejemplo: data: [{ label: "CDMX", values: [{ key: "cancelado", value: 5 }, { key: "atrasado", value: 12 }, { key: "al_corriente", value: 30 }, { key: "liquidado", value: 25 }] }]
   keys: ["cancelado", "atrasado", "al_corriente", "liquidado"]`
                : parsedIntent.template === 'radial-stacked-bar'
                  ? `Genera un dashboard RADIAL:
1. KPIGrid: total, categorÃ­as, series
2. Chart radial-stacked-bar: Similar a stacked-area pero en coordenadas polares.
   data: [{ label: "cat", serie1: N, serie2: N }], keys: ["serie1", ...]`
                  : parsedIntent.template === 'hierarchical-bar'
                    ? `Genera un dashboard JERÃRQUICO con drill-down:
1. KPIGrid: total, niveles, registros
2. Chart hierarchical-bar: Construye un Ã¡rbol de 2 niveles usando 2 campos categÃ³ricos (ej: categoria â†’ producto, o estado â†’ ciudad).
   data: { name: "Total", children: [{ name: "Grupo", value: N, children: [{ name: "Sub", value: N }] }] }`
                    : parsedIntent.template === 'bar-race'
                      ? `Genera un dashboard de CARRERA DE BARRAS ANIMADA:
1. KPIGrid: total, frames/periodos, lÃ­der final
2. Chart bar-race: Genera frames temporales acumulativos. Agrupa por fecha (mes o semana) y por un campo categÃ³rico.
   Cada frame es la suma ACUMULADA hasta ese periodo.
   frames: [{ label: "YYYY-MM", items: [{ name: "cat", value: N }] }], maxBars: 10`
                      : parsedIntent.template === 'chart'
                        ? (totalRecords < 100
                          ? `Genera EXACTAMENTE 3 componentes (pocos registros):
1. KPIGrid: 3 metricas de resumen
2. Chart principal tipo "${parsedIntent.chartType ?? 'area'}" usando aggregations.groupBy.data para labels y values
3. TransactionList: ultimas 5 operaciones`
                          : `Genera mÃ­nimo 5 componentes:
1. KPIGrid: 3 mÃ©tricas de resumen (total registros, monto total, promedio)
2. Chart principal usando aggregations.groupBy.data para labels y values.
   - Si granularity es "month" o "week" o "year" â†’ usa type:"${parsedIntent.chartType ?? 'area'}" con eje X temporal
   - Si chartType es "scatter" â†’ usa labels=valores de un campo numÃ©rico, data=valores de otro campo numÃ©rico
   - Si chartType es "radar" â†’ usa labels=categorÃ­as/estados (top 6-8), datasets=una serie por mÃ©trica
   - Si chartType es "funnel" â†’ usa labels=etapas de crÃ©dito, data=conteos
   - Si chartType es "gauge" â†’ usa labels=["% Morosidad"], data=[valor 0-100]
   - Si chartType es "heatmap" â†’ labels=categorÃ­as (eje X), datasets=estados top 8 (eje Y)
   - Si chartType es "treemap" â†’ labels=categorÃ­as/productos, data=montos o conteos
   NUNCA uses fieldSummaries.estado para una grÃ¡fica temporal.
3. ProgressGroup: distribuciÃ³n de estatus_credito â€” calcula % reales desde fieldSummaries.estatus_credito.topValues, colores: al_corriente="#0CF49B", liquidado="#60a5fa", atrasado="#fb923c", cancelado="#f472b6"
4. Chart heatmap: categorÃ­a Ã— estado (top 5 categorÃ­as Ã— top 8 estados, valor = conteo)
5. TransactionList: Ãºltimas 6 operaciones`)
                        : parsedIntent.template === 'table'
                          ? `Genera mÃ­nimo 4 componentes:
1. KPIGrid: 3 mÃ©tricas de resumen
2. DataSummary con las columnas mÃ¡s relevantes
3. Chart treemap: distribuciÃ³n por categorÃ­a (usa fieldSummaries.categoria.topValues)
4. ProgressGroup: distribuciÃ³n de estatus_credito â€” calcula % reales desde fieldSummaries.estatus_credito.topValues, colores: al_corriente="#0CF49B", liquidado="#60a5fa", atrasado="#fb923c", cancelado="#f472b6"`
                          : 'Genera el dashboard mÃ¡s Ãºtil posible para este intent.'
}

IMPORTANTE: Usa los datos reales de aggregations. Si fieldSummaries.estado.uniqueValues > 5, usa Chart bar para estado, nunca KPIGrid por estado. NUNCA generes arrays de datos vacÃ­os â€” siempre usa los registros disponibles para calcular valores reales.

Si aggregations.crossAggregation estÃ¡ disponible, ÃšSALO para charts multi-serie temporales (area, line, stacked-area):
- crossAggregation.data = array de { label: "YYYY-MM", serie1: N, serie2: N, ... } con datos REALES
- crossAggregation.series = lista de series disponibles
- NUNCA inventes valores para charts multi-serie si crossAggregation existe â€” usa sus datos directamente

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

// â”€â”€â”€ All 32 Mexico states â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const ALL_ESTADOS = [
  'Aguascalientes','Baja California','Baja California Sur','Campeche','Chiapas','Chihuahua',
  'Ciudad de MÃ©xico','Coahuila','Colima','Durango','Guanajuato','Guerrero','Hidalgo','Jalisco',
  'MÃ©xico','MichoacÃ¡n','Morelos','Nayarit','Nuevo LeÃ³n','Oaxaca','Puebla','QuerÃ©taro',
  'Quintana Roo','San Luis PotosÃ­','Sinaloa','Sonora','Tabasco','Tamaulipas','Tlaxcala',
  'Veracruz','YucatÃ¡n','Zacatecas',
];

// â”€â”€â”€ Post-processor: remove charts that make no sense given active filters â”€â”€

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
  const fieldSummaries = (aggregations.fieldSummaries ?? {}) as Record<string, { topValues: { value: string; count: number }[] }>;
  const productoTop = fieldSummaries.producto?.topValues?.slice(0, 8) ?? [];
  const estadoTop   = fieldSummaries.estado?.topValues?.slice(0, 10) ?? [];
  const canalTop    = fieldSummaries.canal_venta?.topValues?.slice(0, 3) ?? [];
  const estatusTop  = fieldSummaries.estatus_credito?.topValues ?? [];

  config.components = (config.components as Record<string, unknown>[]).map(comp => {
    if (comp.component !== 'Chart') return comp;
    const props = comp.props as Record<string, unknown>;
    const type  = props.type as string;
    const data  = props.data as { labels?: unknown[]; datasets?: unknown[] } | undefined;
    const labels = data?.labels ?? [];

    // â”€â”€ Rule 0b: map with singleEstado filter â€” replace with bar by ciudad or categoria â”€â”€
    if (type === 'map' && singleEstado) {
      console.log(`[sanitize] replacing map (singleEstado) â†’ bar by ciudad/categoria`);
      const ciudadTop = fieldSummaries.ciudad?.topValues?.slice(0, 8) ?? [];
      const catTop2   = fieldSummaries.categoria?.topValues?.slice(0, 8) ?? [];
      const source    = ciudadTop.length >= 3 ? ciudadTop : catTop2;
      const groupLabel = ciudadTop.length >= 3 ? 'Ciudad' : 'CategorÃ­a';
      if (source.length > 0) {
        return {
          ...comp,
          props: {
            ...props,
            type: 'bar',
            data: {
              labels: source.map(s => s.value),
              datasets: [{ label: 'Ventas', data: source.map(s => s.count), backgroundColor: '#49a4d8' }],
            },
            title: props.title ?? `Ventas por ${groupLabel} â€” ${filterEstado}`,
          },
        };
      }
    }

    // â”€â”€ Rule 0: map with < 32 states â€” fill missing states with real data or 0 â”€â”€
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
        console.log(`[sanitize] expanding map from ${existingLabels.length} â†’ 32 states`);
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

    // â”€â”€ Rule 1: treemap/doughnut/pie/radar with 1 label and singleCategoria filter â”€â”€
    // Replace with bar chart grouped by producto or estado
    if (singleCategoria && ['treemap', 'doughnut', 'pie', 'radar'].includes(type) && (labels as unknown[]).length <= 1) {
      console.log(`[sanitize] replacing ${type} (1 label, single categoria) â†’ bar by producto`);
      if (productoTop.length > 0) {
        return {
          ...comp,
          props: {
            ...props,
            type: 'bar',
            data: {
              labels: productoTop.map(p => p.value),
              datasets: [{ label: 'Ventas', data: productoTop.map(p => p.count), backgroundColor: '#49a4d8' }],
            },
            title: props.title ?? `Ventas por Producto â€” ${filterCategoria}`,
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
              datasets: [{ label: 'Ventas', data: estadoTop.map(e => e.count), backgroundColor: '#7C3AED' }],
            },
            title: props.title ?? `Ventas por Estado â€” ${filterCategoria}`,
          },
        };
      }
    }

    // â”€â”€ Rule 2: treemap/doughnut/pie with singleCategoria â€” always replace with bar by producto or estado â”€â”€
    if (singleCategoria && ['treemap', 'doughnut', 'pie'].includes(type)) {
      console.log(`[sanitize] replacing ${type} (singleCategoria) â†’ bar by producto`);
      if (productoTop.length > 0) {
        return {
          ...comp,
          props: {
            ...props,
            type: 'bar',
            data: {
              labels: productoTop.map(p => p.value),
              datasets: [{ label: 'Ventas', data: productoTop.map(p => p.count), backgroundColor: '#059669' }],
            },
            title: props.title ?? `Ventas por Producto â€” ${filterCategoria}`,
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
              datasets: [{ label: 'Ventas', data: estadoTop.map(e => e.count), backgroundColor: '#059669' }],
            },
            title: props.title ?? `Ventas por Estado â€” ${filterCategoria}`,
          },
        };
      }
    }

    // â”€â”€ Rule 3: ProgressGroup with singleEstatus â€” replace with canal_venta â”€â”€
    if (singleEstatus && comp.component === 'ProgressGroup') {
      const items = (props.items ?? []) as { label: string }[];
      const allSameEstatus = items.length <= 1 || items.every(it =>
        it.label?.toLowerCase().replace(/\s/g, '_') === (filterEstatus as string)
      );
      if (allSameEstatus && canalTop.length > 0) {
        console.log(`[sanitize] replacing ProgressGroup (single estatus) â†’ canal_venta`);
        const total = canalTop.reduce((s, c) => s + c.count, 0) || 1;
        const CANAL_COLORS = ['#c084fc', '#67e8f9', '#fcd34d'];
        return {
          ...comp,
          props: {
            ...props,
            title: 'DistribuciÃ³n por Canal de Venta',
            items: canalTop.map((c, i) => ({
              label: c.value,
              value: Math.round((c.count / total) * 100),
              color: CANAL_COLORS[i % CANAL_COLORS.length],
            })),
          },
        };
      }
    }

    // â”€â”€ Rule 4: singleEstado â€” bar/heatmap grouped by estado with 1 label â”€â”€
    if (singleEstado && ['bar', 'heatmap'].includes(type) && (labels as unknown[]).length <= 1) {
      console.log(`[sanitize] replacing ${type} (1 label, single estado) â†’ bar by categoria`);
      const catTop = fieldSummaries.categoria?.topValues?.slice(0, 8) ?? [];
      if (catTop.length > 0) {
        return {
          ...comp,
          props: {
            ...props,
            type: 'bar',
            data: {
              labels: catTop.map(c => c.value),
              datasets: [{ label: 'Ventas', data: catTop.map(c => c.count), backgroundColor: '#D97706' }],
            },
            title: `Ventas por CategorÃ­a â€” ${filterEstado}`,
          },
        };
      }
    }

    // â”€â”€ Rule 5b: stacked-area with only 1 key â€” degrade to area â”€â”€
    if (type === 'stacked-area') {
      const keys = props.keys as string[] | undefined;
      if (!keys || keys.length < 2) {
        console.log(`[sanitize] stacked-area with <2 keys â†’ area`);
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
                borderColor: '#49a4d8',
              }],
            },
          },
        };
      }
    }

    // â”€â”€ Rule 5: heatmap with singleCategoria â€” replace with treemap by producto â”€â”€
    if (singleCategoria && type === 'heatmap') {
      console.log(`[sanitize] replacing heatmap (single categoria) â†’ treemap by producto`);
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
            title: `DistribuciÃ³n por Producto â€” ${filterCategoria}`,
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
              datasets: [{ label: 'Ventas', data: estadoTop.map(e => e.count), backgroundColor: '#0891B2' }],
            },
            title: `Ventas por Estado â€” ${filterCategoria}`,
          },
        };
      }
    }

    return comp;
  });

  // â”€â”€ Rule 6b: area/line with all datasets having identical repeated values â€” convert to bar â”€â”€
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
      console.log(`[sanitize] ${type} with duplicated values â†’ bar`);
      return { ...comp, props: { ...props, type: 'bar' } };
    }
    return comp;
  });

  // â”€â”€ Rule 6: 2+ consecutive bar charts â€” convert second onward to ProgressGroup â”€â”€
  let barCount = 0;
  config.components = (config.components as Record<string, unknown>[]).map(comp => {
    if (comp.component !== 'Chart') { barCount = 0; return comp; }
    const props = comp.props as Record<string, unknown>;
    const type = props.type as string;
    const data = props.data as { labels?: string[]; datasets?: { data?: number[] }[] } | undefined;
    const labels = data?.labels ?? [];

    if (type === 'bar' && (labels as unknown[]).length <= 6) {
      barCount++;
      if (barCount >= 2) {
        const values = data?.datasets?.[0]?.data ?? [];
        const maxVal = Math.max(...values, 1);
        const PROGRESS_COLORS = ['#0CF49B','#60a5fa','#fb923c','#f472b6','#c084fc','#67e8f9'];
        console.log(`[sanitize] converting duplicate bar â†’ ProgressGroup`);
        return {
          ...comp,
          component: 'ProgressGroup',
          props: {
            title: props.title,
            items: (labels as string[]).map((label, i) => ({
              label,
              value: Math.round((values[i] ?? 0) / maxVal * 100),
              color: PROGRESS_COLORS[i % PROGRESS_COLORS.length],
            })),
          },
        };
      }
    } else {
      barCount = 0;
    }
    return comp;
  });

  return config;
}

// â”€â”€â”€ Repair empty charts using pre-computed aggregations â”€â”€â”€â”€â”€â”€

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

  const COLORS = ['#49a4d8','#7C3AED','#059669','#D97706','#DC2626','#2563EB','#6366F1','#0891B2','#10B981','#F59E0B','#EF4444','#EC4899','#14B8A6','#8B5CF6','#F97316'];

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

    console.log(`[orchestrator] repairing empty Chart â€” injecting ${labels.length} groupBy data points`);

    const bgColors = labels.length === 1 ? COLORS[0] : COLORS.slice(0, labels.length);
    return {
      ...comp,
      props: {
        ...props,
        data: {
          labels,
          datasets: [{
            label: parsedIntent.metricField ?? 'Ventas',
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

// â”€â”€â”€ Aggregation helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // â”€â”€â”€ String fields: cardinality + top values â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const fieldSummaries: Record<string, unknown> = {};
  for (const field of stringFields) {
    const counts: Record<string, number> = {};
    for (const r of records) {
      const key = String(r[field] ?? '');
      counts[key] = (counts[key] ?? 0) + 1;
    }
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    fieldSummaries[field] = {
      uniqueValues: sorted.length,
      topValues: sorted
        .slice(0, 10)
        .map(([value, count]) => ({ value, count })),
    };
  }
  agg.fieldSummaries = fieldSummaries;

  // â”€â”€â”€ Numeric fields: min, max, sum, avg â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€â”€ Cross aggregation: fecha_venta Ã— top categorical field â”€
  // Provides Bedrock with real multi-series temporal data
  const crossField = ['categoria', 'estado', 'canal_venta'].find(
    f => stringFields.includes(f) && (fieldSummaries[f] as { uniqueValues: number }).uniqueValues > 1
  );
  if (crossField) {
    const topCrossValues = ((fieldSummaries[crossField] as { topValues: { value: string }[] }).topValues ?? [])
      .slice(0, 5).map(v => v.value);
    const crossGroups: Record<string, Record<string, number>> = {};
    for (const record of records) {
      const dateRaw = String(record['fecha_venta'] ?? '');
      const d = new Date(dateRaw);
      if (isNaN(d.getTime())) continue;
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const serieKey = String(record[crossField] ?? '');
      if (!topCrossValues.includes(serieKey)) continue;
      if (!crossGroups[monthKey]) crossGroups[monthKey] = {};
      crossGroups[monthKey][serieKey] = (crossGroups[monthKey][serieKey] ?? 0) + 1;
    }
    const sortedMonths = Object.keys(crossGroups).sort();
    agg.crossAggregation = {
      xField: 'fecha_venta',
      serieField: crossField,
      series: topCrossValues,
      data: sortedMonths.map(month => ({
        label: month,
        ...Object.fromEntries(topCrossValues.map(s => [s, crossGroups[month]?.[s] ?? 0])),
      })),
    };
  }

  // â”€â”€â”€ GroupBy aggregation (from parsed intent) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

      if (parsedIntent.metric === 'count') {
        groups[key] = (groups[key] ?? 0) + 1;
      } else if (parsedIntent.metricField) {
        groups[key] = (groups[key] ?? 0) + Number(record[parsedIntent.metricField] ?? 0);
      } else {
        groups[key] = (groups[key] ?? 0) + 1;
      }
    }

    const sortedGroups = Object.entries(groups).sort(([a], [b]) =>
      isDateField ? a.localeCompare(b) : groups[b] - groups[a],
    );
    const maxSlice = granularity === 'week' ? 12 : granularity === 'year' ? 10 : 36;
    agg.groupBy = {
      field,
      granularity: granularity ?? (isDateField ? 'month' : 'value'),
      metric: parsedIntent.metric,
      uniqueGroups: sortedGroups.length,
      data: sortedGroups.slice(0, maxSlice).map(([label, value]) => ({ label, value })),
    };
  }

  return agg;
}
