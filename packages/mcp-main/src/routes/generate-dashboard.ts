import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Pipeline } from '../pipeline.js';

const generateDashboardSchema = z.object({
  dataset: z.string(),
  labelField: z.string(),
  metrics: z.array(z.string()).min(1),
  title: z.string().optional(),
  description: z.string().optional(),
  layout: z.enum(['grid', 'vertical']).optional(),
  columns: z.number().positive().optional(),
  filters: z.record(z.unknown()).optional(),
  limit: z.number().positive().optional(),
});

type GenerateDashboardBody = z.infer<typeof generateDashboardSchema>;

export async function generateDashboardRoutes(app: FastifyInstance) {
  const pipeline = (app as unknown as { pipeline: Pipeline }).pipeline;

  /**
   * POST /api/generate-dashboard
   * Full pipeline: queries data from a dataset and generates a DashboardConfig.
   */
  app.post(
    '/',
    async (req: FastifyRequest<{ Body: GenerateDashboardBody }>, reply) => {
      const parsed = generateDashboardSchema.safeParse(req.body);

      if (!parsed.success) {
        reply.status(400);
        return {
          success: false,
          error: 'Invalid request body',
          details: parsed.error.flatten().fieldErrors,
        };
      }

      try {
        const dashboardConfig = await pipeline.generateDashboard(parsed.data);
        return { success: true, data: dashboardConfig };
      } catch (error) {
        reply.status(500);
        return { success: false, error: (error as Error).message };
      }
    },
  );
}

