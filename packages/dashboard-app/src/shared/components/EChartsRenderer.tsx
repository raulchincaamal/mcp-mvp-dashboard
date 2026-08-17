'use client';

import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';

// ─── Types ─────────────────────────────────────────────────

interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string | string[];
  }>;
}

interface EChartsRendererProps {
  type: 'bar' | 'line' | 'pie' | 'doughnut' | 'area';
  title?: string;
  data: ChartData;
  height?: number;
  theme?: 'default' | 'neon' | 'glass' | 'aurora';
}

// ─── Color Palettes with Gradients ─────────────────────────

const GRADIENT_PALETTES = {
  default: [
    { start: '#667eea', end: '#764ba2' },  // Purple-violet
    { start: '#f093fb', end: '#f5576c' },  // Pink-red
    { start: '#4facfe', end: '#00f2fe' },  // Blue-cyan
    { start: '#43e97b', end: '#38f9d7' },  // Green-teal
    { start: '#fa709a', end: '#fee140' },  // Pink-yellow
    { start: '#a8edea', end: '#fed6e3' },  // Teal-pink
    { start: '#ff9a9e', end: '#fecfef' },  // Salmon-pink
    { start: '#ffecd2', end: '#fcb69f' },  // Peach
  ],
  neon: [
    { start: '#00f5ff', end: '#0080ff' },  // Cyan-blue
    { start: '#ff00ff', end: '#8000ff' },  // Magenta-purple
    { start: '#00ff88', end: '#00ffcc' },  // Green-cyan
    { start: '#ffff00', end: '#ff8800' },  // Yellow-orange
    { start: '#ff0088', end: '#ff0044' },  // Pink-red
    { start: '#8888ff', end: '#00ccff' },  // Lavender-cyan
  ],
  glass: [
    { start: 'rgba(255,255,255,0.4)', end: 'rgba(255,255,255,0.1)' },
    { start: 'rgba(100,149,237,0.5)', end: 'rgba(100,149,237,0.2)' },
    { start: 'rgba(144,238,144,0.5)', end: 'rgba(144,238,144,0.2)' },
    { start: 'rgba(255,182,193,0.5)', end: 'rgba(255,182,193,0.2)' },
  ],
  aurora: [
    { start: '#12c2e9', end: '#c471ed' },  // Cyan-purple
    { start: '#c471ed', end: '#f64f59' },  // Purple-red
    { start: '#f64f59', end: '#12c2e9' },  // Red-cyan
    { start: '#11998e', end: '#38ef7d' },  // Teal-green
    { start: '#fc466b', end: '#3f5efb' },  // Pink-blue
  ],
};

// ─── Gradient Generator ────────────────────────────────────

function createGradient(
  colorStart: string,
  colorEnd: string,
  direction: 'vertical' | 'horizontal' | 'radial' = 'vertical'
) {
  if (direction === 'radial') {
    return {
      type: 'radial' as const,
      x: 0.5,
      y: 0.5,
      r: 0.8,
      colorStops: [
        { offset: 0, color: colorStart },
        { offset: 1, color: colorEnd },
      ],
    };
  }
  
  return {
    type: 'linear' as const,
    x: direction === 'horizontal' ? 0 : 0,
    y: direction === 'horizontal' ? 0 : 0,
    x2: direction === 'horizontal' ? 1 : 0,
    y2: direction === 'horizontal' ? 0 : 1,
    colorStops: [
      { offset: 0, color: colorStart },
      { offset: 1, color: colorEnd },
    ],
  };
}

// ─── Glow Effect Generator ─────────────────────────────────

function createGlowEffect(color: string, intensity: number = 20) {
  return {
    shadowColor: color,
    shadowBlur: intensity,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
  };
}

// ─── Bar Chart with Gradients ──────────────────────────────

function getBarChartOption(
  data: ChartData,
  title: string | undefined,
  theme: string
): EChartsOption {
  const palette = GRADIENT_PALETTES[theme as keyof typeof GRADIENT_PALETTES] || GRADIENT_PALETTES.default;
  
  return {
    backgroundColor: 'transparent',
    title: title ? {
      text: title,
      left: 'center',
      top: 10,
      textStyle: {
        color: 'var(--text)',
        fontSize: 14,
        fontWeight: 600,
      },
    } : undefined,
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(20, 20, 30, 0.9)',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      borderWidth: 1,
      textStyle: { color: '#fff' },
      axisPointer: {
        type: 'shadow',
        shadowStyle: {
          color: 'rgba(150, 150, 150, 0.1)',
        },
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: title ? '15%' : '8%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: data.labels,
      axisLine: { lineStyle: { color: 'var(--border-color)' } },
      axisLabel: {
        color: 'var(--text-tertiary)',
        fontSize: 11,
        rotate: data.labels.length > 6 ? 45 : 0,
      },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisLabel: { color: 'var(--text-tertiary)', fontSize: 11 },
      splitLine: {
        lineStyle: {
          color: 'var(--border-color)',
          type: 'dashed',
        },
      },
    },
    series: data.datasets.map((ds, i) => {
      const gradientColor = palette[i % palette.length];
      return {
        name: ds.label,
        type: 'bar' as const,
        data: ds.data,
        barWidth: '60%',
        itemStyle: {
          color: createGradient(gradientColor.start, gradientColor.end),
          borderRadius: [6, 6, 0, 0],
          ...createGlowEffect(gradientColor.start, 15),
        },
        emphasis: {
          itemStyle: {
            color: createGradient(gradientColor.start, gradientColor.end),
            ...createGlowEffect(gradientColor.start, 30),
          },
        },
      };
    }),
    animationDuration: 1000,
    animationEasing: 'elasticOut',
  };
}

// ─── Line/Area Chart with Gradients ────────────────────────

function getLineChartOption(
  data: ChartData,
  title: string | undefined,
  theme: string,
  isArea: boolean
): EChartsOption {
  const palette = GRADIENT_PALETTES[theme as keyof typeof GRADIENT_PALETTES] || GRADIENT_PALETTES.default;
  
  return {
    backgroundColor: 'transparent',
    title: title ? {
      text: title,
      left: 'center',
      top: 10,
      textStyle: {
        color: 'var(--text)',
        fontSize: 14,
        fontWeight: 600,
      },
    } : undefined,
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(20, 20, 30, 0.9)',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      textStyle: { color: '#fff' },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '10%',
      top: title ? '15%' : '8%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: data.labels,
      boundaryGap: false,
      axisLine: { lineStyle: { color: 'var(--border-color)' } },
      axisLabel: { color: 'var(--text-tertiary)', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisLabel: { color: 'var(--text-tertiary)', fontSize: 11 },
      splitLine: {
        lineStyle: { color: 'var(--border-color)', type: 'dashed' },
      },
    },
    series: data.datasets.map((ds, i) => {
      const gradientColor = palette[i % palette.length];
      return {
        name: ds.label,
        type: 'line' as const,
        data: ds.data,
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: {
          width: 3,
          color: createGradient(gradientColor.start, gradientColor.end, 'horizontal'),
          ...createGlowEffect(gradientColor.start, 10),
        },
        itemStyle: {
          color: gradientColor.start,
          borderColor: '#fff',
          borderWidth: 2,
          ...createGlowEffect(gradientColor.start, 15),
        },
        areaStyle: isArea ? {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: `${gradientColor.start}60` },
              { offset: 1, color: `${gradientColor.end}05` },
            ],
          },
        } : undefined,
      };
    }),
    animationDuration: 1500,
    animationEasing: 'cubicOut',
  };
}

// ─── Pie/Doughnut Chart with Gradients ─────────────────────

function getPieChartOption(
  data: ChartData,
  title: string | undefined,
  theme: string,
  isDoughnut: boolean
): EChartsOption {
  const palette = GRADIENT_PALETTES[theme as keyof typeof GRADIENT_PALETTES] || GRADIENT_PALETTES.default;
  const dataset = data.datasets[0];
  
  const pieData = data.labels.map((label, i) => ({
    name: label,
    value: dataset.data[i],
    itemStyle: {
      color: createGradient(
        palette[i % palette.length].start,
        palette[i % palette.length].end,
        'radial'
      ),
      ...createGlowEffect(palette[i % palette.length].start, 20),
    },
  }));

  return {
    backgroundColor: 'transparent',
    title: title ? {
      text: title,
      left: 'center',
      top: 10,
      textStyle: {
        color: 'var(--text)',
        fontSize: 14,
        fontWeight: 600,
      },
    } : undefined,
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(20, 20, 30, 0.9)',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      textStyle: { color: '#fff' },
      formatter: '{b}: {c} ({d}%)',
    },
    legend: {
      orient: 'horizontal',
      bottom: 10,
      textStyle: { color: 'var(--text-secondary)', fontSize: 11 },
    },
    series: [
      {
        type: 'pie',
        radius: isDoughnut ? ['45%', '75%'] : ['0%', '75%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: isDoughnut ? 8 : 4,
          borderColor: 'var(--surface)',
          borderWidth: 2,
        },
        label: {
          show: false,
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold',
            color: 'var(--text)',
          },
          itemStyle: {
            shadowBlur: 30,
            shadowColor: 'rgba(0, 0, 0, 0.3)',
          },
          scale: true,
          scaleSize: 10,
        },
        labelLine: { show: false },
        data: pieData,
      },
    ],
    animationType: 'scale',
    animationDuration: 1000,
    animationEasing: 'elasticOut',
  };
}

// ─── Main Component ────────────────────────────────────────

export default function EChartsRenderer({
  type,
  title,
  data,
  height = 300,
  theme = 'default',
}: EChartsRendererProps) {
  
  const getOption = (): EChartsOption => {
    switch (type) {
      case 'bar':
        return getBarChartOption(data, title, theme);
      case 'line':
        return getLineChartOption(data, title, theme, false);
      case 'area':
        return getLineChartOption(data, title, theme, true);
      case 'pie':
        return getPieChartOption(data, title, theme, false);
      case 'doughnut':
        return getPieChartOption(data, title, theme, true);
      default:
        return getBarChartOption(data, title, theme);
    }
  };

  return (
    <div style={{
      background: 'var(--surface)',
      backdropFilter: 'var(--surface-blur)',
      WebkitBackdropFilter: 'var(--surface-blur)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius)',
      padding: '1rem',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <ReactECharts
        option={getOption()}
        style={{ height, width: '100%' }}
        opts={{ renderer: 'canvas' }}
      />
    </div>
  );
}

// ─── Demo Component for Testing ────────────────────────────

export function EChartsDemo() {
  const sampleData: ChartData = {
    labels: ['Motos', 'Celulares', 'Tablets', 'Audio', 'TV', 'Consolas'],
    datasets: [{
      label: 'Ventas',
      data: [120, 200, 80, 60, 90, 45],
    }],
  };

  const lineData: ChartData = {
    labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'],
    datasets: [{
      label: 'Ventas 2024',
      data: [65, 78, 90, 81, 95, 110],
    }, {
      label: 'Ventas 2023',
      data: [50, 60, 70, 65, 80, 85],
    }],
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '2rem' }}>
      <h2 style={{ color: 'var(--text)', fontSize: '1.5rem', fontWeight: 700 }}>
        ECharts Demo - Gradientes y Efectos
      </h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
        <EChartsRenderer type="bar" title="Bar Chart - Default Theme" data={sampleData} theme="default" />
        <EChartsRenderer type="bar" title="Bar Chart - Neon Theme" data={sampleData} theme="neon" />
        <EChartsRenderer type="pie" title="Pie Chart - Aurora Theme" data={sampleData} theme="aurora" />
        <EChartsRenderer type="doughnut" title="Doughnut - Default" data={sampleData} theme="default" />
        <EChartsRenderer type="line" title="Line Chart" data={lineData} theme="default" />
        <EChartsRenderer type="area" title="Area Chart - Neon" data={lineData} theme="neon" />
      </div>
    </div>
  );
}
