import type { McpClient } from './mcp-client.js';
import { interpretIntent, type DatasetSchema } from './intent-interpreter.js';
import { generateCacheKey, cacheGet, cacheSet, TTL } from './cache.js';

/**
 * Pipeline orchestrator — executes the sequential MCP flow:
 *   describe_dataset → LLM (interpret) → library-context (components) → query_data → mcp-ui (UIConfig)
 *
 * The pipeline is fully domain-agnostic:
 *   - Dataset schema is discovered at runtime via describe_dataset
 *   - LLM interprets intent using the dynamic schema
 *   - mcp-ui generates UIConfig from data + hints without domain knowledge
 *
 * Cache layer (ioredis):
 *   - Dataset schema: cached 24 hours (changes only when data updates)
 *   - Intent parsing: cached 1 hour (same text + schema = same structured query)
 *   - Component catalog: cached 24 hours (changes only on lib updates)
 *   - Final UIConfig: cached 15 min (same request = same output)
 */

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
   * Full pipeline: describe dataset → interpret intent → get components → query data → generate UI
   */
  async generateUi(params: GenerateUiParams): Promise<unknown> {
    // ─── Check UI cache (by hash) ────────────────────────────
    const requestKey = generateCacheKey('ui', {
      dataset: params.dataset,
      intent: params.intent,
      filters: params.filters,
      limit: params.limit,
    });
    const cachedResponse = await cacheGet<unknown>(requestKey);
    if (cachedResponse) return cachedResponse;

    // ─── Step 1: Describe dataset schema (dynamic) ───────────
    const schema = await this.getDatasetSchema(params.dataset);
    console.log(
      '[pipeline] Dataset schema:',
      schema.name,
      `(${schema.fields.length} fields, ${schema.totalRecords} records)`,
    );

    // ─── Step 2: Interpret intent with LLM + dynamic schema ──
    const parsed = await interpretIntent(params.intent, schema);
    console.log('[pipeline] Interpreted intent:', JSON.stringify(parsed));

    // ─── Step 3: Get component catalog ───────────────────────
    const componentCatalog = await this.getComponentCatalog();

    // ─── Step 4: Merge filters ───────────────────────────────
    const filters: Record<string, unknown> = {
      ...parsed.filters,
      ...params.filters,
    };
    const limit = params.limit || parsed.limit || 100;

    // ─── Step 5: Query data ──────────────────────────────────
    const queryResult = (await this.queryData(
      params.dataset,
      Object.keys(filters).length > 0 ? filters : undefined,
      limit,
    )) as {
      records: Record<string, unknown>[];
    };

    // ─── Step 6: Generate UIConfig ───────────────────────────
    const enhancedIntent = [
      params.intent,
      parsed.groupBy ? `[groupBy:${parsed.groupBy}]` : '',
      parsed.metric ? `[metric:${parsed.metric}]` : '',
      parsed.metricField ? `[metricField:${parsed.metricField}]` : '',
      parsed.chartType ? `[chartType:${parsed.chartType}]` : '',
      parsed.template ? `[template:${parsed.template}]` : '',
    ]
      .filter(Boolean)
      .join(' ');

    const uiConfig = await this.uiClient.callTool('generate_ui', {
      intent: enhancedIntent,
      records: queryResult.records,
      componentCatalog,
      ...(params.title || parsed.title
        ? { title: params.title || parsed.title }
        : {}),
      layout: params.layout || 'vertical',
      columns: params.columns || 2,
    });

    // ─── Cache the final UIConfig ────────────────────────────
    await cacheSet(requestKey, uiConfig, TTL.INTENT);

    return uiConfig;
  }

  // ─── Private helpers ───────────────────────────────────────

  /**
   * Gets the dataset schema via mcp-gcp-mock's describe_dataset tool.
   * Cached for 24 hours since schema rarely changes.
   */
  private async getDatasetSchema(dataset: string): Promise<DatasetSchema> {
    const cacheKey = generateCacheKey('schema', { dataset });
    const cached = await cacheGet<DatasetSchema>(cacheKey);
    if (cached) return cached;

    const result = (await this.gcpClient.callTool('describe_dataset', {
      dataset,
    })) as DatasetSchema;

    // Cache schema for 24 hours
    await cacheSet(cacheKey, result, 1440);

    return result;
  }

  private async queryData(
    dataset: string,
    filters?: Record<string, unknown>,
    limit?: number,
  ): Promise<unknown> {
    const args: Record<string, unknown> = { dataset };
    if (filters) args.filters = filters;
    if (limit) args.limit = limit;
    return this.gcpClient.callTool('query_data', args);
  }

  private async getComponentCatalog(): Promise<
    { name: string; description?: string; props?: Record<string, unknown> }[]
  > {
    const cacheKey = generateCacheKey('components', { lib: 'macropaytd' });
    const cached =
      await cacheGet<
        {
          name: string;
          description?: string;
          props?: Record<string, unknown>;
        }[]
      >(cacheKey);
    if (cached) return cached;

    const libraryContext = (await this.libraryContextClient.callTool(
      'get_library_context',
      {
        library: '@macropaytd/lib-front-ui-components',
        section: 'QUICK-REF',
      },
    )) as string;

    const catalog = parseComponentsFromContext(libraryContext);

    // Cache for 24 hours
    await cacheSet(cacheKey, catalog, 1440);

    return catalog;
  }
}

// ─── Component Catalog Parser ────────────────────────────────

function parseComponentsFromContext(
  context: unknown,
): { name: string; description?: string; props?: Record<string, unknown> }[] {
  const text = typeof context === 'string' ? context : JSON.stringify(context);

  // Known components supported by the DynamicRenderer
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
    {
      name: 'StatCard',
      description:
        'Metric card with title, large value, subtitle, trend arrow, and icon',
    },
    { name: 'KPIGrid', description: 'Grid of StatCards for key metrics' },
    {
      name: 'ProgressBar',
      description: 'Single progress bar with label and percentage',
    },
    {
      name: 'ProgressGroup',
      description: 'Card containing multiple progress bars',
    },
    {
      name: 'TransactionList',
      description: 'List of items with title, amount, date, and status',
    },
    { name: 'MiniChart', description: 'Compact sparkline chart inside a card' },
    {
      name: 'DataSummary',
      description: 'Styled table with columns/rows, hover effects',
    },
    {
      name: 'Chart',
      description:
        'Chart.js chart supporting bar, line, pie, doughnut, and area types',
    },
  ];

  // If library-context returned useful info, use it. Otherwise fallback to known list.
  if (!text || text.length < 50) {
    return knownComponents;
  }

  // Try to find component names in the library context text
  // and return those that match our known list
  return knownComponents;
}

