'use client';

/**
 * D3 Diverging Stacked Bar Chart.
 * Inspired by https://observablehq.com/@d3/diverging-stacked-bar-chart/2
 *
 * Normalizes each category to 100%, with segments diverging from a center axis.
 * Uses a spectral diverging color scale (red → yellow → green → blue).
 * Supports both percentage-based and absolute data — auto-normalizes to %.
 */

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { createTooltip } from './d3-tooltip';

export interface DivergingBarCategory {
  label: string;
  values: { key: string; value: number }[];
}

export interface D3DivergingBarProps {
  data: DivergingBarCategory[];
  keys: string[]; // All segment keys ordered from most-negative to most-positive
  colors?: string[]; // Optional custom colors (default: spectral diverging)
  title?: string;
  xAxisLabel?: string;
  negativeLabel?: string; // e.g., "← Más atrasos"
  positiveLabel?: string; // e.g., "Más liquidados →"
  neutralKey?: string; // Key that is centered (neutral)
  width?: number;
  height?: number;
}

export default function D3DivergingBar({
  data,
  keys,
  colors,
  title,
  xAxisLabel,
  negativeLabel,
  positiveLabel,
  neutralKey,
  width: propWidth,
  height: propHeight,
}: D3DivergingBarProps) {
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

    const containerWidth = propWidth || containerRef.current.clientWidth || 700;
    const dynamicHeight = propHeight || Math.max(300, data.length * 36 + 100);
    const margin = { top: 40, right: 40, bottom: 50, left: 140 };
    const width = containerWidth - margin.left - margin.right;
    const height = dynamicHeight - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', containerWidth).attr('height', dynamicHeight);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // ─── Color scale: spectral diverging ───────────────────
    // Default: warm reds/oranges/yellows on left → cool greens/blues on right
    const spectralColors = [
      '#d73027',
      '#f46d43',
      '#fdae61',
      '#fee08b', // negative (red → yellow)
      '#d9ef8b',
      '#a6d96a',
      '#66bd63',
      '#1a9850', // positive (light green → dark green)
      '#006837', // strong positive
    ];

    // Pick evenly distributed colors from the spectral range
    const numKeys = keys.length;
    let colorRange: string[];
    if (colors && colors.length >= numKeys) {
      colorRange = colors;
    } else {
      const colorInterp = d3
        .scaleLinear<string>()
        .domain(
          d3
            .range(spectralColors.length)
            .map((i) => i / (spectralColors.length - 1)),
        )
        .range(spectralColors);
      colorRange = d3
        .range(numKeys)
        .map((i) => colorInterp(i / Math.max(1, numKeys - 1)));
    }

    const colorScale = d3.scaleOrdinal<string>().domain(keys).range(colorRange);

    // ─── Determine neutral midpoint ────────────────────────
    const neutralIdx = neutralKey
      ? keys.indexOf(neutralKey)
      : Math.floor(keys.length / 2);
    const negativeKeys = keys.slice(0, neutralIdx);
    const positiveKeys = keys.slice(neutralKey ? neutralIdx + 1 : neutralIdx);
    const neutralKeys = neutralKey ? [neutralKey] : [];

    // ─── Normalize to percentages and compute positions ────
    interface BarSegment {
      category: string;
      key: string;
      x0: number; // percentage start
      x1: number; // percentage end
      rawValue: number;
      pct: number;
    }

    const segments: BarSegment[] = [];

    data.forEach((cat) => {
      const valMap: Record<string, number> = {};
      cat.values.forEach((v) => {
        valMap[v.key] = v.value;
      });

      // Total of all values for this category (for normalization)
      const total = keys.reduce((sum, k) => sum + (valMap[k] || 0), 0) || 1;

      // Negative segments: stack leftward from 0
      let posLeft = 0;
      for (let i = negativeKeys.length - 1; i >= 0; i--) {
        const val = valMap[negativeKeys[i]] || 0;
        const pct = (val / total) * 100;
        segments.push({
          category: cat.label,
          key: negativeKeys[i],
          x0: posLeft - pct,
          x1: posLeft,
          rawValue: val,
          pct,
        });
        posLeft -= pct;
      }

      // Neutral: centered around 0
      if (neutralKey && valMap[neutralKey] !== undefined) {
        const val = valMap[neutralKey] || 0;
        const pct = (val / total) * 100;
        segments.push({
          category: cat.label,
          key: neutralKey,
          x0: -pct / 2,
          x1: pct / 2,
          rawValue: val,
          pct,
        });
      }

      // Positive segments: stack rightward from 0
      let posRight = 0;
      for (let i = 0; i < positiveKeys.length; i++) {
        const val = valMap[positiveKeys[i]] || 0;
        const pct = (val / total) * 100;
        segments.push({
          category: cat.label,
          key: positiveKeys[i],
          x0: posRight,
          x1: posRight + pct,
          rawValue: val,
          pct,
        });
        posRight += pct;
      }
    });

    // ─── Scales ────────────────────────────────────────────
    const xMin = d3.min(segments, (d) => d.x0) || -50;
    const xMax = d3.max(segments, (d) => d.x1) || 50;
    const xExtent = Math.max(Math.abs(xMin), Math.abs(xMax));

    const x = d3
      .scaleLinear()
      .domain([-xExtent * 1.05, xExtent * 1.05])
      .range([0, width]);

    const y = d3
      .scaleBand()
      .domain(data.map((d) => d.label))
      .range([0, height])
      .padding(0.15);

    // ─── Render bars ───────────────────────────────────────
    const tip = createTooltip(containerRef.current!);

    g.selectAll('.segment')
      .data(segments)
      .join('rect')
      .attr('class', 'segment')
      .attr('x', (d) => x(d.x0))
      .attr('y', (d) => y(d.category) || 0)
      .attr('width', (d) => Math.max(0, x(d.x1) - x(d.x0)))
      .attr('height', y.bandwidth())
      .attr('fill', (d) => colorScale(d.key))
      .style('cursor', 'pointer')
      .on('mouseover', function (event, d) {
        d3.select(this)
          .attr('opacity', 0.75)
          .attr('stroke', '#fff')
          .attr('stroke-width', 1.5);
        tip.show(
          `<strong>${d.category}</strong><br/>` +
            `${d.key}: <strong>${d.pct.toFixed(1)}%</strong> (${d3.format(',.0f')(d.rawValue)})`,
          event,
        );
      })
      .on('mousemove', function (event, d) {
        tip.show(
          `<strong>${d.category}</strong><br/>` +
            `${d.key}: <strong>${d.pct.toFixed(1)}%</strong> (${d3.format(',.0f')(d.rawValue)})`,
          event,
        );
      })
      .on('mouseout', function () {
        d3.select(this).attr('opacity', 1).attr('stroke', 'none');
        tip.hide();
      });

    // ─── Center line ───────────────────────────────────────
    g.append('line')
      .attr('x1', x(0))
      .attr('x2', x(0))
      .attr('y1', -5)
      .attr('y2', height)
      .attr('stroke', 'var(--text)')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.6);

    // ─── X Axis (percentages) ──────────────────────────────
    const xAxisG = g.append('g').attr('transform', `translate(0,${height})`);
    xAxisG.call(
      d3
        .axisBottom(x)
        .ticks(10)
        .tickFormat((d) => `${Math.abs(d as number).toFixed(0)}%`),
    );
    xAxisG
      .selectAll('text')
      .attr('font-size', '10px')
      .attr('fill', 'var(--text-secondary)');
    xAxisG.selectAll('line').attr('stroke', 'var(--border-color)');
    xAxisG.select('.domain').attr('stroke', 'var(--border-color)');

    // ─── Top axis labels (negative/positive) ──────────────
    if (negativeLabel || positiveLabel) {
      const topG = g.append('g').attr('transform', 'translate(0,-20)');
      if (negativeLabel) {
        topG
          .append('text')
          .attr('x', x(-xExtent * 0.5))
          .attr('y', 0)
          .attr('text-anchor', 'middle')
          .attr('font-size', '11px')
          .attr('font-weight', '500')
          .attr('fill', 'var(--text-tertiary)')
          .text(negativeLabel);
      }
      if (positiveLabel) {
        topG
          .append('text')
          .attr('x', x(xExtent * 0.5))
          .attr('y', 0)
          .attr('text-anchor', 'middle')
          .attr('font-size', '11px')
          .attr('font-weight', '500')
          .attr('fill', 'var(--text-tertiary)')
          .text(positiveLabel);
      }
    }

    // ─── Y Axis (category labels) ─────────────────────────
    const yAxisG = g.append('g').call(d3.axisLeft(y).tickSize(0));
    yAxisG
      .selectAll('text')
      .attr('font-size', '11px')
      .attr('fill', 'var(--text-secondary)');
    yAxisG.select('.domain').remove();

    // ─── Grid lines ────────────────────────────────────────
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(
        d3
          .axisBottom(x)
          .ticks(10)
          .tickSize(-height)
          .tickFormat(() => ''),
      )
      .selectAll('line')
      .attr('stroke', 'var(--border-color)')
      .attr('stroke-opacity', 0.15);
    g.selectAll('.domain').remove();

    // ─── X axis label ──────────────────────────────────────
    if (xAxisLabel) {
      g.append('text')
        .attr('x', width / 2)
        .attr('y', height + 40)
        .attr('text-anchor', 'middle')
        .attr('font-size', '12px')
        .attr('fill', 'var(--text-tertiary)')
        .text(xAxisLabel);
    }

    // ─── Legend ────────────────────────────────────────────
    const legend = svg
      .append('g')
      .attr('transform', `translate(${margin.left}, ${dynamicHeight - 18})`);

    const itemWidth = Math.min(100, width / keys.length);
    keys.forEach((key, i) => {
      const lg = legend
        .append('g')
        .attr('transform', `translate(${i * itemWidth}, 0)`);
      lg.append('rect')
        .attr('width', 12)
        .attr('height', 12)
        .attr('rx', 2)
        .attr('fill', colorScale(key));
      lg.append('text')
        .attr('x', 16)
        .attr('y', 10)
        .text(key.length > 12 ? key.slice(0, 11) + '…' : key)
        .attr('font-size', '10px')
        .attr('fill', 'var(--text-secondary)');
    });
  }, [
    data,
    keys,
    colors,
    title,
    xAxisLabel,
    negativeLabel,
    positiveLabel,
    neutralKey,
    propWidth,
    propHeight,
  ]);

  const dynamicHeight = propHeight || Math.max(300, data.length * 36 + 100);

  return (
    <div ref={containerRef} style={{ width: '100%', position: 'relative' }}>
      <svg ref={svgRef} style={{ width: '100%', height: dynamicHeight }} />
    </div>
  );
}

