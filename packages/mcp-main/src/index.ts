import Fastify from 'fastify';
import cors from '@fastify/cors';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { orchestrate } from './orchestrator.js';
import {
  initCache,
  generateCacheKey,
  cacheGet,
  cacheSet,
  isCacheConnected,
  TTL,
} from './cache.js';

const LATEST_KEY = 'mcp-dashboard:latest';

function userLatestKey(userId?: string): string {
  if (userId) return `${LATEST_KEY}:${userId}`;
  return LATEST_KEY;
}

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

  await fastify.register(cors, {
    origin: true, // Allow all origins in dev
  });

  fastify.get('/health', async () => ({
    status: 'ok',
    cache: isCacheConnected(),
    mode: 'bedrock-orchestrator',
  }));

  fastify.get('/api/latest', async (_request, reply) => {
    const { userId } = _request.query as { userId?: string };
    const latest = await cacheGet<{
      hash: string;
      status: string;
      uiConfig: unknown;
    }>(userLatestKey(userId));
    if (!latest)
      return reply
        .status(404)
        .send({ success: false, error: 'No dashboard generated yet' });
    return {
      success: true,
      hash: latest.hash,
      status: latest.status ?? 'ready',
      data: latest.status === 'ready' ? latest.uiConfig : null,
      url:
        latest.status === 'ready'
          ? `${DASHBOARD_BASE_URL}/dashboard?key=${latest.hash}`
          : null,
    };
  });

  fastify.post<{
    Body: {
      intent: string;
      dataset?: string;
      filters?: Record<string, unknown>;
      limit?: number;
      userId?: string;
    };
  }>('/api/generate-ui', async (request, reply) => {
    const {
      intent,
      dataset = 'ventas-credito',
      filters,
      limit,
      userId,
    } = request.body;

    if (!intent) {
      return reply
        .status(400)
        .send({ success: false, error: 'intent is required' });
    }

    try {
      // Signal frontend that a new dashboard is being generated
      const latestKey = userLatestKey(userId);
      const processingHash = `processing-${Date.now()}`;
      await cacheSet(
        latestKey,
        { hash: processingHash, status: 'processing' },
        1,
      );

      const uiConfig = await orchestrate({ intent, dataset, filters, limit });

      // Save final result
      const cacheKey = generateCacheKey('ui', {
        userId,
        dataset,
        intent,
        filters,
        limit,
      });
      const hash = cacheKey.split(':').pop() ?? cacheKey;
      await cacheSet(
        latestKey,
        { hash, status: 'ready', uiConfig },
        TTL.INTENT,
      );
      await cacheSet(cacheKey, uiConfig, TTL.INTENT);

      return {
        success: true,
        data: uiConfig,
        url: `${DASHBOARD_BASE_URL}/dashboard?key=${hash}`,
      };
    } catch (error) {
      fastify.log.error(error);
      return reply
        .status(500)
        .send({ success: false, error: (error as Error).message });
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
      intent: z
        .string()
        .describe('Natural language description of the dashboard (Spanish)'),
      dataset: z
        .string()
        .default('ventas-credito')
        .describe('Dataset to query'),
      filters: z
        .record(z.unknown())
        .optional()
        .describe('Optional extra filters'),
      limit: z.number().positive().optional().describe('Max records to query'),
    },
    async ({ intent, dataset, filters, limit }) => {
      try {
        const uiConfig = await orchestrate({ intent, dataset, filters, limit });

        const cacheKey = generateCacheKey('ui', {
          dataset,
          intent,
          filters,
          limit,
        });
        const hash = cacheKey.split(':').pop() ?? cacheKey;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  url: `${DASHBOARD_BASE_URL}/dashboard?key=${hash}`,
                  key: hash,
                  title:
                    (uiConfig as Record<string, unknown>)?.title ?? 'Dashboard',
                  cached: isCacheConnected(),
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
            { type: 'text', text: `Error: ${(error as Error).message}` },
          ],
          isError: true,
        };
      }
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
