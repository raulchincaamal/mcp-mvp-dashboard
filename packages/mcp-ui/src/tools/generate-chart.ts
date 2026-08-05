export interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string;
  borderWidth?: number;
}

export interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'doughnut' | 'area';
  title: string;
  data: {
    labels: string[];
    datasets: ChartDataset[];
  };
  options: {
    responsive: boolean;
    xAxis?: { label: string };
    yAxis?: { label: string };
    stacked?: boolean;
  };
}

const CHART_COLORS = [
  '#4F46E5', // indigo
  '#7C3AED', // violet
  '#2563EB', // blue
  '#0891B2', // cyan
  '#059669', // emerald
  '#D97706', // amber
  '#DC2626', // red
  '#7C2D12', // orange-dark
];

export interface GenerateChartParams {
  chartType: 'bar' | 'line' | 'pie' | 'doughnut' | 'area';
  records: Record<string, unknown>[];
  labelField: string;
  valueFields: string[];
  title?: string;
}

export function generateChart({
  chartType,
  records,
  labelField,
  valueFields,
  title,
}: GenerateChartParams): ChartConfig {
  const labels = records.map((r) => String(r[labelField]));

  const datasets: ChartDataset[] = valueFields.map((field, index) => ({
    label: field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    data: records.map((r) => Number(r[field]) || 0),
    backgroundColor: chartType === 'pie' || chartType === 'doughnut'
      ? CHART_COLORS.slice(0, records.length)
      : CHART_COLORS[index % CHART_COLORS.length],
    borderColor: CHART_COLORS[index % CHART_COLORS.length],
    borderWidth: 2,
  }));

  const chartTitle = title || `${valueFields.join(', ')} by ${labelField}`;

  return {
    type: chartType,
    title: chartTitle,
    data: { labels, datasets },
    options: {
      responsive: true,
      xAxis: { label: labelField.replace(/_/g, ' ') },
      yAxis: { label: valueFields[0].replace(/_/g, ' ') },
    },
  };
}
