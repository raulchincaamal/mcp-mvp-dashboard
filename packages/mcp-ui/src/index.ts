import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { generateUi } from './tools/generate-ui.js';

const server = new McpServer({
  name: 'mcp-ui',
  version: '0.1.0',
});

// Tool: generate dynamic UI config from components + data + intent
server.tool(
  'generate_ui',
  'Generates a declarative UIConfig using available UI components. The frontend DynamicRenderer maps this JSON to real React components. Supports KPI grids, charts, tables, progress bars, transaction lists, and more.',
  {
    intent: z
      .string()
      .describe(
        'What the user wants to see — includes LLM hints like [groupBy:estado] [metric:count] [template:chart]',
      ),
    records: z
      .array(z.record(z.unknown()))
      .describe('Array of data records from MCP GCP'),
    componentCatalog: z
      .array(
        z.object({
          name: z.string().describe('Component name'),
          description: z
            .string()
            .optional()
            .describe('What the component does'),
          props: z.record(z.unknown()).optional().describe('Available props'),
        }),
      )
      .describe('Available UI components from library-context'),
    title: z.string().optional().describe('UI section title'),
    layout: z
      .enum(['vertical', 'grid'])
      .optional()
      .describe('Layout mode (default: vertical)'),
    columns: z.number().optional().describe('Grid columns (default: 2)'),
  },
  async ({ intent, records, componentCatalog, title, layout, columns }) => {
    try {
      const config = generateUi({
        intent,
        records,
        componentCatalog,
        title,
        layout,
        columns,
      });

      return {
        content: [{ type: 'text', text: JSON.stringify(config, null, 2) }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error generating UI: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);

