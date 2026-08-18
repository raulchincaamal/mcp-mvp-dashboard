'use client';

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { createTooltip } from './d3-tooltip';

export interface D3BarChartProps {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string;
  }[];
  title?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  stacked?: boolean;
  width?: number;
  height?: number;
}

export default function D3BarChart({
  labels,
  datasets,
  title,
  xAxisLabel,
  yAxisLabel,
  stacked = false,
  width: propWidth,
  height: propHeight = 280,
}: D3BarChartProps) {
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

    if (stacked) {
      // Stacked bar chart
      const stackData = labels.map((label, i) => {
        const row: Record<string, unknown> = { label };
        datasets.forEach((ds) => {
          row[ds.label] = ds.data[i] || 0;
        });
        return row;
      });

      const keys = datasets.map((ds) => ds.label);
      const stack = d3.stack<Record<string, unknown>>().keys(keys);
      const series = stack(stackData as Iterable<Record<string, unknown>>);

      const yMax = d3.max(series, (s) => d3.max(s, (d) => d[1])) || 0;

      const x = d3.scaleBand().domain(labels).range([0, width]).padding(0.3);
      const y = d3
        .scaleLinear()
        .domain([0, yMax * 1.1])
        .range([height, 0]);

      const color = d3.scaleOrdinal<string>().domain(keys).range(defaultColors);

      g.selectAll('.series')
        .data(series)
        .join('g')
        .attr('fill', (d) => color(d.key))
        .selectAll('rect')
        .data((d) => d)
        .join('rect')
        .attr('x', (d) => x(d.data.label as string) || 0)
        .attr('y', (d) => y(d[1]))
        .attr('height', (d) => y(d[0]) - y(d[1]))
        .attr('width', x.bandwidth())
        .attr('rx', 2);

      // Tooltip for stacked bars
      const tip = createTooltip(containerRef.current!);
      g.selectAll('rect')
        .style('cursor', 'pointer')
        .on('mouseover', function (event) {
          d3.select(this).attr('opacity', 0.8);
          const d = d3.select(this).datum() as [number, number] & {
            data: Record<string, unknown>;
          };
          const value = d[1] - d[0];
          const label = (d.data?.label as string) || '';
          tip.show(
            `<strong>${label}</strong><br/>Valor: <strong>${d3.format(',.0f')(value)}</strong>`,
            event,
          );
        })
        .on('mousemove', function (event) {
          const d = d3.select(this).datum() as [number, number] & {
            data: Record<string, unknown>;
          };
          const value = d[1] - d[0];
          const label = (d.data?.label as string) || '';
          tip.show(
            `<strong>${label}</strong><br/>Valor: <strong>${d3.format(',.0f')(value)}</strong>`,
            event,
          );
        })
        .on('mouseout', function () {
          d3.select(this).attr('opacity', 1);
          tip.hide();
        });

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
    } else {
      // Grouped or single bar chart
      const x0 = d3.scaleBand().domain(labels).range([0, width]).padding(0.2);
      const x1 = d3
        .scaleBand()
        .domain(datasets.map((_, i) => String(i)))
        .range([0, x0.bandwidth()])
        .padding(0.05);
      const yMax = d3.max(datasets, (ds) => d3.max(ds.data) || 0) || 0;
      const y = d3
        .scaleLinear()
        .domain([0, yMax * 1.1])
        .range([height, 0]);

      const tipGrouped = createTooltip(containerRef.current!);

      labels.forEach((label, li) => {
        datasets.forEach((ds, di) => {
          const color = Array.isArray(ds.backgroundColor)
            ? ds.backgroundColor[li % ds.backgroundColor.length]
            : ds.backgroundColor || defaultColors[di % defaultColors.length];

          g.append('rect')
            .attr('x', (x0(label) || 0) + (x1(String(di)) || 0))
            .attr('y', y(ds.data[li] || 0))
            .attr('width', x1.bandwidth())
            .attr('height', height - y(ds.data[li] || 0))
            .attr('fill', color)
            .attr('rx', 2)
            .style('cursor', 'pointer')
            .on('mouseover', function (event) {
              d3.select(this).attr('opacity', 0.8);
              tipGrouped.show(
                `<strong>${label}</strong><br/>${ds.label}: <strong>${d3.format(',.0f')(ds.data[li] || 0)}</strong>`,
                event,
              );
            })
            .on('mousemove', function (event) {
              tipGrouped.show(
                `<strong>${label}</strong><br/>${ds.label}: <strong>${d3.format(',.0f')(ds.data[li] || 0)}</strong>`,
                event,
              );
            })
            .on('mouseout', function () {
              d3.select(this).attr('opacity', 1);
              tipGrouped.hide();
            });
        });
      });

      g.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x0))
        .selectAll('text')
        .attr('font-size', '11px')
        .attr('fill', 'var(--text-secondary)');
      g.append('g')
        .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(',.0f')))
        .selectAll('text')
        .attr('font-size', '11px')
        .attr('fill', 'var(--text-secondary)');
    }

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
        lg.append('rect')
          .attr('width', 12)
          .attr('height', 12)
          .attr('rx', 2)
          .attr(
            'fill',
            (Array.isArray(ds.backgroundColor)
              ? ds.backgroundColor[0]
              : ds.backgroundColor) || defaultColors[i],
          );
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
    stacked,
    propWidth,
    propHeight,
  ]);

  return (
    <div ref={containerRef} style={{ width: '100%', position: 'relative' }}>
      <svg ref={svgRef} style={{ width: '100%', height: propHeight }} />
    </div>
  );
}

