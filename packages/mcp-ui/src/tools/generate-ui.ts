/**
 * generate-ui: Transforms data + component catalog + intent into a declarative UIConfig
 * that the frontend DynamicRenderer can render using real @macropaytd components.
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

/**
 * Analyzes data and intent to produce a UIConfig using available components.
 * This is a deterministic transformer that maps data patterns to UI structures.
 */
export function generateUi(params: GenerateUiParams): UIConfig {
  const { intent, records, componentCatalog, title, layout = 'vertical', columns = 2 } = params;

  const availableComponents = new Set(componentCatalog.map((c) => c.name));
  const fields = records.length > 0 ? Object.keys(records[0]) : [];
  const numericFields = fields.filter((f) => typeof records[0]?.[f] === 'number');
  const stringFields = fields.filter((f) => typeof records[0]?.[f] === 'string');

  const components: UIComponentConfig[] = [];
  const intentLower = intent.toLowerCase();

  // Header
  if (availableComponents.has('Text')) {
    components.push({
      component: 'Text',
      props: { size: 'xl', weight: 'bold' },
      children: [title || inferTitle(intentLower, fields)],
    });
  }

  // Determine what to render based on intent
  if (intentLower.includes('tabla') || intentLower.includes('table') || intentLower.includes('listado')) {
    components.push(buildTable(records, fields, stringFields, numericFields, availableComponents));
  } else if (intentLower.includes('card') || intentLower.includes('tarjeta') || intentLower.includes('resumen')) {
    components.push(...buildCards(records, stringFields, numericFields, availableComponents));
  } else if (intentLower.includes('chart') || intentLower.includes('gráfica') || intentLower.includes('grafica')) {
    components.push(buildChartPlaceholder(records, stringFields, numericFields));
  } else {
    // Default: show summary cards + table
    if (numericFields.length > 0 && availableComponents.has('Card')) {
      components.push(...buildSummaryStats(records, numericFields, availableComponents));
    }
    components.push(buildTable(records, fields, stringFields, numericFields, availableComponents));
  }

  return {
    title: title || inferTitle(intentLower, fields),
    description: `Generado para: "${intent}"`,
    layout,
    columns,
    components,
  };
}

function inferTitle(intent: string, fields: string[]): string {
  if (intent.includes('venta')) return 'Resumen de Ventas';
  if (intent.includes('usuario')) return 'Usuarios';
  if (intent.includes('producto')) return 'Métricas de Producto';
  return `Vista: ${fields.slice(0, 2).join(', ')}`;
}

function buildTable(
  records: Record<string, unknown>[],
  fields: string[],
  _stringFields: string[],
  _numericFields: string[],
  availableComponents: Set<string>,
): UIComponentConfig {
  if (!availableComponents.has('Card')) {
    return {
      component: 'Table',
      props: {
        columns: fields.map((f) => ({ key: f, label: formatLabel(f) })),
        rows: records,
      },
    };
  }

  return {
    component: 'Card',
    props: { className: 'p-4' },
    children: [
      {
        component: 'Table',
        props: {
          columns: fields.map((f) => ({ key: f, label: formatLabel(f) })),
          rows: records,
        },
      },
    ],
  };
}

function buildCards(
  records: Record<string, unknown>[],
  stringFields: string[],
  numericFields: string[],
  availableComponents: Set<string>,
): UIComponentConfig[] {
  const labelField = stringFields[0] || 'item';

  return records.map((record) => {
    const children: (UIComponentConfig | string)[] = [];

    if (availableComponents.has('Text')) {
      children.push({
        component: 'Text',
        props: { size: 'lg', weight: 'medium' },
        children: [String(record[labelField] || 'Item')],
      });
    }

    for (const field of numericFields) {
      if (availableComponents.has('Badge')) {
        children.push({
          component: 'Badge',
          props: { variant: 'secondary' },
          children: [`${formatLabel(field)}: ${record[field]}`],
        });
      } else if (availableComponents.has('Text')) {
        children.push({
          component: 'Text',
          props: { size: 'sm' },
          children: [`${formatLabel(field)}: ${record[field]}`],
        });
      }
    }

    return {
      component: 'Card',
      props: { className: 'p-4 space-y-2' },
      children,
    };
  });
}

function buildSummaryStats(
  records: Record<string, unknown>[],
  numericFields: string[],
  availableComponents: Set<string>,
): UIComponentConfig[] {
  return numericFields.map((field) => {
    const values = records.map((r) => Number(r[field]) || 0);
    const total = values.reduce((a, b) => a + b, 0);
    const avg = total / values.length;
    const max = Math.max(...values);

    const children: (UIComponentConfig | string)[] = [];

    if (availableComponents.has('Text')) {
      children.push({
        component: 'Text',
        props: { size: 'sm', className: 'text-muted-foreground' },
        children: [formatLabel(field)],
      });
      children.push({
        component: 'Text',
        props: { size: 'xl', weight: 'bold' },
        children: [formatNumber(total)],
      });
      children.push({
        component: 'Text',
        props: { size: 'xs', className: 'text-muted-foreground' },
        children: [`Promedio: ${formatNumber(avg)} | Máx: ${formatNumber(max)}`],
      });
    }

    return {
      component: 'Card',
      props: { className: 'p-4 space-y-1' },
      children,
    };
  });
}

function buildChartPlaceholder(
  records: Record<string, unknown>[],
  stringFields: string[],
  numericFields: string[],
): UIComponentConfig {
  // Return a Chart component config that DynamicRenderer will handle
  return {
    component: 'Chart',
    props: {
      type: 'bar',
      data: {
        labels: records.map((r) => String(r[stringFields[0]] || '')),
        datasets: numericFields.map((field, i) => ({
          label: formatLabel(field),
          data: records.map((r) => Number(r[field]) || 0),
          backgroundColor: ['#4F46E5', '#7C3AED', '#2563EB', '#0891B2', '#059669'][i % 5],
          borderColor: ['#4F46E5', '#7C3AED', '#2563EB', '#0891B2', '#059669'][i % 5],
          borderWidth: 2,
        })),
      },
      options: {
        responsive: true,
        xAxis: { label: formatLabel(stringFields[0] || '') },
        yAxis: { label: formatLabel(numericFields[0] || '') },
      },
    },
  };
}

function formatLabel(field: string): string {
  return field
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(n % 1 === 0 ? 0 : 2);
}
