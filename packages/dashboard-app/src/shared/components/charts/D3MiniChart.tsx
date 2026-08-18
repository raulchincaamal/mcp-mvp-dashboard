'use client';

/**
 * D3 MiniChart (Sparkline) — compact inline chart for KPI cards.
 */

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

export interface D3MiniChartProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  fill?: boolean;
}

export default function D3MiniChart({
  data,
  color = '#4F46E5',
  width: propWidth,
  height: propHeight = 60,
  fill = true,
}: D3MiniChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !data.length) return;

    const containerWidth = propWidth || containerRef.current.clientWidth || 200;
    const margin = { top: 4, right: 4, bottom: 4, left: 4 };
    const width = containerWidth - margin.left - margin.right;
    const height = propHeight - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', containerWidth).attr('height', propHeight);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear().domain([0, data.length - 1]).range([0, width]);
    const yExtent = d3.extent(data) as [number, number];
    const y = d3.scaleLinear().domain(yExtent).range([height, 0]);

    if (fill) {
      const area = d3.area<number>()
        .x((_, i) => x(i))
        .y0(height)
        .y1((d) => y(d))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(data)
        .attr('d', area)
        .attr('fill', `${color}20`)
        .attr('stroke', 'none');
    }

    const line = d3.line<number>()
      .x((_, i) => x(i))
      .y((d) => y(d))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(data)
      .attr('d', line)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 2);
  }, [data, color, propWidth, propHeight, fill]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: propHeight }}>
      <svg ref={svgRef} style={{ width: '100%', height: propHeight }} />
    </div>
  );
}
