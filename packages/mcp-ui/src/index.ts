import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { generateUi, validateUiConfig } from './tools/generate-ui.js';

const server = new McpServer({
  name: 'mcp-ui',
  version: '0.2.0',
});

// Tool: generate dynamic UI config from components + data + intent
server.tool(
  'generate_ui',
  'Generates a declarative UIConfig from data records + intent hints. Domain-agnostic: uses data inspection and LLM-provided hints ([groupBy:X], [metric:Y], [chartType:Z], [template:T]) to decide structure. Returns JSON that a frontend DynamicRenderer maps to real components.',
  {
    intent: z
      .string()
      .describe(
        'Natural language intent with optional LLM hints in brackets: [groupBy:field] [metric:sum|avg|count|max|min] [metricField:field1,field2] [chartType:bar|line|pie|doughnut|area] [template:dashboard|chart|table|kpi|cards] [sortBy:field] [limit:N]',
      ),
    records: z
      .array(z.record(z.unknown()))
      .describe(
        'Array of data records (any schema — fields are auto-detected)',
      ),
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
      .describe(
        'Available UI components from library-context (used to filter which components to generate)',
      ),
    title: z
      .string()
      .optional()
      .describe('Override title for the generated UI'),
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

// Tool: validate a pre-built UIConfig (e.g. from an LLM)
server.tool(
  'validate_ui',
  'Validates a UIConfig JSON object against the expected schema. Use this when the LLM generates the UIConfig directly and you need to verify it before sending to the frontend.',
  {
    config: z
      .record(z.unknown())
      .describe(
        'The UIConfig object to validate (must have title, layout, components[])',
      ),
  },
  async ({ config }) => {
    const result = validateUiConfig(config);

    if (result.valid) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              { valid: true, config: result.config },
              null,
              2,
            ),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            { valid: false, errors: result.errors },
            null,
            2,
          ),
        },
      ],
      isError: true,
    };
  },
);

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);

