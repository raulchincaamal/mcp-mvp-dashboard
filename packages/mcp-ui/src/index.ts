import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { generateChart } from './tools/generate-chart.js';
import { generateDashboard } from './tools/generate-dashboard.js';
import { listChartTypes } from './tools/list-chart-types.js';

const server = new McpServer({
  name: 'mcp-ui',
  version: '0.1.0',
});

// Tool: list supported chart types
server.tool(
  'list_chart_types',
  'Lists all supported chart types with descriptions and best-use-case recommendations. Call this to decide which chart type fits your data.',
  {},
  async () => {
    const types = listChartTypes();

    const text = types
      .map((t) => `**${t.type}**: ${t.description}\n  Best for: ${t.bestFor}\n  Min records: ${t.minRecords}`)
      .join('\n\n');

    return { content: [{ type: 'text', text }] };
  },
);

// Tool: generate a single chart config
server.tool(
  'generate_chart',
  'Transforms raw data records into a declarative Chart.js-compatible JSON config. The frontend can render this directly without further processing.',
  {
    chartType: z.enum(['bar', 'line', 'pie', 'doughnut', 'area']).describe('Type of chart to generate'),
    records: z.array(z.record(z.unknown())).describe('Array of data records from MCP GCP'),
    labelField: z.string().describe('Field name to use as labels (x-axis or segments)'),
    valueFields: z.array(z.string()).describe('Field names with numeric values to plot'),
    title: z.string().optional().describe('Chart title'),
  },
  async ({ chartType, records, labelField, valueFields, title }) => {
    try {
      const config = generateChart({ chartType, records, labelField, valueFields, title });

      return { content: [{ type: 'text', text: JSON.stringify(config, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text', text: `Error generating chart: ${(error as Error).message}` }], isError: true };
    }
  },
);

// Tool: generate a full dashboard config
server.tool(
  'generate_dashboard',
  'Generates a complete dashboard with multiple charts from a single dataset. Automatically infers the best chart type for each metric. Returns a JSON config the frontend can render as a full dashboard page.',
  {
    title: z.string().describe('Dashboard title'),
    description: z.string().optional().describe('Dashboard description'),
    records: z.array(z.record(z.unknown())).describe('Array of data records from MCP GCP'),
    labelField: z.string().describe('Field name to group/label by (e.g. "mes", "region")'),
    metrics: z.array(z.string()).describe('Numeric field names to create charts for'),
    layout: z.enum(['grid', 'vertical']).optional().describe('Dashboard layout (default: grid)'),
    columns: z.number().optional().describe('Number of columns for grid layout (default: 2)'),
  },
  async ({ title, description, records, labelField, metrics, layout, columns }) => {
    try {
      const config = generateDashboard({
        title,
        description,
        records,
        labelField,
        metrics,
        layout,
        columns,
      });

      return { content: [{ type: 'text', text: JSON.stringify(config, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text', text: `Error generating dashboard: ${(error as Error).message}` }], isError: true };
    }
  },
);

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
