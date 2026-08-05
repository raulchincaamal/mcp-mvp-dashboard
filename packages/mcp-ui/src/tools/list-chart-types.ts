export interface ChartTypeInfo {
  type: string;
  description: string;
  bestFor: string;
  minRecords: number;
}

const CHART_TYPES: ChartTypeInfo[] = [
  {
    type: 'bar',
    description: 'Vertical bar chart for comparing values across categories',
    bestFor: 'Comparing discrete categories (e.g. sales by region, products by revenue)',
    minRecords: 2,
  },
  {
    type: 'line',
    description: 'Line chart for showing trends over time or sequential data',
    bestFor: 'Time series, trends, continuous data (e.g. monthly sales, growth over time)',
    minRecords: 3,
  },
  {
    type: 'pie',
    description: 'Pie chart for showing proportions of a whole',
    bestFor: 'Distribution/composition with few categories (e.g. market share, budget allocation)',
    minRecords: 2,
  },
  {
    type: 'doughnut',
    description: 'Doughnut chart similar to pie but with center space for key metric',
    bestFor: 'Rates, percentages, KPIs with context (e.g. retention rate, completion %)',
    minRecords: 2,
  },
  {
    type: 'area',
    description: 'Area chart like line but with filled area below for volume emphasis',
    bestFor: 'Cumulative values, volume over time (e.g. revenue growth, user accumulation)',
    minRecords: 3,
  },
];

export function listChartTypes(): ChartTypeInfo[] {
  return CHART_TYPES;
}
