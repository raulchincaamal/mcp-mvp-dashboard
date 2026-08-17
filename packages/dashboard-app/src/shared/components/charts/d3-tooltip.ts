import * as d3 from 'd3';

/**
 * Creates a D3 tooltip div attached to the container element.
 * Returns show/hide/remove functions.
 */
export function createTooltip(container: HTMLElement) {
  // Remove any existing tooltip
  d3.select(container).select('.d3-tooltip').remove();

  const tooltip = d3.select(container)
    .append('div')
    .attr('class', 'd3-tooltip')
    .style('position', 'absolute')
    .style('pointer-events', 'none')
    .style('opacity', '0')
    .style('background', 'var(--surface, #1e293b)')
    .style('border', '1px solid var(--border-color, #334155)')
    .style('border-radius', '6px')
    .style('padding', '0.5rem 0.75rem')
    .style('font-size', '0.8rem')
    .style('color', 'var(--text, #e2e8f0)')
    .style('box-shadow', '0 4px 12px rgba(0,0,0,0.3)')
    .style('z-index', '1000')
    .style('white-space', 'nowrap')
    .style('transition', 'opacity 0.15s ease');

  function show(html: string, event: MouseEvent) {
    const rect = container.getBoundingClientRect();
    const x = event.clientX - rect.left + 12;
    const y = event.clientY - rect.top - 10;

    tooltip
      .html(html)
      .style('left', `${x}px`)
      .style('top', `${y}px`)
      .style('opacity', '1');
  }

  function hide() {
    tooltip.style('opacity', '0');
  }

  function remove() {
    tooltip.remove();
  }

  return { show, hide, remove };
}
