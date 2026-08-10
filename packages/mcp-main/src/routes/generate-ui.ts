import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Pipeline } from '../pipeline.js';
import { generateCacheKey } from '../cache.js';

const generateUiSchema = z.object({
  dataset: z.string(),
  intent: z.string().min(1),
  title: z.string().optional(),
  layout: z.enum(['vertical', 'grid']).optional(),
  columns: z.number().positive().optional(),
  filters: z.record(z.unknown()).optional(),
  limit: z.number().positive().optional(),
});

type GenerateUiBody = z.infer<typeof generateUiSchema>;

export async function generateUiRoutes(app: FastifyInstance) {
  const pipeline = (app as unknown as { pipeline: Pipeline }).pipeline;

  /**
   * POST /api/generate-ui
   * Full pipeline: gets component catalog from library-context, queries data,
   * and generates a declarative UIConfig that DynamicRenderer can render.
   *
   * Body: {
   *   dataset: string,         // which dataset to query
   *   intent: string,          // what the user wants (e.g. "tabla de ventas", "cards de productos")
   *   title?: string,          // optional title override
   *   layout?: 'vertical' | 'grid',
   *   columns?: number,
   *   filters?: Record<string, unknown>,
   *   limit?: number
   * }
   *
   * Response: { success: true, data: UIConfig, key: string }
   * The `key` can be used to retrieve the cached result via the Next.js API route:
   *   GET /api/dashboard/:key
   */
  app.post(
    '/',
    async (req: FastifyRequest<{ Body: GenerateUiBody }>, reply) => {
      const parsed = generateUiSchema.safeParse(req.body);

      if (!parsed.success) {
        reply.status(400);
        return {
          success: false,
          error: 'Invalid request body',
          details: parsed.error.flatten().fieldErrors,
        };
      }

      try {
        const uiConfig = await pipeline.generateUi(parsed.data);

        // Return cache key so frontend can build shareable URLs
        const cacheKey = generateCacheKey('ui', {
          dataset: parsed.data.dataset,
          intent: parsed.data.intent,
          filters: parsed.data.filters,
          limit: parsed.data.limit,
        });
        // Extract just the hash portion (last segment after last colon)
        const hash = cacheKey.split(':').pop() || cacheKey;

        return { success: true, data: uiConfig, key: hash };
      } catch (error) {
        reply.status(500);
        return { success: false, error: (error as Error).message };
      }
    },
  );
}

