'use client';

import { useRef, useCallback, useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import gsap from 'gsap';

// ─── Types ─────────────────────────────────────────────────

// Flat array format (preferred — AntV/mcp-echarts style, easiest for LLM)
export interface FlatDataPoint {
  category: string;
  value: number;
  group?: string;
}

// Flint semantic spec (Microsoft Flint — highest quality output)
export interface FlintSpec {
  chartType: string;                                    // e.g. 'Bar Chart', 'Scatter Plot'
  encodings: Record<string, { field: string } | string>;
  semantic_types?: Record<string, string>;              // e.g. { estado: 'Country', ventas: 'Quantity' }
  title?: string;
  baseSize?: { width: number; height: number };
}

// Legacy Chart.js-style format (still supported for deterministic code)
export interface LegacyChartData {
  labels: string[];
  datasets: Array<{ label?: string; data: number[] }>;
}

export type AuroraChartData = FlatDataPoint[] | LegacyChartData;

export interface AuroraChartProps {
  type: 'bar' | 'line' | 'area' | 'pie' | 'doughnut' | 'scatter' | 'radar' | 'funnel' | 'gauge' | 'heatmap' | 'treemap';
  data: AuroraChartData;
  flint?: FlintSpec;
  flintData?: Record<string, unknown>[];
  title?: string;
  height?: number | string;
  gradient?: 'aurora' | 'neon' | 'fire' | 'ocean';
  bare?: boolean; // strips wrapper card styles — use when embedded in another card
}

// ─── Flat → Legacy normalizer ───────────────────────────────

function normalizeFlatData(data: AuroraChartData): LegacyChartData {
  // Already legacy format
  if (!Array.isArray(data)) return data;
  if (data.length === 0) return { labels: [], datasets: [{ data: [] }] };

  const hasGroup = data.some(d => d.group != null);

  if (!hasGroup) {
    return {
      labels: data.map(d => d.category),
      datasets: [{ label: '', data: data.map(d => d.value) }],
    };
  }

  // Grouped: pivot into multiple datasets
  const groups = [...new Set(data.map(d => d.group!))];
  const categories = [...new Set(data.map(d => d.category))];
  return {
    labels: categories,
    datasets: groups.map(g => ({
      label: g,
      data: categories.map(cat => {
        const point = data.find(d => d.category === cat && d.group === g);
        return point?.value ?? 0;
      }),
    })),
  };
}

// ─── Theme tokens from CSS vars ────────────────────────────

function readTokens() {
  if (typeof window === 'undefined') {
    return {
      bg: '#282c34', surface: 'rgba(255,255,255,0.06)',
      text: '#e6ecf4', textTertiary: 'rgba(170,185,210,0.5)',
      border: 'rgba(200,210,230,0.1)',
    };
  }
  const s = getComputedStyle(document.documentElement);
  const v = (k: string, fb: string) => s.getPropertyValue(k).trim() || fb;
  return {
    bg:           v('--bg',           '#282c34'),
    surface:      v('--surface',      'rgba(255,255,255,0.06)'),
    text:         v('--text',         '#e6ecf4'),
    textTertiary: v('--text-tertiary','rgba(170,185,210,0.5)'),
    border:       v('--border-color', 'rgba(200,210,230,0.1)'),
  };
}

function useThemeTokens() {
  const [t, setT] = useState<ReturnType<typeof readTokens> | null>(null);

  useEffect(() => {
    setT(readTokens());
    const obs = new MutationObserver(() => setT(readTokens()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  return t;
}

// ─── Palettes ──────────────────────────────────────────────

const PALETTES: Record<string, [string, string][]> = {
  aurora: [
    ['#c084fc', '#818cf8'], ['#67e8f9', '#60a5fa'], ['#f9a8d4', '#c084fc'],
    ['#6ee7b7', '#34d399'], ['#fcd34d', '#fb923c'], ['#fca5a5', '#f472b6'],
  ],
  neon: [
    ['#00f5ff', '#0066ff'], ['#ff00ff', '#8800ff'], ['#00ff99', '#00ccff'],
    ['#ffff00', '#ff8800'], ['#ff0088', '#ff00ff'], ['#88ff00', '#00ffaa'],
  ],
  fire: [
    ['#fde68a', '#f97316'], ['#fbbf24', '#ef4444'], ['#fef08a', '#fbbf24'],
    ['#fca5a5', '#dc2626'], ['#fed7aa', '#f97316'], ['#fef9c3', '#fbbf24'],
  ],
  ocean: [
    ['#a5f3fc', '#38bdf8'], ['#7dd3fc', '#0ea5e9'], ['#bae6fd', '#06b6d4'],
    ['#e0f2fe', '#38bdf8'], ['#67e8f9', '#0284c7'], ['#cffafe', '#0e7490'],
  ],
};

// ─── Gradient helpers ───────────────────────────────────────

function vGrad(top: string, bot: string) {
  return {
    type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1,
    colorStops: [{ offset: 0, color: top }, { offset: 1, color: bot + '55' }],
  };
}

function rGrad(top: string, bot: string) {
  return {
    type: 'radial' as const, x: 0.5, y: 0.4, r: 0.7,
    colorStops: [{ offset: 0, color: top }, { offset: 1, color: bot }],
  };
}

// ─── Option builders ────────────────────────────────────────

type Tokens = ReturnType<typeof readTokens>;

function barOption(rawData: AuroraChartData, title: string | undefined, palette: [string,string][], tk: Tokens): EChartsOption {
  const data = normalizeFlatData(rawData);
  const multi = data.datasets.length > 1;
  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis' as const,
      axisPointer: { type: 'shadow' as const, shadowStyle: { color: tk.border } },
      backgroundColor: tk.surface,
      borderColor: tk.border,
      borderWidth: 1,
      textStyle: { color: tk.text, fontSize: 12 },
      extraCssText: 'backdrop-filter:blur(8px);border-radius:8px;',
    },
    legend: multi ? { bottom: 4, textStyle: { color: tk.textTertiary, fontSize: 11 }, icon: 'roundRect' } : undefined,
    grid: { left: 16, right: 16, bottom: multi ? 40 : 24, top: title ? 40 : 16, containLabel: true },
    xAxis: {
      type: 'category', data: data.labels,
      axisLine: { lineStyle: { color: tk.border } },
      axisTick: { show: false },
      axisLabel: { color: tk.textTertiary, fontSize: 11, fontFamily: 'inherit', rotate: data.labels.length > 7 ? 35 : 0 },
    },
    yAxis: {
      type: 'value', axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: tk.textTertiary, fontSize: 11, fontFamily: 'inherit' },
      splitLine: { lineStyle: { color: tk.border, type: 'dashed' } },
    },
    series: data.datasets.map((ds, di) => ({
      name: ds.label ?? '',
      type: 'bar' as const,
      data: multi
        ? ds.data.map(v => ({ value: v, itemStyle: { color: vGrad(palette[di % palette.length][0], palette[di % palette.length][1]), borderRadius: [4, 4, 0, 0] } }))
        : ds.data.map((v, i) => ({ value: v, itemStyle: { color: vGrad(palette[i % palette.length][0], palette[i % palette.length][1]), borderRadius: [4, 4, 0, 0] } })),
      barMaxWidth: 48,
      barCategoryGap: '35%',
      itemStyle: { borderRadius: [4, 4, 0, 0] },
      emphasis: { itemStyle: { opacity: 0.85 } },
    })),
    animationDuration: 900,
    animationEasing: 'cubicOut' as const,
  };
}

function lineOption(rawData: AuroraChartData, title: string | undefined, palette: [string,string][], tk: Tokens, isArea: boolean): EChartsOption {
  const data = normalizeFlatData(rawData);
  const multi = data.datasets.length > 1;
  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: tk.surface, borderColor: tk.border, borderWidth: 1,
      textStyle: { color: tk.text, fontSize: 12 },
      extraCssText: 'backdrop-filter:blur(8px);border-radius:8px;',
    },
    legend: multi ? { bottom: 4, textStyle: { color: tk.textTertiary, fontSize: 11 } } : undefined,
    grid: { left: 16, right: 16, bottom: multi ? 40 : 24, top: title ? 40 : 16, containLabel: true },
    xAxis: {
      type: 'category', data: data.labels, boundaryGap: false,
      axisLine: { lineStyle: { color: tk.border } }, axisTick: { show: false },
      axisLabel: { color: tk.textTertiary, fontSize: 11, fontFamily: 'inherit', rotate: data.labels.length > 8 ? 35 : 0, interval: data.labels.length > 16 ? Math.floor(data.labels.length / 10) : 0 },
    },
    yAxis: {
      type: 'value', axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: tk.textTertiary, fontSize: 11, fontFamily: 'inherit' },
      splitLine: { lineStyle: { color: tk.border, type: 'dashed' } },
    },
    series: data.datasets.map((ds, di) => {
      const [top, bot] = palette[di % palette.length];
      return {
        name: ds.label ?? '',
        type: 'line' as const,
        data: ds.data,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2.5, color: top },
        itemStyle: { color: top, borderColor: tk.bg, borderWidth: 2 },
        areaStyle: isArea ? {
          color: {
            type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: top + '40' }, { offset: 1, color: bot + '05' }],
          },
        } : undefined,
      };
    }),
    animationDuration: 1000,
    animationEasing: 'cubicOut' as const,
  };
}

function pieOption(rawData: AuroraChartData, title: string | undefined, palette: [string,string][], tk: Tokens, isDoughnut: boolean): EChartsOption {
  const data = normalizeFlatData(rawData);
  const ds = data.datasets[0];
  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item', formatter: '{b}: {c} ({d}%)',
      backgroundColor: tk.surface, borderColor: tk.border, borderWidth: 1,
      textStyle: { color: tk.text, fontSize: 12 },
      extraCssText: 'backdrop-filter:blur(8px);border-radius:8px;',
    },
    legend: {
      orient: 'horizontal', bottom: 4,
      textStyle: { color: tk.textTertiary, fontSize: 11 },
      icon: 'circle',
    },
    series: [{
      type: 'pie' as const,
      radius: isDoughnut ? ['42%', '70%'] : ['0%', '70%'],
      center: ['50%', '46%'],
      itemStyle: { borderRadius: isDoughnut ? 6 : 3, borderColor: tk.bg, borderWidth: 2 },
      label: { show: false },
      labelLine: { show: false },
      emphasis: {
        scale: true, scaleSize: 8,
        label: { show: true, color: tk.text, fontSize: 13, fontWeight: 600 },
      },
      data: data.labels.map((label, i) => ({
        name: label,
        value: ds.data[i],
        itemStyle: {
          color: rGrad(palette[i % palette.length][0], palette[i % palette.length][1]),
        },
      })),
    }],
    animationType: 'scale' as const,
    animationDuration: 900,
    animationEasing: 'cubicOut' as const,
  };
}

// ─── Scatter ───────────────────────────────────────────────
// data.datasets[0].data = flat array, data.datasets[1].data = y values
// OR data.labels = x values, data.datasets[0].data = y values

function scatterOption(rawData: AuroraChartData, title: string | undefined, palette: [string,string][], tk: Tokens): EChartsOption {
  const data = normalizeFlatData(rawData);
  const allNumeric = data.labels.every(l => !isNaN(parseFloat(l)) && isFinite(Number(l)));
  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: ((p: unknown) => {
        const v = (p as { value: number[]; name?: string }).value;
        const label = allNumeric ? '' : data.labels[v[2] as number] ?? '';
        return label ? `${label}<br/>X: ${v[0]}, Y: ${v[1]}` : `X: ${v[0]}, Y: ${v[1]}`;
      }) as never,
      backgroundColor: tk.surface, borderColor: tk.border, borderWidth: 1,
      textStyle: { color: tk.text, fontSize: 12 },
      extraCssText: 'backdrop-filter:blur(8px);border-radius:8px;',
    },
    grid: { left: 16, right: 16, bottom: 24, top: title ? 40 : 16, containLabel: true },
    xAxis: {
      type: 'value', axisLine: { lineStyle: { color: tk.border } }, axisTick: { show: false },
      axisLabel: { color: tk.textTertiary, fontSize: 11 },
      splitLine: { lineStyle: { color: tk.border, type: 'dashed' } },
      name: allNumeric ? '' : 'X',
    },
    yAxis: {
      type: 'value', axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: tk.textTertiary, fontSize: 11 },
      splitLine: { lineStyle: { color: tk.border, type: 'dashed' } },
    },
    series: data.datasets.map((ds, di) => {
      const [top] = palette[di % palette.length];
      const points = data.labels.map((x, i) => {
        const xVal = parseFloat(x);
        // Store index as 3rd element for tooltip label lookup
        return [isNaN(xVal) ? i : xVal, ds.data[i] ?? 0, i];
      });
      return {
        name: ds.label ?? '',
        type: 'scatter' as const,
        data: points,
        symbolSize: 8,
        itemStyle: { color: top, opacity: 0.8 },
        emphasis: { itemStyle: { opacity: 1, shadowBlur: 6, shadowColor: top } },
      };
    }),
    animationDuration: 800,
    animationEasing: 'cubicOut' as const,
  };
}

// ─── Radar ─────────────────────────────────────────────────

function radarOption(rawData: AuroraChartData, title: string | undefined, palette: [string,string][], tk: Tokens): EChartsOption {
  const data = normalizeFlatData(rawData);
  const maxVal = Math.max(...data.datasets.flatMap(d => d.data)) * 1.2;
  return {
    backgroundColor: 'transparent',
    tooltip: {
      backgroundColor: tk.surface, borderColor: tk.border, borderWidth: 1,
      textStyle: { color: tk.text, fontSize: 12 },
      extraCssText: 'backdrop-filter:blur(8px);border-radius:8px;',
    },
    legend: data.datasets.length > 1 ? { bottom: 4, textStyle: { color: tk.textTertiary, fontSize: 11 } } : undefined,
    radar: {
      indicator: data.labels.map(l => ({ name: l, max: maxVal })),
      axisName: { color: tk.textTertiary, fontSize: 11 },
      splitLine: { lineStyle: { color: tk.border } },
      splitArea: { show: false },
      axisLine: { lineStyle: { color: tk.border } },
      shape: 'polygon',
    },
    series: [{
      type: 'radar' as const,
      data: data.datasets.map((ds, di) => {
        const [top] = palette[di % palette.length];
        return {
          name: ds.label ?? '',
          value: ds.data,
          lineStyle: { color: top, width: 2 },
          itemStyle: { color: top },
          areaStyle: { color: top + '22' },
        };
      }),
    }],
    animationDuration: 900,
    animationEasing: 'cubicOut' as const,
  };
}

// ─── Funnel ────────────────────────────────────────────────

function funnelOption(rawData: AuroraChartData, title: string | undefined, palette: [string,string][], tk: Tokens): EChartsOption {
  const data = normalizeFlatData(rawData);
  const ds = data.datasets[0];
  const sorted = data.labels
    .map((l, i) => ({ name: l, value: ds.data[i] }))
    .sort((a, b) => b.value - a.value);
  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item', formatter: '{b}: {c}',
      backgroundColor: tk.surface, borderColor: tk.border, borderWidth: 1,
      textStyle: { color: tk.text, fontSize: 12 },
      extraCssText: 'backdrop-filter:blur(8px);border-radius:8px;',
    },
    series: [{
      type: 'funnel' as const,
      left: '10%', width: '80%',
      top: title ? 40 : 16, bottom: 16,
      sort: 'descending',
      gap: 3,
      label: { show: true, position: 'inside', color: '#fff', fontSize: 11, fontWeight: 600 },
      itemStyle: { borderWidth: 0 },
      emphasis: { label: { fontSize: 13 } },
      data: sorted.map((d, i) => ({
        ...d,
        itemStyle: {
          color: vGrad(palette[i % palette.length][0], palette[i % palette.length][1]),
        },
      })),
    }],
    animationDuration: 900,
    animationEasing: 'cubicOut' as const,
  };
}

// ─── Gauge ─────────────────────────────────────────────────
// data.datasets[0].data[0] = value (0-100)

function gaugeOption(rawData: AuroraChartData, title: string | undefined, palette: [string,string][], tk: Tokens): EChartsOption {
  const data = normalizeFlatData(rawData);
  const value = data.datasets[0]?.data[0] ?? 0;
  const [top, bot] = palette[0];
  return {
    backgroundColor: 'transparent',
    series: [{
      type: 'gauge' as const,
      center: ['50%', '58%'],
      radius: '80%',
      startAngle: 200,
      endAngle: -20,
      min: 0, max: 100,
      splitNumber: 5,
      axisLine: {
        lineStyle: {
          width: 16,
          color: [[value / 100, top], [1, tk.border]] as never,
        },
      },
      pointer: { itemStyle: { color: top }, length: '65%', width: 5 },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { color: tk.textTertiary, fontSize: 10, distance: 20 },
      detail: {
        valueAnimation: true,
        formatter: '{value}%',
        color: tk.text,
        fontSize: 22,
        fontWeight: 700,
        offsetCenter: [0, '30%'],
      },
      title: { color: tk.textTertiary, fontSize: 11, offsetCenter: [0, '55%'] },
      data: [{ value, name: data.labels[0] ?? '' }],
    }],
    animationDuration: 1200,
    animationEasing: 'cubicOut' as const,
  };
}

// ─── Heatmap ───────────────────────────────────────────────
// data.labels = x axis, data.datasets[i].label = y axis label, data.datasets[i].data = values per x

function heatmapOption(rawData: AuroraChartData, title: string | undefined, palette: [string,string][], tk: Tokens): EChartsOption {
  const data = normalizeFlatData(rawData);
  const [top, bot] = palette[0];
  const yLabels = data.datasets.map(ds => ds.label ?? '');
  const heatData: [number, number, number][] = [];
  data.datasets.forEach((ds, yi) => {
    ds.data.forEach((val, xi) => heatData.push([xi, yi, val]));
  });
  const maxVal = Math.max(...heatData.map(d => d[2]), 1);

  return {
    backgroundColor: 'transparent',
    tooltip: {
      position: 'top',
      formatter: ((p: unknown) => { const v = (p as {value: [number,number,number]}).value; return `${data.labels[v[0]]} / ${yLabels[v[1]]}: <b>${v[2]}</b>`; }) as never,
      backgroundColor: tk.surface, borderColor: tk.border, borderWidth: 1,
      textStyle: { color: tk.text, fontSize: 12 },
      extraCssText: 'backdrop-filter:blur(8px);border-radius:8px;',
    },
    grid: { left: 16, right: 16, bottom: 40, top: title ? 40 : 16, containLabel: true },
    xAxis: {
      type: 'category', data: data.labels, splitArea: { show: true, areaStyle: { color: ['transparent','transparent'] } },
      axisLine: { lineStyle: { color: tk.border } }, axisTick: { show: false },
      axisLabel: { color: tk.textTertiary, fontSize: 10, rotate: data.labels.length > 6 ? 35 : 0 },
    },
    yAxis: {
      type: 'category', data: yLabels, splitArea: { show: true, areaStyle: { color: ['transparent','transparent'] } },
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: tk.textTertiary, fontSize: 11 },
    },
    visualMap: {
      min: 0, max: maxVal, show: false,
      inRange: { color: [tk.border, bot, top] },
    },
    series: [{
      type: 'heatmap' as const,
      data: heatData,
      itemStyle: { borderRadius: 3, borderColor: tk.bg, borderWidth: 2 },
      emphasis: { itemStyle: { opacity: 0.85 } },
    }],
    animationDuration: 800,
    animationEasing: 'cubicOut' as const,
  };
}

// ─── Treemap ───────────────────────────────────────────────
// data.labels = names, data.datasets[0].data = values

function treemapOption(rawData: AuroraChartData, title: string | undefined, palette: [string,string][], tk: Tokens): EChartsOption {
  const data = normalizeFlatData(rawData);
  const ds = data.datasets[0];
  return {
    backgroundColor: 'transparent',
    tooltip: {
      formatter: '{b}: {c}',
      backgroundColor: tk.surface, borderColor: tk.border, borderWidth: 1,
      textStyle: { color: tk.text, fontSize: 12 },
      extraCssText: 'backdrop-filter:blur(8px);border-radius:8px;',
    },
    series: [{
      type: 'treemap' as const,
      top: title ? 40 : 8, bottom: 8, left: 8, right: 8,
      roam: false,
      nodeClick: false,
      breadcrumb: { show: false },
      label: { show: true, formatter: '{b}\n{c}', color: '#fff', fontSize: 11, fontWeight: 600 },
      itemStyle: { borderWidth: 1, borderColor: tk.border, gapWidth: 2 },
      emphasis: { itemStyle: { opacity: 0.85 } },
      data: data.labels.map((name, i) => ({
        name,
        value: ds.data[i],
        itemStyle: {
          color: vGrad(palette[i % palette.length][0], palette[i % palette.length][1]),
        },
      })),
    }],
    animationDuration: 800,
    animationEasing: 'cubicOut' as const,
  };
}

// ─── Main Component ─────────────────────────────────────────

export default function AuroraChart({
  type, data, flint, flintData, title, height = 300, gradient = 'aurora', bare = false,
}: AuroraChartProps) {
  const palette    = (PALETTES[gradient] ?? PALETTES.aurora) as [string, string][];
  const tk         = useThemeTokens();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const titleRef   = useRef<HTMLDivElement>(null);

  // quickTo refs for smooth tilt with inertia
  const rotY = useRef<ReturnType<typeof gsap.quickTo> | null>(null);
  const rotX = useRef<ReturnType<typeof gsap.quickTo> | null>(null);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    rotY.current = gsap.quickTo(el, 'rotationY', { duration: 0.4, ease: 'power2.out' });
    rotX.current = gsap.quickTo(el, 'rotationX', { duration: 0.4, ease: 'power2.out' });
    gsap.set(el, { transformPerspective: 800, transformStyle: 'preserve-3d' });

    if (titleRef.current) {
      gsap.fromTo(
        titleRef.current,
        { clipPath: 'inset(0 100% 0 0)', opacity: 0 },
        { clipPath: 'inset(0 0% 0 0)', opacity: 1, duration: 0.6, ease: 'power3.out', delay: 0.1 }
      );
    }
  }, [gradient]);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = wrapperRef.current;
    if (!el || !rotY.current || !rotX.current) return;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width  - 0.5) * 6;
    const y = ((e.clientY - r.top)  / r.height - 0.5) * -4;
    rotY.current(x);
    rotX.current(y);
  }, []);

  const onMouseLeave = useCallback(() => {
    if (!rotY.current || !rotX.current) return;
    rotY.current(0);
    rotX.current(0);
  }, []);

  const getOption = (): EChartsOption => {
    switch (type) {
      case 'bar':      return barOption(data, title, palette, tk!);
      case 'line':     return lineOption(data, title, palette, tk!, false);
      case 'area':     return lineOption(data, title, palette, tk!, true);
      case 'pie':      return pieOption(data, title, palette, tk!, false);
      case 'doughnut': return pieOption(data, title, palette, tk!, true);
      case 'scatter':  return scatterOption(data, title, palette, tk!);
      case 'radar':    return radarOption(data, title, palette, tk!);
      case 'funnel':   return funnelOption(data, title, palette, tk!);
      case 'gauge':    return gaugeOption(data, title, palette, tk!);
      case 'heatmap':  return heatmapOption(data, title, palette, tk!);
      case 'treemap':  return treemapOption(data, title, palette, tk!);
      default:         return barOption(data, title, palette, tk!);
    }
  };

  return (
    <div
      ref={wrapperRef}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={bare ? { width: '100%', height: '100%' } : {
        background: `var(--surface)`,
        backdropFilter: 'var(--surface-blur)',
        WebkitBackdropFilter: 'var(--surface-blur)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)',
        transition: 'transform 0.15s ease',
        willChange: 'transform',
      }}
    >
      {!bare && title && (
        <div ref={titleRef} style={{
          padding: '0.9rem 1.1rem 0',
          fontSize: '0.82rem',
          fontWeight: 600,
          color: 'var(--text)',
          letterSpacing: '-0.01em',
        }}>
          {title}
        </div>
      )}
      {bare && title && (
        <div ref={titleRef} style={{
          padding: '0.9rem 1.1rem 0',
          fontSize: '0.82rem',
          fontWeight: 600,
          color: 'var(--text)',
          letterSpacing: '-0.01em',
        }}>
          {title}
        </div>
      )}
      {tk && (
        <ReactECharts
          key={`${type}-${gradient}-${tk.bg}`}
          option={getOption()}
          style={{ height: bare ? '100%' : height, width: '100%' }}
          opts={{ renderer: 'canvas' }}
          notMerge
        />
      )}
    </div>
  );
}
