import Fastify from 'fastify';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { orchestrate } from './orchestrator.js';
import { initCache, generateCacheKey, isCacheConnected } from './cache.js';

// Prevent unhandled ioredis errors from crashing the process
process.on('uncaughtException', (err) => {
  console.error('[mcp-main] Uncaught exception (non-fatal):', err.message);
});

const DASHBOARD_BASE_URL = process.env.DASHBOARD_URL ?? 'http://localhost:3000';
const IS_MCP_MODE = process.argv.includes('--mcp');

await initCache();

// ─── HTTP Server (Fastify) ────────────────────────────────────

if (!IS_MCP_MODE) {
  const fastify = Fastify({ logger: true });

  fastify.get('/health', async () => ({
    status: 'ok',
    cache: isCacheConnected(),
    mode: 'bedrock-orchestrator',
  }));

  fastify.post<{
    Body: { intent: string; dataset?: string; filters?: Record<string, unknown>; limit?: number };
  }>('/api/generate-ui', async (request, reply) => {
    const { intent, dataset = 'ventas-credito', filters, limit } = request.body;

    if (!intent) {
      return reply.status(400).send({ success: false, error: 'intent is required' });
    }

    try {
      const uiConfig = await orchestrate({ intent, dataset, filters, limit });
      return { success: true, data: uiConfig };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ success: false, error: (error as Error).message });
    }
  });

  const port = Number(process.env.PORT) || 4000;
  await fastify.listen({ port, host: '0.0.0.0' });
  console.log(`[mcp-main] HTTP server running on port ${port}`);
}

// ─── MCP Server (stdio) ───────────────────────────────────────

if (IS_MCP_MODE) {
  const server = new McpServer({ name: 'mcp-main', version: '0.1.0' });

  server.tool(
    'generate_dashboard',
    'Generates a dashboard from a natural language intent using Bedrock as orchestrator. Returns a shareable dashboard URL.',
    {
      intent: z.string().describe('Natural language description of the dashboard (Spanish)'),
      dataset: z.string().default('ventas-credito').describe('Dataset to query'),
      filters: z.record(z.unknown()).optional().describe('Optional extra filters'),
      limit: z.number().positive().optional().describe('Max records to query'),
    },
    async ({ intent, dataset, filters, limit }) => {
      try {
        const uiConfig = await orchestrate({ intent, dataset, filters, limit });

        const cacheKey = generateCacheKey('ui', { dataset, intent, filters, limit });
        const hash = cacheKey.split(':').pop() ?? cacheKey;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                url: `${DASHBOARD_BASE_URL}/dashboard?key=${hash}`,
                key: hash,
                title: (uiConfig as Record<string, unknown>)?.title ?? 'Dashboard',
                cached: isCacheConnected(),
              }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
