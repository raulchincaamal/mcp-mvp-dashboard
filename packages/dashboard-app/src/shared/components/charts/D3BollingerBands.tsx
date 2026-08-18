'use client';

/**
 * D3 Bollinger Bands chart.
 * Inspired by https://observablehq.com/@d3/bollinger-bands/2
 *
 * Shows a time-series line with upper/lower Bollinger bands
 * (moving average +/- k standard deviations over N periods).
 */

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { createTooltip } from './d3-tooltip';

export interface BollingerBandsDataPoint {
  date: string; // ISO date or parseable string
  value: number;
}

export interface D3BollingerBandsProps {
  data: BollingerBandsDataPoint[];
  title?: string;
  n?: number; // Moving average period (default: 20)
  k?: number; // Standard deviation multiplier (default: 2)
  lineColor?: string;
  bandColor?: string;
  maColor?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  width?: number;
  height?: number;
}

// Compute Bollinger bands: moving average +/- k * stddev over N periods
function computeBollinger(
  data: { date: Date; value: number }[],
  n: number,
  k: number,
) {
  const result: {
    date: Date;
    value: number;
    upper: number;
    lower: number;
    ma: number;
  }[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i < n - 1) {
      result.push({
        ...data[i],
        upper: data[i].value,
        lower: data[i].value,
        ma: data[i].value,
      });
      continue;
    }

    const window = data.slice(i - n + 1, i + 1).map((d) => d.value);
    const mean = d3.mean(window) || 0;
    const stddev = d3.deviation(window) || 0;

    result.push({
      date: data[i].date,
      value: data[i].value,
      ma: mean,
      upper: mean + k * stddev,
      lower: mean - k * stddev,
    });
  }

  return result;
}

export default function D3BollingerBands({
  data: rawData,
  title,
  n = 20,
  k = 2,
  lineColor = '#4F46E5',
  bandColor = '#4F46E520',
  maColor = '#F59E0B',
  xAxisLabel,
  yAxisLabel,
  width: propWidth,
  height: propHeight = 320,
}: D3BollingerBandsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !rawData.length) return;

    const containerWidth = propWidth || containerRef.current.clientWidth || 600;
    const margin = { top: 20, right: 30, bottom: 50, left: 60 };
    const width = containerWidth - margin.left - margin.right;
    const height = propHeight - margin.top - margin.bottom;

    // Parse data
    const parsed = rawData
      .map((d) => ({
        date: new Date(d.date),
        value: d.value,
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    const bollinger = computeBollinger(parsed, n, k);

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', containerWidth).attr('height', propHeight);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const x = d3
      .scaleTime()
      .domain(d3.extent(bollinger, (d) => d.date) as [Date, Date])
      .range([0, width]);

    const yExtent = [
      d3.min(bollinger, (d) => Math.min(d.lower, d.value)) || 0,
      d3.max(bollinger, (d) => Math.max(d.upper, d.value)) || 0,
    ];
    const y = d3
      .scaleLinear()
      .domain([yExtent[0] * 0.95, yExtent[1] * 1.05])
      .range([height, 0]);

    // Band area (upper to lower)
    const bandArea = d3
      .area<(typeof bollinger)[0]>()
      .x((d) => x(d.date))
      .y0((d) => y(d.lower))
      .y1((d) => y(d.upper))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(bollinger.filter((_, i) => i >= n - 1))
      .attr('d', bandArea)
      .attr('fill', bandColor)
      .attr('stroke', 'none');

    // Upper band line
    const upperLine = d3
      .line<(typeof bollinger)[0]>()
      .x((d) => x(d.date))
      .y((d) => y(d.upper))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(bollinger.filter((_, i) => i >= n - 1))
      .attr('d', upperLine)
      .attr('fill', 'none')
      .attr('stroke', '#94A3B8')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,3');

    // Lower band line
    const lowerLine = d3
      .line<(typeof bollinger)[0]>()
      .x((d) => x(d.date))
      .y((d) => y(d.lower))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(bollinger.filter((_, i) => i >= n - 1))
      .attr('d', lowerLine)
      .attr('fill', 'none')
      .attr('stroke', '#94A3B8')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,3');

    // Moving average line
    const maLine = d3
      .line<(typeof bollinger)[0]>()
      .x((d) => x(d.date))
      .y((d) => y(d.ma))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(bollinger.filter((_, i) => i >= n - 1))
      .attr('d', maLine)
      .attr('fill', 'none')
      .attr('stroke', maColor)
      .attr('stroke-width', 1.5);

    // Value line
    const valueLine = d3
      .line<(typeof bollinger)[0]>()
      .x((d) => x(d.date))
      .y((d) => y(d.value))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(bollinger)
      .attr('d', valueLine)
      .attr('fill', 'none')
      .attr('stroke', lineColor)
      .attr('stroke-width', 2);

    // Tooltip dots on value line
    const bollingerTip = createTooltip(containerRef.current!);

    g.selectAll('.bollinger-dot')
      .data(bollinger)
      .join('circle')
      .attr('class', 'bollinger-dot')
      .attr('cx', (d) => x(d.date))
      .attr('cy', (d) => y(d.value))
      .attr('r', 4)
      .attr('fill', 'transparent')
      .attr('stroke', 'none')
      .style('cursor', 'pointer')
      .on('mouseover', function (event, d) {
        d3.select(this).attr('fill', lineColor).attr('r', 5);
        bollingerTip.show(
          `<strong>${d3.timeFormat('%d %b %Y')(d.date)}</strong><br/>` +
            `Valor: <strong>${d3.format(',.0f')(d.value)}</strong><br/>` +
            `MA: <strong>${d3.format(',.0f')(d.ma)}</strong><br/>` +
            `Upper: <strong>${d3.format(',.0f')(d.upper)}</strong><br/>` +
            `Lower: <strong>${d3.format(',.0f')(d.lower)}</strong>`,
          event,
        );
      })
      .on('mouseout', function () {
        d3.select(this).attr('fill', 'transparent').attr('r', 4);
        bollingerTip.hide();
      });

    // Axes
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(
        d3
          .axisBottom(x)
          .ticks(6)
          .tickFormat((d) => d3.timeFormat('%b %y')(d as Date)),
      )
      .selectAll('text')
      .attr('font-size', '11px')
      .attr('fill', 'var(--text-secondary)');

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
    const legend = svg
      .append('g')
      .attr('transform', `translate(${margin.left + 10}, ${margin.top})`);

    const legendItems = [
      { label: 'Valor', color: lineColor, dash: '' },
      { label: `MA(${n})`, color: maColor, dash: '' },
      { label: `Banda (${k}σ)`, color: '#94A3B8', dash: '4,3' },
    ];

    legendItems.forEach((item, i) => {
      const lg = legend
        .append('g')
        .attr('transform', `translate(${i * 100}, 0)`);
      lg.append('line')
        .attr('x1', 0)
        .attr('x2', 14)
        .attr('y1', 5)
        .attr('y2', 5)
        .attr('stroke', item.color)
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', item.dash || 'none');
      lg.append('text')
        .attr('x', 18)
        .attr('y', 9)
        .text(item.label)
        .attr('font-size', '10px')
        .attr('fill', 'var(--text-secondary)');
    });
  }, [
    rawData,
    n,
    k,
    lineColor,
    bandColor,
    maColor,
    xAxisLabel,
    yAxisLabel,
    propWidth,
    propHeight,
    title,
  ]);

  return (
    <div ref={containerRef} style={{ width: '100%', position: 'relative' }}>
      <svg ref={svgRef} style={{ width: '100%', height: propHeight }} />
    </div>
  );
}

