import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { createMcpClients } from './mcp-client.js';
import { Pipeline } from './pipeline.js';
import { initCache, generateCacheKey, disconnectCache } from './cache.js';

const DASHBOARD_BASE_URL = process.env.DASHBOARD_URL || 'http://localhost:3000';

const server = new McpServer({
  name: 'mcp-main',
  version: '0.1.0',
});

let pipeline: Pipeline | null = null;

async function ensurePipeline(): Promise<Pipeline> {
  if (pipeline) return pipeline;

  initCache();

  const { gcpClient, uiClient, libraryContextClient } =
    await createMcpClients();

  pipeline = new Pipeline(gcpClient, uiClient, libraryContextClient);
  return pipeline;
}

// Tool: generate_dashboard
server.tool(
  'generate_dashboard',
  'Generates a dashboard from a natural language intent. Executes the full pipeline: interprets intent with LLM, queries data from GCP/SAP, generates a UIConfig, caches it in Redis, and returns a shareable dashboard URL.',
  {
    intent: z
      .string()
      .describe(
        'Natural language description of the dashboard to generate (e.g. "dashboard ejecutivo de ventas del Q4 2024 agrupado por estado")',
      ),
    dataset: z
      .string()
      .default('ventas-credito')
      .describe('Dataset to query (default: ventas-credito)'),
    filters: z
      .record(z.unknown())
      .optional()
      .describe(
        'Optional filters to apply to the data query (e.g. { "canal_venta": "tienda_fisica" })',
      ),
    limit: z
      .number()
      .positive()
      .optional()
      .describe('Max number of records to query (default: 100)'),
  },
  async ({ intent, dataset, filters, limit }) => {
    try {
      const pipe = await ensurePipeline();

      const uiConfig = await pipe.generateUi({
        intent,
        dataset,
        filters,
        limit,
      });

      // Compute the cache key to build the URL
      const cacheKey = generateCacheKey('ui', {
        dataset,
        intent,
        filters,
        limit,
      });
      const hash = cacheKey.split(':').pop() || cacheKey;

      const dashboardUrl = `${DASHBOARD_BASE_URL}/dashboard?key=${hash}`;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                url: dashboardUrl,
                key: hash,
                title:
                  (uiConfig as Record<string, unknown>)?.title || 'Dashboard',
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error generating dashboard: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);

