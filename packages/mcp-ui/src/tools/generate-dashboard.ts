import { type ChartConfig, generateChart } from './generate-chart.js';

export interface DashboardConfig {
  title: string;
  description?: string;
  layout: 'grid' | 'vertical';
  columns?: number;
  charts: ChartConfig[];
}

export interface GenerateDashboardParams {
  title: string;
  description?: string;
  records: Record<string, unknown>[];
  labelField: string;
  metrics: string[];
  layout?: 'grid' | 'vertical';
  columns?: number;
}

function inferChartType(metricName: string, recordCount: number): 'bar' | 'line' | 'pie' | 'doughnut' {
  // Rates/percentages → doughnut
  if (metricName.includes('rate') || metricName.includes('tasa') || metricName.includes('porcentaje')) {
    return 'doughnut';
  }
  // Time series (many points) → line
  if (recordCount > 6) {
    return 'line';
  }
  // Few categories → pie for single values, bar for comparison
  if (recordCount <= 5) {
    return 'pie';
  }
  return 'bar';
}

export function generateDashboard({
  title,
  description,
  records,
  labelField,
  metrics,
  layout = 'grid',
  columns = 2,
}: GenerateDashboardParams): DashboardConfig {
  const charts: ChartConfig[] = metrics.map((metric) => {
    const chartType = inferChartType(metric, records.length);

    return generateChart({
      chartType,
      records,
      labelField,
      valueFields: [metric],
      title: `${metric.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} by ${labelField}`,
    });
  });

  return {
    title,
    description,
    layout,
    columns,
    charts,
  };
}
