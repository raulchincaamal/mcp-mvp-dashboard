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
    const limit = params.limit ?? parsedIntent.limit ?? 200;

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

    // Step 3: Generate UIConfig with Bedrock (LLM knows all D3 chart formats)
    console.log('[orchestrator] generating UIConfig with Bedrock');
    const uiConfig = await generateUIConfig(
      params.intent,
      parsedIntent,
      records,
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
            text: `Eres un intérprete de intents para el sistema de dashboards de Macropay, empresa mexicana de ventas a crédito de productos (motos, celulares, bicicletas eléctricas, pantallas, tablets, consolas, audio, accesorios). Tu trabajo es convertir lo que pide el usuario en una consulta estructurada JSON.

IMPORTANTE: El usuario puede escribir sin acentos, en minúsculas, con errores ortográficos o abreviaciones. Debes interpretar correctamente aunque el texto no tenga acentos ni mayúsculas.

Responde SOLO con JSON válido, sin markdown, sin explicaciones.
Estructura exacta:
{"filters":{},"groupBy":null,"metric":"count","metricField":null,"chartType":null,"template":"executive","limit":null,"title":null}

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
- Mes específico mencionado (enero, febrero, agosto, etc.) → filters.fecha_venta como rango: {"gte":"YYYY-MM-01","lte":"YYYY-MM-31"}
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
  "cuantas motos se vendieron" → groupBy:null, filters:{categoria:"Motos"}, metric:"count"
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
    } else if (parsed.groupBy === 'fecha_venta' && !parsed.limit) {
      parsed.limit = 5000;
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

async function generateUIConfig(
  intent: string,
  parsedIntent: Awaited<ReturnType<typeof interpretIntent>>,
  records: Record<string, unknown>[],
): Promise<unknown> {
  const sampleRecords = records.slice(0, 20);
  const totalRecords = records.length;

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
- Chart (heatmap): { type: "heatmap", title?, data: { labels: ["col1","col2",...], datasets: [{ label: "fila1", data: [v1,v2,...] }, { label: "fila2", data: [...] }] } }
  labels = eje X (ej: categorías), datasets[i].label = eje Y (ej: estados), datasets[i].data = valores por columna.
- Chart (treemap): { type: "treemap", title?, data: { labels: ["nombre1","nombre2",...], datasets: [{ data: [v1,v2,...] }] } }
  labels = nombres de los nodos, data = tamaños. Ideal para distribución proporcional de categorías.
- Chart (map): { type: "map", title?, data: { labels: ["Estado1","Estado2",...], datasets: [{ data: [v1,v2,...] }] } }
  labels = nombres exactos de los 32 estados de México (con acento), data = valores numéricos por estado.
  Usa SOLO cuando el groupBy o el análisis principal sea por estado geográfico sin otra dimensión.
  Nombres válidos: Aguascalientes, Baja California, Baja California Sur, Campeche, Chiapas, Chihuahua, Ciudad de México, Coahuila, Colima, Durango, Guanajuato, Guerrero, Hidalgo, Jalisco, México, Michoacán, Morelos, Nayarit, Nuevo León, Oaxaca, Puebla, Querétaro, Quintana Roo, San Luis Potosí, Sinaloa, Sonora, Tabasco, Tamaulipas, Tlaxcala, Veracruz, Yucatán, Zacatecas.
  Para generar OHLC: agrupa registros por fecha. open=primer valor del día, high=máximo, low=mínimo, close=último valor. USA LOS DATOS REALES de aggregations.
- Chart (bollinger): { type: "bollinger", title?, data: [{ date: "YYYY-MM-DD", value: number }], n?: 20, k?: 2 }
  Genera una serie temporal con un valor por fecha (suma o promedio del campo numérico por día).
- Chart (stacked-area): { type: "stacked-area", title?, data: [{ label: "periodo", serie1: number, serie2: number, ... }], keys: ["serie1","serie2",...], colors?: [] }
  Cada objeto tiene un label (eje X) y un valor numérico por cada serie (eje Y apilado).
- Chart (diverging-bar): { type: "diverging-bar", title?, data: [{ label: "categoría", values: [{ key: "segmento", value: number }] }], keys: ["seg_negativo1","seg_negativo2","seg_positivo1","seg_positivo2"], neutralKey?: "neutral", negativeLabel?: "← Más riesgo", positiveLabel?: "Más salud →" }
  IMPORTANTE: los keys DEBEN estar ordenados de más negativo a más positivo. El componente normaliza automáticamente a porcentajes y usa colores espectrales divergentes (rojo→amarillo→verde→azul). Los values son conteos o sumas absolutas — la normalización se hace en el frontend. Incluye negativeLabel y positiveLabel para dar contexto al usuario.
- Chart (radial-stacked-bar): { type: "radial-stacked-bar", title?, data: [{ label: "categoría", serie1: number, serie2: number }], keys: ["serie1","serie2",...], colors?: [] }
- Chart (hierarchical-bar): { type: "hierarchical-bar", title?, data: { name: "Root", children: [{ name: "Grupo", value?: number, children?: [...] }] } }
  Construye un árbol jerárquico de 2-3 niveles con sumas por nivel.
- Chart (bar-race): { type: "bar-race", title?, frames: [{ label: "periodo", items: [{ name: "categoría", value: number }] }], maxBars?: 10, duration?: 800 }
  Genera frames temporales. Cada frame muestra el ranking acumulado hasta ese periodo. Los items deben estar ordenados por value descendente.
- DataSummary: { title?, columns: [{ key, label }], rows: [...] }
- TransactionList: { title?, items: [{ title, subtitle?, amount, date?, status?: "positive"|"negative"|"neutral" }] }
- ProgressGroup: { title?, items: [{ label, value (0-100), color? }] }
- StatCard: { title, value, subtitle?, trend?, trendDirection?, icon? }

IMPORTANTE PARA CHARTS ESPECIALIZADOS:
- Para candlestick: DEBES generar datos OHLC reales agrupando los registros por fecha. Usa aggregations para derivar open/high/low/close. NUNCA generes data vacía [].
- Para bar-race: Genera frames acumulativos — cada frame es la suma hasta ese periodo.
- Para hierarchical-bar: Usa 2 campos categóricos para crear padre → hijos.
- Para stacked-area y radial-stacked-bar: Usa un campo temporal como eje X y un campo categórico para las series.
- Si el filtro no encuentra datos, OMITE el filtro y usa todos los registros disponibles.

REGLA CRÍTICA — CHART TYPE OBLIGATORIO:
Si el userMessage especifica un "ChartType forzado", DEBES usar ESE tipo en el Chart principal, sin excepción.
Esta regla tiene prioridad sobre cualquier template o instrucción posterior.
Los tipos válidos son: bar, line, area, pie, doughnut, scatter, radar, funnel, gauge, heatmap, treemap,
bollinger, stacked-area, diverging-bar, radial-stacked-bar, candlestick, hierarchical-bar, bar-race.

FILOSOFÍA DE VISUALIZACIÓN:
Siempre genera dashboards RICOS y COMPLETOS. El usuario quiere entender sus datos en profundidad. Cada dashboard debe contar una historia completa con múltiples perspectivas. NUNCA generes menos de 6 componentes. Más charts = mejor dashboard.

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
4. Usa aggregations.groupBy.data para labels/values del Chart principal
5. Usa aggregations.numericSummaries para los valores de KPIGrid
6. Usa aggregations.fieldSummaries[campo].topValues para charts de distribución
7. Responde SOLO con el JSON del UIConfig, sin markdown, sin explicaciones
8. Formatea montos: >= 1M → "$1.2M", >= 1K → "$45.3K", resto → "$1,234"

COLORES para charts (usa estos exactos):
["#49a4d8","#7C3AED","#059669","#D97706","#DC2626","#2563EB","#6366F1","#0891B2","#10B981","#F59E0B","#EF4444","#EC4899","#14B8A6","#8B5CF6","#F97316"]`;

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

  // When filtered to 1 categoria, treemap/radar by categoria makes no sense → use producto or estado instead
  const categoriaCtx = singleCategoria
    ? `FILTRO ACTIVO: categoria="${filterCategoria}". NUNCA uses Chart treemap/radar/doughnut agrupado por categoría — solo hay una. En su lugar agrupa por: producto (top 8), estado (top 10), o canal_venta.`
    : '';
  const estadoCtx = singleEstado
    ? `FILTRO ACTIVO: estado="${filterEstado}". NUNCA uses Chart agrupado por estado — solo hay uno. En su lugar agrupa por: ciudad (top 8), sucursal (top 8), o categoria.`
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
    ? `MODO COMPARACIÓN ACTIVO: se están comparando ${(filterCategoria as string[]).length} categorías: [${multiCategoriaList}].
REGLAS OBLIGATORIAS para el dashboard de comparación:
1. El Chart PRINCIPAL debe ser multi-dataset — un dataset por cada categoría (${multiCategoriaList}).
   - Si hay dimensión temporal (groupBy=fecha_venta) → usa type "line" con una línea por categoría.
   - Si no hay tiempo → usa type "bar" con barras agrupadas, eje X = estado/canal_venta/producto.
   Ejemplo multi-dataset: datasets: [{ label: "Motos", data: [...] }, { label: "Celulares", data: [...] }]
2. Incluye un segundo Chart de tipo diferente también multi-dataset:
   - Con tiempo: "area" multi-dataset mostrando la evolución de cada categoría.
   - Sin tiempo: "radar" comparando las categorías en múltiples métricas (conteo, monto promedio, % al_corriente, % atrasado).
3. El KPIGrid debe tener una StatCard por categoría con su total individual (usa fieldSummaries.categoria.topValues).
4. NUNCA uses treemap ni doughnut de una sola serie para comparar — siempre multi-dataset.
5. Para calcular valores por categoría filtra fieldSummaries.categoria.topValues a las categorías del filtro.`
    : multiEstado
    ? `MODO COMPARACIÓN ACTIVO: se están comparando ${(filterEstado as string[]).length} estados: [${multiEstadoList}].
REGLAS OBLIGATORIAS para el dashboard de comparación:
1. El Chart PRINCIPAL debe ser multi-dataset — un dataset por cada estado (${multiEstadoList}).
   - Con tiempo → type "line", una línea por estado.
   - Sin tiempo → type "bar" agrupado, eje X = categoria o canal_venta.
2. Incluye un Chart "radar" comparando los estados en múltiples métricas.
3. El KPIGrid debe tener una StatCard por estado con su total individual.
4. NUNCA uses un chart de un solo dataset cuando hay múltiples estados a comparar.`
    : isMultiDataset
    ? `MODO MULTI-DATASET ACTIVO: el chart principal debe tener datasets separados por cada serie detectada.
   Usa fieldSummaries para calcular los valores por serie.`
    : '';

  const filterCtxBlock = [categoriaCtx, estadoCtx, estatusCtx, comparisonCtx].filter(Boolean).join('\n');

  const userMessage = `Intent del usuario: "${intent}"
Template sugerido: ${parsedIntent.template}
GroupBy detectado: ${parsedIntent.groupBy ?? 'ninguno'}
Métrica: ${parsedIntent.metric}${parsedIntent.metricField ? ` de ${parsedIntent.metricField}` : ''}
${parsedIntent.chartType ? `ChartType forzado: ${parsedIntent.chartType} — USA ESTE TIPO en el Chart principal, es OBLIGATORIO. No uses bar ni doughnut si el tipo forzado es diferente.` : ''}
${topN ? `Top N solicitado: ${topN} — muestra SOLO los ${topN} primeros grupos en el chart (ordenados de mayor a menor). El KPIGrid debe reflejar el total de todos los registros, no solo los top ${topN}.` : ''}

CONTEXTO DE LOS DATOS (${totalRecords} registros totales):
${JSON.stringify(aggregations, null, 2)}

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
${parsedIntent.chartType === 'map' ? `3. ProgressGroup: distribución de estatus_credito — calcula % reales desde fieldSummaries.estatus_credito.topValues, colores: al_corriente="#0CF49B", liquidado="#60a5fa", atrasado="#fb923c", cancelado="#f472b6"
4. ProgressGroup: distribución por canal_venta — calcula % reales desde fieldSummaries.canal_venta.topValues, colores: ["#c084fc","#67e8f9","#fcd34d"]
5. Chart heatmap: categoría × estado (top 5 categorías × top 8 estados, valor = conteo)
6. TransactionList: últimas 6 operaciones` : `3. ProgressGroup: distribución de estatus_credito — calcula % reales desde fieldSummaries.estatus_credito.topValues, colores: al_corriente="#0CF49B", liquidado="#60a5fa", atrasado="#fb923c", cancelado="#f472b6"
4. Chart heatmap: categoría × estado (top 5 categorías × top 8 estados, valor = conteo)
5. TransactionList: últimas 6 operaciones`}`
    : parsedIntent.template === 'executive'
    ? `Genera un dashboard COMPLETO con mínimo 6 componentes:
1. KPIGrid: total ventas, monto total, promedio precio, % morosidad, total liquidados
2. Chart bar: ventas por estado (top 10, usa fieldSummaries.estado.topValues)
3. ProgressGroup: distribución de estatus_credito — calcula % reales desde fieldSummaries.estatus_credito.topValues, colores: al_corriente="#0CF49B", liquidado="#60a5fa", atrasado="#fb923c", cancelado="#f472b6"
4. Chart area: evolución mensual de ventas (usa aggregations.groupBy si hay datos temporales, si no usa fieldSummaries.fecha_venta o genera tendencia con los datos disponibles)
5. Chart treemap: distribución por categoría (usa fieldSummaries.categoria.topValues)
6. TransactionList: últimas 6-8 operaciones de la muestra`
    : parsedIntent.template === 'category'
      ? `Genera mínimo 6 componentes:
1. KPIGrid: total ventas, monto total, promedio, top categoría
2. Chart treemap: distribución por categoría (tamaño = monto total)
3. ProgressGroup: top categorías por % de participación en ventas — calcula % reales desde fieldSummaries.categoria.topValues, colores aurora: ["#c084fc","#67e8f9","#6ee7b7","#fcd34d","#f9a8d4","#818cf8","#fb923c","#60a5fa"]
4. Chart heatmap: categoría × estado (top 6 categorías × top 8 estados, valor = conteo)
5. Chart radar: comparación multidimensional por categoría (usa top 6 categorías, métricas: conteo, monto promedio, % al_corriente)
6. TransactionList: últimas 6 operaciones`
      : parsedIntent.template === 'credit'
        ? `Genera mínimo 6 componentes:
1. KPIGrid: totales por estatus, monto en riesgo, % atrasados
2. ProgressGroup: distribución de estatus_credito — calcula % reales desde fieldSummaries.estatus_credito.topValues, colores: al_corriente="#0CF49B", liquidado="#60a5fa", atrasado="#fb923c", cancelado="#f472b6"
3. Chart diverging-bar: salud crediticia por estado (top 10 estados, keys: ["cancelado","atrasado","al_corriente","liquidado"], negativeLabel: "← Más riesgo", positiveLabel: "Más salud →")
4. Chart treemap: distribución por categoría de créditos atrasados
5. ProgressGroup: distribución por canal_venta — calcula % reales desde fieldSummaries.canal_venta.topValues, colores: ["#c084fc","#67e8f9","#fcd34d"]
6. TransactionList: créditos con mayor riesgo`
        : parsedIntent.template === 'candlestick'
          ? `Genera un dashboard de VELAS/CANDLESTICK:
1. KPIGrid: periodos totales, valor máximo (high), valor mínimo (low), variación total (close final - open inicial)
2. Chart candlestick: Agrupa los registros por fecha_venta. Para cada fecha calcula:
   - open: primer valor del campo numérico (monto_total_credito, precio_contado, o monto_financiado según el intent)
   - high: valor máximo de ese día
   - low: valor mínimo de ese día
   - close: último valor de ese día
   Genera al menos 10-30 velas. Usa aggregations y la muestra para derivar los OHLC reales.
   El formato DEBE ser: data: [{ date: "YYYY-MM-DD", open: N, high: N, low: N, close: N }]`
          : parsedIntent.template === 'bollinger'
            ? `Genera un dashboard de BANDAS DE BOLLINGER:
1. KPIGrid: promedio, máximo, mínimo, total periodos
2. Chart bollinger: Serie temporal con un valor por fecha.
   data: [{ date: "YYYY-MM-DD", value: number }]
   Agrupa por fecha_venta y suma el campo numérico relevante. Genera al menos 15+ puntos.`
            : parsedIntent.template === 'stacked-area'
              ? `Genera un dashboard de ÁREA APILADA:
1. KPIGrid: total, categorías, top serie
2. Chart stacked-area: Usa un campo temporal (fecha_venta por mes/semana) como eje X, y un campo categórico para las series.
   data: [{ label: "periodo", serie1: number, serie2: number, ... }], keys: ["serie1", ...]`
              : parsedIntent.template === 'diverging-bar'
                ? `Genera un dashboard DIVERGENTE (estilo Observable):
1. KPIGrid: total registros, % en estatus negativo (cancelado+atrasado), % en estatus positivo (liquidado+al_corriente)
2. Chart diverging-bar:
   - Usa estatus_credito como segmentos divergentes
   - Usa otro campo categórico (estado, categoria, sucursal según groupBy) como categorías (eje Y)
   - keys DEBEN estar ordenados de más negativo a más positivo: ["cancelado", "atrasado", "al_corriente", "liquidado"]
   - values: conteo de registros por combinación categoría+estatus
   - Incluye negativeLabel: "← Más riesgo" y positiveLabel: "Más salud →"
   - NO incluyas neutralKey si no hay segmento neutro claro
   - El frontend normaliza automáticamente a porcentajes y usa colores espectrales
   Ejemplo: data: [{ label: "CDMX", values: [{ key: "cancelado", value: 5 }, { key: "atrasado", value: 12 }, { key: "al_corriente", value: 30 }, { key: "liquidado", value: 25 }] }]
   keys: ["cancelado", "atrasado", "al_corriente", "liquidado"]`
                : parsedIntent.template === 'radial-stacked-bar'
                  ? `Genera un dashboard RADIAL:
1. KPIGrid: total, categorías, series
2. Chart radial-stacked-bar: Similar a stacked-area pero en coordenadas polares.
   data: [{ label: "cat", serie1: N, serie2: N }], keys: ["serie1", ...]`
                  : parsedIntent.template === 'hierarchical-bar'
                    ? `Genera un dashboard JERÁRQUICO con drill-down:
1. KPIGrid: total, niveles, registros
2. Chart hierarchical-bar: Construye un árbol de 2 niveles usando 2 campos categóricos (ej: categoria → producto, o estado → ciudad).
   data: { name: "Total", children: [{ name: "Grupo", value: N, children: [{ name: "Sub", value: N }] }] }`
                    : parsedIntent.template === 'bar-race'
                      ? `Genera un dashboard de CARRERA DE BARRAS ANIMADA:
1. KPIGrid: total, frames/periodos, líder final
2. Chart bar-race: Genera frames temporales acumulativos. Agrupa por fecha (mes o semana) y por un campo categórico.
   Cada frame es la suma ACUMULADA hasta ese periodo.
   frames: [{ label: "YYYY-MM", items: [{ name: "cat", value: N }] }], maxBars: 10`
                      : parsedIntent.template === 'chart'
                        ? `Genera mínimo 5 componentes:
1. KPIGrid: 3 métricas de resumen (total registros, monto total, promedio)
2. Chart principal usando aggregations.groupBy.data para labels y values.
   - Si granularity es "month" o "week" o "year" → usa type:"${parsedIntent.chartType ?? 'area'}" con eje X temporal
   - Si chartType es "scatter" → usa labels=valores de un campo numérico, data=valores de otro campo numérico
   - Si chartType es "radar" → usa labels=categorías/estados (top 6-8), datasets=una serie por métrica
   - Si chartType es "funnel" → usa labels=etapas de crédito, data=conteos
   - Si chartType es "gauge" → usa labels=["% Morosidad"], data=[valor 0-100]
   - Si chartType es "heatmap" → labels=categorías (eje X), datasets=estados top 8 (eje Y)
   - Si chartType es "treemap" → labels=categorías/productos, data=montos o conteos
   NUNCA uses fieldSummaries.estado para una gráfica temporal.
3. ProgressGroup: distribución de estatus_credito — calcula % reales desde fieldSummaries.estatus_credito.topValues, colores: al_corriente="#0CF49B", liquidado="#60a5fa", atrasado="#fb923c", cancelado="#f472b6"
4. Chart heatmap: categoría × estado (top 5 categorías × top 8 estados, valor = conteo)
5. TransactionList: últimas 6 operaciones`
                        : parsedIntent.template === 'table'
                          ? `Genera mínimo 4 componentes:
1. KPIGrid: 3 métricas de resumen
2. DataSummary con las columnas más relevantes
3. Chart treemap: distribución por categoría (usa fieldSummaries.categoria.topValues)
4. ProgressGroup: distribución de estatus_credito — calcula % reales desde fieldSummaries.estatus_credito.topValues, colores: al_corriente="#0CF49B", liquidado="#60a5fa", atrasado="#fb923c", cancelado="#f472b6"`
                          : 'Genera el dashboard más útil posible para este intent.'
}

IMPORTANTE: Usa los datos reales de aggregations. Si fieldSummaries.estado.uniqueValues > 5, usa Chart bar para estado, nunca KPIGrid por estado. NUNCA generes arrays de datos vacíos — siempre usa los registros disponibles para calcular valores reales.

Genera el UIConfig JSON ahora.`;

  const response = await bedrockClient.send(
    new ConverseCommand({
      modelId: MODEL_ID,
      system: [{ text: systemPrompt }],
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
    // Replace with bar chart grouped by producto or estado
    if (singleCategoria && ['treemap', 'doughnut', 'pie', 'radar'].includes(type) && (labels as unknown[]).length <= 1) {
      console.log(`[sanitize] replacing ${type} (1 label, single categoria) → bar by producto`);
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
              datasets: [{ label: 'Ventas', data: estadoTop.map(e => e.count), backgroundColor: '#7C3AED' }],
            },
            title: props.title ?? `Ventas por Estado — ${filterCategoria}`,
          },
        };
      }
    }

    // ── Rule 2: treemap/doughnut/pie with singleCategoria and all labels = that category ──
    if (singleCategoria && ['treemap', 'doughnut', 'pie'].includes(type)) {
      const allSame = (labels as string[]).every(l =>
        typeof l === 'string' && l.toLowerCase().includes((filterCategoria as string).toLowerCase().split(' ')[0])
      );
      if (allSame && (labels as unknown[]).length <= 2) {
        console.log(`[sanitize] replacing ${type} (all labels = single categoria) → bar by estado`);
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
              title: `Ventas por Estado — ${filterCategoria}`,
            },
          };
        }
      }
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
        const CANAL_COLORS = ['#c084fc', '#67e8f9', '#fcd34d'];
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

    // ── Rule 4: singleEstado — bar/heatmap grouped by estado with 1 label ──
    if (singleEstado && ['bar', 'heatmap'].includes(type) && (labels as unknown[]).length <= 1) {
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
              datasets: [{ label: 'Ventas', data: catTop.map(c => c.count), backgroundColor: '#D97706' }],
            },
            title: `Ventas por Categoría — ${filterEstado}`,
          },
        };
      }
    }

    // ── Rule 5: heatmap with singleCategoria — replace with treemap by producto ──
    if (singleCategoria && type === 'heatmap') {
      console.log(`[sanitize] replacing heatmap (single categoria) → treemap by producto`);
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
              datasets: [{ label: 'Ventas', data: estadoTop.map(e => e.count), backgroundColor: '#0891B2' }],
            },
            title: `Ventas por Estado — ${filterCategoria}`,
          },
        };
      }
    }

    return comp;
  });

  // ── Rule 6: 2+ consecutive bar charts — convert second onward to ProgressGroup ──
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
        console.log(`[sanitize] converting duplicate bar → ProgressGroup`);
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

    console.log(`[orchestrator] repairing empty Chart — injecting ${labels.length} groupBy data points`);

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

  // ─── String fields: cardinality + top values ──────────────
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
    const maxSlice = granularity === 'week' ? 52 : granularity === 'year' ? 10 : 36;
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
