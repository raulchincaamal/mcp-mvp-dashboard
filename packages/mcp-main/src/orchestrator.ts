import {
  BedrockRuntimeClient,
  ConverseCommand,
  type Message,
  type Tool,
  type ToolResultBlock,
} from '@aws-sdk/client-bedrock-runtime';
import type { McpClient } from './mcp-client.js';
import { generateCacheKey, cacheGet, cacheSet, TTL } from './cache.js';

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION,
});
const MODEL_ID = process.env.BEDROCK_MODEL_ID!;

// ─── Tool definitions that Bedrock can invoke ────────────────

const BEDROCK_TOOLS: Tool[] = [
  {
    toolSpec: {
      name: 'list_datasets',
      description: 'Lists all available datasets with their fields and record counts. Call this first if you are unsure what data is available.',
      inputSchema: { json: { type: 'object', properties: {}, required: [] } },
    },
  },
  {
    toolSpec: {
      name: 'query_data',
      description: 'Queries a dataset and returns records. Supports exact match and range filters.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            dataset: { type: 'string', description: 'Dataset name (e.g. "ventas-credito")' },
            filters: {
              type: 'object',
              description: 'Filters: exact match { campo: valor } or range { campo: { gte, lte } }',
            },
            limit: { type: 'number', description: 'Max records to return' },
          },
          required: ['dataset'],
        },
      },
    },
  },
  {
    toolSpec: {
      name: 'generate_ui',
      description: 'Generates a declarative UIConfig JSON from data records and user intent. The frontend renders this into React components (charts, tables, KPI grids, etc).',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            intent: { type: 'string', description: 'What the user wants to see' },
            records: { type: 'array', description: 'Data records from query_data' },
            componentCatalog: {
              type: 'array',
              description: 'Available UI components',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                },
              },
            },
            title: { type: 'string' },
            layout: { type: 'string', enum: ['vertical', 'grid'] },
            columns: { type: 'number' },
          },
          required: ['intent', 'records', 'componentCatalog'],
        },
      },
    },
  },
];

const SYSTEM_PROMPT = `Eres un orquestador de dashboards. DEBES usar las tools disponibles, no respondas con texto.

INSTRUCCIONES:
- Llama INMEDIATAMENTE a query_data con dataset="ventas-credito"
- Luego llama a generate_ui con los registros obtenidos
- NO escribas explicaciones, NO escribas código, SOLO llama las tools

Dataset: "ventas-credito" — campos: id, fecha_venta, cliente, estado, ciudad, categoria, producto, precio_contado, monto_total_credito, estatus_credito, canal_venta, vendedor.
Categorías: Motos, Celulares, Bicicletas Eléctricas, Pantallas/TV, Audio, Tablets, Consolas, Climatización, Accesorios.
Estatus: al_corriente, atrasado, liquidado, cancelado.`;

// ─── Component catalog (hardcoded, augmented from library-context) ────────────

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

// ─── Orchestrator ─────────────────────────────────────────────

export interface OrchestrationParams {
  intent: string;
  dataset?: string;
  filters?: Record<string, unknown>;
  limit?: number;
}

export async function orchestrate(params: OrchestrationParams): Promise<unknown> {
  // Check cache first
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
    console.log(`[orchestrator] Bedrock tool-use failed (${(err as Error).message}), using hardcoded pipeline`);
    const result = await runHardcodedPipeline(params, gcpClient, uiClient);
    await cacheSet(cacheKey, result, TTL.INTENT);
    return result;
  } finally {
    await gcpClient.disconnect();
    await uiClient.disconnect();
  }
}

// ─── Hardcoded pipeline fallback ────────────────────────────

async function runHardcodedPipeline(
  params: OrchestrationParams,
  gcpClient: McpClient,
  uiClient: McpClient,
): Promise<unknown> {
  const parsedIntent = await interpretIntentWithBedrock(params.intent);
  console.log('[orchestrator] fallback parsed intent:', JSON.stringify(parsedIntent));

  const filters: Record<string, unknown> = { ...parsedIntent.filters, ...params.filters };
  // Remove array filters that contain all categories (no real filter)
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

  return uiClient.callTool('generate_ui', {
    intent: enhancedIntent,
    records,
    componentCatalog: COMPONENT_CATALOG,
    layout: 'vertical',
    columns: 2,
  });
}

async function interpretIntentWithBedrock(intent: string): Promise<{
  filters: Record<string, unknown>;
  groupBy: string | null;
  metric: string;
  chartType: string | null;
  template: string;
  limit: number | null;
}> {
  const fallback = { filters: {}, groupBy: null, metric: 'count', chartType: null, template: 'executive', limit: 100 };
  try {
    const response = await bedrockClient.send(new ConverseCommand({
      modelId: MODEL_ID,
      system: [{ text: 'Convierte el intent en JSON. Responde SOLO con JSON válido sin markdown ni explicaciones.\n\nEstructura: {"filters":{},"groupBy":null,"metric":"count","metricField":null,"chartType":null,"template":"executive","limit":null}\n\nCampos: id,fecha_venta,cliente,estado,ciudad,categoria,producto,precio_contado,monto_total_credito,estatus_credito,canal_venta,vendedor.\nCategorías: Motos,Celulares,Bicicletas Eléctricas,Pantallas/TV,Audio,Tablets,Consolas,Climatización,Accesorios.\nTemplates: executive,category,credit,table,chart.' }],
      messages: [{ role: 'user', content: [{ text: intent }] }],
      inferenceConfig: { maxTokens: 512, temperature: 0 },
    }));
    const block = response.output?.message?.content?.[0];
    if (!block || !('text' in block)) return fallback;
    const clean = block.text!.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    return { ...fallback, ...JSON.parse(clean) };
  } catch {
    return fallback;
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
            params.dataset ? `\nDataset: ${params.dataset}` : ''
          }${params.filters ? `\nFiltros adicionales: ${JSON.stringify(params.filters)}` : ''}${
            params.limit ? `\nLímite de registros: ${params.limit}` : ''
          }`,
        },
      ],
    },
  ];

  console.log(`[orchestrator] starting loop — model: ${MODEL_ID}`);
  const isNova = MODEL_ID.includes('nova');
  let uiConfig: unknown = null;
  const MAX_ITERATIONS = 10;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const isFirstCall = i === 0;
    const response = await bedrockClient.send(
      new ConverseCommand({
        modelId: MODEL_ID,
        system: [{ text: SYSTEM_PROMPT }],
        messages,
        tools: BEDROCK_TOOLS,
        // Nova does not support toolChoice: any — only Claude does
        ...(isNova ? {} : { toolChoice: isFirstCall ? { any: {} } : { auto: {} } }),
        inferenceConfig: { maxTokens: 4096, temperature: 0 },
      }),
    );

    const assistantMessage: Message = {
      role: 'assistant',
      content: response.output?.message?.content ?? [],
    };
    messages.push(assistantMessage);

    console.log(`[orchestrator] iteration ${i} stopReason: ${response.stopReason}`);

    // Stop if Bedrock is done
    if (response.stopReason === 'end_turn' || response.stopReason === 'max_tokens') {
      if (!uiConfig) {
        const textBlock = assistantMessage.content?.find((b) => 'text' in b);
        if (textBlock && 'text' in textBlock) {
          const raw = textBlock.text!.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
          try {
            const parsed = JSON.parse(raw);
            // Handle Nova wrapping response in { uiConfig: {...} }
            uiConfig = (parsed as Record<string, unknown>).uiConfig ?? parsed;
          } catch {
            console.log('[orchestrator] end_turn text (not JSON):', raw.slice(0, 200));
          }
        }
      }
      break;
    }

    // Process tool calls
    if (response.stopReason === 'tool_use') {
      const toolResults: ToolResultBlock[] = [];

      for (const block of assistantMessage.content ?? []) {
        if (!('toolUse' in block) || !block.toolUse) continue;

        const { toolUseId, name, input } = block.toolUse;
        const args = (input ?? {}) as Record<string, unknown>;

        console.log(`[orchestrator] Bedrock calling tool: ${name}`, JSON.stringify(args));

        let toolResult: unknown;
        try {
          if (name === 'list_datasets' || name === 'query_data') {
            toolResult = await gcpClient.callTool(name, args);
          } else if (name === 'generate_ui') {
            // Inject component catalog if not provided
            if (!args.componentCatalog) {
              args.componentCatalog = COMPONENT_CATALOG;
            }
            toolResult = await uiClient.callTool('generate_ui', args);
            uiConfig = toolResult; // capture last generate_ui result
          } else {
            toolResult = { error: `Unknown tool: ${name}` };
          }
        } catch (err) {
          toolResult = { error: (err as Error).message };
        }

        toolResults.push({
          toolUseId: toolUseId!,
          content: [{ text: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult) }],
        });
      }

      messages.push({
        role: 'user',
        content: toolResults.map((r) => ({ toolResult: r })),
      });
    }
  }

    if (!uiConfig) {
      throw new Error(`Bedrock did not use tools — stopReason: ${response.stopReason}, model: ${MODEL_ID}`);
    }

  return uiConfig;
}
