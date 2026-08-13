/**
 * generate-ui: Domain-agnostic UIConfig generator.
 *
 * Transforms raw data records + intent hints + component catalog into a declarative
 * UIConfig JSON that the frontend DynamicRenderer can render.
 *
 * This module has ZERO knowledge of specific datasets or business domains.
 * It makes decisions purely based on:
 *   1. Data inspection (field types, cardinality, value ranges)
 *   2. Intent hints provided by the LLM ([groupBy:X], [metric:Y], [chartType:Z], etc.)
 *   3. The component catalog (what components are available to render)
 *
 * The LLM (in mcp-main) is responsible for domain understanding.
 * This module is responsible for structural/visual decisions.
 */

// ─── Types ─────────────────────────────────────────────────

export interface ComponentSpec {
  name: string;
  description?: string;
  props?: Record<string, unknown>;
}

export interface UIComponentConfig {
  component: string;
  props: Record<string, unknown>;
  children?: (UIComponentConfig | string)[];
}

export interface UIConfig {
  title: string;
  description?: string;
  layout: 'vertical' | 'grid';
  columns?: number;
  components: UIComponentConfig[];
}

export interface GenerateUiParams {
  intent: string;
  records: Record<string, unknown>[];
  componentCatalog: ComponentSpec[];
  title?: string;
  layout?: 'vertical' | 'grid';
  columns?: number;
}

// ─── Field Analysis ────────────────────────────────────────

interface FieldInfo {
  name: string;
  type: 'number' | 'string' | 'boolean' | 'date' | 'unknown';
  uniqueValues: number;
  sample: unknown[];
}

interface DataProfile {
  totalRecords: number;
  fields: FieldInfo[];
  numericFields: FieldInfo[];
  categoricalFields: FieldInfo[];
  dateFields: FieldInfo[];
}

/**
 * Inspects records to build a data profile without any domain assumptions.
 */
function profileData(records: Record<string, unknown>[]): DataProfile {
  if (records.length === 0) {
    return {
      totalRecords: 0,
      fields: [],
      numericFields: [],
      categoricalFields: [],
      dateFields: [],
    };
  }

  const sampleSize = Math.min(records.length, 100);
  const sample = records.slice(0, sampleSize);
  const fieldNames = Object.keys(records[0]);

  const fields: FieldInfo[] = fieldNames.map((name) => {
    const values = sample.map((r) => r[name]);
    const nonNull = values.filter((v) => v !== null && v !== undefined);
    const uniqueValues = new Set(nonNull.map(String)).size;

    let type: FieldInfo['type'] = 'unknown';

    if (nonNull.length > 0) {
      const first = nonNull[0];
      if (typeof first === 'number') {
        type = 'number';
      } else if (typeof first === 'boolean') {
        type = 'boolean';
      } else if (typeof first === 'string') {
        // Detect dates: ISO format YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
        if (/^\d{4}-\d{2}-\d{2}/.test(first)) {
          type = 'date';
        } else {
          type = 'string';
        }
      }
    }

    return { name, type, uniqueValues, sample: nonNull.slice(0, 5) };
  });

  const numericFields = fields.filter((f) => f.type === 'number');
  const categoricalFields = fields.filter(
    (f) => f.type === 'string' && f.uniqueValues <= Math.min(50, sampleSize),
  );
  const dateFields = fields.filter((f) => f.type === 'date');

  return {
    totalRecords: records.length,
    fields,
    numericFields,
    categoricalFields,
    dateFields,
  };
}

// ─── Hint Extraction ───────────────────────────────────────

interface IntentHints {
  groupBy: string | null;
  metric: string | null;
  metricField: string | null;
  chartType: string | null;
  template: string | null;
  sortBy: string | null;
  sortOrder: string | null;
  limit: number | null;
  components: string[] | null;
}

function extractHints(intent: string): IntentHints {
  return {
    groupBy: extractHint(intent, 'groupBy'),
    metric: extractHint(intent, 'metric'),
    metricField: extractHint(intent, 'metricField'),
    chartType: extractHint(intent, 'chartType'),
    template: extractHint(intent, 'template'),
    sortBy: extractHint(intent, 'sortBy'),
    sortOrder: extractHint(intent, 'sortOrder'),
    limit: extractHint(intent, 'limit')
      ? Number(extractHint(intent, 'limit'))
      : null,
    components:
      extractHint(intent, 'components')
        ?.split(',')
        .map((s) => s.trim()) || null,
  };
}

function extractHint(intent: string, key: string): string | null {
  const regex = new RegExp(`\\[${key}:([^\\]]+)\\]`);
  const match = intent.match(regex);
  return match ? match[1] : null;
}

function stripHints(intent: string): string {
  return intent.replace(/\s*\[\w+:[^\]]+\]/g, '').trim();
}

// ─── Main Entry ────────────────────────────────────────────

export function generateUi(params: GenerateUiParams): UIConfig {
  const {
    intent,
    records,
    componentCatalog,
    title,
    layout = 'vertical',
    columns = 2,
  } = params;

  if (!records || records.length === 0) {
    return {
      title: title || 'No Data',
      description: `No records found for: "${stripHints(intent)}"`,
      layout,
      columns,
      components: [],
    };
  }

  const profile = profileData(records);
  const hints = extractHints(intent);
  const available = new Set(componentCatalog.map((c) => c.name));

  // Determine what to build based on LLM hints
  const template = hints.template || inferTemplate(profile, hints);

  switch (template) {
    case 'kpi':
      return buildKpiLayout(
        records,
        profile,
        hints,
        available,
        title,
        layout,
        columns,
        intent,
      );
    case 'chart':
      return buildChartLayout(
        records,
        profile,
        hints,
        available,
        title,
        layout,
        columns,
        intent,
      );
    case 'table':
      return buildTableLayout(
        records,
        profile,
        hints,
        available,
        title,
        layout,
        columns,
        intent,
      );
    case 'cards':
      return buildCardsLayout(
        records,
        profile,
        hints,
        available,
        title,
        layout,
        columns,
        intent,
      );
    case 'executive':
    case 'dashboard':
      return buildDashboardLayout(
        records,
        profile,
        hints,
        available,
        title,
        layout,
        columns,
        intent,
      );
    default:
      return buildDashboardLayout(
        records,
        profile,
        hints,
        available,
        title,
        layout,
        columns,
        intent,
      );
  }
}

// ─── Template Inference (no domain knowledge) ──────────────

function inferTemplate(profile: DataProfile, hints: IntentHints): string {
  // If LLM explicitly requested specific components, build a dashboard
  if (hints.components) return 'dashboard';

  // If there's a groupBy + metric, it's likely a chart
  if (hints.groupBy && hints.metric) return 'chart';

  // If there are no numeric fields, default to table
  if (profile.numericFields.length === 0) return 'table';

  // If few categorical fields + multiple numeric fields → KPI/dashboard
  if (
    profile.numericFields.length >= 3 &&
    profile.categoricalFields.length >= 1
  ) {
    return 'dashboard';
  }

  // If many records + few fields → table
  if (profile.totalRecords > 50 && profile.fields.length <= 5) return 'table';

  // Default to dashboard (most complete)
  return 'dashboard';
}

// ─── Layout Builders ───────────────────────────────────────

function buildKpiLayout(
  records: Record<string, unknown>[],
  profile: DataProfile,
  hints: IntentHints,
  available: Set<string>,
  title: string | undefined,
  layout: 'vertical' | 'grid',
  columns: number,
  intent: string,
): UIConfig {
  const components: UIComponentConfig[] = [];

  // Build KPI items from numeric fields
  const metricFields = resolveMetricFields(hints, profile);
  const kpiItems = buildKpiItems(records, metricFields, hints.metric || 'sum');

  if (kpiItems.length > 0 && isAvailable(available, 'KPIGrid')) {
    components.push({ component: 'KPIGrid', props: { items: kpiItems } });
  }

  return {
    title: title || 'Key Metrics',
    description: `Generated for: "${stripHints(intent)}"`,
    layout,
    columns,
    components,
  };
}

function buildChartLayout(
  records: Record<string, unknown>[],
  profile: DataProfile,
  hints: IntentHints,
  available: Set<string>,
  title: string | undefined,
  layout: 'vertical' | 'grid',
  columns: number,
  intent: string,
): UIConfig {
  const components: UIComponentConfig[] = [];

  const groupByField = resolveGroupByField(hints, profile);
  const metricFields = resolveMetricFields(hints, profile);
  const chartType = hints.chartType || inferChartType(profile, groupByField);
  const metric = hints.metric || 'sum';

  if (
    groupByField &&
    metricFields.length > 0 &&
    isAvailable(available, 'Chart')
  ) {
    const chartComponent = buildChartComponent(
      records,
      groupByField,
      metricFields,
      metric,
      chartType,
    );
    components.push(chartComponent);
  } else if (metricFields.length > 0 && isAvailable(available, 'Chart')) {
    // No group by — show distribution or time series
    const labelField =
      profile.dateFields[0]?.name || profile.categoricalFields[0]?.name;
    if (labelField) {
      const chartComponent = buildChartComponent(
        records,
        labelField,
        metricFields,
        metric,
        chartType,
      );
      components.push(chartComponent);
    }
  }

  return {
    title: title || 'Chart',
    description: `Generated for: "${stripHints(intent)}"`,
    layout,
    columns,
    components,
  };
}

function buildTableLayout(
  records: Record<string, unknown>[],
  profile: DataProfile,
  hints: IntentHints,
  available: Set<string>,
  title: string | undefined,
  layout: 'vertical' | 'grid',
  columns: number,
  intent: string,
): UIConfig {
  const limit = hints.limit || 50;
  const displayRecords = records.slice(0, limit);

  // Select columns: prioritize fields that are informative
  const selectedFields = profile.fields
    .filter((f) => f.uniqueValues > 1) // Skip constant fields
    .slice(0, 8);

  const tableColumns = selectedFields.map((f) => ({
    key: f.name,
    label: formatLabel(f.name),
  }));

  const component: UIComponentConfig = {
    component: 'DataSummary',
    props: {
      title: title || 'Data Records',
      columns: tableColumns,
      rows: displayRecords,
    },
  };

  return {
    title: title || 'Data Records',
    description: `Generated for: "${stripHints(intent)}" (${records.length} records)`,
    layout,
    columns,
    components: isAvailable(available, 'DataSummary') ? [component] : [],
  };
}

function buildCardsLayout(
  records: Record<string, unknown>[],
  profile: DataProfile,
  hints: IntentHints,
  available: Set<string>,
  title: string | undefined,
  layout: 'vertical' | 'grid',
  columns: number,
  intent: string,
): UIConfig {
  const limit = hints.limit || 12;
  const displayRecords = records.slice(0, limit);

  // Use first string field as title, second as subtitle, first numeric as amount
  const titleField =
    profile.categoricalFields[0]?.name ||
    profile.fields.find((f) => f.type === 'string')?.name;
  const subtitleField = profile.categoricalFields[1]?.name;
  const amountField = profile.numericFields[0]?.name;
  const dateField = profile.dateFields[0]?.name;

  const items = displayRecords.map((r) => ({
    title: titleField ? String(r[titleField] || '') : '',
    subtitle: subtitleField ? String(r[subtitleField] || '') : undefined,
    amount: amountField ? formatValue(Number(r[amountField]) || 0) : '',
    date: dateField ? String(r[dateField] || '') : undefined,
    status: 'neutral' as const,
  }));

  const component: UIComponentConfig = {
    component: 'TransactionList',
    props: { title: title || 'Records', items },
  };

  return {
    title: title || 'Records',
    description: `Generated for: "${stripHints(intent)}"`,
    layout: 'grid',
    columns,
    components: isAvailable(available, 'TransactionList') ? [component] : [],
  };
}

function buildDashboardLayout(
  records: Record<string, unknown>[],
  profile: DataProfile,
  hints: IntentHints,
  available: Set<string>,
  title: string | undefined,
  layout: 'vertical' | 'grid',
  columns: number,
  intent: string,
): UIConfig {
  const components: UIComponentConfig[] = [];
  const groupByField = resolveGroupByField(hints, profile);
  const metricFields = resolveMetricFields(hints, profile);
  const metric = hints.metric || 'sum';

  // ─── Section 1: KPIs (summary of numeric fields) ────────
  if (isAvailable(available, 'KPIGrid') && metricFields.length > 0) {
    const kpiItems = buildKpiItems(records, metricFields, metric);
    if (kpiItems.length > 0) {
      components.push({ component: 'KPIGrid', props: { items: kpiItems } });
    }
  }

  // ─── Section 2: Main Chart (grouped data) ───────────────
  if (
    isAvailable(available, 'Chart') &&
    groupByField &&
    metricFields.length > 0
  ) {
    const chartType = hints.chartType || inferChartType(profile, groupByField);
    const chartComponent = buildChartComponent(
      records,
      groupByField,
      metricFields,
      metric,
      chartType,
    );
    components.push(chartComponent);
  }

  // ─── Section 3: Distribution chart (if categorical field with low cardinality) ──
  if (
    isAvailable(available, 'Chart') &&
    profile.categoricalFields.length > 0 &&
    metricFields.length > 0
  ) {
    const distField = profile.categoricalFields.find(
      (f) =>
        f.uniqueValues >= 2 && f.uniqueValues <= 8 && f.name !== groupByField,
    );
    if (distField) {
      const distComponent = buildDistributionChart(
        records,
        distField.name,
        metricFields[0],
        metric,
      );
      components.push(distComponent);
    }
  }

  // ─── Section 4: Progress bars (for percentage-like distributions) ──
  if (isAvailable(available, 'ProgressGroup') && groupByField) {
    const progressComponent = buildProgressSection(
      records,
      groupByField,
      metricFields[0],
      metric,
    );
    if (progressComponent) {
      components.push(progressComponent);
    }
  }

  // ─── Section 5: Top N Table (if enough records) ─────────
  if (
    isAvailable(available, 'DataSummary') &&
    records.length > 10 &&
    groupByField &&
    metricFields.length > 0
  ) {
    const tableComponent = buildAggregatedTable(
      records,
      groupByField,
      metricFields,
      metric,
      hints.limit || 10,
    );
    components.push(tableComponent);
  }

  return {
    title: title || 'Dashboard',
    description: `Generated for: "${stripHints(intent)}"`,
    layout,
    columns,
    components,
  };
}

// ─── Component Builders (generic) ──────────────────────────

function buildKpiItems(
  records: Record<string, unknown>[],
  metricFields: string[],
  metric: string,
): {
  title: string;
  value: string;
  subtitle: string;
  trend: string;
  trendDirection: 'up' | 'down' | 'neutral';
  icon: string;
}[] {
  const items: {
    title: string;
    value: string;
    subtitle: string;
    trend: string;
    trendDirection: 'up' | 'down' | 'neutral';
    icon: string;
  }[] = [];

  // Total records KPI
  items.push({
    title: 'Total Records',
    value: formatNumber(records.length),
    subtitle: `${records.length} entries`,
    trend: '',
    trendDirection: 'neutral',
    icon: '📋',
  });

  // One KPI per metric field
  for (const field of metricFields.slice(0, 4)) {
    const values = records.map((r) => Number(r[field]) || 0);
    const total = values.reduce((a, b) => a + b, 0);
    const avg = total / values.length;
    const max = Math.max(...values);
    const min = Math.min(...values);

    let displayValue: string;
    let subtitle: string;

    switch (metric) {
      case 'avg':
        displayValue = formatValue(avg);
        subtitle = `Total: ${formatValue(total)}`;
        break;
      case 'count':
        displayValue = formatNumber(records.length);
        subtitle = `Sum: ${formatValue(total)}`;
        break;
      case 'max':
        displayValue = formatValue(max);
        subtitle = `Avg: ${formatValue(avg)}`;
        break;
      case 'min':
        displayValue = formatValue(min);
        subtitle = `Avg: ${formatValue(avg)}`;
        break;
      default: // sum
        displayValue = formatValue(total);
        subtitle = `Avg: ${formatValue(avg)}`;
    }

    items.push({
      title: formatLabel(field),
      value: displayValue,
      subtitle,
      trend: `${records.length} records`,
      trendDirection: 'neutral',
      icon: '📊',
    });
  }

  return items;
}

function buildChartComponent(
  records: Record<string, unknown>[],
  groupByField: string,
  metricFields: string[],
  metric: string,
  chartType: string,
): UIComponentConfig {
  const aggregated = aggregateByField(records, groupByField, metricFields);
  const countByGroup = countByField(records, groupByField);

  // Sort by first metric descending
  const sortedKeys = Object.keys(aggregated).sort((a, b) => {
    const valA = metricFields[0] ? aggregated[a]?.[metricFields[0]] || 0 : 0;
    const valB = metricFields[0] ? aggregated[b]?.[metricFields[0]] || 0 : 0;
    return valB - valA;
  });
  const labels = sortedKeys.slice(0, 15);
  const colors = CHART_COLORS;

  const datasets =
    metric === 'count'
      ? [
          {
            label: 'Count',
            data: labels.map((l) => countByGroup[l] || 0),
            backgroundColor: colors[0],
            borderColor: colors[0],
            borderWidth: 2,
          },
        ]
      : metricFields.map((field, i) => ({
          label: formatLabel(field),
          data: labels.map((l) => {
            const val = aggregated[l]?.[field] || 0;
            if (metric === 'avg')
              return Math.round(val / (countByGroup[l] || 1));
            return val;
          }),
          backgroundColor: colors[i % colors.length],
          borderColor: colors[i % colors.length],
          borderWidth: 2,
        }));

  return {
    component: 'Chart',
    props: {
      type: chartType,
      title: `${metricFields.map(formatLabel).join(' / ')} by ${formatLabel(groupByField)}`,
      data: { labels, datasets },
      options: {
        responsive: true,
        xAxis: { label: formatLabel(groupByField) },
        yAxis: { label: metricFields.map(formatLabel).join(' / ') },
      },
    },
  };
}

function buildDistributionChart(
  records: Record<string, unknown>[],
  categoryField: string,
  metricField: string,
  metric: string,
): UIComponentConfig {
  const aggregated = aggregateByField(records, categoryField, [metricField]);
  const countByGroup = countByField(records, categoryField);
  const labels = Object.keys(aggregated).slice(0, 10);
  const colors = CHART_COLORS;

  const data =
    metric === 'count'
      ? labels.map((l) => countByGroup[l] || 0)
      : labels.map((l) => {
          const val = aggregated[l]?.[metricField] || 0;
          if (metric === 'avg') return Math.round(val / (countByGroup[l] || 1));
          return val;
        });

  return {
    component: 'Chart',
    props: {
      type: 'doughnut',
      title: `Distribution by ${formatLabel(categoryField)}`,
      data: {
        labels,
        datasets: [
          {
            label: formatLabel(metricField),
            data,
            backgroundColor: colors.slice(0, labels.length),
            borderWidth: 2,
          },
        ],
      },
      options: { responsive: true },
    },
  };
}

function buildProgressSection(
  records: Record<string, unknown>[],
  groupByField: string,
  metricField: string | undefined,
  metric: string,
): UIComponentConfig | null {
  if (!metricField) return null;

  const countByGroup = countByField(records, groupByField);
  const total = records.length;

  // Only show progress if there are between 2 and 10 groups
  const groups = Object.entries(countByGroup);
  if (groups.length < 2 || groups.length > 10) return null;

  const items = groups
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({
      label: `${label} (${count})`,
      value: Math.round((count / total) * 100),
      color: 'bg-primary',
    }));

  return {
    component: 'ProgressGroup',
    props: {
      title: `Distribution by ${formatLabel(groupByField)}`,
      items,
    },
  };
}

function buildAggregatedTable(
  records: Record<string, unknown>[],
  groupByField: string,
  metricFields: string[],
  metric: string,
  limit: number,
): UIComponentConfig {
  const aggregated = aggregateByField(records, groupByField, metricFields);
  const countByGroup = countByField(records, groupByField);

  // Sort by first metric
  const sorted = Object.entries(aggregated)
    .sort((a, b) => {
      const valA = metricFields[0] ? a[1][metricFields[0]] || 0 : 0;
      const valB = metricFields[0] ? b[1][metricFields[0]] || 0 : 0;
      return valB - valA;
    })
    .slice(0, limit);

  const rows = sorted.map(([name, data], i) => {
    const row: Record<string, unknown> = {
      '#': i + 1,
      [groupByField]: name,
      count: countByGroup[name] || 0,
    };
    for (const field of metricFields) {
      const val = data[field] || 0;
      row[field] =
        metric === 'avg'
          ? formatValue(val / (countByGroup[name] || 1))
          : formatValue(val);
    }
    return row;
  });

  const tableColumns = [
    { key: '#', label: '#' },
    { key: groupByField, label: formatLabel(groupByField) },
    { key: 'count', label: 'Count' },
    ...metricFields.map((f) => ({ key: f, label: formatLabel(f) })),
  ];

  return {
    component: 'DataSummary',
    props: {
      title: `Top ${limit} by ${formatLabel(groupByField)}`,
      columns: tableColumns,
      rows,
    },
  };
}

// ─── Resolution helpers (no domain knowledge) ──────────────

function resolveGroupByField(
  hints: IntentHints,
  profile: DataProfile,
): string | null {
  // 1. Use hint directly if it matches an available field
  if (hints.groupBy) {
    const match = profile.fields.find((f) => f.name === hints.groupBy);
    if (match) return match.name;
  }

  // 2. Pick the best categorical field (low-ish cardinality, > 1 unique value)
  const candidates = profile.categoricalFields
    .filter((f) => f.uniqueValues >= 2 && f.uniqueValues <= 30)
    .sort((a, b) => a.uniqueValues - b.uniqueValues);

  return candidates.length > 0 ? candidates[0].name : null;
}

function resolveMetricFields(
  hints: IntentHints,
  profile: DataProfile,
): string[] {
  // 1. Use hint
  if (hints.metricField) {
    const hintFields = hints.metricField.split(',').map((f) => f.trim());
    const resolved = hintFields.filter((f) =>
      profile.numericFields.some((nf) => nf.name === f),
    );
    if (resolved.length > 0) return resolved;
  }

  // 2. Use all numeric fields (up to 3)
  return profile.numericFields.slice(0, 3).map((f) => f.name);
}

function inferChartType(
  profile: DataProfile,
  groupByField: string | null,
): string {
  if (!groupByField) return 'bar';

  const groupField = profile.fields.find((f) => f.name === groupByField);
  if (!groupField) return 'bar';

  // Date fields → line chart
  if (groupField.type === 'date') return 'line';

  // Very few categories (2-5) → doughnut/pie
  if (groupField.uniqueValues <= 5) return 'doughnut';

  // Many categories → bar
  return 'bar';
}

// ─── Data Utilities ────────────────────────────────────────

function aggregateByField(
  records: Record<string, unknown>[],
  groupField: string,
  sumFields: string[],
): Record<string, Record<string, number>> {
  const result: Record<string, Record<string, number>> = {};

  for (const record of records) {
    const key = String(record[groupField] || 'Other');
    if (!result[key]) result[key] = {};
    for (const f of sumFields) {
      result[key][f] = (result[key][f] || 0) + (Number(record[f]) || 0);
    }
  }

  return result;
}

function countByField(
  records: Record<string, unknown>[],
  groupField: string,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const record of records) {
    const key = String(record[groupField] || 'Other');
    result[key] = (result[key] || 0) + 1;
  }
  return result;
}

// ─── Formatting Utilities ──────────────────────────────────

function formatLabel(field: string): string {
  return field.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n % 1 === 0 ? String(n) : n.toFixed(2);
}

function formatValue(n: number): string {
  return formatNumber(n);
}

function isAvailable(available: Set<string>, component: string): boolean {
  // Always allow — the catalog is a hint, not a hard restriction.
  // The frontend's DynamicRenderer has its own set of supported components.
  // If the catalog is empty, we still generate (it's the LLM's job to provide the catalog).
  if (available.size === 0) return true;
  return available.has(component);
}

// ─── Constants ─────────────────────────────────────────────

const CHART_COLORS = [
  '#4F46E5',
  '#7C3AED',
  '#2563EB',
  '#0891B2',
  '#059669',
  '#D97706',
  '#DC2626',
  '#6366F1',
  '#8B5CF6',
  '#EC4899',
];

// ─── Validation (for pre-built UIConfigs) ──────────────────

export function validateUiConfig(config: unknown): {
  valid: boolean;
  errors: string[];
  config?: UIConfig;
} {
  const errors: string[] = [];

  if (!config || typeof config !== 'object') {
    return { valid: false, errors: ['Config must be an object'] };
  }

  const c = config as Record<string, unknown>;

  if (!c.title || typeof c.title !== 'string') {
    errors.push('Missing or invalid "title" (string required)');
  }

  if (!c.layout || !['vertical', 'grid'].includes(c.layout as string)) {
    errors.push('Missing or invalid "layout" (must be "vertical" or "grid")');
  }

  if (!Array.isArray(c.components)) {
    errors.push('Missing or invalid "components" (array required)');
  } else {
    for (let i = 0; i < (c.components as unknown[]).length; i++) {
      const comp = (c.components as unknown[])[i] as Record<string, unknown>;
      if (!comp.component || typeof comp.component !== 'string') {
        errors.push(`components[${i}]: missing "component" name`);
      }
      if (!comp.props || typeof comp.props !== 'object') {
        errors.push(`components[${i}]: missing "props" object`);
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, errors: [], config: c as unknown as UIConfig };
}
