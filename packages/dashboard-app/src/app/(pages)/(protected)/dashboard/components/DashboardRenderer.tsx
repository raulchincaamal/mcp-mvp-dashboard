"use client";

import { Card } from "@macropaytd/lib-front-ui-components";
import ChartRenderer from "./ChartRenderer";
import type { DashboardConfig } from "../types";

interface DashboardRendererProps {
  config: DashboardConfig;
}

export default function DashboardRenderer({ config }: DashboardRendererProps) {
  const gridCols =
    config.layout === "grid"
      ? `grid-cols-1 md:grid-cols-${config.columns || 2}`
      : "grid-cols-1";

  return (
    <div className="space-y-4">
      <div>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.03em', lineHeight: 1.15 }}>
          {config.title}
        </h1>
        {config.description && (
          <Text size="sm" className="text-muted-foreground">
            {config.description}
          </Text>
        )}
      </div>

      <div className={`grid gap-4 ${gridCols}`}>
        {config.charts.map((chart, index) => (
          <Card key={index} className="p-4">
            <ChartRenderer config={chart} />
          </Card>
        ))}
      </div>
    </div>
  );
}
