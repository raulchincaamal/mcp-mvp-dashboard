import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Pipeline } from '../pipeline.js';

const generateChartSchema = z.object({
  dataset: z.string(),
  chartType: z.enum(['bar', 'line', 'pie', 'doughnut', 'area']),
  labelField: z.string(),
  valueFields: z.array(z.string()).min(1),
  title: z.string().optional(),
  filters: z.record(z.unknown()).optional(),
  limit: z.number().positive().optional(),
});

type GenerateChartBody = z.infer<typeof generateChartSchema>;

export async function generateChartRoutes(app: FastifyInstance) {
  const pipeline = (app as unknown as { pipeline: Pipeline }).pipeline;

  /**
   * POST /api/generate-chart
   * Full pipeline: queries data from a dataset and generates a Chart.js config.
   */
  app.post(
    '/',
    async (req: FastifyRequest<{ Body: GenerateChartBody }>, reply) => {
      const parsed = generateChartSchema.safeParse(req.body);

      if (!parsed.success) {
        reply.status(400);
        return {
          success: false,
          error: 'Invalid request body',
          details: parsed.error.flatten().fieldErrors,
        };
      }

      try {
        const chartConfig = await pipeline.generateChart(parsed.data);
        return { success: true, data: chartConfig };
      } catch (error) {
        reply.status(500);
        return { success: false, error: (error as Error).message };
      }
    },
  );
}

