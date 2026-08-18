'use client';

/**
 * D3 Stacked Area chart.
 * Inspired by https://observablehq.com/@d3/revenue-by-music-format-1973-2018
 *
 * Renders a stacked area chart where each series is stacked on top of the previous one,
 * useful for showing composition over time (e.g., revenue by category, sales by product type).
 */

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { createTooltip } from './d3-tooltip';

export interface StackedAreaDataPoint {
  label: string; // x-axis category (e.g., date, year, month)
  [key: string]: string | number; // series values
}

export interface D3StackedAreaProps {
  data: StackedAreaDataPoint[];
  keys: string[]; // Series names (fields in data to stack)
  colors?: string[]; // Color per series
  title?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  width?: number;
  height?: number;
}

export default function D3StackedArea({
  data,
  keys,
  colors,
  title,
  xAxisLabel,
  yAxisLabel,
  width: propWidth,
  height: propHeight = 320,
}: D3StackedAreaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (
      !svgRef.current ||
      !containerRef.current ||
      !data.length ||
      !keys.length
    )
      return;

    const containerWidth = propWidth || containerRef.current.clientWidth || 600;
    const margin = { top: 20, right: 20, bottom: 60, left: 60 };
    const width = containerWidth - margin.left - margin.right;
    const height = propHeight - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', containerWidth).attr('height', propHeight);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const defaultColors = [
      '#4F46E5',
      '#10B981',
      '#F59E0B',
      '#EF4444',
      '#8B5CF6',
      '#06B6D4',
      '#EC4899',
      '#14B8A6',
      '#F97316',
      '#6366F1',
      '#84CC16',
      '#A855F7',
      '#0EA5E9',
      '#D946EF',
    ];

    const colorScale = d3
      .scaleOrdinal<string>()
      .domain(keys)
      .range(colors || defaultColors);

    // Stack the data
    const stack = d3
      .stack<StackedAreaDataPoint>()
      .keys(keys)
      .value((d, key) => (d[key] as number) || 0)
      .order(d3.stackOrderNone)
      .offset(d3.stackOffsetNone);

    const series = stack(data);

    // Scales
    const x = d3
      .scalePoint()
      .domain(data.map((d) => d.label))
      .range([0, width])
      .padding(0.5);

    const yMax = d3.max(series, (s) => d3.max(s, (d) => d[1])) || 0;
    const y = d3
      .scaleLinear()
      .domain([0, yMax * 1.05])
      .range([height, 0]);

    // Area generator
    const area = d3
      .area<d3.SeriesPoint<StackedAreaDataPoint>>()
      .x((d) => x(d.data.label) || 0)
      .y0((d) => y(d[0]))
      .y1((d) => y(d[1]))
      .curve(d3.curveMonotoneX);

    // Render stacked areas
    const areaTip = createTooltip(containerRef.current!);

    g.selectAll('.layer')
      .data(series)
      .join('path')
      .attr('class', 'layer')
      .attr('d', area)
      .attr('fill', (d) => colorScale(d.key))
      .attr('opacity', 0.85)
      .attr('stroke', (d) => colorScale(d.key))
      .attr('stroke-width', 0.5)
      .style('cursor', 'pointer')
      .on('mouseover', function (event, d) {
        d3.select(this).attr('opacity', 1);
        const total = d3.sum(d, (p) => p[1] - p[0]);
        areaTip.show(
          `<strong>${d.key}</strong><br/>Total: <strong>${d3.format(',.0f')(total)}</strong>`,
          event,
        );
      })
      .on('mousemove', function (event, d) {
        const total = d3.sum(d, (p) => p[1] - p[0]);
        areaTip.show(
          `<strong>${d.key}</strong><br/>Total: <strong>${d3.format(',.0f')(total)}</strong>`,
          event,
        );
      })
      .on('mouseout', function () {
        d3.select(this).attr('opacity', 0.85);
        areaTip.hide();
      });

    // Axes
    const xAxis = g
      .append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x));
    xAxis
      .selectAll('text')
      .attr('font-size', '10px')
      .attr('fill', 'var(--text-secondary)')
      .attr('transform', 'rotate(-45)')
      .attr('text-anchor', 'end');

    g.append('g')
      .call(d3.axisLeft(y).ticks(6).tickFormat(d3.format(',.0f')))
      .selectAll('text')
      .attr('font-size', '11px')
      .attr('fill', 'var(--text-secondary)');

    // Grid lines
    g.append('g')
      .call(
        d3
          .axisLeft(y)
          .ticks(6)
          .tickSize(-width)
          .tickFormat(() => ''),
      )
      .selectAll('line')
      .attr('stroke', 'var(--border-color)')
      .attr('stroke-opacity', 0.3);
    g.selectAll('.domain').attr('stroke', 'var(--border-color)');

    // Axis labels
    if (xAxisLabel) {
      g.append('text')
        .attr('x', width / 2)
        .attr('y', height + 50)
        .attr('text-anchor', 'middle')
        .attr('font-size', '12px')
        .attr('fill', 'var(--text-tertiary)')
        .text(xAxisLabel);
    }
    if (yAxisLabel) {
      g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -height / 2)
        .attr('y', -45)
        .attr('text-anchor', 'middle')
        .attr('font-size', '12px')
        .attr('fill', 'var(--text-tertiary)')
        .text(yAxisLabel);
    }

    // Legend (horizontal, wrapped)
    const legendG = svg
      .append('g')
      .attr('transform', `translate(${margin.left}, ${propHeight - 15})`);

    const itemWidth = 110;
    const maxPerRow = Math.floor(width / itemWidth);

    keys.forEach((key, i) => {
      const col = i % maxPerRow;
      const row = Math.floor(i / maxPerRow);
      const lg = legendG
        .append('g')
        .attr('transform', `translate(${col * itemWidth}, ${row * 16})`);
      lg.append('rect')
        .attr('width', 10)
        .attr('height', 10)
        .attr('rx', 2)
        .attr('fill', colorScale(key));
      lg.append('text')
        .attr('x', 14)
        .attr('y', 9)
        .text(key.length > 12 ? key.slice(0, 11) + '...' : key)
        .attr('font-size', '10px')
        .attr('fill', 'var(--text-secondary)');
    });
  }, [
    data,
    keys,
    colors,
    title,
    xAxisLabel,
    yAxisLabel,
    propWidth,
    propHeight,
  ]);

  return (
    <div ref={containerRef} style={{ width: '100%', position: 'relative' }}>
      <svg ref={svgRef} style={{ width: '100%', height: propHeight }} />
    </div>
  );
}

