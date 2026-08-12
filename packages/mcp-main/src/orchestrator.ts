import {
  BedrockRuntimeClient,
  ConverseCommand,
  type Message,
  type Tool,
  type ToolResultBlock,
  type ToolChoice,
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
  { name: 'Card', description: 'Container card with padding and border' },
  { name: 'Badge', description: 'Small label/tag with variants' },
  { name: 'Text', description: 'Typography component' },
];

// ─── Tool definitions ─────────────────────────────────────────
//
// generate_ui only receives DECISION params — Nova decides what to show and how.
// Records and componentCatalog are injected by the orchestrator internally.

const BEDROCK_TOOLS: Tool[] = [
  {
    toolSpec: {
      name: 'query_data',
      description: 'Queries the ventas-credito dataset and returns matching records. Supports exact match and range filters on any field.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            dataset: { type: 'string', description: 'Always "ventas-credito"' },
            filters: {
              type: 'object',
              description: 'Exact match: { "categoria": "Motos" } or range: { "fecha_venta": { "gte": "2025-01-01", "lte": "2025-03-31" } }',
            },
            limit: { type: 'number', description: 'Max records to return (default 100)' },
          },
          required: ['dataset'],
        },
      },
    },
  },
  {
    toolSpec: {
      name: 'generate_ui',
      description: 'Generates the dashboard UI. Call this after query_data. You decide the visualization parameters — the system handles the data automatically.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            intent: {
              type: 'string',
              description: 'Enriched intent describing what to visualize. Include hints like [groupBy:estado] [metric:count] [chartType:bar] [template:chart]',
            },
            template: {
              type: 'string',
              enum: ['executive', 'category', 'credit', 'table', 'chart'],
              description: 'executive=KPIs+chart+list, category=by-group analysis, credit=payment status, table=data table, chart=single chart',
            },
            chartType: {
              type: 'string',
              enum: ['bar', 'line', 'pie', 'doughnut', 'area'],
              description: 'Chart type to use',
            },
            groupBy: {
              type: 'string',
              description: 'Field to group data by (e.g. "estado", "categoria", "canal_venta", "estatus_credito")',
            },
            metric: {
              type: 'string',
              enum: ['count', 'sum', 'avg', 'max', 'min'],
              description: 'Aggregation metric',
            },
            metricField: {
              type: 'string',
              description: 'Numeric field for sum/avg/max/min (e.g. "precio_contado", "monto_total_credito")',
            },
            title: {
              type: 'string',
              description: 'Dashboard title',
            },
            layout: {
              type: 'string',
              enum: ['vertical', 'grid'],
              description: 'Layout type',
            },
          },
          required: ['intent', 'template'],
        },
      },
    },
  },
];

const SYSTEM_PROMPT = `Eres un orquestador de dashboards de ventas. Usas tools para generar dashboards dinámicos.

FLUJO OBLIGATORIO:
1. Llama query_data con los filtros apropiados según el intent del usuario
2. Llama generate_ui con los parámetros de visualización que TÚ decides

PARA generate_ui, tú decides:
- template: qué tipo de dashboard (executive, category, credit, table, chart)
- chartType: qué gráfica (bar, line, pie, doughnut, area)
- groupBy: por qué campo agrupar (estado, categoria, canal_venta, estatus_credito, etc.)
- metric: qué medir (count, sum, avg)
- metricField: qué campo numérico usar para sum/avg
- title: título descriptivo del dashboard
- intent: el intent original enriquecido con hints [groupBy:x] [metric:x] [chartType:x] [template:x]

NO incluyas records ni componentCatalog en generate_ui — el sistema los inyecta automáticamente.
NO respondas con texto. SOLO llama las tools.

Dataset: "ventas-credito"
Campos: id, fecha_venta, cliente, edad_cliente, genero, estado, ciudad, sucursal, categoria, producto, color, precio_contado, enganche, monto_financiado, tasa_interes, monto_total_credito, plazo_semanas, pago_semanal, semanas_pagadas, semanas_atrasadas, monto_vencido, estatus_credito, canal_venta, vendedor
Categorías: Motos, Celulares, Bicicletas Eléctricas, Pantallas/TV, Audio, Tablets, Consolas, Climatización, Accesorios
Estatus: al_corriente, atrasado, liquidado, cancelado
Canales: tienda_fisica, en_linea, telefono`;

// ─── Credential error detection ─────────────────────────────

function isCredentialError(err: unknown): boolean {
  const msg = (err as Error)?.message ?? '';
  return (
    msg.includes('security token') ||
    msg.includes('token is expired') ||
    msg.includes('ExpiredToken') ||
    msg.includes('InvalidClientTokenId') ||
    msg.includes('UnrecognizedClientException') ||
    msg.includes('AccessDeniedException')
  );
}

// ─── Orchestrator entry point ─────────────────────────────────

export interface OrchestrationParams {
  intent: string;
  dataset?: string;
  filters?: Record<string, unknown>;
  limit?: number;
}

export async function orchestrate(params: OrchestrationParams): Promise<unknown> {
  const cacheKey = generateCacheKey('ui', {
    dataset: params.dataset ?? 'ventas-credito',
    intent: params.intent,
    filters: params.filters,
    limit: params.limit,
  });
  const cached = await cacheGet<unknown>(cacheKey);
  if (cached) return cached;

  const { gcpClient, uiClient } = await import('./mcp-client.js').then((m) =>
    m.createMcpClients(),
  );

  try {
    const result = await runBedrockLoop(params, gcpClient, uiClient);
    await cacheSet(cacheKey, result, TTL.INTENT);
    return result;
  } catch (err) {
    if (isCredentialError(err)) throw err; // propagate — don't silently fallback
    console.log(`[orchestrator] Bedrock loop failed (${(err as Error).message}), using hardcoded pipeline`);
    const result = await runHardcodedPipeline(params, gcpClient, uiClient);
    await cacheSet(cacheKey, result, TTL.INTENT);
    return result;
  } finally {
    await gcpClient.disconnect();
    await uiClient.disconnect();
  }
}

// ─── Bedrock tool-use loop ────────────────────────────────────

async function runBedrockLoop(
  params: OrchestrationParams,
  gcpClient: McpClient,
  uiClient: McpClient,
): Promise<unknown> {
  const messages: Message[] = [
    {
      role: 'user',
      content: [
        {
          text: `Intent del usuario: "${params.intent}"${
            params.filters ? `\nFiltros adicionales: ${JSON.stringify(params.filters)}` : ''
          }${params.limit ? `\nLímite de registros: ${params.limit}` : ''}`,
        },
      ],
    },
  ];

  console.log(`[orchestrator] starting loop — model: ${MODEL_ID}`);
  const isNova = MODEL_ID.includes('nova');
  let uiConfig: unknown = null;
  let lastStopReason: string | undefined;
  let stashedRecords: unknown[] | null = null;
  const MAX_ITERATIONS = 10;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const isFirstCall = i === 0;

    // Nova: force query_data first, then force generate_ui once we have records.
    // Claude: force any tool on first call, then auto.
    const toolChoice: ToolChoice = isNova
      ? (isFirstCall ? { tool: { name: 'query_data' } } : { tool: { name: 'generate_ui' } })
      : (isFirstCall ? { any: {} } : { auto: {} });

    const response = await bedrockClient.send(
      new ConverseCommand({
        modelId: MODEL_ID,
        system: [{ text: SYSTEM_PROMPT }],
        messages,
        toolConfig: { tools: BEDROCK_TOOLS, toolChoice },
        inferenceConfig: { maxTokens: 4096, temperature: 0 },
      }),
    );
    lastStopReason = response.stopReason;

    const assistantMessage: Message = {
      role: 'assistant',
      content: response.output?.message?.content ?? [],
    };
    messages.push(assistantMessage);

    console.log(`[orchestrator] iteration ${i} stopReason: ${response.stopReason}`);

    if (response.stopReason === 'end_turn' || response.stopReason === 'max_tokens') {
      break;
    }

    if (response.stopReason === 'tool_use') {
      const toolResults: ToolResultBlock[] = [];

      for (const block of assistantMessage.content ?? []) {
        if (!('toolUse' in block) || !block.toolUse) continue;

        const { toolUseId, name, input } = block.toolUse;
        const args = (input ?? {}) as Record<string, unknown>;

        console.log(`[orchestrator] tool: ${name}`, JSON.stringify(args));

        let toolResult: unknown;
        try {
          if (name === 'query_data') {
            const rawFilters = (args.filters ?? {}) as Record<string, unknown>;
            // Normalize string filter values to match dataset casing
            const normalizedFilters: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(rawFilters)) {
              if (typeof v === 'string') {
                normalizedFilters[k] = v.charAt(0).toUpperCase() + v.slice(1);
              } else {
                normalizedFilters[k] = v;
              }
            }
            const raw = await gcpClient.callTool(name, {
              dataset: params.dataset ?? 'ventas-credito',
              ...(Object.keys(normalizedFilters).length > 0 ? { filters: normalizedFilters } : {}),
              limit: args.limit ?? params.limit ?? 500,
            }) as { records?: unknown[]; totalRecords?: number };

            stashedRecords = raw.records ?? (raw as unknown as unknown[]);
            // Summary only — full records would overflow Nova's context
            toolResult = {
              totalRecords: raw.totalRecords ?? stashedRecords.length,
              message: `Query successful. ${stashedRecords.length} records ready. Now call generate_ui with your visualization parameters.`,
            };
          } else if (name === 'generate_ui') {
            // Nova decides the visualization — we inject records + catalog
            const baseIntent = (args.intent ?? params.intent as string).replace(/\s*\[\w+:[^\]]+\]/g, '').trim();
            const enhancedIntent = [
              baseIntent,
              args.groupBy ? `[groupBy:${args.groupBy}]` : '',
              args.metric ? `[metric:${args.metric}]` : '',
              args.metricField ? `[metricField:${args.metricField}]` : '',
              args.chartType ? `[chartType:${args.chartType}]` : '',
              args.template ? `[template:${args.template}]` : '',
            ].filter(Boolean).join(' ');

            let rawUiConfig = await uiClient.callTool('generate_ui', {
              intent: enhancedIntent,
              records: stashedRecords ?? [],
              componentCatalog: COMPONENT_CATALOG,
              ...(args.title ? { title: args.title } : {}),
              layout: args.layout ?? 'vertical',
              columns: 2,
            });

            // mcp-ui double-stringifies: parse until we get an object with 'components'
            while (typeof rawUiConfig === 'string') {
              try { rawUiConfig = JSON.parse(rawUiConfig); } catch { break; }
            }
            uiConfig = rawUiConfig;
            console.log('[orchestrator] uiConfig type:', typeof uiConfig, 'keys:', uiConfig && typeof uiConfig === 'object' ? Object.keys(uiConfig as object) : 'N/A');

            // Summary back to Bedrock — UIConfig is too large to include
            toolResult = { success: true, message: 'Dashboard generated successfully.' };
          } else {
            toolResult = { error: `Unknown tool: ${name}` };
          }
        } catch (err) {
          toolResult = { error: (err as Error).message };
        }

        toolResults.push({
          toolUseId: toolUseId!,
          content: [{ text: JSON.stringify(toolResult) }],
        });
      }

      messages.push({
        role: 'user',
        content: toolResults.map((r) => ({ toolResult: r })),
      });

      // If we just got the UIConfig, we're done — no need for another Bedrock call
      if (uiConfig) break;
    }
  }

  if (!uiConfig) {
    throw new Error(`No UIConfig produced — stopReason: ${lastStopReason}, model: ${MODEL_ID}`);
  }

  return uiConfig;
}

// ─── Hardcoded pipeline fallback ─────────────────────────────

async function runHardcodedPipeline(
  params: OrchestrationParams,
  gcpClient: McpClient,
  uiClient: McpClient,
): Promise<unknown> {
  const parsedIntent = await interpretIntentWithBedrock(params.intent);
  console.log('[orchestrator] fallback parsed intent:', JSON.stringify(parsedIntent));

  const filters: Record<string, unknown> = { ...parsedIntent.filters, ...params.filters };
  for (const [key, value] of Object.entries(filters)) {
    if (Array.isArray(value) && value.length >= 8) delete filters[key];
  }
  const limit = params.limit ?? parsedIntent.limit ?? 100;

  const queryResult = await gcpClient.callTool('query_data', {
    dataset: params.dataset ?? 'ventas-credito',
    ...(Object.keys(filters).length > 0 ? { filters } : {}),
    limit,
  }) as { records?: Record<string, unknown>[] };

  const records = queryResult.records ?? (queryResult as unknown as Record<string, unknown>[]);

  const enhancedIntent = [
    params.intent,
    parsedIntent.groupBy ? `[groupBy:${parsedIntent.groupBy}]` : '',
    parsedIntent.metric ? `[metric:${parsedIntent.metric}]` : '',
    parsedIntent.chartType ? `[chartType:${parsedIntent.chartType}]` : '',
    parsedIntent.template ? `[template:${parsedIntent.template}]` : '',
  ].filter(Boolean).join(' ');

  let rawResult = await uiClient.callTool('generate_ui', {
    intent: enhancedIntent,
    records,
    componentCatalog: COMPONENT_CATALOG,
    layout: 'vertical',
    columns: 2,
  });

  while (typeof rawResult === 'string') {
    try { rawResult = JSON.parse(rawResult); } catch { break; }
  }
  return rawResult;
}

async function interpretIntentWithBedrock(intent: string): Promise<{
  filters: Record<string, unknown>;
  groupBy: string | null;
  metric: string;
  chartType: string | null;
  template: string;
  limit: number | null;
}> {
  const fallback = { filters: {}, groupBy: null, metric: 'count', chartType: null, template: 'executive', limit: 500 };

  // ─── Local regex parser (no Bedrock needed) ───────────────
  const i = intent.toLowerCase();
  const filters: Record<string, unknown> = {};

  // Categorías
  const categorias: Record<string, string> = {
    moto: 'Motos', motos: 'Motos',
    celular: 'Celulares', celulares: 'Celulares', telefono: 'Celulares', teléfono: 'Celulares',
    bicicleta: 'Bicicletas Eléctricas', bicicletas: 'Bicicletas Eléctricas',
    pantalla: 'Pantallas/TV', pantallas: 'Pantallas/TV', tv: 'Pantallas/TV', televisor: 'Pantallas/TV',
    audio: 'Audio', bocina: 'Audio', bocinas: 'Audio',
    tablet: 'Tablets', tablets: 'Tablets',
    consola: 'Consolas', consolas: 'Consolas', nintendo: 'Consolas', playstation: 'Consolas', xbox: 'Consolas',
    clima: 'Climatización', climatización: 'Climatización', ac: 'Climatización', aire: 'Climatización',
    accesorio: 'Accesorios', accesorios: 'Accesorios',
  };
  for (const [kw, val] of Object.entries(categorias)) {
    if (i.includes(kw)) { filters['categoria'] = val; break; }
  }

  // Colores
  const colores = ['rojo', 'azul', 'negro', 'blanco', 'gris', 'verde', 'amarillo', 'morado', 'rosa', 'naranja', 'lila', 'dorado', 'plateado'];
  for (const color of colores) {
    if (i.includes(color)) {
      filters['color'] = color.charAt(0).toUpperCase() + color.slice(1);
      break;
    }
  }

  // Estatus crédito
  if (i.includes('atrasado') || i.includes('atraso') || i.includes('mora')) filters['estatus_credito'] = 'atrasado';
  else if (i.includes('liquidado') || i.includes('pagado')) filters['estatus_credito'] = 'liquidado';
  else if (i.includes('cancelado')) filters['estatus_credito'] = 'cancelado';
  else if (i.includes('al corriente') || i.includes('corriente')) filters['estatus_credito'] = 'al_corriente';

  // Canal de venta
  if (i.includes('en línea') || i.includes('en linea') || i.includes('online')) filters['canal_venta'] = 'en_linea';
  else if (i.includes('tienda') || i.includes('física') || i.includes('fisica')) filters['canal_venta'] = 'tienda_fisica';
  else if (i.includes('teléfono') || i.includes('telefono')) filters['canal_venta'] = 'telefono';

  // Fecha (mes)
  const meses: Record<string, string> = {
    enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06',
    julio: '07', agosto: '08', septiembre: '09', octubre: '10', noviembre: '11', diciembre: '12',
  };
  for (const [mes, num] of Object.entries(meses)) {
    if (i.includes(mes)) {
      const yearMatch = intent.match(/(202\d)/);
      const year = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();
      filters['fecha_venta'] = { gte: `${year}-${num}-01`, lte: `${year}-${num}-31` };
      break;
    }
  }

  // Template
  let template = 'executive';
  if (/cr[eé]dito|estatus|pago|atraso|liquidado|corriente/i.test(i)) template = 'credit';
  else if (/categor[ií]a|por\s+categor/i.test(i)) template = 'category';
  else if (/tabla|listado|registros|detalle|últimas|ultimas/i.test(i)) template = 'table';
  else if (/gr[aá]fica|chart|tendencia|pastel|pie|dona|doughnut/i.test(i)) template = 'chart';
  else if (/resumen|ejecutivo|dashboard|general|kpi/i.test(i)) template = 'executive';
  else if (Object.keys(filters).length > 0) template = 'chart'; // filtered query → chart

  // chartType
  let chartType: string | null = null;
  if (/pastel|pie/i.test(i)) chartType = 'pie';
  else if (/dona|doughnut/i.test(i)) chartType = 'doughnut';
  else if (/l[ií]nea|line|tendencia/i.test(i)) chartType = 'line';
  else if (/barra|bar/i.test(i)) chartType = 'bar';

  // groupBy
  let groupBy: string | null = null;
  if (/por estado/i.test(i)) groupBy = 'estado';
  else if (/por categor/i.test(i)) groupBy = 'categoria';
  else if (/por canal/i.test(i)) groupBy = 'canal_venta';
  else if (/por ciudad/i.test(i)) groupBy = 'ciudad';
  else if (/por sucursal/i.test(i)) groupBy = 'sucursal';
  else if (/por color/i.test(i)) groupBy = 'color';
  else if (/por vendedor/i.test(i)) groupBy = 'vendedor';
  else if (/por mes/i.test(i)) groupBy = 'fecha_venta';

  // metric
  let metric = 'count';
  if (/promedio|media|avg/i.test(i)) metric = 'avg';
  else if (/total|suma|sum/i.test(i)) metric = 'sum';

  // limit
  const limitMatch = intent.match(/(?:últimas?|ultimas?|top|primeras?)\s+(\d+)/i);
  const limit = limitMatch ? Number(limitMatch[1]) : 500;

  console.log('[orchestrator] local parser result:', JSON.stringify({ filters, template, chartType, groupBy, metric, limit }));
  return { filters, groupBy, metric, chartType, template, limit };
}
