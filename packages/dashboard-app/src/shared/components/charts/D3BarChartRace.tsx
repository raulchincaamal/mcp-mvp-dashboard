'use client';

/**
 * D3 Bar Chart Race (animated).
 * Inspired by https://observablehq.com/@d3/bar-chart-race
 *
 * Animates bars reordering over time frames. Each frame shows the top N items
 * ranked by value, with smooth transitions as positions and values change.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';

export interface BarRaceFrame {
  label: string;  // Time frame label (e.g., "2024-01", "Semana 12")
  items: { name: string; value: number }[];
}

export interface D3BarChartRaceProps {
  frames: BarRaceFrame[];
  title?: string;
  maxBars?: number;
  duration?: number;       // ms per frame transition
  colors?: string[];
  xAxisLabel?: string;
  autoPlay?: boolean;
  width?: number;
  height?: number;
}

export default function D3BarChartRace({
  frames,
  title,
  maxBars = 10,
  duration = 800,
  colors,
  xAxisLabel,
  autoPlay = true,
  width: propWidth,
  height: propHeight = 420,
}: D3BarChartRaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentFrame = frames[frameIndex] || frames[0];

  // Auto-play logic
  useEffect(() => {
    if (isPlaying && frames.length > 1) {
      timerRef.current = setInterval(() => {
        setFrameIndex((prev) => {
          if (prev >= frames.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, duration + 200);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, frames.length, duration]);

  const togglePlay = useCallback(() => {
    if (frameIndex >= frames.length - 1) {
      setFrameIndex(0);
      setIsPlaying(true);
    } else {
      setIsPlaying((p) => !p);
    }
  }, [frameIndex, frames.length]);

  // Render chart
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !currentFrame) return;

    const containerWidth = propWidth || containerRef.current.clientWidth || 600;
    const margin = { top: 10, right: 60, bottom: 30, left: 120 };
    const barHeight = 30;
    const numBars = Math.min(maxBars, currentFrame.items.length);
    const chartHeight = numBars * (barHeight + 6);
    const totalHeight = chartHeight + margin.top + margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.attr('width', containerWidth).attr('height', totalHeight);

    const width = containerWidth - margin.left - margin.right;

    // Sort and slice top N
    const sorted = [...currentFrame.items]
      .sort((a, b) => b.value - a.value)
      .slice(0, numBars);

    const defaultColors = [
      '#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
      '#06B6D4', '#EC4899', '#14B8A6', '#F97316', '#6366F1',
      '#84CC16', '#A855F7', '#0EA5E9', '#D946EF', '#64748B',
    ];
    const allNames = [...new Set(frames.flatMap((f) => f.items.map((i) => i.name)))];
    const colorScale = d3.scaleOrdinal<string>()
      .domain(allNames)
      .range(colors || defaultColors);

    // Scales
    const maxValue = d3.max(sorted, (d) => d.value) || 1;
    const x = d3.scaleLinear().domain([0, maxValue * 1.1]).range([0, width]);
    const y = d3.scaleBand()
      .domain(sorted.map((d) => d.name))
      .range([0, chartHeight])
      .padding(0.15);

    // Select/create persistent group
    let g = svg.select<SVGGElement>('g.chart-group');
    if (g.empty()) {
      g = svg.append('g').attr('class', 'chart-group')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    }

    // Transition
    const t = d3.transition().duration(duration).ease(d3.easeLinear);

    // Bars
    const bars = g.selectAll<SVGGElement, typeof sorted[0]>('.bar-group')
      .data(sorted, (d) => d.name);

    // EXIT
    bars.exit().transition(t).attr('opacity', 0).remove();

    // ENTER
    const barsEnter = bars.enter().append('g').attr('class', 'bar-group')
      .attr('transform', (d) => `translate(0,${y(d.name) || 0})`)
      .attr('opacity', 0);

    barsEnter.append('rect').attr('class', 'bar-rect')
      .attr('height', y.bandwidth())
      .attr('width', (d) => x(d.value))
      .attr('fill', (d) => colorScale(d.name))
      .attr('rx', 3);

    barsEnter.append('text').attr('class', 'bar-value')
      .attr('x', (d) => x(d.value) + 5)
      .attr('y', y.bandwidth() / 2)
      .attr('dy', '0.35em')
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .attr('fill', 'var(--text-secondary)')
      .text((d) => d3.format(',.0f')(d.value));

    // ENTER + UPDATE (merge)
    const merged = barsEnter.merge(bars);

    merged.transition(t)
      .attr('transform', (d) => `translate(0,${y(d.name) || 0})`)
      .attr('opacity', 1);

    merged.select('.bar-rect')
      .transition(t)
      .attr('width', (d) => x(d.value))
      .attr('height', y.bandwidth())
      .attr('fill', (d) => colorScale(d.name));

    merged.select('.bar-value')
      .transition(t)
      .attr('x', (d) => x(d.value) + 5)
      .attr('y', y.bandwidth() / 2)
      .tween('text', function (d) {
        const node = this as SVGTextElement;
        const current = parseFloat(node.textContent?.replace(/,/g, '') || '0');
        const interp = d3.interpolateNumber(current, d.value);
        return (tt: number) => {
          node.textContent = d3.format(',.0f')(interp(tt));
        };
      });

    // Y axis labels (outside bars)
    let yAxisG = svg.select<SVGGElement>('g.y-axis-group');
    if (yAxisG.empty()) {
      yAxisG = svg.append('g').attr('class', 'y-axis-group')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    }

    const labels = yAxisG.selectAll<SVGTextElement, typeof sorted[0]>('.y-label')
      .data(sorted, (d) => d.name);

    labels.exit().transition(t).attr('opacity', 0).remove();

    const labelsEnter = labels.enter().append('text').attr('class', 'y-label')
      .attr('x', -8)
      .attr('y', (d) => (y(d.name) || 0) + y.bandwidth() / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'end')
      .attr('font-size', '11px')
      .attr('fill', 'var(--text-secondary)')
      .attr('opacity', 0)
      .text((d) => d.name.length > 14 ? d.name.slice(0, 13) + '…' : d.name);

    labelsEnter.merge(labels)
      .transition(t)
      .attr('y', (d) => (y(d.name) || 0) + y.bandwidth() / 2)
      .attr('opacity', 1)
      .text((d) => d.name.length > 14 ? d.name.slice(0, 13) + '…' : d.name);

    // X Axis
    let xAxisG = svg.select<SVGGElement>('g.x-axis-group');
    if (xAxisG.empty()) {
      xAxisG = svg.append('g').attr('class', 'x-axis-group')
        .attr('transform', `translate(${margin.left},${margin.top + chartHeight})`);
    }
    xAxisG.transition(t)
      .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format(',.0f')) as never);
    xAxisG.selectAll('text').attr('font-size', '10px').attr('fill', 'var(--text-secondary)');
  }, [currentFrame, maxBars, duration, colors, xAxisLabel, propWidth, propHeight, frames]);

  const numBars = Math.min(maxBars, currentFrame?.items.length || 0);
  const dynamicHeight = numBars * 36 + 80;

  return (
    <div ref={containerRef} style={{ width: '100%', position: 'relative' }}>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={togglePlay}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              padding: '0.4rem 0.75rem',
              fontSize: '0.8rem',
              fontWeight: 500,
              color: 'var(--text)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            {isPlaying ? '⏸' : '▶'} {isPlaying ? 'Pausa' : (frameIndex >= frames.length - 1 ? 'Reiniciar' : 'Reproducir')}
          </button>
          <input
            type="range"
            min={0}
            max={frames.length - 1}
            value={frameIndex}
            onChange={(e) => {
              setIsPlaying(false);
              setFrameIndex(Number(e.target.value));
            }}
            style={{ width: 120, accentColor: '#4F46E5' }}
          />
        </div>
        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px' }}>
          {currentFrame?.label || ''}
        </span>
      </div>
      <svg ref={svgRef} style={{ width: '100%', height: dynamicHeight }} />
    </div>
  );
}
