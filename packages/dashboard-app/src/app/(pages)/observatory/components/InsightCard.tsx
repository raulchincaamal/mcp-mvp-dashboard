'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import * as echarts from 'echarts';
import GlassPanel from './GlassPanel';
import type { CursorState } from '../hooks/useCursor';
import type { InsightData } from '../state-machine';

interface Props {
  insight: InsightData;
  cursor: CursorState;
  index: number;
  visible: boolean;
  onRevealComplete?: () => void;
}

export default function InsightCard({ insight, cursor, index, visible, onRevealComplete }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [phase, setPhase] = useState<'hidden' | 'border' | 'content' | 'chart' | 'complete'>('hidden');

  useEffect(() => {
    if (!visible || !containerRef.current) return;

    const tl = gsap.timeline({
      onComplete: () => {
        setPhase('complete');
        onRevealComplete?.();
      },
    });

    tl.fromTo(containerRef.current,
      { opacity: 0, scale: 0.92, y: 30 },
      { opacity: 1, scale: 1, y: 0, duration: 0.5, ease: 'power3.out', delay: index * 0.15 },
    );

    setPhase('border');
    tl.add(() => setPhase('content'), '+=0.1');
    tl.add(() => setPhase('chart'), '+=0.2');

  }, [visible, index, onRevealComplete]);

  useEffect(() => {
    if (phase !== 'chart' && phase !== 'complete') return;
    if (!chartRef.current || chartInstance.current) return;

    const instance = echarts.init(chartRef.current, null, { renderer: 'canvas' });
    chartInstance.current = instance;

    // Get computed styles for theming
    const style = getComputedStyle(document.documentElement);
    const textColor = style.getPropertyValue('--text-secondary').trim() || 'rgba(200, 220, 255, 0.82)';
    const borderColor = style.getPropertyValue('--border-color').trim() || 'rgba(73, 164, 216, 0.14)';

    const option = {
      ...insight.chartOptions,
      backgroundColor: 'transparent',
      animation: true,
      animationDuration: 1200,
      animationEasing: 'cubicOut',
      textStyle: { color: textColor },
    };

    instance.setOption(option as echarts.EChartsOption);

    const ro = new ResizeObserver(() => instance.resize());
    ro.observe(chartRef.current);

    return () => {
      ro.disconnect();
      instance.dispose();
      chartInstance.current = null;
    };
  }, [phase, insight.chartOptions]);

  const showContent = phase === 'content' || phase === 'chart' || phase === 'complete';
  const showChart = phase === 'chart' || phase === 'complete';

  return (
    <div
      ref={containerRef}
      style={{
        opacity: 0,
        gridColumn: insight.isPrimary ? '1 / -1' : undefined,
      }}
    >
      <GlassPanel
        cursor={cursor}
        depth={insight.isPrimary ? 0.6 : 0.4}
        style={{ height: '100%' }}
      >
        <div style={{
          padding: insight.isPrimary ? '28px 32px' : '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          gap: 16,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            opacity: showContent ? 1 : 0,
            transform: showContent ? 'translateY(0)' : 'translateY(8px)',
            transition: 'all 0.4s ease',
          }}>
            <div>
              <p style={{
                fontSize: insight.isPrimary ? 11 : 9,
                fontWeight: 600,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--primary)',
                margin: 0,
              }}>
                {insight.title}
              </p>
              {insight.subtitle && (
                <p style={{
                  fontSize: 12,
                  color: 'var(--text-tertiary)',
                  margin: '4px 0 0',
                }}>
                  {insight.subtitle}
                </p>
              )}
            </div>
            {insight.metric && (
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{
                  fontSize: insight.isPrimary ? 32 : 24,
                  fontWeight: 700,
                  color: 'var(--text)',
                  margin: 0,
                  letterSpacing: '-0.02em',
                  lineHeight: 1,
                }}>
                  {insight.metric}
                </p>
                {insight.metricLabel && (
                  <p style={{
                    fontSize: 10,
                    color: 'var(--text-tertiary)',
                    margin: '4px 0 0',
                  }}>
                    {insight.metricLabel}
                  </p>
                )}
              </div>
            )}
          </div>

          <div
            ref={chartRef}
            style={{
              flex: 1,
              minHeight: insight.isPrimary ? 220 : 160,
              opacity: showChart ? 1 : 0,
              transition: 'opacity 0.5s ease',
            }}
          />
        </div>
      </GlassPanel>
    </div>
  );
}
