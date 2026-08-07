import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { createMcpClients } from './mcp-client.js';
import { Pipeline } from './pipeline.js';
import { generateUiRoutes } from './routes/generate-ui.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;

async function main() {
  console.log('[mcp-main] Starting pipeline orchestrator...');

  // Step 1: Spawn and connect to MCP servers
  const { gcpClient, uiClient, libraryContextClient } =
    await createMcpClients();

  // Step 2: Create pipeline instance
  const pipeline = new Pipeline(gcpClient, uiClient, libraryContextClient);

  // Step 3: Setup Fastify
  const app = Fastify({ logger: false });

  await app.register(cors);

  // Decorate with pipeline so routes can access it
  app.decorate('pipeline', pipeline);

  // Health check
  app.get('/health', async () => ({
    status: 'ok',
    services: {
      'mcp-gcp-mock': gcpClient.isConnected,
      'mcp-ui': uiClient.isConnected,
      'library-context': libraryContextClient.isConnected,
    },
  }));

  // Main endpoint: generate UI from intent
  await app.register(generateUiRoutes, { prefix: '/api/generate-ui' });

  // Step 4: Start listening
  await app.listen({ port: PORT, host: '0.0.0.0' });

  console.log(`[mcp-main] HTTP API running at http://localhost:${PORT}`);
  console.log(`[mcp-main] Endpoints:`);
  console.log(`  GET  /health`);
  console.log(`  POST /api/generate-ui`);

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n[mcp-main] Shutting down...');
    await app.close();
    await gcpClient.disconnect();
    await uiClient.disconnect();
    await libraryContextClient.disconnect();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('[mcp-main] Fatal error:', error);
  process.exit(1);
});

