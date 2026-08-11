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

const SYSTEM_PROMPT = `Eres un orquestador de dashboards de ventas a crédito. Tu trabajo es:
1. Entender lo que el usuario quiere ver (en español)
2. Usar las tools disponibles para obtener los datos correctos
3. Generar una configuración de UI (UIConfig) que el frontend pueda renderizar

Flujo esperado:
- Llama a query_data con los filtros apropiados según el intent del usuario
- Llama a generate_ui con los registros obtenidos y el intent original
- Devuelve el UIConfig final

Dataset principal: "ventas-credito" con campos: id, fecha_venta, cliente, estado, ciudad, categoria, producto, precio_contado, monto_total_credito, estatus_credito, canal_venta, vendedor, entre otros.

Categorías disponibles: Motos, Celulares, Bicicletas Eléctricas, Pantallas/TV, Audio, Tablets, Consolas, Climatización, Accesorios.
Estatus de crédito: al_corriente, atrasado, liquidado, cancelado.

Componentes UI disponibles: StatCard, KPIGrid, Chart (bar/line/pie/doughnut), DataSummary, TransactionList, ProgressGroup, MiniChart.

Responde SOLO con el resultado final del UIConfig, sin explicaciones adicionales.`;

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
  } finally {
    await gcpClient.disconnect();
    await uiClient.disconnect();
  }
}

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

  let uiConfig: unknown = null;
  const MAX_ITERATIONS = 10;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await bedrockClient.send(
      new ConverseCommand({
        modelId: MODEL_ID,
        system: [{ text: SYSTEM_PROMPT }],
        messages,
        tools: BEDROCK_TOOLS,
        inferenceConfig: { maxTokens: 4096, temperature: 0 },
      }),
    );

    const assistantMessage: Message = {
      role: 'assistant',
      content: response.output?.message?.content ?? [],
    };
    messages.push(assistantMessage);

    // Stop if Bedrock is done
    if (response.stopReason === 'end_turn' || response.stopReason === 'max_tokens') {
      const textBlock = assistantMessage.content?.find((b) => 'text' in b);
      if (textBlock && 'text' in textBlock) {
        try {
          uiConfig = JSON.parse(textBlock.text!);
        } catch {
          uiConfig = textBlock.text;
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
    throw new Error('[orchestrator] Bedrock did not produce a UIConfig');
  }

  return uiConfig;
}
