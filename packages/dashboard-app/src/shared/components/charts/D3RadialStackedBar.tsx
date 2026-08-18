'use client';

/**
 * D3 Radial Stacked Bar Chart.
 * Inspired by https://observablehq.com/@d3/radial-stacked-bar-chart/2
 *
 * Displays stacked bar segments arranged radially (polar coordinates).
 * Each "spoke" represents a category, segments are stacked outward from center.
 */

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { createTooltip } from './d3-tooltip';

export interface RadialStackedBarDataPoint {
  label: string;
  [key: string]: string | number;
}

export interface D3RadialStackedBarProps {
  data: RadialStackedBarDataPoint[];
  keys: string[];
  colors?: string[];
  title?: string;
  innerRadius?: number;
  width?: number;
  height?: number;
}

export default function D3RadialStackedBar({
  data,
  keys,
  colors,
  title,
  innerRadius: propInnerRadius,
  width: propWidth,
  height: propHeight = 500,
}: D3RadialStackedBarProps) {
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

    const containerWidth = propWidth || containerRef.current.clientWidth || 500;
    const size = Math.min(containerWidth, propHeight);
    const outerRadius = size / 2 - 40;
    const innerRadius = propInnerRadius ?? outerRadius * 0.3;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', containerWidth).attr('height', propHeight);

    const g = svg
      .append('g')
      .attr('transform', `translate(${containerWidth / 2},${propHeight / 2})`);

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
    ];

    const colorScale = d3
      .scaleOrdinal<string>()
      .domain(keys)
      .range(colors || defaultColors);

    // Stack the data
    const stack = d3
      .stack<RadialStackedBarDataPoint>()
      .keys(keys)
      .value((d, key) => (d[key] as number) || 0)
      .order(d3.stackOrderNone)
      .offset(d3.stackOffsetNone);

    const series = stack(data);

    // Scales
    const x = d3
      .scaleBand()
      .domain(data.map((d) => d.label))
      .range([0, 2 * Math.PI])
      .align(0);

    const yMax = d3.max(series, (s) => d3.max(s, (d) => d[1])) || 0;
    const y = d3
      .scaleRadial()
      .domain([0, yMax])
      .range([innerRadius, outerRadius]);

    // Render arcs
    const arc = d3
      .arc<d3.SeriesPoint<RadialStackedBarDataPoint>>()
      .innerRadius((d) => y(d[0]))
      .outerRadius((d) => y(d[1]))
      .startAngle((d) => x(d.data.label) || 0)
      .endAngle((d) => (x(d.data.label) || 0) + x.bandwidth())
      .padAngle(0.01)
      .padRadius(innerRadius);

    g.selectAll('g.series')
      .data(series)
      .join('g')
      .attr('fill', (d) => colorScale(d.key))
      .selectAll('path')
      .data((d) => d)
      .join('path')
      .attr('d', arc as unknown as string)
      .style('cursor', 'pointer')
      .on('mouseover', function (event, d) {
        d3.select(this).attr('opacity', 0.7);
        const value = d[1] - d[0];
        const label = d.data.label;
        radialTip.show(
          `<strong>${label}</strong><br/>Valor: <strong>${d3.format(',.0f')(value)}</strong>`,
          event,
        );
      })
      .on('mousemove', function (event, d) {
        const value = d[1] - d[0];
        const label = d.data.label;
        radialTip.show(
          `<strong>${label}</strong><br/>Valor: <strong>${d3.format(',.0f')(value)}</strong>`,
          event,
        );
      })
      .on('mouseout', function () {
        d3.select(this).attr('opacity', 1);
        radialTip.hide();
      });

    const radialTip = createTooltip(containerRef.current!);

    // Category labels around the outside
    const labelRadius = outerRadius + 12;
    g.append('g')
      .selectAll('text')
      .data(data)
      .join('text')
      .attr('transform', (d) => {
        const angle = (x(d.label) || 0) + x.bandwidth() / 2;
        const rotate = (angle * 180) / Math.PI - 90;
        return `rotate(${rotate}) translate(${labelRadius},0) ${angle > Math.PI ? 'rotate(180)' : ''}`;
      })
      .attr('text-anchor', (d) => {
        const angle = (x(d.label) || 0) + x.bandwidth() / 2;
        return angle > Math.PI ? 'end' : 'start';
      })
      .attr('font-size', '10px')
      .attr('fill', 'var(--text-secondary)')
      .text((d) =>
        d.label.length > 12 ? d.label.slice(0, 11) + '…' : d.label,
      );

    // Radial grid lines
    const ticks = y.ticks(4);
    g.append('g')
      .selectAll('circle')
      .data(ticks)
      .join('circle')
      .attr('r', (d) => y(d))
      .attr('fill', 'none')
      .attr('stroke', 'var(--border-color)')
      .attr('stroke-opacity', 0.4)
      .attr('stroke-dasharray', '2,2');

    // Tick labels
    g.append('g')
      .selectAll('text')
      .data(ticks)
      .join('text')
      .attr('y', (d) => -y(d))
      .attr('dy', '-0.3em')
      .attr('text-anchor', 'middle')
      .attr('font-size', '9px')
      .attr('fill', 'var(--text-tertiary)')
      .text((d) => d3.format(',.0f')(d));

    // Legend
    const legend = svg
      .append('g')
      .attr('transform', `translate(10, ${propHeight - 20})`);

    const itemWidth = Math.min(110, containerWidth / Math.min(keys.length, 5));
    keys.forEach((key, i) => {
      const lg = legend
        .append('g')
        .attr('transform', `translate(${i * itemWidth}, 0)`);
      lg.append('rect')
        .attr('width', 10)
        .attr('height', 10)
        .attr('rx', 2)
        .attr('fill', colorScale(key));
      lg.append('text')
        .attr('x', 14)
        .attr('y', 9)
        .text(key.length > 10 ? key.slice(0, 9) + '…' : key)
        .attr('font-size', '10px')
        .attr('fill', 'var(--text-secondary)');
    });
  }, [data, keys, colors, title, propInnerRadius, propWidth, propHeight]);

  return (
    <div ref={containerRef} style={{ width: '100%', position: 'relative' }}>
      <svg ref={svgRef} style={{ width: '100%', height: propHeight }} />
    </div>
  );
}

