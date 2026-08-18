'use client';

/**
 * D3 Candlestick Chart.
 * Inspired by https://observablehq.com/@d3/candlestick-chart/2
 *
 * Shows OHLC (Open, High, Low, Close) data as candlestick bars.
 * Green candles = close > open (bullish), Red candles = close < open (bearish).
 */

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { createTooltip } from './d3-tooltip';

export interface CandlestickDataPoint {
  date: string; // ISO date or parseable string
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface D3CandlestickProps {
  data: CandlestickDataPoint[];
  title?: string;
  bullColor?: string;
  bearColor?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  width?: number;
  height?: number;
}

export default function D3Candlestick({
  data: rawData,
  title,
  bullColor = '#10B981',
  bearColor = '#EF4444',
  xAxisLabel,
  yAxisLabel,
  width: propWidth,
  height: propHeight = 360,
}: D3CandlestickProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !rawData.length) return;

    const containerWidth = propWidth || containerRef.current.clientWidth || 600;
    const margin = { top: 20, right: 30, bottom: 50, left: 60 };
    const width = containerWidth - margin.left - margin.right;
    const height = propHeight - margin.top - margin.bottom;

    // Parse and sort data
    const data = rawData
      .map((d) => ({
        date: new Date(d.date),
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', containerWidth).attr('height', propHeight);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const x = d3
      .scaleBand()
      .domain(data.map((d) => d.date.toISOString()))
      .range([0, width])
      .padding(0.3);

    const yMin = d3.min(data, (d) => d.low) || 0;
    const yMax = d3.max(data, (d) => d.high) || 0;
    const yPadding = (yMax - yMin) * 0.05;
    const y = d3
      .scaleLinear()
      .domain([yMin - yPadding, yMax + yPadding])
      .range([height, 0]);

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

    // Wicks (high-low lines)
    g.selectAll('.wick')
      .data(data)
      .join('line')
      .attr('class', 'wick')
      .attr('x1', (d) => (x(d.date.toISOString()) || 0) + x.bandwidth() / 2)
      .attr('x2', (d) => (x(d.date.toISOString()) || 0) + x.bandwidth() / 2)
      .attr('y1', (d) => y(d.high))
      .attr('y2', (d) => y(d.low))
      .attr('stroke', (d) => (d.close >= d.open ? bullColor : bearColor))
      .attr('stroke-width', 1);

    // Candle bodies (open-close rectangles)
    const tip = createTooltip(containerRef.current!);

    g.selectAll('.candle')
      .data(data)
      .join('rect')
      .attr('class', 'candle')
      .attr('x', (d) => x(d.date.toISOString()) || 0)
      .attr('y', (d) => y(Math.max(d.open, d.close)))
      .attr('width', x.bandwidth())
      .attr('height', (d) => Math.max(1, Math.abs(y(d.open) - y(d.close))))
      .attr('fill', (d) => (d.close >= d.open ? bullColor : bearColor))
      .attr('stroke', (d) => (d.close >= d.open ? bullColor : bearColor))
      .attr('stroke-width', 1)
      .attr('rx', 1)
      .style('cursor', 'pointer')
      .on('mouseover', function (event, d) {
        d3.select(this).attr('opacity', 0.7);
        tip.show(
          `<strong>${d3.timeFormat('%d %b %Y')(d.date)}</strong><br/>` +
            `Open: <strong>${d3.format(',.0f')(d.open)}</strong><br/>` +
            `High: <strong>${d3.format(',.0f')(d.high)}</strong><br/>` +
            `Low: <strong>${d3.format(',.0f')(d.low)}</strong><br/>` +
            `Close: <strong>${d3.format(',.0f')(d.close)}</strong>`,
          event,
        );
      })
      .on('mousemove', function (event, d) {
        tip.show(
          `<strong>${d3.timeFormat('%d %b %Y')(d.date)}</strong><br/>` +
            `Open: <strong>${d3.format(',.0f')(d.open)}</strong><br/>` +
            `High: <strong>${d3.format(',.0f')(d.high)}</strong><br/>` +
            `Low: <strong>${d3.format(',.0f')(d.low)}</strong><br/>` +
            `Close: <strong>${d3.format(',.0f')(d.close)}</strong>`,
          event,
        );
      })
      .on('mouseout', function () {
        d3.select(this).attr('opacity', 1);
        tip.hide();
      });

    // X Axis — show subset of dates
    const tickInterval = Math.max(1, Math.floor(data.length / 8));
    const tickValues = data
      .filter((_, i) => i % tickInterval === 0)
      .map((d) => d.date.toISOString());

    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(
        d3
          .axisBottom(x)
          .tickValues(tickValues)
          .tickFormat((d) => d3.timeFormat('%d %b')(new Date(d))),
      )
      .selectAll('text')
      .attr('font-size', '10px')
      .attr('fill', 'var(--text-secondary)')
      .attr('transform', 'rotate(-35)')
      .attr('text-anchor', 'end');

    // Y Axis
    g.append('g')
      .call(d3.axisLeft(y).ticks(6).tickFormat(d3.format(',.0f')))
      .selectAll('text')
      .attr('font-size', '11px')
      .attr('fill', 'var(--text-secondary)');

    // Axis labels
    if (xAxisLabel) {
      g.append('text')
        .attr('x', width / 2)
        .attr('y', height + 45)
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

    [
      { label: 'Alcista (Close > Open)', color: bullColor },
      { label: 'Bajista (Close < Open)', color: bearColor },
    ].forEach((item, i) => {
      const lg = legend
        .append('g')
        .attr('transform', `translate(${i * 160}, 0)`);
      lg.append('rect')
        .attr('width', 12)
        .attr('height', 12)
        .attr('rx', 2)
        .attr('fill', item.color);
      lg.append('text')
        .attr('x', 16)
        .attr('y', 10)
        .text(item.label)
        .attr('font-size', '10px')
        .attr('fill', 'var(--text-secondary)');
    });
  }, [
    rawData,
    title,
    bullColor,
    bearColor,
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

