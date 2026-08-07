import type { McpClient } from './mcp-client.js';
import { interpretIntent } from './intent-interpreter.js';

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
   *   1. LLM interprets intent → structured query (filters, groupBy, metric, etc.)
   *   2. library-context → component catalog (what components exist)
   *   3. mcp-gcp-mock → data records (with inferred filters + limit)
   *   4. mcp-ui generate_ui → UIConfig (declarative component tree)
   */
  async generateUi(params: GenerateUiParams): Promise<unknown> {
    // Step 1: Interpret intent with LLM (Bedrock Claude Haiku)
    const parsed = await interpretIntent(params.intent);
    console.log('[pipeline] Interpreted intent:', JSON.stringify(parsed));

    // Step 2: Get available components from library-context
    const componentCatalog = await this.getComponentCatalog();

    // Step 3: Merge explicit params with LLM-inferred params
    const filters: Record<string, unknown> = {
      ...parsed.filters,
      ...params.filters,
    };
    const limit = params.limit || parsed.limit || 100;

    // Step 4: Get data from MCP GCP Mock
    const queryResult = (await this.queryData(
      params.dataset,
      Object.keys(filters).length > 0 ? filters : undefined,
      limit,
    )) as {
      records: Record<string, unknown>[];
    };

    // Step 5: Build enhanced intent with parsed metadata for mcp-ui
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
    // Composite rich components (rendered by DynamicRenderer)
    {
      name: 'StatCard',
      description:
        'Metric card with title, large value, subtitle, trend arrow, and icon. Props: title, value, subtitle?, trend?, trendDirection?(up|down|neutral), icon?',
    },
    {
      name: 'KPIGrid',
      description:
        'Grid of StatCards for key metrics. Props: items (array of StatCard props)',
    },
    {
      name: 'ProgressBar',
      description:
        'Single progress bar with label and percentage. Props: label, value(0-100), color?, showValue?',
    },
    {
      name: 'ProgressGroup',
      description:
        'Card containing multiple progress bars. Props: title?, items (array of {label, value, color?})',
    },
    {
      name: 'TransactionList',
      description:
        'List of transaction items with title, subtitle, amount, date, status. Props: title?, items (array of {title, subtitle?, amount, date?, status?(positive|negative|neutral)})',
    },
    {
      name: 'MiniChart',
      description:
        'Compact sparkline chart inside a card with title and value. Props: title, value, data (number[]), color?',
    },
    {
      name: 'DataSummary',
      description:
        'Styled data table with hover effects. Props: title?, columns (array of {key, label}), rows (array of records), highlightFirst?',
    },
    {
      name: 'Chart',
      description:
        'Full Chart.js chart in a card. Props: type(bar|line|pie|doughnut|area), title?, data({labels, datasets}), options?',
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

/**
 * Extracts a numeric limit from a natural language intent.
 * Matches patterns like "últimas 10", "top 20", "primeros 5", "50 ventas", etc.
 */
function extractLimitFromIntent(intent: string): number | null {
  const patterns = [
    /(?:últim[oa]s?|ultim[oa]s?)\s+(\d+)/i,
    /\btop\s+(\d+)/i,
    /(?:primer[oa]s?)\s+(\d+)/i,
    /\b(?:las?|los)\s+(\d+)\s+\w+/i,
    /(\d+)\s+(?:últim[oa]s?|ultim[oa]s?|primer[oa]s?)/i,
    /(?:muestra|mostrar|ver|dame)\s+(\d+)/i,
    /(?:limit[ea]?|máximo|maximo|max)\s+(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = intent.match(pattern);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > 0 && num <= 5000) return num;
    }
  }

  return null;
}

/**
 * Extracts date range filters from a natural language intent.
 * Returns a filter object for the "fecha_venta" field if a date/month reference is found.
 *
 * Supported patterns:
 *   - "en Julio", "del mes de Julio", "Julio 2025"
 *   - "en enero 2024", "de marzo"
 *   - "este mes", "mes anterior", "mes pasado"
 */
function extractDateFiltersFromIntent(
  intent: string,
): Record<string, unknown> | null {
  const MONTHS: Record<string, string> = {
    enero: '01',
    febrero: '02',
    marzo: '03',
    abril: '04',
    mayo: '05',
    junio: '06',
    julio: '07',
    agosto: '08',
    septiembre: '09',
    octubre: '10',
    noviembre: '11',
    diciembre: '12',
  };

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // Match "mes anterior" / "mes pasado"
  if (/mes\s+(?:anterior|pasado)/i.test(intent)) {
    const targetMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const targetYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    return buildMonthFilter(targetYear, targetMonth);
  }

  // Match "este mes"
  if (/este\s+mes/i.test(intent)) {
    return buildMonthFilter(currentYear, currentMonth);
  }

  // Match "en [month] [year?]" or "del mes de [month]" or "de [month] [year?]"
  const monthPattern =
    /(?:en|del?\s+mes\s+de|de)\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)(?:\s+(\d{4}))?/i;
  const monthMatch = intent.match(monthPattern);
  if (monthMatch) {
    const monthName = monthMatch[1].toLowerCase();
    const month = parseInt(MONTHS[monthName], 10);
    let year = monthMatch[2] ? parseInt(monthMatch[2], 10) : currentYear;
    // If the month hasn't happened yet this year, assume previous year
    if (!monthMatch[2] && month > currentMonth) {
      year = currentYear - 1;
    }
    return buildMonthFilter(year, month);
  }

  // Match standalone month name (e.g. "Julio" capitalized)
  for (const [name, num] of Object.entries(MONTHS)) {
    const regex = new RegExp(`\\b${name}\\b(?:\\s+(\\d{4}))?`, 'i');
    const match = intent.match(regex);
    if (match) {
      const month = parseInt(num, 10);
      let year = match[1] ? parseInt(match[1], 10) : currentYear;
      // If the month hasn't happened yet this year, assume previous year
      if (!match[1] && month > currentMonth) {
        year = currentYear - 1;
      }
      return buildMonthFilter(year, month);
    }
  }

  return null;
}

function buildMonthFilter(
  year: number,
  month: number,
): Record<string, unknown> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  return {
    fecha_venta: { gte: startDate, lte: endDate },
  };
}

/**
 * Extracts category filter from intent based on known product categories.
 */
function extractCategoryFilterFromIntent(
  intent: string,
): Record<string, unknown> | null {
  const categoryMap: Record<string, string> = {
    moto: 'Motos',
    motos: 'Motos',
    celular: 'Celulares',
    celulares: 'Celulares',
    teléfono: 'Celulares',
    telefono: 'Celulares',
    bicicleta: 'Bicicletas Eléctricas',
    bicicletas: 'Bicicletas Eléctricas',
    bici: 'Bicicletas Eléctricas',
    pantalla: 'Pantallas/TV',
    pantallas: 'Pantallas/TV',
    tv: 'Pantallas/TV',
    televisor: 'Pantallas/TV',
    audio: 'Audio',
    bocina: 'Audio',
    bafle: 'Audio',
    tablet: 'Tablets',
    tablets: 'Tablets',
    tableta: 'Tablets',
    consola: 'Consolas',
    consolas: 'Consolas',
    nintendo: 'Consolas',
    switch: 'Consolas',
    climatización: 'Climatización',
    climatizacion: 'Climatización',
    aire: 'Climatización',
    ventilador: 'Climatización',
    accesorio: 'Accesorios',
    accesorios: 'Accesorios',
    hielera: 'Accesorios',
  };

  const intentLower = intent.toLowerCase();

  for (const [keyword, category] of Object.entries(categoryMap)) {
    if (intentLower.includes(keyword)) {
      return { categoria: category };
    }
  }

  return null;
}

