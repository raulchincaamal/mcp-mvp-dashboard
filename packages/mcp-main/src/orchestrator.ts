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

function normalizeChartType(intent: string): { chartType: string | null; normalizedIntent: string } {
  let normalized = intent;
  let chartType: string | null = null;
  
  const chartMappings: [RegExp, string][] = [
    [/gr[aá]fica?\s+de\s+(pastel|pay|pie|circular)/gi, 'pie'],
    [/(pastel|pay|pie|circular)/gi, 'pie'],
    [/gr[aá]fica?\s+de\s+(dona|donut|doughnut|rosquilla)/gi, 'doughnut'],
    [/(dona|donut|doughnut)/gi, 'doughnut'],
    [/gr[aá]fica?\s+de\s+(barras?|columnas?)/gi, 'bar'],
    [/(barras?|columnas?)/gi, 'bar'],
    [/gr[aá]fica?\s+de\s+(l[ií]neas?|tendencia)/gi, 'line'],
    [/(l[ií]neas?|tendencia)/gi, 'line'],
    [/gr[aá]fica?\s+de\s+[aá]rea/gi, 'area'],
  ];
  
  for (const [regex, type] of chartMappings) {
    if (regex.test(normalized)) {
      chartType = type;
      break;
    }
  }
  
  return { chartType, normalizedIntent: normalized };
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
  const { chartType: detectedChartType, normalizedIntent: finalIntent } = normalizeChartType(normalizedIntent);
  
  console.log(`[orchestrator] original intent: "${params.intent}"`);
  console.log(`[orchestrator] normalized intent: "${finalIntent}"`);
  if (detectedChartType) console.log(`[orchestrator] detected chart type: ${detectedChartType}`);

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
    const parsedIntent = await interpretIntent(finalIntent, detectedChartType);
    console.log('[orchestrator] parsed intent:', JSON.stringify(parsedIntent));

    // Step 2: Query real data
    const filters: Record<string, unknown> = { ...parsedIntent.filters, ...params.filters };
    for (const [key, value] of Object.entries(filters)) {
      if (Array.isArray(value) && value.length >= 8) delete filters[key];
    }
    const limit = params.limit ?? parsedIntent.limit ?? 100;

    console.log(`[orchestrator] querying data — filters: ${JSON.stringify(filters)}, limit: ${limit}`);
    const queryResult = await gcpClient.callTool('query_data', {
      dataset,
      ...(Object.keys(filters).length > 0 ? { filters } : {}),
      limit,
    }) as { records?: Record<string, unknown>[]; totalRecords?: number };

    const records = queryResult.records ?? (queryResult as unknown as Record<string, unknown>[]);
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

async function interpretIntent(intent: string, detectedChartType: string | null): Promise<{
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
    filters: {}, groupBy: null, metric: 'count', metricField: null,
    chartType: detectedChartType, template: 'chart', limit: 100, title: null,
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
{"filters":{},"groupBy":null,"metric":"count","metricField":null,"chartType":null,"template":"chart","limit":null,"title":null}

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
- color: color del producto
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

1. FILTROS DE FECHA (filters.fecha_venta):
   - Si el intent menciona un rango de fechas como "(del YYYY-MM-DD al YYYY-MM-DD)", usa: {"gte": "YYYY-MM-DD", "lte": "YYYY-MM-DD"}
   - "ventas de enero" → filters.fecha_venta: {"gte": "2025-01-01", "lte": "2025-01-31"}
   - "año pasado" → filters.fecha_venta: {"gte": "2024-01-01", "lte": "2024-12-31"}

2. AGRUPACIÓN (groupBy):
   - "por estado" → groupBy: "estado"
   - "por categoría" → groupBy: "categoria"
   - "por mes" → groupBy: "mes" (el sistema extraerá el mes de fecha_venta)
   - "por vendedor" → groupBy: "vendedor"
   - "por canal" → groupBy: "canal_venta"

3. FILTROS DE CATEGORÍA:
   - "motos" → filters.categoria: "Motos"
   - "celulares/teléfonos" → filters.categoria: "Celulares"
   - "bicis/bicicletas" → filters.categoria: "Bicicletas Eléctricas"
   - "pantallas/tv/televisores" → filters.categoria: "Pantallas/TV"

4. TIPO DE GRÁFICA (chartType):
   - "pie/pastel/circular" → chartType: "pie"
   - "dona/donut" → chartType: "doughnut"
   - "barras/columnas" → chartType: "bar"
   - "líneas/tendencia" → chartType: "line"
   - Si no se especifica, usa "bar" para comparaciones, "pie" para distribuciones

5. TEMPLATE:
   - "gráfica/chart" → template: "chart"
   - "tabla/listado" → template: "table"
   - "resumen/dashboard/kpi" → template: "executive"
   - "crédito/estatus/morosidad" → template: "credit"
   - "por categoría/análisis" → template: "category"

6. LÍMITE:
   - "20 motos" → limit: 20, filters.categoria: "Motos"
   - "últimas 10" → limit: 10
   - "top 5" → limit: 5

7. MÉTRICAS:
   - "ventas" sin especificar → metric: "count" (contar registros)
   - "monto/dinero/pesos" → metric: "sum", metricField: "monto_total_credito"
   - "promedio de precio" → metric: "avg", metricField: "precio_contado"

EJEMPLOS:
- "ventas por mes" → {"groupBy":"mes","metric":"count","template":"chart","chartType":"bar"}
- "20 motos en gráfica de pie" → {"filters":{"categoria":"Motos"},"limit":20,"chartType":"pie","template":"chart"}
- "ventas de celulares del año pasado" → {"filters":{"categoria":"Celulares","fecha_venta":{"gte":"2024-01-01","lte":"2024-12-31"}},"template":"chart"}
- "monto total por estado" → {"groupBy":"estado","metric":"sum","metricField":"monto_total_credito","chartType":"bar"}`,
      }],
      messages: [{ role: 'user', content: [{ text: intent }] }],
      inferenceConfig: { maxTokens: 512, temperature: 0 },
    }));

    const block = response.output?.message?.content?.[0];
    if (!block || !('text' in block)) return fallback;
    const clean = block.text!.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    const parsed = { ...fallback, ...JSON.parse(clean) };
    
    // Override chartType if we detected it from the original intent
    if (detectedChartType && !parsed.chartType) {
      parsed.chartType = detectedChartType;
    }
    
    return parsed;
  } catch (err) {
    console.log('[orchestrator] intent interpretation failed:', (err as Error).message);
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
Siempre genera dashboards RICOS y COMPLETOS. Más información es mejor que menos. El usuario quiere entender sus datos en profundidad, no solo ver un número. Cada dashboard debe contar una historia completa: qué pasó, dónde, cuánto, y cómo se distribuye. Nunca generes menos de 4 componentes para cualquier template.

REGLAS DE VISUALIZACIÓN (obligatorias):
1. SIEMPRE incluye al menos un KPIGrid con 3-5 métricas de resumen (total registros, sumas, promedios)
2. Si uniqueValues > 5 en el campo de agrupación → Chart bar. NUNCA un card por grupo
3. Si uniqueValues <= 5 → ProgressGroup o pie/doughnut
4. Para template "category" o "executive": KPIGrid + Chart doughnut + Chart bar
5. Para template "credit": KPIGrid + ProgressGroup + Chart bar + TransactionList
6. Para template "chart": KPIGrid (resumen) + Chart principal
7. Para template "table": KPIGrid (resumen) + DataSummary
8. Usa aggregations.groupBy.data directamente para labels/values del Chart
9. Usa aggregations.numericSummaries para los valores de KPIGrid
10. Usa aggregations.fieldSummaries[campo].topValues para charts de distribución
11. Responde SOLO con el JSON del UIConfig, sin markdown, sin explicaciones
12. Formatea montos: >= 1M → "$1.2M", >= 1K → "$45.3K", resto → "$1,234"

COLORES para charts (usa estos exactos):
["#49a4d8","#7C3AED","#059669","#D97706","#DC2626","#2563EB","#6366F1","#0891B2","#10B981","#F59E0B","#EF4444","#EC4899","#14B8A6","#8B5CF6","#F97316"]`;

  const userMessage = `Intent del usuario: "${intent}"
Template sugerido: ${parsedIntent.template}
GroupBy detectado: ${parsedIntent.groupBy ?? 'ninguno'}
Métrica: ${parsedIntent.metric}${parsedIntent.metricField ? ` de ${parsedIntent.metricField}` : ''}

CONTEXTO DE LOS DATOS (${totalRecords} registros totales):
${JSON.stringify(aggregations, null, 2)}

Muestra de registros (${sampleRecords.length} de ${totalRecords}):
${JSON.stringify(sampleRecords, null, 2)}

INSTRUCCIONES SEGÚN TEMPLATE:
${ parsedIntent.template === 'executive' ? `Genera un dashboard COMPLETO con:
1. KPIGrid: total ventas, monto total, promedio precio, tasa morosidad (si aplica)
2. Chart bar: ventas/monto por estado (usa fieldSummaries.estado.topValues)
3. Chart doughnut: distribución por estatus_credito (usa fieldSummaries.estatus_credito.topValues)
4. Chart bar: ventas por canal_venta (usa fieldSummaries.canal_venta.topValues)
5. TransactionList: últimas 6-8 operaciones de la muestra de registros` :
parsedIntent.template === 'category' ? `Genera:
1. KPIGrid: total ventas, monto total, promedio
2. Chart doughnut: distribución por categoría
3. Chart bar: monto total por categoría
4. ProgressGroup: top categorías por cantidad` :
parsedIntent.template === 'credit' ? `Genera:
1. KPIGrid: totales por estatus, monto en riesgo
2. ProgressGroup: distribución de estatus
3. Chart bar: créditos atrasados por estado
4. TransactionList: créditos con mayor riesgo` :
parsedIntent.template === 'chart' ? `Genera:
1. KPIGrid: 3 métricas de resumen
2. Chart principal según groupBy detectado` :
parsedIntent.template === 'table' ? `Genera:
1. KPIGrid: 3 métricas de resumen
2. DataSummary con las columnas más relevantes` :
'Genera el dashboard más útil posible para este intent.'}

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
  parsedIntent: { groupBy: string | null; metric: string; metricField: string | null },
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
