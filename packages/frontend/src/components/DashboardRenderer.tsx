import { ChartRenderer } from './ChartRenderer';
import type { DashboardConfig } from '../types';

interface DashboardRendererProps {
  config: DashboardConfig;
}

export function DashboardRenderer({ config }: DashboardRendererProps) {
  const gridStyle = config.layout === 'grid'
    ? { gridTemplateColumns: `repeat(${config.columns || 2}, 1fr)` }
    : {};

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>{config.title}</h2>
        {config.description && <p>{config.description}</p>}
      </div>

      <div className={`dashboard-grid ${config.layout}`} style={gridStyle}>
        {config.charts.map((chart, index) => (
          <div key={index} className="dashboard-card">
            <ChartRenderer config={chart} />
          </div>
        ))}
      </div>
    </div>
  );
}
