import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { listDatasets } from './tools/list-datasets.js';
import { queryData } from './tools/query-data.js';

const server = new McpServer({
  name: 'mcp-gcp-mock',
  version: '0.1.0',
});

// Tool: list available datasets
server.tool(
  'list_datasets',
  'Lists all available datasets with their fields and record counts.',
  {},
  async () => {
    const datasets = listDatasets();

    const text = datasets
      .map(
        (ds) =>
          `**${ds.name}** (${ds.recordCount} records)\n  Fields: ${ds.fields.join(', ')}`,
      )
      .join('\n\n');

    return { content: [{ type: 'text', text }] };
  },
);

// Tool: query data from a dataset
server.tool(
  'query_data',
  'Queries a dataset and returns records. Supports exact match and range filters. Returns data as JSON array.',
  {
    dataset: z.string().describe('Dataset name (e.g. "ventas-credito")'),
    filters: z
      .record(z.unknown())
      .optional()
      .describe('Filters: exact match or range ({gte, lte, gt, lt})'),
    limit: z
      .number()
      .optional()
      .describe('Maximum number of records to return'),
  },
  async ({ dataset, filters, limit }) => {
    try {
      const result = queryData({ dataset, filters, limit });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: (error as Error).message }],
        isError: true,
      };
    }
  },
);

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);

