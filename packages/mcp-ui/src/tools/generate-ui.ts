/**
 * generate-ui: Transforms data + component catalog + intent into a declarative UIConfig
 * that the frontend DynamicRenderer can render using real components.
 *
 * Supports rich composite components: StatCard, KPIGrid, ProgressGroup,
 * TransactionList, MiniChart, Chart, DataSummary/Table.
 */

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

// ─── Main Entry ────────────────────────────────────────────

export function generateUi(params: GenerateUiParams): UIConfig {
  const { intent, records, title, layout = 'vertical', columns = 2 } = params;

  if (!records || records.length === 0) {
    return {
      title: title || 'Sin datos',
      description: `No se encontraron registros para: "${intent}"`,
      layout,
      columns,
      components: [],
    };
  }

  const fields = Object.keys(records[0]);
  const numericFields = fields.filter((f) => typeof records[0][f] === 'number');
  const stringFields = fields.filter((f) => typeof records[0][f] === 'string');
  const intentLower = intent.toLowerCase();

  // Extract metadata hints from enhanced intent (set by pipeline via LLM)
  const groupByHint = extractHint(intent, 'groupBy');
  const templateHint = extractHint(intent, 'template') as Template | null;
  const metricHint = extractHint(intent, 'metric');
  const chartTypeHint = extractHint(intent, 'chartType');

  // Detect template: use LLM hint if available, otherwise detect from text
  const template = templateHint || detectTemplate(intentLower);

  switch (template) {
    case 'executive':
      return buildExecutiveTemplate(
        records,
        fields,
        numericFields,
        stringFields,
        intent,
        title,
        columns,
      );
    case 'category':
      return buildCategoryTemplate(
        records,
        fields,
        numericFields,
        stringFields,
        intent,
        title,
        columns,
      );
    case 'credit':
      return buildCreditTemplate(records, intent, title, columns);
    case 'table':
      return buildTableTemplate(records, fields, intent, title);
    case 'cards':
      return buildCardsTemplate(
        records,
        numericFields,
        stringFields,
        intent,
        title,
        columns,
      );
    case 'chart':
      return buildChartTemplate(
        records,
        numericFields,
        stringFields,
        intent,
        title,
      );
    default:
      return buildExecutiveTemplate(
        records,
        fields,
        numericFields,
        stringFields,
        intent,
        title,
        columns,
      );
  }
}

// ─── Hint Extraction from Enhanced Intent ──────────────────

function extractHint(intent: string, key: string): string | null {
  const regex = new RegExp(`\\[${key}:([^\\]]+)\\]`);
  const match = intent.match(regex);
  return match ? match[1] : null;
}

// ─── Template Detection ────────────────────────────────────

type Template =
  | 'executive'
  | 'category'
  | 'credit'
  | 'table'
  | 'cards'
  | 'chart';

function detectTemplate(intent: string): Template {
  if (/cr[eé]dito|estatus|pago|atraso|liquidado|corriente/i.test(intent))
    return 'credit';
  if (/categor[ií]a|por\s+categor/i.test(intent)) return 'category';
  if (/tabla|listado|registros|detalle/i.test(intent)) return 'table';
  if (/card|tarjeta/i.test(intent)) return 'cards';
  if (/gr[aá]fica|chart|tendencia/i.test(intent)) return 'chart';
  if (/resumen|ejecutivo|dashboard|general|kpi/i.test(intent))
    return 'executive';
  return 'executive';
}

// ─── Template: Executive Summary ───────────────────────────

function buildExecutiveTemplate(
  records: Record<string, unknown>[],
  _fields: string[],
  numericFields: string[],
  stringFields: string[],
  intent: string,
  title?: string,
  columns?: number,
): UIConfig {
  const components: UIComponentConfig[] = [];

  // KPI Grid
  const kpiItems = numericFields.slice(0, 4).map((field) => {
    const values = records.map((r) => Number(r[field]) || 0);
    const total = values.reduce((a, b) => a + b, 0);
    const avg = total / values.length;
    return {
      title: formatLabel(field),
      value: formatNumber(total),
      subtitle: `Promedio: ${formatNumber(avg)}`,
      trend: `${records.length} registros`,
      trendDirection: 'neutral' as const,
      icon: getIconForField(field),
    };
  });

  if (kpiItems.length > 0) {
    components.push({ component: 'KPIGrid', props: { items: kpiItems } });
  }

  // Chart (line/bar for first numeric field over string field)
  if (numericFields.length > 0 && stringFields.length > 0) {
    const labelField = stringFields[0];
    const valueField = numericFields[0];

    // Aggregate by label field
    const aggregated = aggregateByField(records, labelField, [valueField]);
    const labels = Object.keys(aggregated).slice(0, 12);
    const data = labels.map((l) => aggregated[l][valueField] || 0);

    components.push({
      component: 'Chart',
      props: {
        type: 'bar',
        title: `${formatLabel(valueField)} por ${formatLabel(labelField)}`,
        data: {
          labels,
          datasets: [
            {
              label: formatLabel(valueField),
              data,
              backgroundColor: '#4F46E5',
              borderColor: '#4F46E5',
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          xAxis: { label: formatLabel(labelField) },
          yAxis: { label: formatLabel(valueField) },
        },
      },
    });
  }

  // Transaction list (last 8 records)
  const transactionItems = records.slice(0, 8).map((r) => ({
    title: String(r[stringFields[0]] || r[Object.keys(r)[0]] || ''),
    subtitle: stringFields[1] ? String(r[stringFields[1]] || '') : undefined,
    amount: numericFields[0]
      ? `$${formatNumber(Number(r[numericFields[0]]))}`
      : '',
    date: r['fecha_venta'] ? String(r['fecha_venta']) : undefined,
    status: 'neutral' as const,
  }));

  if (transactionItems.length > 0) {
    components.push({
      component: 'TransactionList',
      props: { title: 'Últimos Registros', items: transactionItems },
    });
  }

  return {
    title: title || 'Resumen Ejecutivo',
    description: `Generado para: "${intent}"`,
    layout: 'vertical',
    columns: columns || 2,
    components,
  };
}

// ─── Template: Category Analysis ───────────────────────────

function buildCategoryTemplate(
  records: Record<string, unknown>[],
  _fields: string[],
  numericFields: string[],
  stringFields: string[],
  intent: string,
  title?: string,
  columns?: number,
): UIConfig {
  const components: UIComponentConfig[] = [];

  // Find the category field
  const categoryField =
    stringFields.find((f) => /categor/i.test(f)) || stringFields[0];
  const valueField =
    numericFields.find((f) => /precio|venta|ingreso|monto/i.test(f)) ||
    numericFields[0];

  if (!categoryField || !valueField) {
    return buildExecutiveTemplate(
      records,
      [],
      numericFields,
      stringFields,
      intent,
      title,
      columns,
    );
  }

  // Aggregate by category
  const aggregated = aggregateByField(records, categoryField, [valueField]);
  const categories = Object.keys(aggregated);

  // KPI per category
  const kpiItems = categories.map((cat) => {
    const catRecords = records.filter((r) => r[categoryField] === cat);
    const total = catRecords.reduce(
      (sum, r) => sum + (Number(r[valueField]) || 0),
      0,
    );
    return {
      title: cat,
      value: `$${formatNumber(total)}`,
      subtitle: `${catRecords.length} ventas`,
      trendDirection: 'neutral' as const,
    };
  });

  components.push({ component: 'KPIGrid', props: { items: kpiItems } });

  // Pie chart distribution
  const pieLabels = categories;
  const pieData = categories.map((cat) => aggregated[cat][valueField] || 0);
  const colors = [
    '#4F46E5',
    '#7C3AED',
    '#2563EB',
    '#0891B2',
    '#059669',
    '#D97706',
    '#DC2626',
    '#6366F1',
    '#8B5CF6',
  ];

  components.push({
    component: 'Chart',
    props: {
      type: 'doughnut',
      title: `Distribución por ${formatLabel(categoryField)}`,
      data: {
        labels: pieLabels,
        datasets: [
          {
            label: formatLabel(valueField),
            data: pieData,
            backgroundColor: colors.slice(0, pieLabels.length),
            borderWidth: 2,
          },
        ],
      },
      options: { responsive: true },
    },
  });

  // Bar chart comparison
  components.push({
    component: 'Chart',
    props: {
      type: 'bar',
      title: `${formatLabel(valueField)} por ${formatLabel(categoryField)}`,
      data: {
        labels: categories,
        datasets: [
          {
            label: formatLabel(valueField),
            data: pieData,
            backgroundColor: '#4F46E5',
            borderColor: '#4F46E5',
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        xAxis: { label: formatLabel(categoryField) },
        yAxis: { label: formatLabel(valueField) },
      },
    },
  });

  return {
    title: title || `Análisis por ${formatLabel(categoryField)}`,
    description: `Generado para: "${intent}"`,
    layout: 'vertical',
    columns: columns || 2,
    components,
  };
}

// ─── Template: Credit Tracking ─────────────────────────────

function buildCreditTemplate(
  records: Record<string, unknown>[],
  intent: string,
  title?: string,
  columns?: number,
): UIConfig {
  const components: UIComponentConfig[] = [];

  // Status distribution
  const statusField = 'estatus_credito';
  const statusCounts: Record<string, number> = {};
  const statusTotals: Record<string, number> = {};

  records.forEach((r) => {
    const status = String(r[statusField] || 'desconocido');
    statusCounts[status] = (statusCounts[status] || 0) + 1;
    statusTotals[status] =
      (statusTotals[status] || 0) + (Number(r['monto_total_credito']) || 0);
  });

  const total = records.length;

  // KPI cards for each status
  const statusColors: Record<string, string> = {
    al_corriente: '↑',
    liquidado: '✓',
    atrasado: '↓',
    cancelado: '✗',
  };

  const kpiItems = Object.entries(statusCounts).map(([status, count]) => ({
    title: formatLabel(status),
    value: String(count),
    subtitle: `$${formatNumber(statusTotals[status] || 0)}`,
    trend: `${((count / total) * 100).toFixed(1)}%`,
    trendDirection:
      status === 'al_corriente' || status === 'liquidado'
        ? ('up' as const)
        : status === 'atrasado'
          ? ('down' as const)
          : ('neutral' as const),
    icon: statusColors[status] || '•',
  }));

  components.push({ component: 'KPIGrid', props: { items: kpiItems } });

  // Progress bars for status percentage
  const progressItems = Object.entries(statusCounts).map(([status, count]) => {
    const colors: Record<string, string> = {
      al_corriente: 'bg-emerald-500',
      liquidado: 'bg-blue-500',
      atrasado: 'bg-amber-500',
      cancelado: 'bg-red-500',
    };
    return {
      label: `${formatLabel(status)} (${count})`,
      value: Math.round((count / total) * 100),
      color: colors[status] || 'bg-primary',
    };
  });

  components.push({
    component: 'ProgressGroup',
    props: { title: 'Distribución de Estatus', items: progressItems },
  });

  // MiniCharts for weekly payments if available
  if (records[0]?.['semanas_pagadas'] !== undefined) {
    const avgPaid =
      records.reduce((sum, r) => sum + (Number(r['semanas_pagadas']) || 0), 0) /
      records.length;
    const avgPlazo =
      records.reduce((sum, r) => sum + (Number(r['plazo_semanas']) || 0), 0) /
      records.length;
    const completionRate = ((avgPaid / avgPlazo) * 100).toFixed(0);

    // Generate sparkline data from a sample of records
    const sampleData = records
      .slice(0, 20)
      .map((r) => Number(r['pago_semanal']) || 0);

    components.push({
      component: 'MiniChart',
      props: {
        title: 'Pago Semanal Promedio',
        value: `$${formatNumber(records.reduce((s, r) => s + (Number(r['pago_semanal']) || 0), 0) / records.length)}`,
        data: sampleData,
        color: '#4F46E5',
      },
    });

    components.push({
      component: 'StatCard',
      props: {
        title: 'Avance Promedio de Crédito',
        value: `${completionRate}%`,
        subtitle: `${avgPaid.toFixed(0)} de ${avgPlazo.toFixed(0)} semanas`,
        trend: avgPaid > avgPlazo * 0.5 ? 'Buen ritmo' : 'Bajo ritmo',
        trendDirection: avgPaid > avgPlazo * 0.5 ? 'up' : 'down',
      },
    });
  }

  // Recent transactions with issues
  const atrasados = records
    .filter((r) => r['estatus_credito'] === 'atrasado')
    .slice(0, 6);
  if (atrasados.length > 0) {
    const txItems = atrasados.map((r) => ({
      title: String(r['cliente'] || r['producto'] || ''),
      subtitle: String(r['producto'] || ''),
      amount: `$${formatNumber(Number(r['monto_total_credito']) || 0)}`,
      date: String(r['fecha_venta'] || ''),
      status: 'negative' as const,
    }));
    components.push({
      component: 'TransactionList',
      props: { title: 'Créditos Atrasados', items: txItems },
    });
  }

  return {
    title: title || 'Seguimiento de Créditos',
    description: `Generado para: "${intent}"`,
    layout: 'vertical',
    columns: columns || 2,
    components,
  };
}

// ─── Template: Table ───────────────────────────────────────

function buildTableTemplate(
  records: Record<string, unknown>[],
  fields: string[],
  intent: string,
  title?: string,
): UIConfig {
  // Select most relevant columns (max 8)
  const priorityFields = fields.filter((f) =>
    /fecha|cliente|producto|categor|precio|monto|estatus|estado|canal/i.test(f),
  );
  const selectedFields =
    priorityFields.length > 0 ? priorityFields.slice(0, 8) : fields.slice(0, 8);

  return {
    title: title || 'Listado de Registros',
    description: `Generado para: "${intent}" (${records.length} registros)`,
    layout: 'vertical',
    columns: 2,
    components: [
      {
        component: 'DataSummary',
        props: {
          columns: selectedFields.map((f) => ({
            key: f,
            label: formatLabel(f),
          })),
          rows: records,
        },
      },
    ],
  };
}

// ─── Template: Cards ───────────────────────────────────────

function buildCardsTemplate(
  records: Record<string, unknown>[],
  numericFields: string[],
  stringFields: string[],
  intent: string,
  title?: string,
  columns?: number,
): UIConfig {
  const labelField = stringFields[0];
  const items = records.slice(0, 12).map((r) => ({
    title: String(r[labelField] || ''),
    subtitle: stringFields[1] ? String(r[stringFields[1]] || '') : undefined,
    amount: numericFields[0]
      ? `$${formatNumber(Number(r[numericFields[0]]))}`
      : '',
    date: r['fecha_venta'] ? String(r['fecha_venta']) : undefined,
    status: 'neutral' as const,
  }));

  return {
    title: title || 'Detalle en Cards',
    description: `Generado para: "${intent}"`,
    layout: 'grid',
    columns: columns || 2,
    components: [
      {
        component: 'TransactionList',
        props: { items },
      },
    ],
  };
}

// ─── Template: Chart ───────────────────────────────────────

function buildChartTemplate(
  records: Record<string, unknown>[],
  numericFields: string[],
  stringFields: string[],
  intent: string,
  title?: string,
): UIConfig {
  // Detect grouping field: LLM hint > "por X" pattern > fallback
  const groupByHint = extractHint(intent, 'groupBy');
  const chartTypeHint = extractHint(intent, 'chartType');
  const metricHint = extractHint(intent, 'metric');

  const labelField =
    (groupByHint && stringFields.includes(groupByHint) ? groupByHint : null) ||
    detectGroupField(intent, stringFields) ||
    stringFields.find((f) => /categor|mes|estado|producto/i.test(f)) ||
    stringFields[0];
  const valueFields = numericFields
    .filter((f) => /precio|venta|monto|ingreso/i.test(f))
    .slice(0, 2);
  if (valueFields.length === 0 && numericFields.length > 0)
    valueFields.push(numericFields[0]);

  // If metric hint is "count" or intent mentions quantity, count records per group
  const useCount =
    metricHint === 'count' ||
    /cantidad|n[uú]mero|cuant[oa]s|total\s+de\s+ventas/i.test(intent);

  const aggregated = aggregateByField(records, labelField, valueFields);
  const countByGroup = countByField(records, labelField);
  const labels = Object.keys(useCount ? countByGroup : aggregated).slice(0, 15);
  const colors = [
    '#4F46E5',
    '#7C3AED',
    '#2563EB',
    '#0891B2',
    '#059669',
    '#D97706',
    '#DC2626',
    '#6366F1',
  ];

  const datasets = useCount
    ? [
        {
          label: 'Cantidad de Ventas',
          data: labels.map((l) => countByGroup[l] || 0),
          backgroundColor: '#4F46E5',
          borderColor: '#4F46E5',
          borderWidth: 2,
        },
      ]
    : valueFields.map((vf, i) => ({
        label: formatLabel(vf),
        data: labels.map((l) => aggregated[l][vf] || 0),
        backgroundColor: colors[i % colors.length],
        borderColor: colors[i % colors.length],
        borderWidth: 2,
      }));

  const chartType =
    chartTypeHint ||
    (/l[ií]nea|line|tendencia/i.test(intent)
      ? 'line'
      : /pie|pastel|donut|dona/i.test(intent)
        ? 'doughnut'
        : 'bar');

  return {
    title: title || `Gráfica: ${valueFields.map(formatLabel).join(', ')}`,
    description: `Generado para: "${intent}"`,
    layout: 'vertical',
    columns: 2,
    components: [
      {
        component: 'Chart',
        props: {
          type: chartType,
          title: `${valueFields.map(formatLabel).join(', ')} por ${formatLabel(labelField)}`,
          data: { labels, datasets },
          options: {
            responsive: true,
            xAxis: { label: formatLabel(labelField) },
            yAxis: { label: valueFields.map(formatLabel).join(', ') },
          },
        },
      },
    ],
  };
}

// ─── Helpers ───────────────────────────────────────────────

function aggregateByField(
  records: Record<string, unknown>[],
  groupField: string,
  sumFields: string[],
): Record<string, Record<string, number>> {
  const result: Record<string, Record<string, number>> = {};

  records.forEach((r) => {
    const key = String(r[groupField] || 'Otro');
    if (!result[key]) result[key] = {};
    sumFields.forEach((f) => {
      result[key][f] = (result[key][f] || 0) + (Number(r[f]) || 0);
    });
  });

  return result;
}

function countByField(
  records: Record<string, unknown>[],
  groupField: string,
): Record<string, number> {
  const result: Record<string, number> = {};
  records.forEach((r) => {
    const key = String(r[groupField] || 'Otro');
    result[key] = (result[key] || 0) + 1;
  });
  return result;
}

function formatLabel(field: string): string {
  return field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n % 1 === 0 ? String(n) : n.toFixed(2);
}

function getIconForField(field: string): string {
  if (/precio|monto|venta|ingreso|total/i.test(field)) return '💰';
  if (/cliente|usuario/i.test(field)) return '👤';
  if (/producto/i.test(field)) return '📦';
  if (/pago|semanal/i.test(field)) return '📅';
  if (/tasa|interes/i.test(field)) return '📊';
  return '📈';
}

/**
 * Detects the grouping field from the intent text.
 * Matches patterns like "por estado", "por categoría", "por producto", etc.
 */
function detectGroupField(
  intent: string,
  availableFields: string[],
): string | null {
  const fieldAliases: Record<string, string[]> = {
    estado: ['estado', 'estados', 'región', 'region'],
    categoria: ['categoría', 'categoria', 'categorías', 'categorias', 'tipo'],
    producto: ['producto', 'productos'],
    ciudad: ['ciudad', 'ciudades'],
    sucursal: ['sucursal', 'sucursales', 'tienda'],
    canal_venta: ['canal', 'canales'],
    color: ['color', 'colores'],
    genero: ['género', 'genero', 'sexo'],
    vendedor: ['vendedor', 'vendedores'],
    estatus_credito: ['estatus', 'status', 'estado de crédito'],
  };

  const intentLower = intent.toLowerCase();

  // Match "por [field]" pattern
  const porMatch = intentLower.match(/por\s+(\w+)/);
  if (porMatch) {
    const keyword = porMatch[1];

    // Direct field name match
    if (availableFields.includes(keyword)) return keyword;

    // Alias match
    for (const [field, aliases] of Object.entries(fieldAliases)) {
      if (aliases.includes(keyword) && availableFields.includes(field)) {
        return field;
      }
    }
  }

  return null;
}

