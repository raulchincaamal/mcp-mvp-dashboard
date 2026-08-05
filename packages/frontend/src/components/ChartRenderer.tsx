import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Filler,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Line, Pie, Doughnut } from 'react-chartjs-2';
import type { ChartConfig } from '../types';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Filler,
  Title,
  Tooltip,
  Legend,
);

interface ChartRendererProps {
  config: ChartConfig;
}

export function ChartRenderer({ config }: ChartRendererProps) {
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: config.title,
        font: { size: 16 },
      },
      legend: {
        position: 'bottom' as const,
      },
    },
    scales: config.type !== 'pie' && config.type !== 'doughnut'
      ? {
          x: {
            title: {
              display: !!config.options.xAxis?.label,
              text: config.options.xAxis?.label || '',
            },
          },
          y: {
            title: {
              display: !!config.options.yAxis?.label,
              text: config.options.yAxis?.label || '',
            },
          },
        }
      : undefined,
  };

  const chartData = {
    labels: config.data.labels,
    datasets: config.data.datasets.map((ds) => ({
      ...ds,
      fill: config.type === 'area',
      tension: config.type === 'line' || config.type === 'area' ? 0.3 : undefined,
    })),
  };

  const renderChart = () => {
    switch (config.type) {
      case 'bar':
        return <Bar data={chartData} options={chartOptions} />;
      case 'line':
      case 'area':
        return <Line data={chartData} options={chartOptions} />;
      case 'pie':
        return <Pie data={chartData} options={chartOptions} />;
      case 'doughnut':
        return <Doughnut data={chartData} options={chartOptions} />;
      default:
        return <p>Unsupported chart type: {config.type}</p>;
    }
  };

  return (
    <div className="chart-container">
      {renderChart()}
    </div>
  );
}
