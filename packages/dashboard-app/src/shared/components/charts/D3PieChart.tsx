'use client';

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { createTooltip } from './d3-tooltip';

export interface D3PieChartProps {
  labels: string[];
  data: number[];
  colors?: string[];
  title?: string;
  doughnut?: boolean;
  width?: number;
  height?: number;
}

export default function D3PieChart({
  labels,
  data,
  colors,
  title,
  doughnut = false,
  width: propWidth,
  height: propHeight = 320,
}: D3PieChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (
      !svgRef.current ||
      !containerRef.current ||
      !labels.length ||
      !data.length
    )
      return;

    const containerWidth = propWidth || containerRef.current.clientWidth || 400;
    const size = Math.min(containerWidth, propHeight);
    const radius = size / 2 - 40;

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
      .domain(labels)
      .range(colors || defaultColors);

    const pie = d3
      .pie<number>()
      .value((d) => d)
      .sort(null);
    const arc = d3
      .arc<d3.PieArcDatum<number>>()
      .innerRadius(doughnut ? radius * 0.55 : 0)
      .outerRadius(radius);

    const arcs = g
      .selectAll('.arc')
      .data(pie(data))
      .join('g')
      .attr('class', 'arc');

    const pieTip = createTooltip(containerRef.current!);
    const total = d3.sum(data);

    arcs
      .append('path')
      .attr('d', arc)
      .attr('fill', (_, i) => colorScale(labels[i]))
      .attr('stroke', 'white')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('mouseover', function (event, d) {
        d3.select(this).attr('opacity', 0.8);
        const pct = ((d.data / total) * 100).toFixed(1);
        const idx = data.indexOf(d.data);
        pieTip.show(
          `<strong>${labels[idx]}</strong><br/>Valor: <strong>${d3.format(',.0f')(d.data)}</strong> (${pct}%)`,
          event,
        );
      })
      .on('mousemove', function (event, d) {
        const pct = ((d.data / total) * 100).toFixed(1);
        const idx = data.indexOf(d.data);
        pieTip.show(
          `<strong>${labels[idx]}</strong><br/>Valor: <strong>${d3.format(',.0f')(d.data)}</strong> (${pct}%)`,
          event,
        );
      })
      .on('mouseout', function () {
        d3.select(this).attr('opacity', 1);
        pieTip.hide();
      });

    // Percentage labels
    const labelArc = d3
      .arc<d3.PieArcDatum<number>>()
      .innerRadius(radius * 0.7)
      .outerRadius(radius * 0.7);

    arcs
      .append('text')
      .attr('transform', (d) => `translate(${labelArc.centroid(d)})`)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .attr('fill', 'white')
      .text((d) => {
        const pct = (d.data / total) * 100;
        return pct > 5 ? `${pct.toFixed(0)}%` : '';
      });

    // Legend below
    const legendY = propHeight / 2 + radius + 15;
    const legend = svg
      .append('g')
      .attr(
        'transform',
        `translate(${containerWidth / 2 - (labels.length * 50) / 2}, ${legendY})`,
      );

    const itemWidth = Math.min(
      120,
      containerWidth / Math.min(labels.length, 4),
    );

    labels.forEach((label, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const lg = legend
        .append('g')
        .attr('transform', `translate(${col * itemWidth}, ${row * 18})`);
      lg.append('rect')
        .attr('width', 10)
        .attr('height', 10)
        .attr('rx', 2)
        .attr('fill', colorScale(label));
      lg.append('text')
        .attr('x', 14)
        .attr('y', 9)
        .text(label.length > 14 ? label.slice(0, 12) + '...' : label)
        .attr('font-size', '10px')
        .attr('fill', 'var(--text-secondary)');
    });
  }, [labels, data, colors, title, doughnut, propWidth, propHeight]);

  return (
    <div ref={containerRef} style={{ width: '100%', position: 'relative' }}>
      <svg ref={svgRef} style={{ width: '100%', height: propHeight }} />
    </div>
  );
}

