'use client';

import { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';

export interface MexicoMapDataPoint {
  name: string;   // estado name — must match GeoJSON property "name"
  value: number;
}

export interface MexicoMapChartProps {
  data: MexicoMapDataPoint[];
  title?: string;
  height?: number | string;
  gradient?: 'aurora' | 'neon' | 'fire' | 'ocean';
  bare?: boolean;
  /** @deprecated — transitions are now triggered by click */
  toggleInterval?: number;
}

// ─── Palette per gradient ─────────────────────────────────

const GRADIENT_COLORS: Record<string, string[]> = {
  aurora: ['#312e81', '#4f46e5', '#818cf8', '#c084fc', '#f472b6', '#fb923c', '#fcd34d'],
  neon:   ['#0066ff', '#00c6ff', '#00f5a0', '#a8ff3e', '#ffee00', '#ff8800', '#ff0088'],
  fire:   ['#f97316', '#fb923c', '#fbbf24', '#fde68a', '#fef9c3', '#ffffff', '#ffe4e6'],
  ocean:  ['#0ea5e9', '#38bdf8', '#7dd3fc', '#a5f3fc', '#6ee7b7', '#86efac', '#d9f99d'],
};

// ─── Component ────────────────────────────────────────────

export default function MexicoMapChart({
  data,
  title,
  height = 420,
  gradient = 'aurora',
  bare = false,
  toggleInterval = 3000,
}: MexicoMapChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<echarts.ECharts | null>(null);
  const modeRef      = useRef<'map' | 'bar'>('map');
  const [mode, setMode] = useState<'map' | 'bar'>('map');
  const [ready, setReady] = useState(false);

  const colors = GRADIENT_COLORS[gradient] ?? GRADIENT_COLORS.aurora;
  const sorted = [...data].sort((a, b) => a.value - b.value);
  const minVal = sorted[0]?.value ?? 0;
  const maxVal = sorted[sorted.length - 1]?.value ?? 1;

  // ─── Build options ──────────────────────────────────────

  function buildMapOption(): echarts.EChartsOption {
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: (p: unknown) => {
          const params = p as { name: string; value: number };
          return `<b>${params.name}</b><br/>${params.value?.toLocaleString('es-MX') ?? 'N/A'}`;
        },
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderColor: 'rgba(200,210,230,0.1)',
        borderWidth: 1,
        textStyle: { color: '#e6ecf4', fontSize: 12 },
        extraCssText: 'backdrop-filter:blur(8px);border-radius:8px;',
      },
      visualMap: {
        left: 'right',
        bottom: 16,
        min: minVal,
        max: maxVal,
        inRange: { color: colors },
        text: ['Alto', 'Bajo'],
        textStyle: { color: 'rgba(170,185,210,0.7)', fontSize: 10 },
        calculable: true,
        itemWidth: 12,
        itemHeight: 80,
      },
      series: [{
        id: 'geo-data',
        type: 'map',
        map: 'Mexico',
        roam: true,
        animationDurationUpdate: 800,
        universalTransition: true,
        emphasis: {
          label: { show: true, color: '#fff', fontSize: 10 },
          itemStyle: { areaColor: colors[colors.length - 1], shadowBlur: 12, shadowColor: colors[colors.length - 1] + '66' },
        },
        itemStyle: {
          borderColor: 'rgba(200,210,230,0.15)',
          borderWidth: 0.5,
        },
        data: sorted,
      }],
    };
  }

  function buildBarOption(): echarts.EChartsOption {
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          const list = Array.isArray(params) ? params : [params];
          const p = list[0] as { name?: string; value?: number; axisValueLabel?: string };
          const name = p.name ?? p.axisValueLabel ?? '';
          const val = p.value != null ? Number(p.value).toLocaleString('es-MX') : 'N/A';
          return `<b>${name}</b><br/>${val}`;
        },
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderColor: 'rgba(200,210,230,0.1)',
        borderWidth: 1,
        textStyle: { color: '#e6ecf4', fontSize: 12 },
        extraCssText: 'backdrop-filter:blur(8px);border-radius:8px;',
      },
      grid: { left: 16, right: 80, top: 8, bottom: 8, containLabel: true },
      xAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: 'rgba(170,185,210,0.5)', fontSize: 9 },
        splitLine: { lineStyle: { color: 'rgba(200,210,230,0.08)', type: 'dashed' } },
      },
      yAxis: {
        type: 'category',
        data: sorted.map(d => d.name),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: 'rgba(170,185,210,0.6)', fontSize: 9 },
      },
      visualMap: {
        show: false,
        min: minVal,
        max: maxVal,
        inRange: { color: colors },
      },
      animationDurationUpdate: 800,
      series: [{
        id: 'geo-data',
        type: 'bar',
        universalTransition: true,
        data: sorted.map(d => ({ name: d.name, value: d.value })),
        barMaxWidth: 16,
        itemStyle: { borderRadius: [0, 3, 3, 0] },
        emphasis: { itemStyle: { opacity: 0.85 } },
      }],
    };
  }

  function toggle() {
    if (!chartRef.current) return;
    const next = modeRef.current === 'map' ? 'bar' : 'map';
    modeRef.current = next;
    setMode(next);
    chartRef.current.setOption(
      next === 'map' ? buildMapOption() : buildBarOption(),
      { replaceMerge: ['series'] }
    );
  }

  // ─── Init chart ─────────────────────────────────────────

  useEffect(() => {
    if (!containerRef.current) return;

    fetch('/mexico.json')
      .then(r => r.json())
      .then(geoJson => {
        echarts.registerMap('Mexico', geoJson);

        const chart = echarts.init(containerRef.current!, undefined, { renderer: 'canvas' });
        chartRef.current = chart;
        chart.setOption(buildMapOption());
        setReady(true);

        const ro = new ResizeObserver(() => chart.resize());
        ro.observe(containerRef.current!);
        return () => { ro.disconnect(); };
      });

    return () => {
      chartRef.current?.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-apply options when data/gradient changes (after init)
  useEffect(() => {
    if (!ready || !chartRef.current) return;
    chartRef.current.setOption(
      modeRef.current === 'map' ? buildMapOption() : buildBarOption(),
      { replaceMerge: ['series'] }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, gradient, ready]);

  const h = typeof height === 'number' ? `${height}px` : height;

  return (
    <div style={bare ? { width: '100%', height: h } : {
      background: 'var(--surface)',
      backdropFilter: 'var(--surface-blur)',
      WebkitBackdropFilter: 'var(--surface-blur)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius)',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.9rem 1.1rem 0.5rem' }}>
        {title && (
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.01em' }}>
            {title}
          </div>
        )}
        {ready && (
          <button
            onClick={(e) => { e.stopPropagation(); toggle(); }}
            style={{
              fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.04em',
              color: 'var(--text-tertiary)', background: 'var(--surface-2)',
              border: '1px solid var(--border-color)', borderRadius: 6,
              padding: '3px 10px', cursor: 'pointer', transition: 'color 0.15s',
              flexShrink: 0, marginLeft: 'auto', position: 'relative', zIndex: 10,
            }}
          >
            {mode === 'map' ? '▦ Ver barras' : '🗺 Ver mapa'}
          </button>
        )}
      </div>
      <div ref={containerRef} style={{ width: '100%', height: `calc(${h} - 44px)` }} />
    </div>
  );
}
