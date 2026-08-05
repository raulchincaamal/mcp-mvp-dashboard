import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { listDatasets } from './tools/list-datasets.js';
import { queryData } from './tools/query-data.js';
import { describeDataset } from './tools/describe-dataset.js';

const server = new McpServer({
  name: 'mcp-gcp-mock',
  version: '0.1.0',
});

// Tool: list available datasets
server.tool(
  'list_datasets',
  'Lists all available datasets with their fields and record counts. Use this to discover what data is available before querying.',
  {},
  async () => {
    const datasets = listDatasets();

    const text = datasets
      .map((ds) => `**${ds.name}** (${ds.recordCount} records)\n  Fields: ${ds.fields.join(', ')}`)
      .join('\n\n');

    return { content: [{ type: 'text', text }] };
  },
);

// Tool: describe a specific dataset
server.tool(
  'describe_dataset',
  'Returns detailed schema information for a dataset including field names, types, and sample values.',
  {
    dataset: z.string().describe('Dataset name (e.g. "ventas-mensuales", "usuarios-activos", "metricas-producto")'),
  },
  async ({ dataset }) => {
    try {
      const description = describeDataset(dataset);

      const fieldsText = description.fields
        .map((f) => `  - **${f.name}** (${f.type}): sample = ${JSON.stringify(f.sample)}`)
        .join('\n');

      const text = `## ${description.name}\nRecords: ${description.recordCount}\n\nFields:\n${fieldsText}`;

      return { content: [{ type: 'text', text }] };
    } catch (error) {
      return { content: [{ type: 'text', text: (error as Error).message }], isError: true };
    }
  },
);

// Tool: query data from a dataset
server.tool(
  'query_data',
  'Queries a dataset and returns records. Supports optional filtering and limiting results. Returns data as JSON array ready for chart generation.',
  {
    dataset: z.string().describe('Dataset name (e.g. "ventas-mensuales")'),
    filters: z.record(z.unknown()).optional().describe('Key-value filters to apply (exact match). E.g. { "region": "Norte" }'),
    limit: z.number().optional().describe('Maximum number of records to return'),
  },
  async ({ dataset, filters, limit }) => {
    try {
      const result = queryData({ dataset, filters, limit });

      const text = JSON.stringify(result, null, 2);

      return { content: [{ type: 'text', text }] };
    } catch (error) {
      return { content: [{ type: 'text', text: (error as Error).message }], isError: true };
    }
  },
);

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
