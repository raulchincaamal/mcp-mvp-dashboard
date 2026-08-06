import type { McpClient } from './mcp-client.js';

/**
 * Pipeline orchestrator — executes the sequential MCP flow:
 *   MCP GCP Mock (data) → MCP UI (chart/dashboard/ui JSON config)
 *   Library Context → component catalog for dynamic UI generation
 */

export interface GenerateChartParams {
  dataset: string;
  chartType: 'bar' | 'line' | 'pie' | 'doughnut' | 'area';
  labelField: string;
  valueFields: string[];
  title?: string;
  filters?: Record<string, unknown>;
  limit?: number;
}

export interface GenerateDashboardParams {
  dataset: string;
  labelField: string;
  metrics: string[];
  title?: string;
  description?: string;
  layout?: 'grid' | 'vertical';
  columns?: number;
  filters?: Record<string, unknown>;
  limit?: number;
}

export interface GenerateUiParams {
  dataset: string;
  intent: string;
  title?: string;
  layout?: 'vertical' | 'grid';
  columns?: number;
  filters?: Record<string, unknown>;
  limit?: number;
}

export class Pipeline {
  constructor(
    private gcpClient: McpClient,
    private uiClient: McpClient,
    private libraryContextClient: McpClient,
  ) {}

  /**
   * List available datasets from MCP GCP Mock
   */
  async listDatasets(): Promise<unknown> {
    return this.gcpClient.callTool('list_datasets');
  }

  /**
   * Describe a specific dataset schema
   */
  async describeDataset(dataset: string): Promise<unknown> {
    return this.gcpClient.callTool('describe_dataset', { dataset });
  }

  /**
   * Query raw data from MCP GCP Mock
   */
  async queryData(
    dataset: string,
    filters?: Record<string, unknown>,
    limit?: number,
  ): Promise<unknown> {
    const args: Record<string, unknown> = { dataset };
    if (filters) args.filters = filters;
    if (limit) args.limit = limit;
    return this.gcpClient.callTool('query_data', args);
  }

  /**
   * Get the component catalog from library-context MCP.
   * Returns an array of available UI components with their metadata.
   */
  async getComponentCatalog(): Promise<
    { name: string; description?: string; props?: Record<string, unknown> }[]
  > {
    const libraryContext = (await this.libraryContextClient.callTool(
      'get_library_context',
      {
        library: '@macropaytd/lib-front-ui-components',
        section: 'QUICK-REF',
      },
    )) as string;

    // Parse the component names from the library context response
    // The library-context returns markdown; extract component names
    const components = parseComponentsFromContext(libraryContext);
    return components;
  }

  /**
   * Full pipeline: query data → generate single chart config
   */
  async generateChart(params: GenerateChartParams): Promise<unknown> {
    // Step 1: Get data from MCP GCP Mock
    const queryResult = (await this.queryData(
      params.dataset,
      params.filters,
      params.limit,
    )) as {
      records: Record<string, unknown>[];
    };

    // Step 2: Transform data into chart config via MCP UI
    const chartConfig = await this.uiClient.callTool('generate_chart', {
      chartType: params.chartType,
      records: queryResult.records,
      labelField: params.labelField,
      valueFields: params.valueFields,
      title: params.title,
    });

    return chartConfig;
  }

  /**
   * Full pipeline: query data → generate dashboard config with multiple charts
   */
  async generateDashboard(params: GenerateDashboardParams): Promise<unknown> {
    // Step 1: Get data from MCP GCP Mock
    const queryResult = (await this.queryData(
      params.dataset,
      params.filters,
      params.limit,
    )) as {
      records: Record<string, unknown>[];
    };

    // Step 2: Transform data into dashboard config via MCP UI
    const dashboardConfig = await this.uiClient.callTool('generate_dashboard', {
      title: params.title || `Dashboard: ${params.dataset}`,
      description: params.description,
      records: queryResult.records,
      labelField: params.labelField,
      metrics: params.metrics,
      layout: params.layout || 'grid',
      columns: params.columns || 2,
    });

    return dashboardConfig;
  }

  /**
   * Full pipeline: get component catalog + query data → generate dynamic UI config
   *
   * Flow:
   *   1. library-context → component catalog (what components exist)
   *   2. mcp-gcp-mock → data records
   *   3. mcp-ui generate_ui → UIConfig (declarative component tree)
   */
  async generateUi(params: GenerateUiParams): Promise<unknown> {
    // Step 1: Get available components from library-context
    const componentCatalog = await this.getComponentCatalog();

    // Step 2: Get data from MCP GCP Mock
    const queryResult = (await this.queryData(
      params.dataset,
      params.filters,
      params.limit,
    )) as {
      records: Record<string, unknown>[];
    };

    // Step 3: Generate UIConfig via MCP UI using components + data + intent
    const uiConfig = await this.uiClient.callTool('generate_ui', {
      intent: params.intent,
      records: queryResult.records,
      componentCatalog,
      title: params.title,
      layout: params.layout || 'vertical',
      columns: params.columns || 2,
    });

    return uiConfig;
  }
}

/**
 * Parses component information from library-context markdown response.
 * Extracts component names and descriptions from the QUICK-REF section.
 */
function parseComponentsFromContext(
  context: unknown,
): { name: string; description?: string; props?: Record<string, unknown> }[] {
  const text = typeof context === 'string' ? context : JSON.stringify(context);

  // Known components from @macropaytd/lib-front-ui-components
  // These are extracted from the library context or fall back to known defaults
  const knownComponents = [
    {
      name: 'Button',
      description:
        'Clickable button with variants: default, outline, ghost, destructive',
    },
    {
      name: 'Input',
      description: 'Text input field with label, placeholder, hint support',
    },
    { name: 'Card', description: 'Container card with padding and border' },
    {
      name: 'Badge',
      description:
        'Small label/tag with variants: default, secondary, destructive, outline',
    },
    {
      name: 'Text',
      description:
        'Typography component with size (xs, sm, base, lg, xl) and weight props',
    },
    { name: 'Table', description: 'Data table with columns and rows props' },
    {
      name: 'RadioGroup',
      description: 'Radio button group with options array',
    },
    { name: 'Checkbox', description: 'Checkbox with label and checked state' },
    { name: 'Avatar', description: 'User avatar with fallback text' },
    {
      name: 'DropdownMenu',
      description: 'Dropdown menu with trigger and items',
    },
    { name: 'ThemeToggle', description: 'Dark/light theme switch' },
    {
      name: 'DashboardLayout',
      description: 'Full page layout with sidebar, header, and content area',
    },
  ];

  // Try to extract additional components from the context text
  const componentPattern = /\*\*(\w+)\*\*/g;
  let match;
  const extractedNames = new Set(knownComponents.map((c) => c.name));

  while ((match = componentPattern.exec(text)) !== null) {
    const name = match[1];
    if (
      name &&
      name[0] === name[0].toUpperCase() &&
      !extractedNames.has(name)
    ) {
      knownComponents.push({ name, description: `Component: ${name}` });
      extractedNames.add(name);
    }
  }

  return knownComponents;
}

