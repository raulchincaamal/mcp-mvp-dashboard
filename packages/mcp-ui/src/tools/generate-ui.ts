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
    // Find what values exist for the filtered fields to suggest alternatives
    return {
      title: title || 'Sin resultados',
      description: 'No se encontraron registros con los filtros aplicados.',
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
  const hints: IntentHints = {
    groupBy: extractHint(intent, 'groupBy'),
    template: extractHint(intent, 'template') as Template | null,
    metric: extractHint(intent, 'metric'),
    metricField: extractHint(intent, 'metricField'),
    chartType: extractHint(intent, 'chartType'),
  };

  // Detect template: use LLM hint if available, otherwise detect from text
  const template = hints.template || detectTemplate(intentLower);

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
        hints,
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
        hints,
      );
  }
}

// ─── Hint Extraction from Enhanced Intent ──────────────────

interface IntentHints {
  groupBy: string | null;
  template: Template | null;
  metric: string | null;
  metricField: string | null;
  chartType: string | null;
}

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
  hints?: IntentHints,
): UIConfig {
  const components: UIComponentConfig[] = [];
  const intentLower = intent.toLowerCase();

  const groupByField = resolveGroupByField(hints?.groupBy, intentLower, stringFields);
  const metricFields = resolveMetricFields(hints?.metricField, intentLower, numericFields);
  const metric = hints?.metric || detectMetricType(intentLower);

  // If grouping by high-cardinality field (states, cities), redirect to chart template
  const uniqueGroupCount = groupByField
    ? new Set(records.map(r => String(r[groupByField] || ''))).size
    : 0;
  if (uniqueGroupCount > 5) {
    return buildChartTemplate(records, numericFields, stringFields, intent, title);
  }

  // ─── 1. KPIs ─────────────────────────────────────────────
  const kpiItems = buildKpiItems(records, metricFields, numericFields, metric);
  if (kpiItems.length > 0) {
    components.push({ component: 'KPIGrid', props: { items: kpiItems } });
  }

  // ─── 2. Main chart: metric grouped by primary field ──────
  if (groupByField && metricFields.length > 0) {
    const uniqueGroups = new Set(records.map(r => String(r[groupByField] || ''))).size;
    // If grouping by a high-cardinality field (states, cities), always use chart — never KPIGrid per group
    if (uniqueGroups > 6) {
      components.push(buildGroupedChart(
        records, groupByField, metricFields, metric, hints?.chartType || 'bar',
      ));
    } else {
      components.push(buildGroupedChart(
        records, groupByField, metricFields, metric, hints?.chartType || 'bar',
      ));
    }
  }

  // ─── 3. Distribution by category (always for executive) ──
  if (stringFields.includes('categoria')) {
    const countByCat = countByField(records, 'categoria');
    const catLabels = Object.keys(countByCat).sort((a, b) => countByCat[b] - countByCat[a]);
    const colors = ['#4F46E5','#7C3AED','#2563EB','#0891B2','#059669','#D97706','#DC2626','#6366F1','#8B5CF6'];
    components.push({
      component: 'Chart',
      props: {
        type: 'doughnut',
        title: 'Distribución por Categoría',
        data: {
          labels: catLabels,
          datasets: [{
            label: 'Ventas',
            data: catLabels.map(l => countByCat[l]),
            backgroundColor: colors.slice(0, catLabels.length),
            borderColor: '#ffffff',
            borderWidth: 2,
          }],
        },
        options: { responsive: true },
      },
    });
  }

  // ─── 4. Credit status progress bars (always if field exists)
  if (stringFields.includes('estatus_credito')) {
    const statusCount = countByField(records, 'estatus_credito');
    const total = records.length;
    const statusColors: Record<string, string> = {
      al_corriente: '#059669', liquidado: '#2563EB',
      atrasado: '#D97706', cancelado: '#DC2626',
    };
    const progressItems = Object.entries(statusCount)
      .sort((a, b) => b[1] - a[1])
      .map(([status, count]) => ({
        label: `${formatLabel(status)} (${count})`,
        value: Math.round((count / total) * 100),
        color: statusColors[status] || '#4F46E5',
      }));
    components.push({
      component: 'ProgressGroup',
      props: { title: 'Estatus de Créditos', items: progressItems },
    });
  }

  // ─── 5. Sales by channel (if canal_venta exists) ──────────
  if (stringFields.includes('canal_venta')) {
    const countByCh = countByField(records, 'canal_venta');
    const chLabels = Object.keys(countByCh);
    const colors = ['#4F46E5', '#0891B2', '#059669'];
    components.push({
      component: 'Chart',
      props: {
        type: 'bar',
        title: 'Ventas por Canal',
        data: {
          labels: chLabels.map(formatLabel),
          datasets: [{
            label: 'Cantidad',
            data: chLabels.map(l => countByCh[l]),
            backgroundColor: colors,
            borderColor: colors,
            borderWidth: 2,
          }],
        },
        options: { responsive: true, xAxis: { label: 'Canal' }, yAxis: { label: 'Ventas' } },
      },
    });
  }

  // ─── 6. Recent transactions ───────────────────────────────
  const recent = records.slice(0, 8);
  if (recent.length > 0 && recent[0]['cliente'] !== undefined) {
    const txItems = recent.map(r => ({
      title: String(r['cliente'] || ''),
      subtitle: String(r['producto'] || r['categoria'] || ''),
      amount: `$${formatNumber(Number(r['monto_total_credito'] || r['precio_contado']) || 0)}`,
      date: String(r['fecha_venta'] || ''),
      status: r['estatus_credito'] === 'atrasado' ? 'negative' as const
        : r['estatus_credito'] === 'liquidado' ? 'positive' as const
        : 'neutral' as const,
    }));
    components.push({
      component: 'TransactionList',
      props: { title: 'Últimas Operaciones', items: txItems },
    });
  }

  return {
    title: title || 'Resumen Ejecutivo',
    layout: 'vertical',
    columns: columns || 2,
    components,
  };
}

// ─── Executive Template Helpers ────────────────────────────

function resolveGroupByField(
  hint: string | null | undefined,
  intentLower: string,
  stringFields: string[],
): string {
  // 1. Use hint directly if it matches an available field
  if (hint && stringFields.includes(hint)) return hint;

  // 2. Detect from intent "por X" or "agrupado por X"
  const detected = detectGroupField(intentLower, stringFields);
  if (detected) return detected;

  // 3. Smart defaults for common fields
  const priority = ['estado', 'categoria', 'sucursal', 'ciudad', 'canal_venta'];
  for (const p of priority) {
    if (stringFields.includes(p)) return p;
  }

  return stringFields[0] || 'id';
}

function resolveMetricFields(
  hint: string | null | undefined,
  intentLower: string,
  numericFields: string[],
): string[] {
  const resolved: string[] = [];

  // 1. Use hint
  if (hint) {
    const hintFields = hint.split(',').map((f) => f.trim());
    hintFields.forEach((f) => {
      if (numericFields.includes(f)) resolved.push(f);
    });
    if (resolved.length > 0) return resolved;
  }

  // 2. Detect from intent keywords
  const fieldKeywords: Record<string, RegExp> = {
    monto_financiado: /financiad|venta/i,
    monto_total_credito: /total.*cr[eé]dito|cobrad|monto.*total/i,
    monto_vencido: /vencid|morosidad/i,
    precio_contado: /precio|contado/i,
    enganche: /enganche/i,
    pago_semanal: /pago.*semanal/i,
    plazo_semanas: /plazo/i,
  };

  for (const [field, regex] of Object.entries(fieldKeywords)) {
    if (regex.test(intentLower) && numericFields.includes(field)) {
      resolved.push(field);
    }
  }

  if (resolved.length > 0) return resolved.slice(0, 3);

  // 3. Smart defaults: financial fields first
  const financialPriority = [
    'monto_financiado',
    'monto_total_credito',
    'precio_contado',
    'enganche',
  ];
  for (const f of financialPriority) {
    if (numericFields.includes(f)) resolved.push(f);
    if (resolved.length >= 2) break;
  }

  return resolved.length > 0 ? resolved : numericFields.slice(0, 2);
}

function detectMetricType(intentLower: string): string {
  if (/promedio|media|avg/i.test(intentLower)) return 'avg';
  if (/cantidad|cuantos|n[uú]mero|count/i.test(intentLower)) return 'count';
  return 'sum';
}

function buildKpiItems(
  records: Record<string, unknown>[],
  metricFields: string[],
  numericFields: string[],
  metric: string,
): {
  title: string;
  value: string;
  subtitle: string;
  trend: string;
  trendDirection: 'up' | 'down' | 'neutral';
  icon: string;
}[] {
  // Use metric fields + add count
  const fields = [...new Set(metricFields)].slice(0, 3);
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
    title: 'Total Registros',
    value: formatNumber(records.length),
    subtitle: `${records.length} operaciones`,
    trend: '',
    trendDirection: 'neutral',
    icon: '📋',
  });

  // Metric-based KPIs
  fields.forEach((field) => {
    const values = records.map((r) => Number(r[field]) || 0);
    const total = values.reduce((a, b) => a + b, 0);
    const avg = total / values.length;

    let displayValue: string;
    let subtitle: string;

    switch (metric) {
      case 'avg':
        displayValue = `$${formatNumber(avg)}`;
        subtitle = `Total: $${formatNumber(total)}`;
        break;
      case 'count':
        displayValue = formatNumber(records.length);
        subtitle = `Total: $${formatNumber(total)}`;
        break;
      default: // sum
        displayValue = `$${formatNumber(total)}`;
        subtitle = `Promedio: $${formatNumber(avg)}`;
    }

    items.push({
      title: formatLabel(field),
      value: displayValue,
      subtitle,
      trend: `${records.length} registros`,
      trendDirection: 'neutral',
      icon: getIconForField(field),
    });
  });

  // Add morosidad KPI if monto_vencido exists
  if (numericFields.includes('monto_vencido')) {
    const totalVencido = records.reduce(
      (s, r) => s + (Number(r['monto_vencido']) || 0),
      0,
    );
    const atrasados = records.filter(
      (r) => r['estatus_credito'] === 'atrasado',
    ).length;
    const tasaMorosidad = ((atrasados / records.length) * 100).toFixed(1);

    items.push({
      title: 'Tasa Morosidad',
      value: `${tasaMorosidad}%`,
      subtitle: `$${formatNumber(totalVencido)} vencido`,
      trend: `${atrasados} créditos atrasados`,
      trendDirection: Number(tasaMorosidad) > 20 ? 'down' : 'neutral',
      icon: '⚠️',
    });
  }

  return items.slice(0, 5);
}

function buildGroupedChart(
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
    const valA = metricFields[0] ? aggregated[a][metricFields[0]] || 0 : 0;
    const valB = metricFields[0] ? aggregated[b][metricFields[0]] || 0 : 0;
    return valB - valA;
  });
  const labels = sortedKeys.slice(0, 15);

  const colors = [
    '#4F46E5', '#0891B2', '#059669', '#D97706', '#DC2626',
    '#7C3AED', '#6366F1', '#0EA5E9', '#10B981', '#F59E0B',
    '#EF4444', '#EC4899', '#14B8A6', '#8B5CF6', '#F97316',
  ];

  const datasets =
    metric === 'count'
      ? [{
          label: 'Cantidad',
          data: labels.map((l) => countByGroup[l] || 0),
          backgroundColor: colors.slice(0, labels.length),
          borderColor: colors.slice(0, labels.length),
          borderWidth: 2,
        }]
      : metricFields.map((field, i) => ({
          label: formatLabel(field),
          data: labels.map((l) => {
            const val = aggregated[l]?.[field] || 0;
            return metric === 'avg'
              ? Math.round(val / (countByGroup[l] || 1))
              : val;
          }),
          backgroundColor: metricFields.length === 1 ? colors.slice(0, labels.length) : colors[i * 4 % colors.length],
          borderColor: metricFields.length === 1 ? colors.slice(0, labels.length) : colors[i * 4 % colors.length],
          borderWidth: 2,
        }));

  return {
    component: 'Chart',
    props: {
      type: chartType,
      title: `${metricFields.map(formatLabel).join(' vs ')} por ${formatLabel(groupByField)}`,
      data: { labels, datasets },
      options: {
        responsive: true,
        xAxis: { label: formatLabel(groupByField) },
        yAxis: { label: metricFields.map(formatLabel).join(' / ') },
      },
    },
  };
}

function buildMorosidadSection(
  records: Record<string, unknown>[],
  intentLower: string,
): UIComponentConfig[] {
  const components: UIComponentConfig[] = [];

  // Morosidad by category
  const categoryField = 'categoria';
  if (records[0]?.[categoryField] !== undefined) {
    const categories = [
      ...new Set(records.map((r) => String(r[categoryField]))),
    ];
    const morosidadData = categories
      .map((cat) => {
        const catRecords = records.filter((r) => r[categoryField] === cat);
        const atrasados = catRecords.filter(
          (r) => r['estatus_credito'] === 'atrasado',
        ).length;
        return {
          cat,
          rate:
            catRecords.length > 0 ? (atrasados / catRecords.length) * 100 : 0,
          total: catRecords.length,
        };
      })
      .sort((a, b) => b.rate - a.rate);

    // Progress bars for morosidad by category
    const progressItems = morosidadData.map((d) => ({
      label: `${d.cat} (${d.rate.toFixed(1)}%)`,
      value: Math.round(d.rate),
      color:
        d.rate > 20
          ? 'bg-red-500'
          : d.rate > 10
            ? 'bg-amber-500'
            : 'bg-emerald-500',
    }));

    components.push({
      component: 'ProgressGroup',
      props: { title: 'Tasa de Morosidad por Categoría', items: progressItems },
    });
  }

  return components;
}

function buildPlazosChart(
  records: Record<string, unknown>[],
  intentLower: string,
): UIComponentConfig {
  // Extract specific plazos mentioned or use all
  const plazoMatch = intentLower.match(
    /(\d+)(?:\s*,\s*|\s+y\s+|\s+)(\d+)(?:\s*,\s*|\s+y\s+|\s+)(\d+)/,
  );
  let targetPlazos: number[] | null = null;
  if (plazoMatch) {
    targetPlazos = [
      Number(plazoMatch[1]),
      Number(plazoMatch[2]),
      Number(plazoMatch[3]),
    ];
  }

  const plazoCounts: Record<number, { count: number; montoTotal: number }> = {};
  records.forEach((r) => {
    const plazo = Number(r['plazo_semanas']);
    if (!plazo) return;
    if (targetPlazos && !targetPlazos.includes(plazo)) return;
    if (!plazoCounts[plazo]) plazoCounts[plazo] = { count: 0, montoTotal: 0 };
    plazoCounts[plazo].count++;
    plazoCounts[plazo].montoTotal += Number(r['monto_financiado']) || 0;
  });

  const sortedPlazos = Object.keys(plazoCounts)
    .map(Number)
    .sort((a, b) => a - b);
  const labels = sortedPlazos.map((p) => `${p} semanas`);

  return {
    component: 'Chart',
    props: {
      type: 'bar',
      title: 'Distribución por Plazo',
      data: {
        labels,
        datasets: [
          {
            label: 'Cantidad de Créditos',
            data: sortedPlazos.map((p) => plazoCounts[p].count),
            backgroundColor: '#4F46E5',
            borderColor: '#4F46E5',
            borderWidth: 2,
          },
          {
            label: 'Monto Financiado',
            data: sortedPlazos.map((p) => plazoCounts[p].montoTotal),
            backgroundColor: '#7C3AED',
            borderColor: '#7C3AED',
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        xAxis: { label: 'Plazo' },
        yAxis: { label: 'Cantidad / Monto' },
      },
    },
  };
}

function buildTopTable(
  records: Record<string, unknown>[],
  intentLower: string,
  numericFields: string[],
  stringFields: string[],
): UIComponentConfig | null {
  // Detect: "top N sucursales con mayor monto_vencido"
  const topMatch = intentLower.match(/(?:top|las)\s*(\d+)/);
  const limit = topMatch ? Number(topMatch[1]) : 10;

  // Detect which field to rank by
  let rankField = 'monto_vencido';
  if (/vencid/i.test(intentLower) && numericFields.includes('monto_vencido')) {
    rankField = 'monto_vencido';
  } else if (
    /financiad/i.test(intentLower) &&
    numericFields.includes('monto_financiado')
  ) {
    rankField = 'monto_financiado';
  } else if (
    /total.*cr[eé]dito/i.test(intentLower) &&
    numericFields.includes('monto_total_credito')
  ) {
    rankField = 'monto_total_credito';
  } else if (numericFields.includes('monto_vencido')) {
    rankField = 'monto_vencido';
  } else {
    rankField =
      numericFields.find((f) => /monto|precio|venta/i.test(f)) ||
      numericFields[0];
  }

  // Detect grouping for the table (usually sucursal)
  let tableGroupField = 'sucursal';
  if (/sucursal/i.test(intentLower) && stringFields.includes('sucursal')) {
    tableGroupField = 'sucursal';
  } else if (/estado/i.test(intentLower) && stringFields.includes('estado')) {
    tableGroupField = 'estado';
  } else if (
    /categor/i.test(intentLower) &&
    stringFields.includes('categoria')
  ) {
    tableGroupField = 'categoria';
  }

  if (!numericFields.includes(rankField)) return null;

  // Aggregate
  const grouped: Record<string, { total: number; count: number }> = {};
  records.forEach((r) => {
    const key = String(r[tableGroupField] || 'Otro');
    if (!grouped[key]) grouped[key] = { total: 0, count: 0 };
    grouped[key].total += Number(r[rankField]) || 0;
    grouped[key].count++;
  });

  const sorted = Object.entries(grouped)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, limit);

  const rows = sorted.map(([name, data], i) => ({
    [tableGroupField]: name,
    [rankField]: `$${formatNumber(data.total)}`,
    operaciones: data.count,
    ranking: i + 1,
  }));

  const tableColumns = [
    { key: 'ranking', label: '#' },
    { key: tableGroupField, label: formatLabel(tableGroupField) },
    { key: rankField, label: formatLabel(rankField) },
    { key: 'operaciones', label: 'Operaciones' },
  ];

  return {
    component: 'DataSummary',
    props: {
      title: `Top ${limit} ${formatLabel(tableGroupField)} por ${formatLabel(rankField)}`,
      columns: tableColumns,
      rows,
    },
  };
}

/**
 * Strips [hint:value] tags from intent for display purposes.
 */
function stripHints(intent: string): string {
  return intent.replace(/\s*\[\w+:[^\]]+\]/g, '').trim();
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
    return buildExecutiveTemplate(records, [], numericFields, stringFields, intent, title, columns);
  }

  // Aggregate by category
  const aggregated = aggregateByField(records, categoryField, [valueField]);
  const categories = Object.keys(aggregated);

  // If only 1 category (filtered data), pivot to a more useful grouping
  if (categories.length <= 1) {
    const altField =
      stringFields.find((f) => f === 'estado') ||
      stringFields.find((f) => f === 'canal_venta') ||
      stringFields.find((f) => f === 'color') ||
      stringFields.find((f) => f !== categoryField);

    if (altField) {
      const altAgg = aggregateByField(records, altField, [valueField]);
      const altCount = countByField(records, altField);
      const altLabels = Object.keys(altAgg).sort((a, b) => (altAgg[b][valueField] || 0) - (altAgg[a][valueField] || 0)).slice(0, 15);
      const colors = ['#4F46E5','#7C3AED','#2563EB','#0891B2','#059669','#D97706','#DC2626','#6366F1','#8B5CF6','#0EA5E9','#10B981','#F59E0B','#EF4444','#EC4899','#14B8A6'];

      return {
        title: title || `Ventas por ${formatLabel(altField)}`,
        layout: 'vertical',
        columns: columns || 2,
        components: [
          {
            component: 'KPIGrid',
            props: {
              items: [
                { title: 'Total Registros', value: String(records.length), subtitle: `${records.length} ventas`, trend: '', trendDirection: 'neutral' as const, icon: '📋' },
                { title: formatLabel(valueField), value: `$${formatNumber(Object.values(altAgg).reduce((s, v) => s + (v[valueField] || 0), 0))}`, subtitle: `Promedio: $${formatNumber(Object.values(altAgg).reduce((s, v) => s + (v[valueField] || 0), 0) / records.length)}`, trend: '', trendDirection: 'neutral' as const, icon: '💰' },
              ],
            },
          },
          {
            component: 'Chart',
            props: {
              type: 'bar',
              title: `${formatLabel(valueField)} por ${formatLabel(altField)}`,
              data: {
                labels: altLabels,
                datasets: [{ label: formatLabel(valueField), data: altLabels.map(l => altAgg[l][valueField] || 0), backgroundColor: '#4F46E5', borderColor: '#4F46E5', borderWidth: 2 }],
              },
              options: { responsive: true, xAxis: { label: formatLabel(altField) }, yAxis: { label: formatLabel(valueField) } },
            },
          },
          {
            component: 'Chart',
            props: {
              type: 'doughnut',
              title: `Cantidad de Ventas por ${formatLabel(altField)}`,
              data: {
                labels: altLabels,
                datasets: [{ label: 'Ventas', data: altLabels.map(l => altCount[l] || 0), backgroundColor: colors.slice(0, altLabels.length), borderColor: '#ffffff', borderWidth: 2 }],
              },
              options: { responsive: true },
            },
          },
        ],
      };
    }
  }

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
    '#4F46E5','#7C3AED','#2563EB','#0891B2','#059669',
    '#D97706','#DC2626','#6366F1','#8B5CF6','#0EA5E9',
  ];

  components.push({
    component: 'Chart',
    props: {
      type: 'doughnut',
      title: `Distribución por ${formatLabel(categoryField)}`,
      data: {
        labels: pieLabels,
        datasets: [{
          label: formatLabel(valueField),
          data: pieData,
          backgroundColor: colors.slice(0, pieLabels.length),
          borderColor: '#ffffff',
          borderWidth: 2,
        }],
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
        datasets: [{
          label: formatLabel(valueField),
          data: pieData,
          backgroundColor: colors.slice(0, categories.length),
          borderColor: colors.slice(0, categories.length),
          borderWidth: 2,
        }],
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
  const isFiltered = Object.keys(statusCounts).length === 1;

  // If all records share one status (filtered query), show breakdown by category instead
  const kpiItems = isFiltered
    ? (() => {
        const [singleStatus, count] = Object.entries(statusCounts)[0];
        const monto = statusTotals[singleStatus] || 0;
        const avgMonto = monto / count;
        const avgPlazo = records.reduce((s, r) => s + (Number(r['plazo_semanas']) || 0), 0) / count;
        const avgAtrasadas = records.reduce((s, r) => s + (Number(r['semanas_atrasadas'] ?? r['semanas_pagadas']) || 0), 0) / count;
        const montoVencido = records.reduce((s, r) => s + (Number(r['monto_vencido']) || 0), 0);
        return [
          { title: `Total ${formatLabel(singleStatus)}`, value: String(count), subtitle: `$${formatNumber(monto)} en créditos`, trend: '100% del resultado', trendDirection: singleStatus === 'atrasado' ? 'down' as const : 'up' as const, icon: singleStatus === 'atrasado' ? '⚠️' : '✅' },
          { title: 'Monto Promedio', value: `$${formatNumber(avgMonto)}`, subtitle: 'por crédito', trend: '', trendDirection: 'neutral' as const, icon: '💰' },
          { title: 'Plazo Promedio', value: `${avgPlazo.toFixed(0)} sem`, subtitle: 'plazo del crédito', trend: '', trendDirection: 'neutral' as const, icon: '📅' },
          ...(montoVencido > 0 ? [{ title: 'Monto Vencido Total', value: `$${formatNumber(montoVencido)}`, subtitle: 'cartera vencida', trend: `${avgAtrasadas.toFixed(0)} sem prom atrasadas`, trendDirection: 'down' as const, icon: '🚨' }] : []),
        ];
      })()
    : Object.entries(statusCounts).map(([status, count]) => ({
        title: formatLabel(status),
        value: String(count),
        subtitle: `$${formatNumber(statusTotals[status] || 0)}`,
        trend: `${((count / total) * 100).toFixed(1)}%`,
        trendDirection:
          status === 'al_corriente' || status === 'liquidado' ? 'up' as const
          : status === 'atrasado' ? 'down' as const : 'neutral' as const,
        icon: ({ al_corriente: '↑', liquidado: '✓', atrasado: '↓', cancelado: '✗' } as Record<string,string>)[status] || '•',
      }));

  components.push({ component: 'KPIGrid', props: { items: kpiItems } });

  // Progress bars
  const progressItems = isFiltered
    ? (() => {
        const catCount = countByField(records, 'categoria');
        const progressColors = ['#4F46E5','#7C3AED','#2563EB','#0891B2','#059669','#D97706','#DC2626','#6366F1','#8B5CF6'];
        return Object.entries(catCount)
          .sort((a, b) => b[1] - a[1])
          .map(([cat, count], idx) => ({
            label: `${cat} (${count})`,
            value: Math.round((count / total) * 100),
            color: progressColors[idx % progressColors.length],
          }));
      })()
    : Object.entries(statusCounts).map(([status, count]) => {
        const colors: Record<string, string> = {
          al_corriente: '#059669', liquidado: '#2563EB',
          atrasado: '#D97706', cancelado: '#DC2626',
        };
        return {
          label: `${formatLabel(status)} (${count})`,
          value: Math.round((count / total) * 100),
          color: colors[status] || '#4F46E5',
        };
      });

  components.push({
    component: 'ProgressGroup',
    props: {
      title: isFiltered ? 'Distribución por Categoría' : 'Distribución de Estatus',
      items: progressItems,
    },
  });

  // Chart: if filtered by one status, show breakdown by ciudad (not estado if already filtered)
  if (isFiltered && records[0]?.['estado'] !== undefined) {
    const allSameEstado = new Set((records as Record<string,unknown>[]).map(r => r['estado'])).size === 1;
    const groupField = allSameEstado ? 'ciudad' : 'estado';
    const countByGroup = countByField(records, groupField);
    const groupLabels = Object.keys(countByGroup).sort((a, b) => countByGroup[b] - countByGroup[a]).slice(0, 12);
    const groupTitle = allSameEstado ? 'Créditos Atrasados por Ciudad' : 'Créditos Atrasados por Estado';
    const colors = ['#4F46E5','#7C3AED','#2563EB','#0891B2','#059669','#D97706','#DC2626','#6366F1','#8B5CF6','#0EA5E9','#10B981','#F59E0B'];
    components.push({
      component: 'Chart',
      props: {
        type: 'bar',
        title: groupTitle,
        data: {
          labels: groupLabels,
          datasets: [{ label: 'Atrasados', data: groupLabels.map(l => countByGroup[l]), backgroundColor: colors.slice(0, groupLabels.length), borderColor: colors.slice(0, groupLabels.length), borderWidth: 2 }],
        },
        options: { responsive: true, xAxis: { label: groupField === 'ciudad' ? 'Ciudad' : 'Estado' }, yAxis: { label: 'Cantidad' } },
      },
    });
  }

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
    description: `${records.length} registros`,
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

  // Resolve chartType FIRST — used by isPie below
  const chartType =
    chartTypeHint ||
    (/l[ií]nea|line|tendencia/i.test(intent) ? 'line'
      : /pie|pastel/i.test(intent) ? 'pie'
      : /donut|dona|doughnut/i.test(intent) ? 'doughnut'
      : /scatter|dispersi[oó]n/i.test(intent) ? 'scatter'
      : /radar|ara[nñ]a/i.test(intent) ? 'radar'
      : /embudo|funnel/i.test(intent) ? 'funnel'
      : /gauge|medidor/i.test(intent) ? 'gauge'
      : /heatmap|calor/i.test(intent) ? 'heatmap'
      : /treemap|[aá]rbol/i.test(intent) ? 'treemap'
      : 'bar');

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
  const labels = Object.keys(useCount ? countByGroup : aggregated)
    .sort((a, b) => useCount
      ? (countByGroup[b] - countByGroup[a])
      : ((aggregated[b][valueFields[0]] || 0) - (aggregated[a][valueFields[0]] || 0)))
    .slice(0, 15);
  const colors = [
    '#4F46E5', '#7C3AED', '#2563EB', '#0891B2', '#059669',
    '#D97706', '#DC2626', '#6366F1', '#8B5CF6', '#0EA5E9',
    '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#14B8A6',
  ];

  const isPie = chartType === 'pie' || chartType === 'doughnut';

  const datasets = useCount
    ? [{
        label: 'Cantidad de Ventas',
        data: labels.map((l) => countByGroup[l] || 0),
        backgroundColor: isPie ? colors.slice(0, labels.length) : colors.slice(0, labels.length),
        borderColor: isPie ? '#ffffff' : colors.slice(0, labels.length),
        borderWidth: 2,
      }]
    : isPie
      ? [{
          label: formatLabel(valueFields[0] || 'Valor'),
          data: labels.map((l) => aggregated[l][valueFields[0]] || 0),
          backgroundColor: colors.slice(0, labels.length),
          borderColor: '#ffffff',
          borderWidth: 2,
        }]
      : valueFields.map((vf, i) => ({
          label: formatLabel(vf),
          data: labels.map((l) => aggregated[l][vf] || 0),
          backgroundColor: valueFields.length === 1 ? colors.slice(0, labels.length) : colors[i * 4 % colors.length],
          borderColor: valueFields.length === 1 ? colors.slice(0, labels.length) : colors[i * 4 % colors.length],
          borderWidth: 2,
        }));

  const totalRecords = records.length;
  const totalValue = useCount ? totalRecords : records.reduce((s, r) => s + (Number(r[valueFields[0]]) || 0), 0);
  const kpiItems = [
    { title: 'Total Registros', value: formatNumber(totalRecords), subtitle: `${totalRecords} operaciones`, trend: '', trendDirection: 'neutral' as const, icon: '📋' },
    ...(!useCount && valueFields[0] ? [{ title: formatLabel(valueFields[0]), value: `$${formatNumber(totalValue)}`, subtitle: `Promedio: $${formatNumber(totalValue / totalRecords)}`, trend: '', trendDirection: 'neutral' as const, icon: '💰' }] : []),
    { title: formatLabel(labelField), value: String(labels.length), subtitle: 'grupos distintos', trend: '', trendDirection: 'neutral' as const, icon: '📊' },
  ];

  return {
    title: title || `Gráfica: ${useCount ? 'Ventas' : valueFields.map(formatLabel).join(', ')}`,
    layout: 'vertical',
    columns: 2,
    components: [
      { component: 'KPIGrid', props: { items: kpiItems } },
      {
        component: 'Chart',
        props: {
          type: chartType,
          title: `${useCount ? 'Cantidad de Ventas' : valueFields.map(formatLabel).join(', ')} por ${formatLabel(labelField)}`,
          data: { labels, datasets },
          options: {
            responsive: true,
            xAxis: { label: formatLabel(labelField) },
            yAxis: { label: useCount ? 'Ventas' : valueFields.map(formatLabel).join(', ') },
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

