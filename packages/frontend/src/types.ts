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

export interface DashboardConfig {
  title: string;
  description?: string;
  layout: 'grid' | 'vertical';
  columns?: number;
  charts: ChartConfig[];
}
