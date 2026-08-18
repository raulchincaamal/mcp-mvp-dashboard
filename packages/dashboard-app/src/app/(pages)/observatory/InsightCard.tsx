'use client';

import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import type { InsightData } from './state-machine';

interface InsightCardProps {
  insight: InsightData;
  index: number;
  visible: boolean;
}

export default function InsightCard({ insight, index, visible }: InsightCardProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current || !visible) return;
    const instance = echarts.init(chartRef.current, null, { renderer: 'canvas' });
    instanceRef.current = instance;
    instance.setOption(insight.chartOptions as echarts.EChartsOption);

    const ro = new ResizeObserver(() => instance.resize());
    ro.observe(chartRef.current);

    return () => {
      ro.disconnect();
      instance.dispose();
    };
  }, [visible, insight.chartOptions]);

  return (
    <div
      className="insight-card"
      data-index={index}
      data-primary={insight.isPrimary}
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(73,164,216,0.15)',
        borderRadius: 16,
        backdropFilter: 'blur(24px)',
        padding: insight.isPrimary ? '28px 32px' : '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        opacity: 0,
        transform: 'translateY(24px)',
        transition: 'none', // GSAP handles this
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <p style={{ fontSize: insight.isPrimary ? 13 : 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(73,164,216,0.8)', margin: 0 }}>
            {insight.title}
          </p>
          {insight.subtitle && (
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', margin: '2px 0 0', fontWeight: 400 }}>
              {insight.subtitle}
            </p>
          )}
        </div>
        {insight.metric && (
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <p style={{ fontSize: insight.isPrimary ? 28 : 20, fontWeight: 700, color: '#e0f2fe', margin: 0, letterSpacing: '-0.02em', lineHeight: 1 }}>
              {insight.metric}
            </p>
            {insight.metricLabel && (
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', margin: '3px 0 0' }}>
                {insight.metricLabel}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Chart */}
      <div
        ref={chartRef}
        style={{ flex: 1, minHeight: insight.isPrimary ? 200 : 140 }}
      />
    </div>
  );
}
