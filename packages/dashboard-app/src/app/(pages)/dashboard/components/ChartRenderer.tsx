'use client';

import {
  D3BarChart,
  D3LineChart,
  D3PieChart,
} from '@/shared/components/charts';
import type { ChartConfig } from '../types';

interface ChartRendererProps {
  config: ChartConfig;
}

export default function ChartRenderer({ config }: ChartRendererProps) {
  const xAxisLabel = config.options.xAxis?.label;
  const yAxisLabel = config.options.yAxis?.label;

  // Only handle standard chart types (bar, line, area, pie, doughnut)
  // Bollinger, stacked-area, diverging-bar use DynamicRenderer directly
  const data = config.data as {
    labels: string[];
    datasets: {
      label: string;
      data: number[];
      backgroundColor?: string | string[];
      borderColor?: string;
    }[];
  };

  if (!data || !('labels' in data)) {
    return <p>This chart type requires DynamicRenderer</p>;
  }

  switch (config.type) {
    case 'bar':
      return (
        <div className="relative w-full">
          <D3BarChart
            labels={data.labels}
            datasets={data.datasets.map((ds) => ({
              label: ds.label,
              data: ds.data,
              backgroundColor: ds.backgroundColor,
              borderColor: ds.borderColor,
            }))}
            title={config.title}
            xAxisLabel={xAxisLabel}
            yAxisLabel={yAxisLabel}
            stacked={config.options.stacked}
            height={300}
          />
        </div>
      );

    case 'line':
    case 'area':
      return (
        <div className="relative w-full">
          <D3LineChart
            labels={data.labels}
            datasets={data.datasets.map((ds) => ({
              label: ds.label,
              data: ds.data,
              borderColor: ds.borderColor,
              backgroundColor:
                typeof ds.backgroundColor === 'string'
                  ? ds.backgroundColor
                  : undefined,
              fill: config.type === 'area',
            }))}
            title={config.title}
            xAxisLabel={xAxisLabel}
            yAxisLabel={yAxisLabel}
            area={config.type === 'area'}
            height={300}
          />
        </div>
      );

    case 'pie':
    case 'doughnut': {
      const firstDs = data.datasets[0];
      return (
        <div className="relative w-full max-w-[360px] mx-auto">
          <D3PieChart
            labels={data.labels}
            data={firstDs.data}
            colors={
              Array.isArray(firstDs.backgroundColor)
                ? firstDs.backgroundColor
                : undefined
            }
            title={config.title}
            doughnut={config.type === 'doughnut'}
            height={320}
          />
        </div>
      );
    }

    default:
      return <p>Unsupported chart type: {config.type}</p>;
  }
}

