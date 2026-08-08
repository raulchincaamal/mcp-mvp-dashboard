import type { McpClient } from './mcp-client.js';
import { interpretIntent } from './intent-interpreter.js';
import { generateCacheKey, cacheGet, cacheSet, TTL } from './cache.js';

/**
 * Pipeline orchestrator — executes the sequential MCP flow:
 *   LLM (interpret) → library-context (components) → mcp-gcp-mock (data) → mcp-ui (UIConfig)
 *
 * Cache layer (ioredis):
 *   - Intent parsing: cached 1 hour (same text = same structured query)
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
   * Full pipeline: interpret intent → get components → query data → generate UI
   */
  async generateUi(params: GenerateUiParams): Promise<unknown> {
    // ─── Check full response cache ───────────────────────────
    const requestKey = generateCacheKey('ui', {
      dataset: params.dataset,
      intent: params.intent,
      filters: params.filters,
      limit: params.limit,
    });
    const cachedResponse = await cacheGet<unknown>(requestKey);
    if (cachedResponse) return cachedResponse;

    // ─── Step 1: Interpret intent (cached) ───────────────────
    const intentKey = generateCacheKey('intent', params.intent);
    let parsed =
      await cacheGet<Awaited<ReturnType<typeof interpretIntent>>>(intentKey);
    if (!parsed) {
      parsed = await interpretIntent(params.intent);
      await cacheSet(intentKey, parsed, TTL.INTENT);
    }
    console.log('[pipeline] Interpreted intent:', JSON.stringify(parsed));

    // ─── Step 2: Get component catalog (cached) ──────────────
    const catalogKey = generateCacheKey('catalog', 'ui-components');
    let componentCatalog =
      await cacheGet<Awaited<ReturnType<typeof this.getComponentCatalog>>>(
        catalogKey,
      );
    if (!componentCatalog) {
      componentCatalog = await this.getComponentCatalog();
      await cacheSet(catalogKey, componentCatalog, TTL.CATALOG);
    }

    // ─── Step 3: Merge filters ───────────────────────────────
    const filters: Record<string, unknown> = {
      ...parsed.filters,
      ...params.filters,
    };
    const limit = params.limit || parsed.limit || 100;

    // ─── Step 4: Query data (not cached — data can change) ───
    const queryResult = (await this.queryData(
      params.dataset,
      Object.keys(filters).length > 0 ? filters : undefined,
      limit,
    )) as {
      records: Record<string, unknown>[];
    };

    // ─── Step 5: Generate UIConfig ───────────────────────────
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
      title: params.title || parsed.title,
      layout: params.layout || 'vertical',
      columns: params.columns || 2,
    });

    // ─── Cache the final response ────────────────────────────
    await cacheSet(requestKey, uiConfig, TTL.UI_CONFIG);

    return uiConfig;
  }

  // ─── Private helpers ───────────────────────────────────────

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
    const libraryContext = (await this.libraryContextClient.callTool(
      'get_library_context',
      {
        library: '@macropaytd/lib-front-ui-components',
        section: 'QUICK-REF',
      },
    )) as string;

    return parseComponentsFromContext(libraryContext);
  }
}

// ─── Component Catalog Parser ────────────────────────────────

function parseComponentsFromContext(
  context: unknown,
): { name: string; description?: string; props?: Record<string, unknown> }[] {
  const text = typeof context === 'string' ? context : JSON.stringify(context);

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
      description:
        'List of transaction items with title, subtitle, amount, date, status',
    },
    {
      name: 'MiniChart',
      description: 'Compact sparkline chart inside a card with title and value',
    },
    {
      name: 'DataSummary',
      description: 'Styled data table with hover effects',
    },
    {
      name: 'Chart',
      description:
        'Full Chart.js chart in a card (bar, line, pie, doughnut, area)',
    },
  ];

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

