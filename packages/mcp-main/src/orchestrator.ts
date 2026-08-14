import {
  BedrockRuntimeClient,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime';
import type { McpClient } from './mcp-client.js';
import { generateCacheKey, cacheGet, cacheSet, TTL } from './cache.js';

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION,
});
const MODEL_ID = process.env.BEDROCK_MODEL_ID!;

// ─── Intent validation ───────────────────────────────────────

interface ValidationResult {
  isValid: boolean;
  sanitizedIntent: string;
  errorMessage?: string;
  isGreeting?: boolean;
}

function validateIntent(intent: string): ValidationResult {
  const trimmed = intent.trim();
  
  // Empty or too short
  if (!trimmed || trimmed.length < 3) {
    return { isValid: false, sanitizedIntent: '', errorMessage: 'Por favor escribe qué información necesitas ver. Ejemplo: "ventas de motos por estado"' };
  }
  
  // Too long (likely copy-paste error or attack)
  if (trimmed.length > 500) {
    return { isValid: false, sanitizedIntent: trimmed.slice(0, 500), errorMessage: 'El mensaje es muy largo. Por favor sé más específico.' };
  }
  
  // Greetings and small talk - respond friendly but ask for intent
  const greetings = /^(hola|hey|buenos? (d[ií]as?|tardes?|noches?)|qu[eé] tal|saludos?|hi|hello)\s*[!.?]?$/i;
  if (greetings.test(trimmed)) {
    return { isValid: false, sanitizedIntent: trimmed, isGreeting: true, errorMessage: '¡Hola! ¿Qué información te gustaría ver? Puedo mostrarte ventas, créditos, gráficas por estado, categoría, etc.' };
  }
  
  // Thanks/acknowledgments
  const thanks = /^(gracias|ok|vale|listo|entendido|perfecto|genial|excelente|bien|bueno)\s*[!.?]?$/i;
  if (thanks.test(trimmed)) {
    return { isValid: false, sanitizedIntent: trimmed, errorMessage: '¡De nada! ¿Necesitas ver algo más?' };
  }
  
  // Gibberish detection (no vowels or too many consonants in a row)
  const hasVowels = /[aeiouáéíóú]/i.test(trimmed);
  const tooManyConsonants = /[bcdfghjklmnpqrstvwxyz]{5,}/i.test(trimmed);
  if (!hasVowels || tooManyConsonants) {
    return { isValid: false, sanitizedIntent: trimmed, errorMessage: 'No entendí tu mensaje. ¿Puedes reformularlo? Ejemplo: "muéstrame las ventas del mes"' };
  }
  
  return { isValid: true, sanitizedIntent: trimmed };
}

// ─── Field synonyms mapping ─────────────────────────────────

function normalizeFieldSynonyms(intent: string): string {
  let normalized = intent;
  
  // Field name synonyms
  const synonyms: [RegExp, string][] = [
    [/\b(marca|fabricante|manufacturer)\b/gi, 'producto'],
    [/\b(regi[oó]n|zona|[aá]rea)\b/gi, 'estado'],
    [/\b(tienda|local|punto de venta)\b/gi, 'sucursal'],
    [/\b(tel[eé]fono|celular|m[oó]vil|smartphone)\b/gi, 'Celulares'],
    [/\b(tele|televisi[oó]n|tv)\b/gi, 'Pantallas/TV'],
    [/\b(bici|bicicleta)s?\b/gi, 'Bicicletas Eléctricas'],
    [/\b(moto|motocicleta)s?\b/gi, 'Motos'],
    [/\b(CDMX|DF|Ciudad de M[eé]xico|Distrito Federal)\b/gi, 'Ciudad de México'],
    [/\b(Edomex|Estado de M[eé]xico)\b/gi, 'México'],
    [/\b(NL|Nuevo Le[oó]n|Monterrey)\b/gi, 'Nuevo León'],
    [/\b(Gdl|Guadalajara)\b/gi, 'Jalisco'],
    [/\b(morosos?|vencidos?|deudores?)\b/gi, 'atrasado'],
    [/\b(pagados?|saldados?|finiquitados?)\b/gi, 'liquidado'],
    [/\b(al d[ií]a|al corriente|puntuales?)\b/gi, 'al_corriente'],
  ];
  
  for (const [regex, replacement] of synonyms) {
    normalized = normalized.replace(regex, replacement);
  }
  
  return normalized;
}

// ─── Date helpers ─────────────────────────────────────────────

function normalizeDateExpressions(intent: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const day = now.getDate();
  
  const monthNames = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const pad = (n: number) => String(n).padStart(2, '0');
  const formatDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  
  let normalized = intent;
  
  // "hoy" → fecha de hoy
  if (/\bhoy\b/i.test(normalized)) {
    const today = formatDate(now);
    normalized = normalized.replace(/\bhoy\b/gi, `hoy (${today})`);
  }
  
  // "ayer" → fecha de ayer
  if (/\bayer\b/i.test(normalized)) {
    const yesterday = new Date(now);
    yesterday.setDate(day - 1);
    normalized = normalized.replace(/\bayer\b/gi, `ayer (${formatDate(yesterday)})`);
  }
  
  // "esta semana" → lunes a hoy
  if (/esta\s+semana/i.test(normalized)) {
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(day - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    normalized = normalized.replace(/esta\s+semana/gi, `esta semana (del ${formatDate(monday)} al ${formatDate(now)})`);
  }
  
  // "semana pasada" → lunes a domingo anterior
  if (/semana\s+pasada/i.test(normalized)) {
    const dayOfWeek = now.getDay();
    const lastMonday = new Date(now);
    lastMonday.setDate(day - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) - 7);
    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastMonday.getDate() + 6);
    normalized = normalized.replace(/semana\s+pasada/gi, `semana pasada (del ${formatDate(lastMonday)} al ${formatDate(lastSunday)})`);
  }
  
  // "últimos N días" → rango
  const lastNDays = normalized.match(/[uú]ltimos?\s+(\d+)\s+d[ií]as?/i);
  if (lastNDays) {
    const n = parseInt(lastNDays[1]);
    const startDate = new Date(now);
    startDate.setDate(day - n);
    normalized = normalized.replace(/[uú]ltimos?\s+\d+\s+d[ií]as?/gi, `últimos ${n} días (del ${formatDate(startDate)} al ${formatDate(now)})`);
  }
  
  // "este mes" → rango concreto
  if (/este\s+mes/i.test(normalized)) {
    const start = `${year}-${pad(month + 1)}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const end = `${year}-${pad(month + 1)}-${lastDay}`;
    normalized = normalized.replace(/este\s+mes/gi, `el mes ${monthNames[month]} ${year} (del ${start} al ${end})`);
  }
  
  // "mes pasado" → rango concreto
  if (/mes\s+pasado/i.test(normalized)) {
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const start = `${prevYear}-${pad(prevMonth + 1)}-01`;
    const lastDay = new Date(prevYear, prevMonth + 1, 0).getDate();
    const end = `${prevYear}-${pad(prevMonth + 1)}-${lastDay}`;
    normalized = normalized.replace(/mes\s+pasado/gi, `el mes ${monthNames[prevMonth]} ${prevYear} (del ${start} al ${end})`);
  }
  
  // "este año" → rango concreto
  if (/este\s+a[ñn]o/i.test(normalized)) {
    normalized = normalized.replace(/este\s+a[ñn]o/gi, `el año ${year} (del ${year}-01-01 al ${year}-12-31)`);
  }
  
  // "año pasado" → rango concreto
  if (/a[ñn]o\s+pasado/i.test(normalized)) {
    const prevYear = year - 1;
    normalized = normalized.replace(/a[ñn]o\s+pasado/gi, `el año ${prevYear} (del ${prevYear}-01-01 al ${prevYear}-12-31)`);
  }
  
  // "por mes" → groupBy mes (extraer mes de fecha_venta)
  if (/por\s+mes/i.test(normalized) && !/groupBy/i.test(normalized)) {
    normalized = normalized.replace(/por\s+mes/gi, 'agrupado por mes (campo: mes extraído de fecha_venta)');
  }
  
  // Meses específicos: "en julio", "de agosto", etc.
  for (let i = 0; i < monthNames.length; i++) {
    const regex = new RegExp(`(en|de|del mes de)\\s+${monthNames[i]}(?!\\s+\\d{4})`, 'gi');
    if (regex.test(normalized)) {
      const start = `${year}-${pad(i + 1)}-01`;
      const lastDay = new Date(year, i + 1, 0).getDate();
      const end = `${year}-${pad(i + 1)}-${lastDay}`;
      normalized = normalized.replace(regex, `en ${monthNames[i]} ${year} (del ${start} al ${end})`);
    }
  }
  
  return normalized;
}

// ─── Chart type synonyms ──────────────────────────────────────

function normalizeChartType(intent: string): { chartTypes: string[]; normalizedIntent: string } {
  let normalized = intent;
  const chartTypes: string[] = [];
  
  const chartMappings: [RegExp, string][] = [
    [/gr[aá]fica?\s+de\s+(pastel|pay|pie|circular)/gi, 'pie'],
    [/(pastel|pay|circular)/gi, 'pie'],
    [/\bpie\b/gi, 'pie'],
    [/gr[aá]fica?\s+de\s+(dona|donut|doughnut|rosquilla)/gi, 'doughnut'],
    [/(dona|donut|doughnut)/gi, 'doughnut'],
    [/gr[aá]fica?\s+de\s+(barras?|columnas?)/gi, 'bar'],
    [/(barras?|columnas?)/gi, 'bar'],
    [/gr[aá]fica?\s+de\s+(l[ií]neas?|tendencia)/gi, 'line'],
    [/(l[ií]neas?)(?!\s+de)/gi, 'line'],
    [/tendencia/gi, 'line'],
    [/gr[aá]fica?\s+de\s+[aá]rea/gi, 'area'],
  ];
  
  // Detect ALL chart types mentioned
  for (const [regex, type] of chartMappings) {
    if (regex.test(normalized) && !chartTypes.includes(type)) {
      chartTypes.push(type);
    }
  }
  
  return { chartTypes, normalizedIntent: normalized };
}

// ─── Session context for refinement ───────────────────────────

interface SessionContext {
  lastIntent: string;
  lastParsedIntent: ParsedIntent;
  lastFilters: Record<string, unknown>;
  timestamp: number;
}

const SESSION_TTL = 30 * 60; // 30 minutes

async function getSessionContext(sessionId: string): Promise<SessionContext | null> {
  if (!sessionId) return null;
  return cacheGet<SessionContext>(`session:${sessionId}`);
}

async function saveSessionContext(sessionId: string, context: SessionContext): Promise<void> {
  if (!sessionId) return;
  await cacheSet(`session:${sessionId}`, context, SESSION_TTL);
}

// Detect if intent is a refinement (needs previous context)
function isRefinementIntent(intent: string): boolean {
  const refinementPatterns = [
    /^(hazlo|ponlo|c[aá]mbialo|cambiar?)\s+(en|a|de|con)/i,
    /^(ahora|tambi[eé]n|adem[aá]s)\s+(agr[eé]gale|qu[ií]tale|pon|muestra)/i,
    /^(qu[ií]tale|agr[eé]gale|pon(le)?|muestra(me)?)/i,
    /^(m[aá]s|menos)\s+(datos|registros|informaci[oó]n)/i,
    /^(en|con)\s+(tonos?|colou?res?)\s+(azul|verde|rojo|oscuro|claro)/i,
    /^(y|\?)\s+(por|en|de)\s+/i,
    /^\u00bfy\s+(por|en|de|cu[aá]nto)/i,
    /^(no me gust[oó]|otra vez|de nuevo|rep[ií]te)/i,
    /^(m[aá]s simple|m[aá]s detalle|simplifica|detalla)/i,
  ];
  return refinementPatterns.some(p => p.test(intent.trim()));
}

// ─── Component catalog ────────────────────────────────────────

const COMPONENT_CATALOG = [
  { name: 'StatCard', description: 'Metric card with title, large value, trend arrow, and icon' },
  { name: 'KPIGrid', description: 'Grid of StatCards for key metrics' },
  { name: 'Chart', description: 'Full Chart.js chart (bar, line, pie, doughnut, area)' },
  { name: 'DataSummary', description: 'Styled data table with hover effects' },
  { name: 'TransactionList', description: 'List of items with title, amount, date, status' },
  { name: 'ProgressGroup', description: 'Card with multiple progress bars' },
  { name: 'MiniChart', description: 'Compact sparkline chart inside a card' },
];

// ─── Orchestrator ─────────────────────────────────────────────

export interface OrchestrationParams {
  intent: string;
  dataset?: string;
  filters?: Record<string, unknown>;
  limit?: number;
  sessionId?: string;  // For refinement/follow-up intents
}

export async function orchestrate(params: OrchestrationParams): Promise<unknown> {
  const dataset = params.dataset ?? 'ventas-credito';
  const sessionId = params.sessionId ?? '';
  
  // Validate intent first
  const validation = validateIntent(params.intent);
  if (!validation.isValid) {
    console.log(`[orchestrator] invalid intent: "${params.intent}" - ${validation.errorMessage}`);
    return {
      title: validation.isGreeting ? '¡Hola!' : 'Necesito más información',
      layout: 'vertical',
      components: [{
        component: 'StatCard',
        props: {
          title: validation.isGreeting ? 'Bienvenido a Macropay Dashboard' : '¿Qué te gustaría ver?',
          value: validation.errorMessage,
          icon: validation.isGreeting ? '👋' : '❓',
        }
      }]
    };
  }
  
  // Check if this is a refinement intent that needs previous context
  let baseIntent = validation.sanitizedIntent;
  let previousContext: SessionContext | null = null;
  
  if (isRefinementIntent(baseIntent) && sessionId) {
    previousContext = await getSessionContext(sessionId);
    if (previousContext) {
      console.log(`[orchestrator] refinement detected, merging with previous: "${previousContext.lastIntent}"`);
      baseIntent = `${previousContext.lastIntent} ${baseIntent}`;
    }
  }
  
  // Normalize field synonyms and dates
  const withSynonyms = normalizeFieldSynonyms(baseIntent);
  const normalizedIntent = normalizeDateExpressions(withSynonyms);
  const { chartTypes: detectedChartTypes, normalizedIntent: finalIntent } = normalizeChartType(normalizedIntent);
  
  console.log(`[orchestrator] original intent: "${params.intent}"`);
  if (previousContext) console.log(`[orchestrator] combined intent: "${baseIntent}"`);
  console.log(`[orchestrator] normalized intent: "${finalIntent}"`);
  if (detectedChartTypes.length) console.log(`[orchestrator] detected chart types: ${detectedChartTypes.join(', ')}`);

  const cacheKey = generateCacheKey('ui', {
    dataset,
    intent: finalIntent,
    filters: params.filters,
    limit: params.limit,
  });
  const cached = await cacheGet<unknown>(cacheKey);
  if (cached) {
    console.log('[orchestrator] cache hit');
    return cached;
  }

  const { gcpClient, uiClient } = await import('./mcp-client.js').then((m) =>
    m.createMcpClients(),
  );

  try {
    // Step 1: Interpret intent with Bedrock → structured query
    console.log(`[orchestrator] interpreting intent with model: ${MODEL_ID}`);
    const parsedIntent = await interpretIntent(finalIntent, detectedChartTypes);
    console.log('[orchestrator] parsed intent:', JSON.stringify(parsedIntent));

    // Step 2: Query real data
    const filters: Record<string, unknown> = { ...parsedIntent.filters, ...params.filters };
    for (const [key, value] of Object.entries(filters)) {
      if (Array.isArray(value) && value.length >= 8) delete filters[key];
    }
    const limit = params.limit ?? parsedIntent.limit ?? 100;
    const needsAllData = !!(parsedIntent.trendAnalysis || parsedIntent.percentile || parsedIntent.cumulative || parsedIntent.correlation || parsedIntent.comparison || parsedIntent.groupByMultiple || parsedIntent.drillDown);
    const fetchLimit = needsAllData ? 5000 : (parsedIntent.excludeFilters || parsedIntent.orFilters ? limit * 3 : limit);

    console.log(`[orchestrator] querying data — filters: ${JSON.stringify(filters)}, limit: ${fetchLimit}`);
    const queryResult = await gcpClient.callTool('query_data', {
      dataset,
      ...(Object.keys(filters).length > 0 ? { filters } : {}),
      limit: fetchLimit,
    }) as { records?: Record<string, unknown>[]; totalRecords?: number };

    let records = queryResult.records ?? (queryResult as unknown as Record<string, unknown>[]);

    // Apply OR filters client-side
    if (parsedIntent.orFilters && Object.keys(parsedIntent.orFilters).length > 0) {
      console.log(`[orchestrator] applying OR filters: ${JSON.stringify(parsedIntent.orFilters)}`);
      records = handleOrFilters(records, parsedIntent.orFilters);
    }

    // Apply exclusion filters client-side
    if (parsedIntent.excludeFilters && Object.keys(parsedIntent.excludeFilters).length > 0) {
      console.log(`[orchestrator] applying exclusions: ${JSON.stringify(parsedIntent.excludeFilters)}`);
      records = records.filter(record => {
        for (const [field, excludeValue] of Object.entries(parsedIntent.excludeFilters!)) {
          if (String(record[field] ?? '').toLowerCase() === String(excludeValue).toLowerCase()) return false;
        }
        return true;
      });
    }

    // Apply text search client-side
    if (parsedIntent.textSearch) {
      console.log(`[orchestrator] applying text search: ${JSON.stringify(parsedIntent.textSearch)}`);
      records = handleTextSearch(records, parsedIntent.textSearch);
    }

    // Apply calculated field
    if (parsedIntent.calculatedField) {
      console.log(`[orchestrator] applying calculated field: ${parsedIntent.calculatedField.name}`);
      records = applyCalculatedField(records, parsedIntent.calculatedField);
    }

    records = records.slice(0, limit);
    console.log(`[orchestrator] got ${records.length} records after client-side filters`);

    // Handle no results — ask Bedrock for smart suggestions based on what actually exists
    if (!records.length) {
      console.log('[orchestrator] no records found, generating smart suggestions');
      const smartEmpty = await generateEmptyStateWithSuggestions(
        params.intent, parsedIntent, filters, dataset, gcpClient
      );
      await cacheSet(cacheKey, smartEmpty, TTL.INTENT);
      return smartEmpty;
    }

    // Handle special cases that return their own UIConfig
    let specialResult: unknown = null;

    if (parsedIntent.findExtreme) {
      console.log(`[orchestrator] handling findExtreme`);
      specialResult = handleFindExtreme(records, parsedIntent.findExtreme, baseIntent);
    } else if (parsedIntent.trendAnalysis) {
      console.log('[orchestrator] handling trendAnalysis');
      specialResult = handleTrendAnalysis(records, baseIntent);
    } else if (parsedIntent.cumulative) {
      console.log('[orchestrator] handling cumulative');
      specialResult = handleCumulative(records, parsedIntent.metricField);
    } else if (parsedIntent.correlation) {
      console.log(`[orchestrator] handling correlation`);
      specialResult = handleCorrelation(records, parsedIntent.correlation);
    } else if (parsedIntent.drillDown) {
      console.log(`[orchestrator] handling drillDown: ${JSON.stringify(parsedIntent.drillDown)}`);
      specialResult = handleDrillDown(records, parsedIntent.drillDown);
    } else if (parsedIntent.comparison) {
      console.log(`[orchestrator] handling comparison: ${JSON.stringify(parsedIntent.comparison)}`);
      specialResult = handleComparison(records, parsedIntent.comparison, parsedIntent.metricField);
    } else if (parsedIntent.groupByMultiple?.length) {
      console.log(`[orchestrator] handling groupByMultiple: ${parsedIntent.groupByMultiple}`);
      specialResult = handleGroupByMultiple(records, parsedIntent.groupByMultiple, parsedIntent.metricField);
    } else if (parsedIntent.percentile) {
      console.log(`[orchestrator] handling percentile`);
      records = handlePercentile(records, parsedIntent.percentile, parsedIntent.metricField);
    }

    if (specialResult) {
      await cacheSet(cacheKey, specialResult, TTL.INTENT);
      if (sessionId) await saveSessionContext(sessionId, { lastIntent: baseIntent, lastParsedIntent: parsedIntent, lastFilters: filters, timestamp: Date.now() });
      return specialResult;
    }

    // Step 3: Bedrock generates UIConfig from data + intent
    console.log('[orchestrator] generating UIConfig with Bedrock');
    const uiConfig = await generateUIConfig(baseIntent, parsedIntent, records);

    // Save session context for future refinements
    if (sessionId) {
      await saveSessionContext(sessionId, {
        lastIntent: baseIntent,
        lastParsedIntent: parsedIntent,
        lastFilters: filters,
        timestamp: Date.now(),
      });
    }

    await cacheSet(cacheKey, uiConfig, TTL.INTENT);
    return uiConfig;
  } finally {
    await gcpClient.disconnect();
    await uiClient.disconnect();
  }
}

// ─── Step 1: Interpret intent ─────────────────────────────────

interface ParsedIntent {
  filters: Record<string, unknown>;
  excludeFilters?: Record<string, unknown>;
  orFilters?: Record<string, unknown[]>;  // "motos O celulares" → {categoria: ["Motos", "Celulares"]}
  groupBy: string | null;
  groupByMultiple?: string[];  // "por estado Y categoría" → ["estado", "categoria"]
  metric: string;
  metricField: string | null;
  chartTypes: string[];
  template: string;
  limit: number | null;
  title: string | null;
  colorTheme?: string;
  comparison?: { field: string; values: string[]; type?: 'yoy' | 'mom' | 'custom' };
  sortBy?: { field: string; order: 'asc' | 'desc' };
  showPercentages?: boolean;
  topBottom?: { type: 'top' | 'bottom'; count: number };
  findExtreme?: { type: 'max' | 'min'; field: string };
  percentile?: { type: 'top' | 'bottom'; percent: number };
  trendAnalysis?: boolean;
  // New capabilities
  cumulative?: boolean;  // "ventas acumuladas"
  correlation?: { fields: [string, string] };  // "relación entre edad y monto"
  drillDown?: { field: string; value: string };  // "detalles de Jalisco"
  calculatedField?: { name: string; formula: string };  // "margen de ganancia"
  textSearch?: { field: string; query: string };  // "busca iPhone"
}

async function interpretIntent(intent: string, detectedChartTypes: string[]): Promise<ParsedIntent> {
  const fallback: ParsedIntent = {
    filters: {}, groupBy: null, metric: 'count', metricField: null,
    chartTypes: detectedChartTypes.length ? detectedChartTypes : ['bar'], template: 'chart', limit: 100, title: null,
  };

  const now = new Date();
  const currentDate = now.toISOString().split('T')[0];

  try {
    const response = await bedrockClient.send(new ConverseCommand({
      modelId: MODEL_ID,
      system: [{
        text: `Eres un intérprete de intents para dashboards de Macropay (ventas a crédito en México).

FECHA ACTUAL: ${currentDate}. Dataset: ventas desde 2024-01-01.

Responde SOLO JSON válido, sin markdown.
Estructura:
{"filters":{},"excludeFilters":{},"orFilters":{},"groupBy":null,"groupByMultiple":null,"metric":"count","metricField":null,"chartTypes":[],"template":"chart","limit":null,"title":null,"colorTheme":null,"comparison":null,"sortBy":null,"showPercentages":false,"topBottom":null,"findExtreme":null,"percentile":null,"trendAnalysis":false,"cumulative":false,"correlation":null,"drillDown":null,"calculatedField":null,"textSearch":null}

CAMPOS: id, fecha_venta, cliente, edad_cliente, genero, estado, ciudad, sucursal, categoria, producto, color, precio_contado, enganche, monto_financiado, monto_total_credito, plazo_semanas, pago_semanal, semanas_pagadas, estatus_credito, canal_venta, vendedor

REGLAS:

1. EXTREMOS (findExtreme):
   - "la venta más cara" → findExtreme:{type:"max",field:"monto_total_credito"}
   - "el más barato" → findExtreme:{type:"min",field:"precio_contado"}

2. PERCENTILES (percentile):
   - "el 20% más alto" → percentile:{type:"top",percent:20}
   - "el 10% inferior" → percentile:{type:"bottom",percent:10}

3. TENDENCIAS (trendAnalysis):
   - "¿por qué bajaron?", "tendencia", "evolución" → trendAnalysis:true, groupBy:"mes"

4. FILTROS OR (orFilters) - cuando dice "o"/"u":
   - "motos o celulares" → orFilters:{categoria:["Motos","Celulares"]}
   - "Jalisco o Nuevo León" → orFilters:{estado:["Jalisco","Nuevo León"]}
   - "rojo, azul o negro" → orFilters:{color:["Rojo","Azul","Negro"]}

5. AGRUPACIÓN MÚLTIPLE (groupByMultiple) - cuando dice "y" entre campos:
   - "por estado y categoría" → groupByMultiple:["estado","categoria"]
   - "por mes y canal" → groupByMultiple:["mes","canal_venta"]
   - "matriz estado-producto" → groupByMultiple:["estado","producto"]

6. ACUMULADOS (cumulative):
   - "ventas acumuladas" → cumulative:true, groupBy:"mes"
   - "running total" → cumulative:true
   - "acumulado por mes" → cumulative:true, groupBy:"mes"

7. CORRELACIONES (correlation):
   - "relación entre edad y monto" → correlation:{fields:["edad_cliente","monto_total_credito"]}
   - "correlación precio-plazo" → correlation:{fields:["precio_contado","plazo_semanas"]}

8. DRILL-DOWN (drillDown):
   - "detalles de Jalisco" → drillDown:{field:"estado",value:"Jalisco"}
   - "desglose de motos" → drillDown:{field:"categoria",value:"Motos"}
   - "profundizar en atrasados" → drillDown:{field:"estatus_credito",value:"atrasado"}

9. CÁLCULOS CUSTOM (calculatedField):
   - "margen de ganancia" → calculatedField:{name:"margen",formula:"monto_total_credito-precio_contado"}
   - "porcentaje de enganche" → calculatedField:{name:"pct_enganche",formula:"enganche/precio_contado*100"}
   - "avance de pago" → calculatedField:{name:"avance",formula:"semanas_pagadas/plazo_semanas*100"}

10. BÚSQUEDA TEXTO (textSearch):
    - "busca iPhone" → textSearch:{field:"producto",query:"iPhone"}
    - "clientes llamados Juan" → textSearch:{field:"cliente",query:"Juan"}
    - "productos Samsung" → textSearch:{field:"producto",query:"Samsung"}

11. COMPARACIONES TEMPORALES (comparison con type):
    - "vs año pasado", "comparado con 2024" → comparison:{field:"año",values:["2024","2025"],type:"yoy"}
    - "vs mes anterior" → comparison:{field:"mes",values:["anterior","actual"],type:"mom"}
    - "enero vs febrero" → comparison:{field:"mes",values:["Enero","Febrero"],type:"custom"}
    - "Jalisco vs NL" → comparison:{field:"estado",values:["Jalisco","Nuevo León"],type:"custom"}

12. FILTROS COMBINADOS, RANGOS, EXCLUSIONES, TOP/BOTTOM, PORCENTAJES, COLORES: (igual que antes)

EJEMPLOS:
- "motos o celulares por estado" → {"orFilters":{"categoria":["Motos","Celulares"]},"groupBy":"estado"}
- "ventas por estado y categoría" → {"groupByMultiple":["estado","categoria"]}
- "ventas acumuladas por mes" → {"cumulative":true,"groupBy":"mes","chartTypes":["line"]}
- "relación edad-monto" → {"correlation":{"fields":["edad_cliente","monto_total_credito"]}}
- "detalles de Jalisco" → {"drillDown":{"field":"estado","value":"Jalisco"}}
- "busca Galaxy" → {"textSearch":{"field":"producto","query":"Galaxy"}}
- "este mes vs mes pasado" → {"comparison":{"field":"mes","values":["anterior","actual"],"type":"mom"}}`,
      }],
      messages: [{ role: 'user', content: [{ text: intent }] }],
      inferenceConfig: { maxTokens: 512, temperature: 0 },
    }));

    const block = response.output?.message?.content?.[0];
    if (!block || !('text' in block)) return fallback;
    const clean = block.text!.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    const raw = JSON.parse(clean);
    
    // Normalize: convert old chartType to chartTypes array
    let chartTypes = raw.chartTypes ?? [];
    if (raw.chartType && !chartTypes.length) {
      chartTypes = [raw.chartType];
    }
    // Merge with detected chart types from regex
    for (const ct of detectedChartTypes) {
      if (!chartTypes.includes(ct)) {
        chartTypes.unshift(ct);
      }
    }
    if (!chartTypes.length) chartTypes = ['bar'];
    
    return {
      ...fallback,
      ...raw,
      chartTypes,
    };
  } catch (err) {
    console.log('[orchestrator] intent interpretation failed:', (err as Error).message);
    return fallback;
  }
}

// ─── Color themes ─────────────────────────────────────────────

const COLOR_THEMES: Record<string, string[]> = {
  default: ["#49a4d8","#7C3AED","#059669","#D97706","#DC2626","#2563EB","#6366F1","#0891B2","#10B981","#F59E0B","#EF4444","#EC4899","#14B8A6","#8B5CF6","#F97316"],
  blue: ["#1e3a5f","#2563EB","#3B82F6","#60A5FA","#93C5FD","#BFDBFE","#0EA5E9","#0284C7","#0369A1","#075985"],
  green: ["#064E3B","#059669","#10B981","#34D399","#6EE7B7","#A7F3D0","#14B8A6","#0D9488","#0F766E","#115E59"],
  dark: ["#1F2937","#374151","#4B5563","#6B7280","#9CA3AF","#111827","#1E293B","#334155","#475569","#64748B"],
  light: ["#FEF3C7","#FDE68A","#FCD34D","#FBBF24","#F59E0B","#D1FAE5","#A7F3D0","#6EE7B7","#FBCFE8","#F9A8D4"],
  mono: ["#18181B","#27272A","#3F3F46","#52525B","#71717A","#A1A1AA","#D4D4D8","#E4E4E7","#F4F4F5","#FAFAFA"],
  corporate: ["#1E40AF","#1D4ED8","#2563EB","#3B82F6","#60A5FA","#0F172A","#1E293B","#334155","#475569","#64748B"],
};

// ─── Special handlers ─────────────────────────────────────────────

function handleOrFilters(
  records: Record<string, unknown>[],
  orFilters: Record<string, unknown[]>,
): Record<string, unknown>[] {
  return records.filter(record => {
    for (const [field, values] of Object.entries(orFilters)) {
      const v = String(record[field] ?? '').toLowerCase();
      if (values.some(val => String(val).toLowerCase() === v)) return true;
    }
    return false;
  });
}

function handleTextSearch(
  records: Record<string, unknown>[],
  textSearch: { field: string; query: string },
): Record<string, unknown>[] {
  const q = textSearch.query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return records.filter(r => {
    const val = String(r[textSearch.field] ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return val.includes(q);
  });
}

function applyCalculatedField(
  records: Record<string, unknown>[],
  calc: { name: string; formula: string },
): Record<string, unknown>[] {
  const formulaMap: Record<string, (r: Record<string, unknown>) => number> = {
    'monto_total_credito-precio_contado': r => Number(r.monto_total_credito) - Number(r.precio_contado),
    'enganche/precio_contado*100': r => (Number(r.enganche) / (Number(r.precio_contado) || 1)) * 100,
    'semanas_pagadas/plazo_semanas*100': r => (Number(r.semanas_pagadas) / (Number(r.plazo_semanas) || 1)) * 100,
    'monto_financiado/monto_total_credito*100': r => (Number(r.monto_financiado) / (Number(r.monto_total_credito) || 1)) * 100,
  };
  const fn = formulaMap[calc.formula];
  if (!fn) return records;
  return records.map(r => ({ ...r, [calc.name]: Math.round(fn(r) * 100) / 100 }));
}

function handleDrillDown(
  records: Record<string, unknown>[],
  drillDown: { field: string; value: string },
): unknown {
  const filtered = records.filter(r =>
    String(r[drillDown.field] ?? '').toLowerCase() === drillDown.value.toLowerCase()
  );
  if (!filtered.length) return null;
  const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const total = filtered.length;
  const totalMonto = filtered.reduce((s, r) => s + (Number(r.monto_total_credito) || 0), 0);
  const avgMonto = totalMonto / total;
  const byCat: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const byMonth: Record<string, number> = {};
  for (const r of filtered) {
    const cat = String(r.categoria ?? 'N/A'); byCat[cat] = (byCat[cat] ?? 0) + 1;
    const st = String(r.estatus_credito ?? 'N/A'); byStatus[st] = (byStatus[st] ?? 0) + 1;
    if (r.fecha_venta) {
      const d = new Date(String(r.fecha_venta));
      const k = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      byMonth[k] = (byMonth[k] ?? 0) + 1;
    }
  }
  const sortedMonths = Object.entries(byMonth).sort(([a], [b]) => {
    const p = (s: string) => { const [m, y] = s.split(' '); return parseInt(y) * 12 + monthNames.indexOf(m); };
    return p(a) - p(b);
  });
  const fmt = (n: number) => n >= 1e6 ? `$${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n/1e3).toFixed(1)}K` : `$${Math.round(n).toLocaleString('es-MX')}`;
  return {
    title: `Desglose: ${drillDown.value}`, layout: 'vertical',
    components: [
      { component: 'KPIGrid', props: { items: [
        { title: 'Total Ventas', value: total.toLocaleString('es-MX'), icon: '📊' },
        { title: 'Monto Total', value: fmt(totalMonto), icon: '💰' },
        { title: 'Promedio', value: fmt(avgMonto), icon: '📈' },
        { title: 'Atrasados', value: String(byStatus['atrasado'] ?? 0), icon: '⚠️' },
      ]}},
      { component: 'Chart', props: { type: 'bar', title: 'Ventas por Categoría',
        data: { labels: Object.keys(byCat), datasets: [{ label: 'Ventas', data: Object.values(byCat), backgroundColor: '#2563EB' }] }
      }},
      { component: 'Chart', props: { type: 'doughnut', title: 'Estatus de Créditos',
        data: { labels: Object.keys(byStatus), datasets: [{ label: 'Estatus', data: Object.values(byStatus), backgroundColor: ['#10B981','#EF4444','#6366F1','#F59E0B'] }] }
      }},
      { component: 'Chart', props: { type: 'line', title: 'Ventas por Mes',
        data: { labels: sortedMonths.map(([k]) => k), datasets: [{ label: 'Ventas', data: sortedMonths.map(([,v]) => v), borderColor: '#7C3AED', backgroundColor: 'rgba(124,58,237,0.1)', fill: true }] }
      }},
      { component: 'DataSummary', props: { title: 'Últimas Ventas',
        columns: [{key:'fecha_venta',label:'Fecha'},{key:'cliente',label:'Cliente'},{key:'categoria',label:'Categoría'},{key:'producto',label:'Producto'},{key:'monto_total_credito',label:'Monto'},{key:'estatus_credito',label:'Estatus'}],
        rows: filtered.slice(0, 10).map(r => ({ ...r, monto_total_credito: fmt(Number(r.monto_total_credito)) }))
      }},
    ]
  };
}

function handleCorrelation(
  records: Record<string, unknown>[],
  correlation: { fields: [string, string] },
): unknown {
  const [fieldX, fieldY] = correlation.fields;
  const pairs = records
    .map(r => ({ x: Number(r[fieldX]) || 0, y: Number(r[fieldY]) || 0 }))
    .filter(p => p.x > 0 && p.y > 0).slice(0, 200);
  if (!pairs.length) return null;
  const n = pairs.length;
  const meanX = pairs.reduce((s, p) => s + p.x, 0) / n;
  const meanY = pairs.reduce((s, p) => s + p.y, 0) / n;
  const num = pairs.reduce((s, p) => s + (p.x - meanX) * (p.y - meanY), 0);
  const denX = Math.sqrt(pairs.reduce((s, p) => s + (p.x - meanX) ** 2, 0));
  const denY = Math.sqrt(pairs.reduce((s, p) => s + (p.y - meanY) ** 2, 0));
  const r = denX && denY ? num / (denX * denY) : 0;
  const rRounded = Math.round(r * 100) / 100;
  const strength = Math.abs(r) > 0.7 ? 'fuerte' : Math.abs(r) > 0.4 ? 'moderada' : 'débil';
  const direction = r > 0 ? 'positiva' : 'negativa';
  const fieldLabels: Record<string, string> = {
    edad_cliente: 'Edad', monto_total_credito: 'Monto Total', precio_contado: 'Precio',
    plazo_semanas: 'Plazo', pago_semanal: 'Pago Semanal', enganche: 'Enganche',
  };
  const xVals = pairs.map(p => p.x);
  const xMin = Math.min(...xVals), xMax = Math.max(...xVals);
  const bucketSize = (xMax - xMin) / 8 || 1;
  const buckets: Record<string, { sumY: number; count: number }> = {};
  for (const p of pairs) {
    const b = Math.floor((p.x - xMin) / bucketSize);
    const label = `${Math.round(xMin + b * bucketSize)}`;
    if (!buckets[label]) buckets[label] = { sumY: 0, count: 0 };
    buckets[label].sumY += p.y; buckets[label].count++;
  }
  const bucketEntries = Object.entries(buckets).sort(([a], [b]) => Number(a) - Number(b));
  return {
    title: `Correlación: ${fieldLabels[fieldX] ?? fieldX} vs ${fieldLabels[fieldY] ?? fieldY}`, layout: 'vertical',
    components: [
      { component: 'KPIGrid', props: { items: [
        { title: 'Coeficiente r', value: String(rRounded), subtitle: `Correlación ${strength} ${direction}`, icon: r > 0 ? '📈' : '📉' },
        { title: 'Registros', value: String(n) },
        { title: fieldLabels[fieldX] ?? fieldX, value: `Prom: ${Math.round(meanX).toLocaleString('es-MX')}` },
        { title: fieldLabels[fieldY] ?? fieldY, value: `Prom: ${Math.round(meanY).toLocaleString('es-MX')}` },
      ]}},
      { component: 'Chart', props: { type: 'bar',
        title: `Promedio de ${fieldLabels[fieldY] ?? fieldY} por rango de ${fieldLabels[fieldX] ?? fieldX}`,
        data: { labels: bucketEntries.map(([k]) => k), datasets: [{ label: fieldLabels[fieldY] ?? fieldY, data: bucketEntries.map(([,v]) => Math.round(v.sumY / v.count)), backgroundColor: '#7C3AED' }] }
      }},
      { component: 'TransactionList', props: { title: 'Interpretación', items: [
        { title: `Correlación ${strength} ${direction} (r=${rRounded})`, status: Math.abs(r) > 0.4 ? 'positive' : 'neutral' },
        { title: r > 0 ? `A mayor ${fieldLabels[fieldX] ?? fieldX}, mayor ${fieldLabels[fieldY] ?? fieldY}` : `A mayor ${fieldLabels[fieldX] ?? fieldX}, menor ${fieldLabels[fieldY] ?? fieldY}`, status: 'neutral' },
      ]}},
    ]
  };
}

function handleCumulative(
  records: Record<string, unknown>[],
  metricField: string | null,
): unknown {
  const field = metricField || 'monto_total_credito';
  const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const byMonth: Record<string, number> = {};
  for (const r of records) {
    if (!r.fecha_venta) continue;
    const d = new Date(String(r.fecha_venta));
    const k = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
    byMonth[k] = (byMonth[k] ?? 0) + (field === 'count' ? 1 : Number(r[field]) || 0);
  }
  const sorted = Object.entries(byMonth).sort(([a], [b]) => {
    const p = (s: string) => { const [m, y] = s.split(' '); return parseInt(y) * 12 + monthNames.indexOf(m); };
    return p(a) - p(b);
  });
  const labels = sorted.map(([k]) => k);
  const monthly = sorted.map(([,v]) => Math.round(v));
  const cumulative: number[] = []; let acc = 0;
  for (const v of monthly) { acc += v; cumulative.push(acc); }
  const fmt = (n: number) => n >= 1e6 ? `$${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n/1e3).toFixed(1)}K` : String(n);
  const isAmount = field !== 'count';
  return {
    title: `Acumulado de ${isAmount ? 'Monto' : 'Ventas'} por Mes`, layout: 'vertical',
    components: [
      { component: 'KPIGrid', props: { items: [
        { title: 'Total Acumulado', value: isAmount ? fmt(acc) : String(acc), icon: '📊' },
        { title: 'Promedio Mensual', value: isAmount ? fmt(acc / (labels.length || 1)) : String(Math.round(acc / (labels.length || 1))), icon: '📈' },
        { title: 'Mejor Mes', value: labels[monthly.indexOf(Math.max(...monthly))] ?? 'N/A', subtitle: isAmount ? fmt(Math.max(...monthly)) : String(Math.max(...monthly)) },
      ]}},
      { component: 'Chart', props: { type: 'line', title: 'Acumulado vs Mensual',
        data: { labels, datasets: [
          { label: 'Acumulado', data: cumulative, borderColor: '#2563EB', backgroundColor: 'rgba(37,99,235,0.1)', fill: true },
          { label: 'Mensual', data: monthly, borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,0.1)', fill: false },
        ]}
      }},
    ]
  };
}

function handleComparison(
  allRecords: Record<string, unknown>[],
  comparison: { field: string; values: string[]; type?: string },
  metricField: string | null,
): unknown {
  const now = new Date();
  const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  let resolvedValues = [...comparison.values];
  if (comparison.type === 'mom') {
    const curMonth = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
    const prevM = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const prevY = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    resolvedValues = [`${monthNames[prevM]} ${prevY}`, curMonth];
  } else if (comparison.type === 'yoy') {
    resolvedValues = [String(now.getFullYear() - 1), String(now.getFullYear())];
  }
  const field = comparison.field;
  const mField = metricField || 'monto_total_credito';
  const fmt = (n: number) => n >= 1e6 ? `$${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n/1e3).toFixed(1)}K` : `$${Math.round(n).toLocaleString('es-MX')}`;
  const groups: Record<string, Record<string, unknown>[]> = {};
  for (const v of resolvedValues) groups[v] = [];
  for (const r of allRecords) {
    let key = '';
    if (field === 'mes' || field === 'month') {
      const d = new Date(String(r.fecha_venta ?? ''));
      key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
    } else if (field === 'año' || field === 'year') {
      key = String(new Date(String(r.fecha_venta ?? '')).getFullYear());
    } else {
      key = String(r[field] ?? '');
    }
    if (groups[key]) groups[key].push(r);
  }
  const labels = resolvedValues;
  const counts = labels.map(v => groups[v]?.length ?? 0);
  const totals = labels.map(v => groups[v]?.reduce((s, r) => s + (Number(r[mField]) || 0), 0) ?? 0);
  const deltaCount = counts[1] - counts[0];
  const deltaPct = counts[0] ? Math.round((deltaCount / counts[0]) * 100) : 0;
  const trendDir = deltaPct > 0 ? 'up' : deltaPct < 0 ? 'down' : 'neutral';
  return {
    title: `Comparación: ${resolvedValues.join(' vs ')}`, layout: 'vertical',
    components: [
      { component: 'KPIGrid', props: { items: [
        ...labels.map((v, i) => ({ title: v, value: String(counts[i]), subtitle: fmt(totals[i]) })),
        { title: 'Variación', value: `${deltaPct > 0 ? '+' : ''}${deltaPct}%`, trendDirection: trendDir, icon: trendDir === 'up' ? '📈' : trendDir === 'down' ? '📉' : '➖' },
      ]}},
      { component: 'Chart', props: { type: 'bar', title: 'Comparación de Ventas',
        data: { labels, datasets: [{ label: 'Cantidad', data: counts, backgroundColor: ['#2563EB','#10B981'] }] }
      }},
      { component: 'Chart', props: { type: 'bar', title: 'Comparación de Monto',
        data: { labels, datasets: [{ label: 'Monto', data: totals, backgroundColor: ['#7C3AED','#F59E0B'] }] }
      }},
    ]
  };
}

function handleGroupByMultiple(
  records: Record<string, unknown>[],
  fields: string[],
  metricField: string | null,
): unknown {
  const [f1, f2] = fields;
  const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const getKey = (r: Record<string, unknown>, f: string) => {
    if (f === 'mes' && r.fecha_venta) {
      const d = new Date(String(r.fecha_venta));
      return `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
    }
    return String(r[f] ?? 'N/A');
  };
  const matrix: Record<string, Record<string, number>> = {};
  const f2Vals = new Set<string>();
  for (const r of records) {
    const k1 = getKey(r, f1); const k2 = getKey(r, f2);
    f2Vals.add(k2);
    if (!matrix[k1]) matrix[k1] = {};
    matrix[k1][k2] = (matrix[k1][k2] ?? 0) + (metricField ? Number(r[metricField]) || 0 : 1);
  }
  const f1Keys = Object.keys(matrix).sort();
  const f2Keys = [...f2Vals].sort();
  const colors = ['#2563EB','#10B981','#7C3AED','#F59E0B','#EF4444','#0891B2','#EC4899','#F97316'];
  return {
    title: `Ventas por ${f1} y ${f2}`, layout: 'vertical',
    components: [
      { component: 'KPIGrid', props: { items: [
        { title: `Valores de ${f1}`, value: String(f1Keys.length) },
        { title: `Valores de ${f2}`, value: String(f2Keys.length) },
        { title: 'Total Registros', value: String(records.length) },
      ]}},
      { component: 'Chart', props: { type: 'bar', title: `${f1} por ${f2}`,
        data: { labels: f1Keys.slice(0, 15),
          datasets: f2Keys.slice(0, 8).map((k2, i) => ({ label: k2, data: f1Keys.slice(0, 15).map(k1 => matrix[k1]?.[k2] ?? 0), backgroundColor: colors[i % colors.length] }))
        }
      }},
      { component: 'DataSummary', props: { title: 'Matriz de Datos',
        columns: [{ key: f1, label: f1 }, ...f2Keys.slice(0, 6).map(k => ({ key: k, label: k }))],
        rows: f1Keys.slice(0, 15).map(k1 => ({ [f1]: k1, ...Object.fromEntries(f2Keys.slice(0, 6).map(k2 => [k2, matrix[k1]?.[k2] ?? 0])) }))
      }},
    ]
  };
}

function handleFindExtreme(
  records: Record<string, unknown>[],
  extreme: { type: 'max' | 'min'; field: string },
  intent: string,
): unknown {
  if (!records.length) return null;
  
  const sorted = [...records].sort((a, b) => {
    const aVal = a[extreme.field];
    const bVal = b[extreme.field];
    // Handle dates
    if (extreme.field === 'fecha_venta') {
      return extreme.type === 'max' 
        ? new Date(String(bVal)).getTime() - new Date(String(aVal)).getTime()
        : new Date(String(aVal)).getTime() - new Date(String(bVal)).getTime();
    }
    // Handle numbers
    const aNum = Number(aVal) || 0;
    const bNum = Number(bVal) || 0;
    return extreme.type === 'max' ? bNum - aNum : aNum - bNum;
  });
  
  const record = sorted[0];
  const value = record[extreme.field];
  const formattedValue = typeof value === 'number' 
    ? `$${value.toLocaleString('es-MX')}` 
    : String(value);
  
  const typeLabel = extreme.type === 'max' ? 'Máximo' : 'Mínimo';
  const fieldLabels: Record<string, string> = {
    monto_total_credito: 'Monto Total',
    precio_contado: 'Precio',
    edad_cliente: 'Edad',
    fecha_venta: 'Fecha',
    plazo_semanas: 'Plazo',
    pago_semanal: 'Pago Semanal',
  };
  
  return {
    title: `${typeLabel}: ${fieldLabels[extreme.field] || extreme.field}`,
    layout: 'vertical',
    components: [
      {
        component: 'KPIGrid',
        props: {
          items: [
            { title: fieldLabels[extreme.field] || extreme.field, value: formattedValue, icon: extreme.type === 'max' ? '📈' : '📉' },
            { title: 'Producto', value: String(record.producto || 'N/A') },
            { title: 'Cliente', value: String(record.cliente || 'N/A') },
            { title: 'Estado', value: String(record.estado || 'N/A') },
          ]
        }
      },
      {
        component: 'DataSummary',
        props: {
          title: 'Detalle del Registro',
          columns: [
            { key: 'campo', label: 'Campo' },
            { key: 'valor', label: 'Valor' },
          ],
          rows: [
            { campo: 'ID', valor: record.id },
            { campo: 'Fecha', valor: record.fecha_venta },
            { campo: 'Cliente', valor: record.cliente },
            { campo: 'Categoría', valor: record.categoria },
            { campo: 'Producto', valor: record.producto },
            { campo: 'Precio Contado', valor: `$${Number(record.precio_contado || 0).toLocaleString('es-MX')}` },
            { campo: 'Monto Total Crédito', valor: `$${Number(record.monto_total_credito || 0).toLocaleString('es-MX')}` },
            { campo: 'Estado', valor: record.estado },
            { campo: 'Vendedor', valor: record.vendedor },
            { campo: 'Estatus', valor: record.estatus_credito },
          ]
        }
      }
    ]
  };
}

function handlePercentile(
  records: Record<string, unknown>[],
  percentile: { type: 'top' | 'bottom'; percent: number },
  metricField: string | null,
): Record<string, unknown>[] {
  if (!records.length) return [];
  
  const field = metricField || 'monto_total_credito';
  const sorted = [...records].sort((a, b) => {
    const aNum = Number(a[field]) || 0;
    const bNum = Number(b[field]) || 0;
    return percentile.type === 'top' ? bNum - aNum : aNum - bNum;
  });
  
  const count = Math.ceil(records.length * (percentile.percent / 100));
  return sorted.slice(0, count);
}

function handleTrendAnalysis(
  records: Record<string, unknown>[],
  intent: string,
): unknown {
  if (!records.length) return null;
  
  const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  
  // Group by month
  const byMonth: Record<string, { count: number; total: number }> = {};
  for (const r of records) {
    if (!r.fecha_venta) continue;
    const date = new Date(String(r.fecha_venta));
    const key = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
    if (!byMonth[key]) byMonth[key] = { count: 0, total: 0 };
    byMonth[key].count++;
    byMonth[key].total += Number(r.monto_total_credito) || 0;
  }
  
  // Sort chronologically
  const sortedMonths = Object.entries(byMonth).sort(([a], [b]) => {
    const parseKey = (s: string) => {
      const [month, year] = s.split(' ');
      return parseInt(year) * 12 + monthNames.indexOf(month);
    };
    return parseKey(a) - parseKey(b);
  });
  
  const labels = sortedMonths.map(([k]) => k);
  const countData = sortedMonths.map(([, v]) => v.count);
  const totalData = sortedMonths.map(([, v]) => Math.round(v.total));
  
  // Calculate trend
  const recentMonths = countData.slice(-3);
  const olderMonths = countData.slice(-6, -3);
  const recentAvg = recentMonths.reduce((a, b) => a + b, 0) / (recentMonths.length || 1);
  const olderAvg = olderMonths.length ? olderMonths.reduce((a, b) => a + b, 0) / olderMonths.length : recentAvg;
  
  const trendPercent = olderAvg ? Math.round(((recentAvg - olderAvg) / olderAvg) * 100) : 0;
  const trendDirection = trendPercent > 5 ? 'up' : trendPercent < -5 ? 'down' : 'neutral';
  const trendEmoji = trendDirection === 'up' ? '📈' : trendDirection === 'down' ? '📉' : '➖';
  const trendText = trendDirection === 'up' ? 'Subiendo' : trendDirection === 'down' ? 'Bajando' : 'Estable';
  
  // Find best and worst months
  const maxMonth = sortedMonths.reduce((max, curr) => curr[1].count > max[1].count ? curr : max);
  const minMonth = sortedMonths.reduce((min, curr) => curr[1].count < min[1].count ? curr : min);
  
  // Insights
  const insights: string[] = [];
  if (trendDirection === 'down') {
    insights.push(`Las ventas han bajado ${Math.abs(trendPercent)}% en los últimos 3 meses comparado con los 3 anteriores.`);
    insights.push(`El mes con menos ventas fue ${minMonth[0]} con ${minMonth[1].count} ventas.`);
  } else if (trendDirection === 'up') {
    insights.push(`Las ventas han subido ${trendPercent}% en los últimos 3 meses.`);
    insights.push(`El mejor mes fue ${maxMonth[0]} con ${maxMonth[1].count} ventas.`);
  } else {
    insights.push('Las ventas se han mantenido estables.');
  }
  
  return {
    title: 'Análisis de Tendencia',
    layout: 'vertical',
    components: [
      {
        component: 'KPIGrid',
        props: {
          items: [
            { title: 'Tendencia', value: trendText, trend: `${trendPercent > 0 ? '+' : ''}${trendPercent}%`, trendDirection, icon: trendEmoji },
            { title: 'Total Ventas', value: records.length.toLocaleString('es-MX') },
            { title: 'Mejor Mes', value: maxMonth[0], subtitle: `${maxMonth[1].count} ventas` },
            { title: 'Peor Mes', value: minMonth[0], subtitle: `${minMonth[1].count} ventas` },
          ]
        }
      },
      {
        component: 'Chart',
        props: {
          type: 'line',
          title: 'Evolución de Ventas por Mes',
          data: {
            labels,
            datasets: [{
              label: 'Cantidad de Ventas',
              data: countData,
              borderColor: '#2563EB',
              backgroundColor: 'rgba(37, 99, 235, 0.1)',
              fill: true,
            }]
          }
        }
      },
      {
        component: 'Chart',
        props: {
          type: 'bar',
          title: 'Monto Total por Mes',
          data: {
            labels,
            datasets: [{
              label: 'Monto (MXN)',
              data: totalData,
              backgroundColor: '#10B981',
            }]
          }
        }
      },
      {
        component: 'TransactionList',
        props: {
          title: 'Insights',
          items: insights.map(text => ({
            title: text,
            status: trendDirection === 'down' ? 'negative' : trendDirection === 'up' ? 'positive' : 'neutral',
          }))
        }
      }
    ]
  };
}

// ─── Smart empty state ─────────────────────────────────────────

async function generateEmptyStateWithSuggestions(
  originalIntent: string,
  parsedIntent: ParsedIntent,
  appliedFilters: Record<string, unknown>,
  dataset: string,
  gcpClient: { callTool: (name: string, args: unknown) => Promise<unknown> },
): Promise<unknown> {
  // Fetch a sample of the full dataset (no filters) to understand what exists
  let datasetSample: Record<string, unknown>[] = [];
  try {
    const result = await gcpClient.callTool('query_data', { dataset, limit: 200 }) as { records?: Record<string, unknown>[] };
    datasetSample = result.records ?? [];
  } catch {
    // If we can't fetch, fall back to static message
  }

  // Build a compact summary of what actually exists in the dataset
  const summary: Record<string, unknown> = {};
  if (datasetSample.length > 0) {
    const categorias = [...new Set(datasetSample.map(r => String(r.categoria ?? '')))].filter(Boolean);
    const fechas = datasetSample.map(r => String(r.fecha_venta ?? '')).filter(Boolean).sort();
    const estados = [...new Set(datasetSample.map(r => String(r.estado ?? '')))].filter(Boolean).slice(0, 8);
    const estatuses = [...new Set(datasetSample.map(r => String(r.estatus_credito ?? '')))].filter(Boolean);
    summary.categorias_disponibles = categorias;
    summary.rango_fechas = { desde: fechas[0], hasta: fechas[fechas.length - 1] };
    summary.estados_ejemplo = estados;
    summary.estatuses_credito = estatuses;
    summary.total_registros_dataset = 5000;
  }

  // Ask Bedrock to explain why there are no results and suggest alternatives
  try {
    const response = await bedrockClient.send(new ConverseCommand({
      modelId: MODEL_ID,
      system: [{ text: `Eres un asistente de dashboards para Macropay. El usuario hizo una consulta que no devolvió resultados. Tu tarea es:
1. Explicar brevemente por qué no hay resultados (en 1 oración, en español, sin tecnicismos)
2. Dar 3 sugerencias concretas de consultas similares que SÍ funcionarían, basadas en los datos disponibles

Responde SOLO con JSON válido:
{"explicacion": "string", "sugerencias": ["string", "string", "string"]}` }],
      messages: [{ role: 'user', content: [{ text: `Consulta del usuario: "${originalIntent}"
Filtros aplicados: ${JSON.stringify(appliedFilters)}
Datos disponibles en el sistema: ${JSON.stringify(summary)}` }] }],
      inferenceConfig: { maxTokens: 300, temperature: 0.3 },
    }));

    const block = response.output?.message?.content?.[0];
    if (block && 'text' in block) {
      const clean = block.text!.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
      const parsed = JSON.parse(clean) as { explicacion: string; sugerencias: string[] };

      return {
        title: 'Sin resultados',
        layout: 'vertical',
        components: [
          {
            component: 'StatCard',
            props: {
              title: 'No se encontraron datos',
              value: parsed.explicacion,
              subtitle: `Consulta: "${originalIntent}"`,
              icon: '🔍',
            }
          },
          {
            component: 'TransactionList',
            props: {
              title: '¿Qué puedes intentar?',
              items: parsed.sugerencias.map(s => ({
                title: s,
                status: 'neutral' as const,
              }))
            }
          }
        ]
      };
    }
  } catch (err) {
    console.log('[orchestrator] smart empty state failed:', (err as Error).message);
  }

  // Fallback si Bedrock falla
  return {
    title: 'Sin resultados',
    layout: 'vertical',
    components: [
      { component: 'StatCard', props: { title: 'No se encontraron datos', value: `No hay registros que coincidan con "${originalIntent}"`, icon: '🔍' } },
      { component: 'TransactionList', props: { title: 'Sugerencias', items: [
        { title: 'Prueba: "ventas de motos del mes pasado"', status: 'neutral' as const },
        { title: 'Prueba: "resumen ejecutivo de ventas"', status: 'neutral' as const },
        { title: 'Prueba: "créditos atrasados por estado"', status: 'neutral' as const },
      ]}},
    ]
  };
}

// ─── Step 3: Generate UIConfig with Bedrock ───────────────────

async function generateUIConfig(
  intent: string,
  parsedIntent: ParsedIntent,
  records: Record<string, unknown>[],
): Promise<unknown> {
  const sampleRecords = records.slice(0, 20);
  const totalRecords = records.length;

  // Compute basic aggregations to help Bedrock
  const aggregations = computeAggregations(records, parsedIntent);
  
  // Select color palette based on theme
  const colorPalette = COLOR_THEMES[parsedIntent.colorTheme ?? 'default'] ?? COLOR_THEMES.default;

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
${COMPONENT_CATALOG.map(c => `- ${c.name}: ${c.description}`).join('\n')}

UIConfig schema:
{
  "title": "string",
  "description": "string (opcional)",
  "layout": "vertical",
  "components": [{ "component": "NombreComponente", "props": { ... } }]
}

Props por componente:
- KPIGrid: { items: [{ title, value, subtitle?, trend?, trendDirection?: "up"|"down"|"neutral", icon? }] }
- Chart: { type: "bar"|"line"|"pie"|"doughnut", title?, data: { labels: [], datasets: [{ label, data: [], backgroundColor }] } }
- DataSummary: { title?, columns: [{ key, label }], rows: [...] }
- TransactionList: { title?, items: [{ title, subtitle?, amount, date?, status?: "positive"|"negative"|"neutral" }] }
- ProgressGroup: { title?, items: [{ label, value (0-100), color? }] }
- StatCard: { title, value, subtitle?, trend?, trendDirection?, icon? }

FILOSOFÍA DE VISUALIZACIÓN:
Siempre genera dashboards RICOS y COMPLETOS. Más información es mejor que menos. El usuario quiere entender sus datos en profundidad, no solo ver un número. Cada dashboard debe contar una historia completa: qué pasó, dónde, cuánto, y cómo se distribuye.

REGLAS DE VISUALIZACIÓN (obligatorias):
1. SIEMPRE incluye al menos un KPIGrid con 3-5 métricas de resumen (total registros, sumas, promedios)
2. Si uniqueValues > 5 en el campo de agrupación → Chart bar. NUNCA un card por grupo
3. Si uniqueValues <= 5 → ProgressGroup o pie/doughnut
4. Para template "mixed": genera TODAS las visualizaciones pedidas (múltiples Charts + DataSummary si pidió tabla)
5. Para template "chart": KPIGrid (resumen) + Chart(s) principal(es)
6. Para template "table": KPIGrid (resumen) + DataSummary
7. Usa aggregations.groupBy.data directamente para labels/values del Chart
8. Usa aggregations.numericSummaries para los valores de KPIGrid
9. Responde SOLO con el JSON del UIConfig, sin markdown, sin explicaciones
10. Formatea montos: >= 1M → "$1.2M", >= 1K → "$45.3K", resto → "$1,234"

COLORES para charts (USA ESTOS EXACTOS - tema ${parsedIntent.colorTheme ?? 'default'}):
${JSON.stringify(colorPalette)}`;

  // Build chart instructions based on requested types
  const chartInstructions = parsedIntent.chartTypes.length > 1
    ? `El usuario pidió MÚLTIPLES visualizaciones: ${parsedIntent.chartTypes.join(', ')}. Genera UN Chart por cada tipo pedido con los mismos datos pero diferente visualización.`
    : `Genera un Chart de tipo ${parsedIntent.chartTypes[0] ?? 'bar'}.`;

  const userMessage = `Intent del usuario: "${intent}"
Template sugerido: ${parsedIntent.template}
GroupBy detectado: ${parsedIntent.groupBy ?? 'ninguno'}
Métrica: ${parsedIntent.metric}${parsedIntent.metricField ? ` de ${parsedIntent.metricField}` : ''}
Tipos de gráfica pedidos: ${parsedIntent.chartTypes.join(', ')}
Tema de colores: ${parsedIntent.colorTheme ?? 'default'}
${parsedIntent.comparison ? `Comparación: ${parsedIntent.comparison.field} entre ${parsedIntent.comparison.values.join(' vs ')}` : ''}

CONTEXTO DE LOS DATOS (${totalRecords} registros totales):
${JSON.stringify(aggregations, null, 2)}

Muestra de registros (${sampleRecords.length} de ${totalRecords}):
${JSON.stringify(sampleRecords, null, 2)}

INSTRUCCIONES ESPECÍFICAS:
${chartInstructions}
${parsedIntent.template === 'mixed' ? 'Incluye también un DataSummary (tabla) con los datos más relevantes.' : ''}
${parsedIntent.comparison ? `Genera una visualización comparativa entre ${parsedIntent.comparison.values.join(' y ')}.` : ''}

IMPORTANTE: Usa los datos reales de aggregations. Si fieldSummaries.estado.uniqueValues > 5, usa Chart bar para estado, nunca KPIGrid por estado.

Genera el UIConfig JSON ahora.`;

  const response = await bedrockClient.send(new ConverseCommand({
    modelId: MODEL_ID,
    system: [{ text: systemPrompt }],
    messages: [{ role: 'user', content: [{ text: userMessage }] }],
    inferenceConfig: { maxTokens: 8192, temperature: 0 },
  }));

  const block = response.output?.message?.content?.[0];
  if (!block || !('text' in block)) throw new Error('Bedrock did not return UIConfig');

  const raw = block.text!.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

  try {
    const parsed = JSON.parse(raw);
    return (parsed as Record<string, unknown>).uiConfig ?? parsed;
  } catch {
    // Try to recover truncated JSON by finding the last complete component
    const lastBracket = raw.lastIndexOf('},');
    if (lastBracket > 0) {
      try {
        const recovered = raw.slice(0, lastBracket + 1) + ']}';
        const parsed = JSON.parse(recovered);
        return (parsed as Record<string, unknown>).uiConfig ?? parsed;
      } catch { /* fall through */ }
    }
    throw new Error(`Bedrock returned invalid JSON: ${raw.slice(0, 200)}`);
  }
}

// ─── Aggregation helper ───────────────────────────────────────

function computeAggregations(
  records: Record<string, unknown>[],
  parsedIntent: ParsedIntent,
): Record<string, unknown> {
  if (records.length === 0) return {};

  const first = records[0];
  const fields = Object.keys(first);
  const stringFields = fields.filter(f => typeof first[f] === 'string');
  const numericFields = fields.filter(f => typeof first[f] === 'number');

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
      topValues: sorted.slice(0, 10).map(([value, count]) => ({ value, count })),
    };
  }
  agg.fieldSummaries = fieldSummaries;

  // ─── Numeric fields: min, max, sum, avg ───────────────────
  const numericSummaries: Record<string, unknown> = {};
  for (const field of numericFields) {
    const values = records.map(r => Number(r[field] ?? 0));
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
    const groups: Record<string, number> = {};
    
    const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    
    for (const record of records) {
      let key: string;
      
      // Special handling for "mes" - extract month from fecha_venta
      if (field === 'mes' && record.fecha_venta) {
        const date = new Date(String(record.fecha_venta));
        const monthIdx = date.getMonth();
        const year = date.getFullYear();
        key = `${monthNames[monthIdx]} ${year}`;
      } else {
        key = String(record[field] ?? 'N/A');
      }
      
      if (parsedIntent.metric === 'count') {
        groups[key] = (groups[key] ?? 0) + 1;
      } else if (parsedIntent.metricField) {
        groups[key] = (groups[key] ?? 0) + Number(record[parsedIntent.metricField] ?? 0);
      }
    }
    
    // Sort by date for "mes" groupBy, otherwise by value
    let sortedEntries = Object.entries(groups);
    if (field === 'mes') {
      sortedEntries = sortedEntries.sort(([a], [b]) => {
        const parseMonthYear = (s: string) => {
          const parts = s.split(' ');
          const monthIdx = monthNames.indexOf(parts[0]);
          const year = parseInt(parts[1] || '2024');
          return year * 12 + monthIdx;
        };
        return parseMonthYear(a) - parseMonthYear(b);
      });
    } else {
      sortedEntries = sortedEntries.sort(([, a], [, b]) => b - a);
    }
    
    agg.groupBy = {
      field,
      metric: parsedIntent.metric,
      uniqueGroups: Object.keys(groups).length,
      data: sortedEntries
        .slice(0, 15)
        .map(([label, value]) => ({ label, value })),
    };
  }

  return agg;
}
