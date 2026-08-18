'use client';

/**
 * D3 Hierarchical Bar Chart with drill-down interaction.
 * Inspired by https://observablehq.com/@d3/hierarchical-bar-chart
 *
 * Clicking a bar drills into its children. A breadcrumb trail allows
 * navigating back up the hierarchy. Transitions animate between levels.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';

export interface HierarchicalNode {
  name: string;
  value?: number;
  children?: HierarchicalNode[];
}

export interface D3HierarchicalBarProps {
  data: HierarchicalNode;
  title?: string;
  color?: string;
  xAxisLabel?: string;
  width?: number;
  height?: number;
}

export default function D3HierarchicalBar({
  data,
  title,
  color = '#4F46E5',
  xAxisLabel,
  width: propWidth,
  height: propHeight = 400,
}: D3HierarchicalBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [path, setPath] = useState<HierarchicalNode[]>([data]);

  const currentNode = path[path.length - 1];

  const drillDown = useCallback((node: HierarchicalNode) => {
    if (node.children && node.children.length > 0) {
      setPath((prev) => [...prev, node]);
    }
  }, []);

  const navigateTo = useCallback((index: number) => {
    setPath((prev) => prev.slice(0, index + 1));
  }, []);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const containerWidth = propWidth || containerRef.current.clientWidth || 600;
    const margin = { top: 10, right: 30, bottom: 40, left: 140 };
    const barHeight = 28;

    // Get items to display: children of current node, or current node itself
    const items = currentNode.children && currentNode.children.length > 0
      ? currentNode.children
      : [currentNode];

    const dynamicHeight = Math.max(200, items.length * (barHeight + 4) + margin.top + margin.bottom);
    const height = dynamicHeight - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', containerWidth).attr('height', dynamicHeight);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    const width = containerWidth - margin.left - margin.right;

    // Compute values: if a node has children, sum them; otherwise use value
    const getValue = (node: HierarchicalNode): number => {
      if (node.value !== undefined) return node.value;
      if (node.children) return node.children.reduce((s, c) => s + getValue(c), 0);
      return 0;
    };

    const sortedItems = [...items].sort((a, b) => getValue(b) - getValue(a));
    const maxValue = d3.max(sortedItems, (d) => getValue(d)) || 1;

    // Scales
    const x = d3.scaleLinear().domain([0, maxValue * 1.1]).range([0, width]);
    const y = d3.scaleBand()
      .domain(sortedItems.map((d) => d.name))
      .range([0, height])
      .padding(0.15);

    // Color scale based on depth — lighter for leaf nodes
    const colorScale = d3.scaleLinear<string>()
      .domain([0, maxValue])
      .range([`${color}40`, color]);

    // Bars
    const bars = g.selectAll('.bar')
      .data(sortedItems)
      .join('g')
      .attr('class', 'bar')
      .attr('transform', (d) => `translate(0,${y(d.name) || 0})`)
      .style('cursor', (d) => (d.children && d.children.length > 0) ? 'pointer' : 'default');

    bars.append('rect')
      .attr('width', (d) => x(getValue(d)))
      .attr('height', y.bandwidth())
      .attr('fill', (d) => colorScale(getValue(d)))
      .attr('rx', 3)
      .attr('stroke', (d) => (d.children && d.children.length > 0) ? color : 'none')
      .attr('stroke-width', 1)
      .attr('stroke-opacity', 0.3);

    // Value labels
    bars.append('text')
      .attr('x', (d) => x(getValue(d)) + 6)
      .attr('y', y.bandwidth() / 2)
      .attr('dy', '0.35em')
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .attr('fill', 'var(--text-secondary)')
      .text((d) => d3.format(',.0f')(getValue(d)));

    // Drill-down indicator (arrow) for items with children
    bars.filter((d) => !!(d.children && d.children.length > 0))
      .append('text')
      .attr('x', (d) => x(getValue(d)) + 6 + String(d3.format(',.0f')(getValue(d))).length * 7 + 8)
      .attr('y', y.bandwidth() / 2)
      .attr('dy', '0.35em')
      .attr('font-size', '10px')
      .attr('fill', 'var(--text-tertiary)')
      .text('▶');

    // Click handler for drill-down
    bars.on('click', (_, d) => {
      drillDown(d);
    });

    // Y Axis (category labels)
    g.append('g')
      .call(d3.axisLeft(y))
      .selectAll('text')
      .attr('font-size', '11px')
      .attr('fill', 'var(--text-secondary)');

    // X Axis
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format(',.0f')))
      .selectAll('text').attr('font-size', '10px').attr('fill', 'var(--text-secondary)');

    // Grid
    g.append('g')
      .call(d3.axisBottom(x).ticks(5).tickSize(-height).tickFormat(() => ''))
      .attr('transform', `translate(0,${height})`)
      .selectAll('line').attr('stroke', 'var(--border-color)').attr('stroke-opacity', 0.2);
    g.selectAll('.domain').attr('stroke', 'var(--border-color)').attr('stroke-opacity', 0.5);

    // X axis label
    if (xAxisLabel) {
      g.append('text').attr('x', width / 2).attr('y', height + 35)
        .attr('text-anchor', 'middle').attr('font-size', '12px').attr('fill', 'var(--text-tertiary)')
        .text(xAxisLabel);
    }
  }, [currentNode, color, xAxisLabel, propWidth, propHeight, drillDown]);

  // Compute dynamic SVG height
  const items = currentNode.children && currentNode.children.length > 0
    ? currentNode.children
    : [currentNode];
  const dynamicSvgHeight = Math.max(200, items.length * 32 + 50);

  return (
    <div ref={containerRef} style={{ width: '100%', position: 'relative' }}>
      {/* Breadcrumb navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        {path.map((node, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            {i > 0 && <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>›</span>}
            <button
              onClick={() => navigateTo(i)}
              style={{
                background: i === path.length - 1 ? `${color}15` : 'transparent',
                border: i === path.length - 1 ? `1px solid ${color}40` : '1px solid transparent',
                borderRadius: '4px',
                padding: '0.2rem 0.5rem',
                fontSize: '0.8rem',
                fontWeight: i === path.length - 1 ? 600 : 400,
                color: i === path.length - 1 ? color : 'var(--text-secondary)',
                cursor: i < path.length - 1 ? 'pointer' : 'default',
              }}
            >
              {node.name}
            </button>
          </span>
        ))}
      </div>
      <svg ref={svgRef} style={{ width: '100%', height: dynamicSvgHeight }} />
    </div>
  );
}
