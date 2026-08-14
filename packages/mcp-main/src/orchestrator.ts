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

// ─── Date helpers ─────────────────────────────────────────────

function normalizeDateExpressions(intent: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  
  const monthNames = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  
  let normalized = intent;
  
  // "este mes" → rango concreto
  if (/este\s+mes/i.test(normalized)) {
    const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const end = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`;
    normalized = normalized.replace(/este\s+mes/gi, `el mes ${monthNames[month]} ${year} (del ${start} al ${end})`);
  }
  
  // "mes pasado" → rango concreto
  if (/mes\s+pasado/i.test(normalized)) {
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const start = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(prevYear, prevMonth + 1, 0).getDate();
    const end = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${lastDay}`;
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
      // Asume año actual si no se especifica
      const start = `${year}-${String(i + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, i + 1, 0).getDate();
      const end = `${year}-${String(i + 1).padStart(2, '0')}-${lastDay}`;
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
}

export async function orchestrate(params: OrchestrationParams): Promise<unknown> {
  const dataset = params.dataset ?? 'ventas-credito';
  
  // Pre-process intent: normalize dates and chart types
  const normalizedIntent = normalizeDateExpressions(params.intent);
  const { chartTypes: detectedChartTypes, normalizedIntent: finalIntent } = normalizeChartType(normalizedIntent);
  
  console.log(`[orchestrator] original intent: "${params.intent}"`);
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

    // Step 2: Query real data (with exclusion support)
    const filters: Record<string, unknown> = { ...parsedIntent.filters, ...params.filters };
    for (const [key, value] of Object.entries(filters)) {
      if (Array.isArray(value) && value.length >= 8) delete filters[key];
    }
    const limit = params.limit ?? parsedIntent.limit ?? 100;

    console.log(`[orchestrator] querying data — filters: ${JSON.stringify(filters)}, limit: ${limit}`);
    let queryResult = await gcpClient.callTool('query_data', {
      dataset,
      ...(Object.keys(filters).length > 0 ? { filters } : {}),
      limit: parsedIntent.excludeFilters ? limit * 2 : limit, // Fetch more if we need to exclude
    }) as { records?: Record<string, unknown>[]; totalRecords?: number };

    let records = queryResult.records ?? (queryResult as unknown as Record<string, unknown>[]);
    
    // Apply exclusion filters client-side
    if (parsedIntent.excludeFilters && Object.keys(parsedIntent.excludeFilters).length > 0) {
      console.log(`[orchestrator] applying exclusions: ${JSON.stringify(parsedIntent.excludeFilters)}`);
      records = records.filter(record => {
        for (const [field, excludeValue] of Object.entries(parsedIntent.excludeFilters!)) {
          const recordValue = String(record[field] ?? '').toLowerCase();
          const excludeStr = String(excludeValue).toLowerCase();
          if (recordValue === excludeStr) return false;
        }
        return true;
      }).slice(0, limit);
    }
    
    console.log(`[orchestrator] got ${Array.isArray(records) ? records.length : 0} records`);

    // Step 3: Bedrock generates UIConfig from data + intent
    console.log('[orchestrator] generating UIConfig with Bedrock');
    const uiConfig = await generateUIConfig(params.intent, parsedIntent, records);

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
  excludeFilters?: Record<string, unknown>;  // Para negaciones: "todo menos motos"
  groupBy: string | null;
  metric: string;
  metricField: string | null;
  chartTypes: string[];  // Múltiples gráficas: ["pie", "bar", "line"]
  template: string;
  limit: number | null;
  title: string | null;
  colorTheme?: string;  // "azul", "verde", "oscuro", "claro"
  comparison?: { field: string; values: string[] };  // "compara enero vs febrero"
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
        text: `Eres un intérprete de intents para el sistema de dashboards de Macropay, empresa mexicana de ventas a crédito.

FECHA ACTUAL: ${currentDate}
El dataset contiene ventas desde 2024-01-01 hasta hoy.

Responde SOLO con JSON válido, sin markdown, sin explicaciones.
Estructura exacta:
{"filters":{},"excludeFilters":{},"groupBy":null,"metric":"count","metricField":null,"chartTypes":[],"template":"chart","limit":null,"title":null,"colorTheme":null,"comparison":null}

CAMPOS DISPONIBLES:
- id: identificador único
- fecha_venta: fecha en formato YYYY-MM-DD (2024-01-01 a ${currentDate})
- cliente: nombre del cliente
- edad_cliente: edad numérica
- genero: "Masculino" o "Femenino"
- estado: uno de los 32 estados de México (ej: "Jalisco", "Nuevo León", "Ciudad de México")
- ciudad: ciudad dentro del estado
- sucursal: nombre de la sucursal
- categoria: "Motos", "Celulares", "Bicicletas Eléctricas", "Pantallas/TV", "Audio", "Tablets", "Consolas", "Climatización", "Accesorios"
- producto: nombre específico del producto
- color: color del producto (Rojo, Azul, Negro, Blanco, Gris, Verde, Amarillo, Rosa, Morado, Naranja, etc.)
- precio_contado: precio sin financiamiento (número)
- enganche: pago inicial (número)
- monto_financiado: monto a crédito (número)
- monto_total_credito: total con intereses (número)
- plazo_semanas: duración del crédito (número)
- pago_semanal: pago por semana (número)
- semanas_pagadas: semanas ya pagadas (número)
- estatus_credito: "al_corriente", "atrasado", "liquidado", "cancelado"
- canal_venta: "tienda_fisica", "en_linea", "telefono"
- vendedor: nombre del vendedor

REGLAS DE INTERPRETACIÓN:

1. FILTROS COMBINADOS (filters):
   - "motos rojas atrasadas" → filters: {categoria: "Motos", color: "Rojo", estatus_credito: "atrasado"}
   - "celulares en Jalisco" → filters: {categoria: "Celulares", estado: "Jalisco"}
   - Puedes combinar MÚLTIPLES filtros en una sola consulta

2. EXCLUSIONES/NEGACIONES (excludeFilters):
   - "todo menos motos" → excludeFilters: {categoria: "Motos"}
   - "ventas que NO estén atrasadas" → excludeFilters: {estatus_credito: "atrasado"}
   - "estados excepto CDMX" → excludeFilters: {estado: "Ciudad de México"}

3. MÚLTIPLES GRÁFICAS (chartTypes como ARRAY):
   - "en pastel y barras" → chartTypes: ["pie", "bar"]
   - "gráfica de línea, pastel y tabla" → chartTypes: ["line", "pie"], template: "mixed"
   - "pie/pastel/circular" → chartTypes: ["pie"]
   - "dona/donut" → chartTypes: ["doughnut"]
   - "barras/columnas" → chartTypes: ["bar"]
   - "líneas/tendencia" → chartTypes: ["line"]
   - Si pide "y tabla" además de gráficas → template: "mixed"

4. TEMA DE COLORES (colorTheme):
   - "en tonos azules/azul" → colorTheme: "blue"
   - "en verde/verdes" → colorTheme: "green"
   - "colores oscuros" → colorTheme: "dark"
   - "colores claros/pasteles" → colorTheme: "light"
   - "monocromático" → colorTheme: "mono"
   - "corporativo" → colorTheme: "corporate"

5. COMPARACIONES (comparison):
   - "compara enero vs febrero" → comparison: {field: "mes", values: ["Enero", "Febrero"]}
   - "este mes contra el mes pasado" → comparison: {field: "mes", values: ["actual", "anterior"]}
   - "Jalisco vs Nuevo León" → comparison: {field: "estado", values: ["Jalisco", "Nuevo León"]}

6. FILTROS DE FECHA (filters.fecha_venta):
   - Si el intent menciona un rango como "(del YYYY-MM-DD al YYYY-MM-DD)", usa: {"gte": "YYYY-MM-DD", "lte": "YYYY-MM-DD"}

7. AGRUPACIÓN (groupBy):
   - "por estado" → groupBy: "estado"
   - "por categoría" → groupBy: "categoria"
   - "por mes" → groupBy: "mes"
   - "por vendedor" → groupBy: "vendedor"
   - "por color" → groupBy: "color"

8. TEMPLATE:
   - Si pide múltiples visualizaciones (gráfica + tabla) → template: "mixed"
   - "gráfica/chart" solo → template: "chart"
   - "tabla/listado" solo → template: "table"
   - "resumen/dashboard/kpi" → template: "executive"

EJEMPLOS AVANZADOS:
- "motos rojas atrasadas en pie y barras" → {"filters":{"categoria":"Motos","color":"Rojo","estatus_credito":"atrasado"},"chartTypes":["pie","bar"],"template":"chart"}
- "todo menos celulares en tonos azules" → {"excludeFilters":{"categoria":"Celulares"},"colorTheme":"blue","chartTypes":["bar"]}
- "compara ventas de enero vs febrero en líneas" → {"comparison":{"field":"mes","values":["Enero","Febrero"]},"chartTypes":["line"]}
- "motos por estado en pastel, barras y tabla" → {"filters":{"categoria":"Motos"},"groupBy":"estado","chartTypes":["pie","bar"],"template":"mixed"}
- "hazlo en verde" → {"colorTheme":"green"}`,
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
