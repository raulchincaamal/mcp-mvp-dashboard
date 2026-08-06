"use client";

import {
  Button,
  Input,
  Card,
  Badge,
  Text,
  RadioGroup,
  Checkbox,
  Avatar,
} from "@macropaytd/lib-front-ui-components";
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
} from "chart.js";
import { Bar, Line, Pie, Doughnut } from "react-chartjs-2";

// Register Chart.js
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

// ─── Types ─────────────────────────────────────────────────

export interface UIComponentConfig {
  component: string;
  props: Record<string, unknown>;
  children?: (UIComponentConfig | string)[];
}

export interface UIConfig {
  title: string;
  description?: string;
  layout: "vertical" | "grid";
  columns?: number;
  components: UIComponentConfig[];
}

// ─── Component Map ─────────────────────────────────────────

const componentMap: Record<string, React.ComponentType<Record<string, unknown>>> = {
  Button: Button as unknown as React.ComponentType<Record<string, unknown>>,
  Input: Input as unknown as React.ComponentType<Record<string, unknown>>,
  Card: Card as unknown as React.ComponentType<Record<string, unknown>>,
  Badge: Badge as unknown as React.ComponentType<Record<string, unknown>>,
  Text: Text as unknown as React.ComponentType<Record<string, unknown>>,
  RadioGroup: RadioGroup as unknown as React.ComponentType<Record<string, unknown>>,
  Checkbox: Checkbox as unknown as React.ComponentType<Record<string, unknown>>,
  Avatar: Avatar as unknown as React.ComponentType<Record<string, unknown>>,
};

// ─── Renderers ─────────────────────────────────────────────

function renderTable(props: Record<string, unknown>) {
  const columns = props.columns as { key: string; label: string }[] | undefined;
  const rows = props.rows as Record<string, unknown>[] | undefined;

  if (!columns || !rows) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b">
            {columns.map((col) => (
              <th key={col.key} className="text-left p-2 font-medium text-muted-foreground">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b last:border-0">
              {columns.map((col) => (
                <td key={col.key} className="p-2">
                  {String(row[col.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderChart(props: Record<string, unknown>) {
  const type = props.type as string;
  const data = props.data as { labels: string[]; datasets: Record<string, unknown>[] };
  const options = props.options as Record<string, unknown> | undefined;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom" as const },
    },
    scales:
      type !== "pie" && type !== "doughnut"
        ? {
            x: {
              title: {
                display: !!(options?.xAxis as Record<string, unknown>)?.label,
                text: ((options?.xAxis as Record<string, unknown>)?.label as string) || "",
              },
            },
            y: {
              title: {
                display: !!(options?.yAxis as Record<string, unknown>)?.label,
                text: ((options?.yAxis as Record<string, unknown>)?.label as string) || "",
              },
            },
          }
        : undefined,
  };

  const chartData = {
    labels: data.labels,
    datasets: data.datasets.map((ds) => ({
      ...ds,
      fill: type === "area",
      tension: type === "line" || type === "area" ? 0.3 : undefined,
    })),
  };

  return (
    <div className="relative h-[300px] w-full">
      {type === "bar" && <Bar data={chartData as never} options={chartOptions} />}
      {(type === "line" || type === "area") && <Line data={chartData as never} options={chartOptions} />}
      {type === "pie" && <Pie data={chartData as never} options={chartOptions} />}
      {type === "doughnut" && <Doughnut data={chartData as never} options={chartOptions} />}
    </div>
  );
}

// ─── Recursive Component Renderer ──────────────────────────

function RenderComponent({ config }: { config: UIComponentConfig }) {
  const { component, props, children } = config;

  // Special components that aren't in the componentMap
  if (component === "Table") {
    return renderTable(props);
  }

  if (component === "Chart") {
    return renderChart(props);
  }

  const Component = componentMap[component];

  if (!Component) {
    return (
      <div className="p-2 border border-dashed border-destructive rounded text-sm text-destructive">
        Unknown component: {component}
      </div>
    );
  }

  // Render children recursively
  const renderedChildren = children?.map((child, i) => {
    if (typeof child === "string") {
      return <span key={i}>{child}</span>;
    }
    return <RenderComponent key={i} config={child} />;
  });

  return <Component {...props}>{renderedChildren}</Component>;
}

// ─── Main DynamicRenderer ──────────────────────────────────

interface DynamicRendererProps {
  config: UIConfig;
}

export default function DynamicRenderer({ config }: DynamicRendererProps) {
  const gridClass =
    config.layout === "grid"
      ? `grid gap-4 grid-cols-1 md:grid-cols-${config.columns || 2}`
      : "flex flex-col gap-4";

  return (
    <div className="space-y-4">
      {config.description && (
        <Text size="sm" className="text-muted-foreground">
          {config.description}
        </Text>
      )}

      <div className={gridClass}>
        {config.components.map((comp, i) => (
          <RenderComponent key={i} config={comp} />
        ))}
      </div>
    </div>
  );
}
