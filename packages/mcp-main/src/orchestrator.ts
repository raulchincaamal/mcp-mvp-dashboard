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

  const cacheKey = generateCacheKey('ui', {
    dataset,
    intent: params.intent,
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
    const parsedIntent = await interpretIntent(params.intent);
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
    filters: {}, groupBy: null, metric: 'count', metricField: null,
    chartType: null, template: 'executive', limit: 100, title: null,
  };

  try {
    const response = await bedrockClient.send(new ConverseCommand({
      modelId: MODEL_ID,
      system: [{
        text: `Convierte el intent del usuario en un JSON estructurado. Responde SOLO con JSON válido, sin markdown, sin explicaciones.

Estructura exacta:
{"filters":{},"groupBy":null,"metric":"count","metricField":null,"chartType":null,"template":"executive","limit":null,"title":null}

Campos del dataset ventas-credito: id, fecha_venta, cliente, edad_cliente, genero, estado, ciudad, sucursal, categoria, producto, precio_contado, monto_total_credito, estatus_credito, canal_venta, vendedor.
Categorías: Motos, Celulares, Bicicletas Eléctricas, Pantallas/TV, Audio, Tablets, Consolas, Climatización, Accesorios.
Estatus: al_corriente, atrasado, liquidado, cancelado.
Canales: tienda_fisica, en_linea, telefono.

Reglas:
- "por estado/categoría/mes/vendedor" → groupBy
- categoría específica mencionada → filters.categoria
- "atrasado/liquidado/al corriente" → filters.estatus_credito
- "tabla/listado" → template:table
- "gráfica/chart/tendencia" → template:chart
- "crédito/estatus/pago" → template:credit
- "por categoría/análisis" → template:category
- "resumen/dashboard/kpi/ejecutivo" → template:executive
- número mencionado (últimas 10, top 20) → limit
- genera un título descriptivo en español → title`,
      }],
      messages: [{ role: 'user', content: [{ text: intent }] }],
      inferenceConfig: { maxTokens: 512, temperature: 0 },
    }));

    const block = response.output?.message?.content?.[0];
    if (!block || !('text' in block)) return fallback;
    const clean = block.text!.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    return { ...fallback, ...JSON.parse(clean) };
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

  const systemPrompt = `Eres un generador de dashboards. Recibes datos de ventas y generas un UIConfig JSON que el frontend renderiza.

Componentes disponibles:
${COMPONENT_CATALOG.map(c => `- ${c.name}: ${c.description}`).join('\n')}

UIConfig schema:
{
  "title": "string",
  "description": "string (opcional)",
  "layout": "vertical" | "grid",
  "columns": number (solo si layout=grid),
  "components": [
    {
      "component": "NombreComponente",
      "props": { ... }
    }
  ]
}

Props por componente:
- KPIGrid: { items: [{ title, value, subtitle?, trend?, trendDirection?: "up"|"down"|"neutral", icon? }] }
- Chart: { type: "bar"|"line"|"pie"|"doughnut", title?, data: { labels: [], datasets: [{ label, data: [], backgroundColor }] } }
- DataSummary: { title?, columns: [{ key, label }], rows: [...] }
- TransactionList: { title?, items: [{ title, subtitle?, amount, date?, status?: "positive"|"negative"|"neutral" }] }
- ProgressGroup: { title?, items: [{ label, value (0-100), color? }] }
- StatCard: { title, value, subtitle?, trend?, trendDirection?, icon? }

REGLAS:
- Responde SOLO con el JSON del UIConfig, sin markdown, sin explicaciones
- Usa datos reales de las agregaciones y registros proporcionados
- El template "${parsedIntent.template}" sugiere qué componentes usar
- Formatea montos en pesos mexicanos (ej: "$1,234")`;

  const userMessage = `Intent: "${intent}"
Template sugerido: ${parsedIntent.template}
GroupBy: ${parsedIntent.groupBy ?? 'ninguno'}
Métrica: ${parsedIntent.metric}${parsedIntent.metricField ? ` de ${parsedIntent.metricField}` : ''}
Total registros: ${totalRecords}

Agregaciones calculadas:
${JSON.stringify(aggregations, null, 2)}

Muestra de registros (${sampleRecords.length} de ${totalRecords}):
${JSON.stringify(sampleRecords, null, 2)}

Genera el UIConfig JSON ahora.`;

  const response = await bedrockClient.send(new ConverseCommand({
    modelId: MODEL_ID,
    system: [{ text: systemPrompt }],
    messages: [{ role: 'user', content: [{ text: userMessage }] }],
    inferenceConfig: { maxTokens: 4096, temperature: 0 },
  }));

  const block = response.output?.message?.content?.[0];
  if (!block || !('text' in block)) throw new Error('Bedrock did not return UIConfig');

  const raw = block.text!.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

  try {
    const parsed = JSON.parse(raw);
    // Handle potential wrapping
    return (parsed as Record<string, unknown>).uiConfig ?? parsed;
  } catch {
    throw new Error(`Bedrock returned invalid JSON: ${raw.slice(0, 200)}`);
  }
}

// ─── Aggregation helper ───────────────────────────────────────

function computeAggregations(
  records: Record<string, unknown>[],
  parsedIntent: { groupBy: string | null; metric: string; metricField: string | null },
): Record<string, unknown> {
  if (records.length === 0) return {};

  const agg: Record<string, unknown> = {
    totalRecords: records.length,
  };

  // Group by aggregation
  if (parsedIntent.groupBy) {
    const field = parsedIntent.groupBy;
    const groups: Record<string, number> = {};

    for (const record of records) {
      const key = String(record[field] ?? 'N/A');
      if (parsedIntent.metric === 'count') {
        groups[key] = (groups[key] ?? 0) + 1;
      } else if (parsedIntent.metricField) {
        const val = Number(record[parsedIntent.metricField] ?? 0);
        groups[key] = (groups[key] ?? 0) + val;
      }
    }

    agg.groupBy = {
      field,
      metric: parsedIntent.metric,
      data: Object.entries(groups)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 15)
        .map(([label, value]) => ({ label, value })),
    };
  }

  // General KPIs
  const numericFields = ['precio_contado', 'monto_total_credito', 'pago_semanal'];
  for (const field of numericFields) {
    if (records[0]?.[field] !== undefined) {
      const values = records.map(r => Number(r[field] ?? 0));
      agg[`total_${field}`] = values.reduce((a, b) => a + b, 0);
      agg[`avg_${field}`] = Math.round(agg[`total_${field}`] as number / values.length);
    }
  }

  // Status distribution
  if (records[0]?.estatus_credito !== undefined) {
    const statusCount: Record<string, number> = {};
    for (const r of records) {
      const s = String(r.estatus_credito ?? 'N/A');
      statusCount[s] = (statusCount[s] ?? 0) + 1;
    }
    agg.estatus_credito = statusCount;
  }

  return agg;
}
