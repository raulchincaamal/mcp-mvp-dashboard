export interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string;
  borderWidth?: number;
  fill?: boolean;
  borderDash?: number[];
}

export interface ChartConfig {
  type:
    | 'bar'
    | 'line'
    | 'pie'
    | 'doughnut'
    | 'area'
    | 'bollinger'
    | 'stacked-area'
    | 'diverging-bar';
  title: string;
  data:
    | {
        labels: string[];
        datasets: ChartDataset[];
      }
    | BollingerDataPoint[]
    | StackedAreaDataPoint[]
    | DivergingBarDataItem[];
  options: {
    responsive: boolean;
    xAxis?: { label: string };
    yAxis?: { label: string };
    stacked?: boolean;
  };
  // Bollinger-specific
  n?: number;
  k?: number;
  // Stacked-area & diverging-bar specific
  keys?: string[];
  colors?: string[];
  neutralKey?: string;
}

// ─── Bollinger Bands ───────────────────────────────────────

export interface BollingerDataPoint {
  date: string;
  value: number;
}

// ─── Stacked Area ──────────────────────────────────────────

export interface StackedAreaDataPoint {
  label: string;
  [key: string]: string | number;
}

// ─── Diverging Stacked Bar ─────────────────────────────────

export interface DivergingBarDataItem {
  label: string;
  values: { key: string; value: number }[];
}

// ─── Dashboard Config ──────────────────────────────────────

export interface DashboardConfig {
  title: string;
  description?: string;
  layout: 'grid' | 'vertical';
  columns?: number;
  charts: ChartConfig[];
}

