'use client';

import { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';

export interface HexbinDataPoint {
  /** Estado name — used as label */
  name: string;
  /** Longitude (decimal degrees) */
  lon: number;
  /** Latitude (decimal degrees) */
  lat: number;
  /** Metric value — drives hexagon color */
  value: number;
  /** Optional: drives hexagon size (defaults to value) */
  size?: number;
}

export interface MexicoHexbinChartProps {
  data: HexbinDataPoint[];
  title?: string;
  height?: number | string;
  gradient?: 'aurora' | 'neon' | 'fire' | 'ocean';
  bare?: boolean;
  /** Hexagon radius in geo units (degrees). Default: 1.2 */
  hexRadius?: number;
  colorLabel?: string;
  sizeLabel?: string;
}

// ─── Palette ──────────────────────────────────────────────

const GRADIENT_COLORS: Record<string, string[]> = {
  aurora: ['#1e1b4b', '#3730a3', '#6366f1', '#818cf8', '#c084fc', '#f9a8d4', '#fcd34d'],
  neon:   ['#0d0d1a', '#0066ff', '#00f5ff', '#00ff99', '#ffff00', '#ff8800', '#ff0088'],
  fire:   ['#1a0500', '#7c2d12', '#c2410c', '#f97316', '#fbbf24', '#fef08a', '#ffffff'],
  ocean:  ['#0c1a2e', '#0e4d7a', '#0ea5e9', '#38bdf8', '#7dd3fc', '#bae6fd', '#e0f2fe'],
};

// ─── Hexbin statistics (port of d3-hexbin) ────────────────

interface HexBin {
  x: number;
  y: number;
  points: HexbinDataPoint[];
}

function hexBinStatistics(points: HexbinDataPoint[], r: number): { bins: HexBin[]; maxCount: number } {
  const dx = r * 2 * Math.sin(Math.PI / 3);
  const dy = r * 1.5;
  const binsById: Record<string, HexBin> = {};
  const bins: HexBin[] = [];

  for (const point of points) {
    let px = point.lon / dx;
    let py = point.lat / dy;
    const pj = Math.round(py);
    const pi = Math.round(px - (pj & 1) / 2);
    const py1 = py - pj;
    if (Math.abs(py1) * 3 > 1) {
      const px1 = px - pi;
      const pi2 = pi + (px < pi ? -1 : 1) / 2;
      const pj2 = pj + (py < pj ? -1 : 1);
      const px2 = px - pi2;
      const py2 = py - pj2;
      if (px1 * px1 + py1 * py1 > px2 * px2 + py2 * py2) {
        px = pi2 + (pj & 1 ? 1 : -1) / 2;
        py = pj2;
      }
    }
    const id = `${Math.round(px)}-${Math.round(py)}`;
    if (binsById[id]) {
      binsById[id].points.push(point);
    } else {
      const bin: HexBin = { x: (Math.round(px) + (pj & 1) / 2) * dx, y: pj * dy, points: [point] };
      binsById[id] = bin;
      bins.push(bin);
    }
  }

  const maxCount = bins.reduce((m, b) => Math.max(m, b.points.length), 0);
  return { bins, maxCount };
}

// ─── Component ────────────────────────────────────────────

export default function MexicoHexbinChart({
  data,
  title,
  height = 420,
  gradient = 'aurora',
  bare = false,
  hexRadius = 1.2,
  colorLabel = 'Valor',
  sizeLabel = 'Cantidad',
}: MexicoHexbinChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<echarts.ECharts | null>(null);
  const [ready, setReady] = useState(false);

  const colors = GRADIENT_COLORS[gradient] ?? GRADIENT_COLORS.aurora;

  useEffect(() => {
    if (!containerRef.current) return;
    let disposed = false;

    fetch('/mexico.json')
      .then(r => r.json())
      .then((geoJson: unknown) => {
        if (disposed) return;

        echarts.registerMap('Mexico', geoJson as Parameters<typeof echarts.registerMap>[1]);

        const chart = echarts.init(containerRef.current!, undefined, { renderer: 'canvas' });
        chartRef.current = chart;

        // Build hexbins from lat/lon data
        const { bins, maxCount } = hexBinStatistics(data, hexRadius);

        // Each bin: [lon, lat, count, avgValue]
        const hexData = bins.map(bin => {
          const avgValue = bin.points.reduce((s, p) => s + p.value, 0) / bin.points.length;
          return [bin.x, bin.y, bin.points.length, avgValue];
        });

        const maxValue = Math.max(...data.map(d => d.value), 1);
        const minValue = Math.min(...data.map(d => d.value), 0);

        function renderHexBin(params: echarts.CustomSeriesRenderItemParams, api: echarts.CustomSeriesRenderItemAPI) {
          const center = api.coord([api.value(0), api.value(1)]);
          const maxViewRadius = (api.size as (v: number[]) => number[])([hexRadius, 0])[0];
          const minViewRadius = Math.max(maxViewRadius * 0.25, 3);
          const count = api.value(2) as number;
          const viewRadius = minViewRadius + (maxViewRadius - minViewRadius) * Math.sqrt(count / Math.max(maxCount, 1));

          const points: [number, number][] = [];
          const bgPoints: [number, number][] = [];
          for (let i = 0, angle = Math.PI / 6; i < 6; i++, angle += Math.PI / 3) {
            points.push([center[0] + viewRadius * Math.cos(angle), center[1] + viewRadius * Math.sin(angle)]);
            bgPoints.push([center[0] + maxViewRadius * Math.cos(angle), center[1] + maxViewRadius * Math.sin(angle)]);
          }

          return {
            type: 'group',
            children: [
              {
                type: 'polygon',
                shape: { points: bgPoints },
                style: { fill: 'rgba(0,0,0,0.35)', stroke: null, lineWidth: 0 },
                z2: -1,
              },
              {
                type: 'polygon',
                shape: { points },
                style: {
                  fill: api.visual('color'),
                  stroke: 'rgba(255,255,255,0.15)',
                  lineWidth: 0.5,
                },
              },
            ],
          };
        }

        const option: echarts.EChartsOption = {
          backgroundColor: 'transparent',
          tooltip: {
            backgroundColor: 'rgba(8,16,32,0.95)',
            borderColor: 'rgba(0,200,240,0.3)',
            borderWidth: 1,
            textStyle: { color: '#e4f0ff', fontSize: 12 },
            extraCssText: 'backdrop-filter:blur(12px);border-radius:8px;',
            formatter: (p: unknown) => {
              const params = p as { value: number[] };
              const [, , count, avg] = params.value;
              return `<b>${sizeLabel}:</b> ${count}<br/><b>${colorLabel}:</b> ${avg.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;
            },
          },
          animation: false,
          geo: {
            map: 'Mexico',
            left: 0, right: 0, top: 0, bottom: 0,
            roam: true,
            silent: true,
            itemStyle: {
              areaColor: 'rgba(30,27,75,0.4)',
              borderColor: 'rgba(99,102,241,0.3)',
              borderWidth: 0.8,
            },
            emphasis: { disabled: true },
          },
          visualMap: {
            type: 'continuous',
            orient: 'horizontal',
            right: 16,
            top: 16,
            min: minValue,
            max: maxValue,
            dimension: 3,
            calculable: true,
            text: [null, colorLabel],
            inRange: { color: colors },
            textStyle: { color: 'rgba(170,185,210,0.7)', fontSize: 10 },
            itemWidth: 12,
            itemHeight: 80,
          },
          series: [{
            type: 'custom',
            coordinateSystem: 'geo',
            geoIndex: 0,
            renderItem: renderHexBin as never,
            dimensions: [null, null, sizeLabel, colorLabel],
            encode: { tooltip: [2, 3] },
            data: hexData,
          }],
        };

        chart.setOption(option);
        setReady(true);

        const ro = new ResizeObserver(() => chart.resize());
        ro.observe(containerRef.current!);
      });

    return () => {
      disposed = true;
      chartRef.current?.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-apply when data/gradient changes
  useEffect(() => {
    if (!ready || !chartRef.current) return;
    const { bins, maxCount } = hexBinStatistics(data, hexRadius);
    const hexData = bins.map(bin => {
      const avgValue = bin.points.reduce((s, p) => s + p.value, 0) / bin.points.length;
      return [bin.x, bin.y, bin.points.length, avgValue];
    });
    const maxValue = Math.max(...data.map(d => d.value), 1);
    const minValue = Math.min(...data.map(d => d.value), 0);
    chartRef.current.setOption({
      visualMap: { min: minValue, max: maxValue, inRange: { color: GRADIENT_COLORS[gradient] ?? GRADIENT_COLORS.aurora } },
      series: [{ data: hexData }],
    });
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
      {title && (
        <div style={{ padding: '0.9rem 1.1rem 0', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.01em' }}>
          {title}
        </div>
      )}
      <div ref={containerRef} style={{ width: '100%', height: h }} />
    </div>
  );
}
