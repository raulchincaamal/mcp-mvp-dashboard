import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Pipeline } from '../pipeline.js';

export async function datasetsRoutes(app: FastifyInstance) {
  const pipeline = (app as unknown as { pipeline: Pipeline }).pipeline;

  /**
   * GET /api/datasets
   * Lists all available datasets with their fields and record counts.
   */
  app.get('/', async (_req, reply) => {
    try {
      const result = await pipeline.listDatasets();
      return { success: true, data: result };
    } catch (error) {
      reply.status(500);
      return { success: false, error: (error as Error).message };
    }
  });

  /**
   * GET /api/datasets/:name
   * Describes a specific dataset schema.
   */
  app.get(
    '/:name',
    async (req: FastifyRequest<{ Params: { name: string } }>, reply) => {
      try {
        const result = await pipeline.describeDataset(req.params.name);
        return { success: true, data: result };
      } catch (error) {
        reply.status(500);
        return { success: false, error: (error as Error).message };
      }
    },
  );

  /**
   * POST /api/datasets/:name/query
   * Queries raw data from a dataset with optional filters and limit.
   * Body: { filters?: Record<string, unknown>, limit?: number }
   */
  app.post(
    '/:name/query',
    async (
      req: FastifyRequest<{
        Params: { name: string };
        Body: { filters?: Record<string, unknown>; limit?: number };
      }>,
      reply,
    ) => {
      try {
        const { filters, limit } = req.body;
        const result = await pipeline.queryData(
          req.params.name,
          filters,
          limit,
        );
        return { success: true, data: result };
      } catch (error) {
        reply.status(500);
        return { success: false, error: (error as Error).message };
      }
    },
  );
}

