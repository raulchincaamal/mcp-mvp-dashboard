'use client';

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { createTooltip } from './d3-tooltip';

export interface D3LineChartProps {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    borderColor?: string;
    backgroundColor?: string;
    fill?: boolean;
    borderDash?: number[];
  }[];
  title?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  area?: boolean;
  width?: number;
  height?: number;
}

export default function D3LineChart({
  labels,
  datasets,
  title,
  xAxisLabel,
  yAxisLabel,
  area = false,
  width: propWidth,
  height: propHeight = 280,
}: D3LineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (
      !svgRef.current ||
      !containerRef.current ||
      !labels.length ||
      !datasets.length
    )
      return;

    const containerWidth = propWidth || containerRef.current.clientWidth || 500;
    const margin = { top: 20, right: 20, bottom: 50, left: 60 };
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
    ];

    const allValues = datasets.flatMap((ds) => ds.data);
    const yMin = Math.min(0, d3.min(allValues) || 0);
    const yMax = d3.max(allValues) || 0;

    const x = d3.scalePoint().domain(labels).range([0, width]).padding(0.5);
    const y = d3
      .scaleLinear()
      .domain([yMin, yMax * 1.1])
      .range([height, 0]);

    // Grid lines
    g.append('g')
      .attr('class', 'grid')
      .call(
        d3
          .axisLeft(y)
          .ticks(5)
          .tickSize(-width)
          .tickFormat(() => ''),
      )
      .selectAll('line')
      .attr('stroke', 'var(--border-color)')
      .attr('stroke-opacity', 0.5);
    g.selectAll('.grid .domain').remove();

    datasets.forEach((ds, di) => {
      const color = ds.borderColor || defaultColors[di % defaultColors.length];
      const fillColor = ds.backgroundColor || `${color}20`;

      const line = d3
        .line<number>()
        .x((_, i) => x(labels[i]) || 0)
        .y((d) => y(d))
        .curve(d3.curveMonotoneX);

      // Area fill
      if (area || ds.fill) {
        const areaGen = d3
          .area<number>()
          .x((_, i) => x(labels[i]) || 0)
          .y0(height)
          .y1((d) => y(d))
          .curve(d3.curveMonotoneX);

        g.append('path')
          .datum(ds.data)
          .attr('d', areaGen)
          .attr('fill', fillColor)
          .attr('opacity', 0.6);
      }

      // Line
      const path = g
        .append('path')
        .datum(ds.data)
        .attr('d', line)
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', 2);

      if (ds.borderDash) {
        path.attr('stroke-dasharray', ds.borderDash.join(','));
      }

      // Points
      const lineTip = createTooltip(containerRef.current!);

      g.selectAll(`.point-${di}`)
        .data(ds.data)
        .join('circle')
        .attr('cx', (_, i) => x(labels[i]) || 0)
        .attr('cy', (d) => y(d))
        .attr('r', 3)
        .attr('fill', color)
        .attr('stroke', 'white')
        .attr('stroke-width', 1.5)
        .style('cursor', 'pointer')
        .on('mouseover', function (event, d) {
          d3.select(this).attr('r', 5);
          const idx = ds.data.indexOf(d);
          lineTip.show(
            `<strong>${labels[idx]}</strong><br/>${ds.label}: <strong>${d3.format(',.0f')(d)}</strong>`,
            event,
          );
        })
        .on('mousemove', function (event, d) {
          const idx = ds.data.indexOf(d);
          lineTip.show(
            `<strong>${labels[idx]}</strong><br/>${ds.label}: <strong>${d3.format(',.0f')(d)}</strong>`,
            event,
          );
        })
        .on('mouseout', function () {
          d3.select(this).attr('r', 3);
          lineTip.hide();
        });
    });

    // Axes
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .attr('font-size', '11px')
      .attr('fill', 'var(--text-secondary)');
    g.append('g')
      .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(',.0f')))
      .selectAll('text')
      .attr('font-size', '11px')
      .attr('fill', 'var(--text-secondary)');

    // Axis labels
    if (xAxisLabel) {
      g.append('text')
        .attr('x', width / 2)
        .attr('y', height + 40)
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

    // Legend
    if (datasets.length > 1) {
      const legend = svg
        .append('g')
        .attr('transform', `translate(${margin.left}, ${propHeight - 10})`);

      datasets.forEach((ds, i) => {
        const lg = legend
          .append('g')
          .attr('transform', `translate(${i * 120}, 0)`);
        lg.append('line')
          .attr('x1', 0)
          .attr('x2', 12)
          .attr('y1', 6)
          .attr('y2', 6)
          .attr('stroke', ds.borderColor || defaultColors[i])
          .attr('stroke-width', 2);
        lg.append('text')
          .attr('x', 16)
          .attr('y', 10)
          .text(ds.label)
          .attr('font-size', '11px')
          .attr('fill', 'var(--text-secondary)');
      });
    }
  }, [
    labels,
    datasets,
    title,
    xAxisLabel,
    yAxisLabel,
    area,
    propWidth,
    propHeight,
  ]);

  return (
    <div ref={containerRef} style={{ width: '100%', position: 'relative' }}>
      <svg ref={svgRef} style={{ width: '100%', height: propHeight }} />
    </div>
  );
}

