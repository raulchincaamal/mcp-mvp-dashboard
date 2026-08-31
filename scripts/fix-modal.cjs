const fs = require('fs');
const file = 'packages/dashboard-app/src/app/(pages)/observatory/components/ScrollPresentation.tsx';
let c = fs.readFileSync(file, 'utf8');

// 1. Replace the chartType block ONLY in ExpandedModal (after "return null;\n  })() : null;\n\n\n  const chartType")
// We target the unique context: it follows "return null;\n  })() : null;" which only appears in ExpandedModal
const oldChartType = `  const chartType = insight.chartOptions ? (() => {\n    const opts = insight.chartOptions as Record<string, unknown>;\n\n    if (opts._auroraType) return opts._auroraType as 'scatter' | 'radar' | 'funnel' | 'gauge' | 'heatmap' | 'treemap';\n\n    const series = opts.series as { type?: string; radius?: unknown }[] | undefined;\n    const t = series?.[0]?.type ?? 'bar';\n\n    if (t === 'pie') { const r = series?.[0]?.radius; return Array.isArray(r) && r[0] !== '0%' ? 'doughnut' : 'pie'; }\n    const supported = ['bar','line','area','pie','doughnut','scatter','radar','funnel','gauge','heatmap','treemap'];\n\n    return (supported.includes(t) ? t : 'bar') as 'bar' | 'line' | 'area' | 'pie' | 'doughnut' | 'scatter' | 'radar' | 'funnel' | 'gauge' | 'heatmap' | 'treemap';\n\n  })() : 'bar';\n\n\n  useEffect`;

const newChartType = `  const chartType = insight.chartOptions ? (() => {\n    const opts = insight.chartOptions as Record<string, unknown>;\n    if (opts._auroraType) return opts._auroraType as string;\n    const series = opts.series as { type?: string; radius?: unknown }[] | undefined;\n    const t = series?.[0]?.type ?? 'bar';\n    if (t === 'pie') { const r = series?.[0]?.radius; return Array.isArray(r) && r[0] !== '0%' ? 'doughnut' : 'pie'; }\n    const supported = ['bar','line','area','pie','doughnut','scatter','radar','funnel','gauge','heatmap','treemap'];\n    return (supported.includes(t) ? t : 'bar') as string;\n  })() : 'bar';\n\n  // Adaptive modal sizing based on chart type\n  const WIDE_TYPES = new Set(['line','area','stacked-area','bollinger','bar-race','theme-river','calendar-heatmap','candlestick','candlestick-ma']);\n  const TALL_TYPES = new Set(['map','heatmap','hierarchical-bar','diverging-bar','radial-stacked-bar','sankey','sunburst']);\n  const modalMaxW = WIDE_TYPES.has(chartType) ? 1280 : TALL_TYPES.has(chartType) ? 860 : 900;\n  const modalH = isStatCard ? 'auto' : WIDE_TYPES.has(chartType) ? 'min(78vh, calc(100vh - 48px))' : 'min(80vh, calc(100vh - 48px))';\n\n  useEffect`;

if (c.includes(oldChartType)) {
  c = c.replace(oldChartType, newChartType);
  console.log('✓ chartType block replaced in ExpandedModal');
} else {
  console.error('✗ chartType block not found');
}

// 2. Replace maxWidth: 900 with dynamic modalMaxW
c = c.replace(
  `width: '100%', maxWidth: 900, height: isStatCard ? 'auto' : 'min(75vh, calc(100vh - 64px))', maxHeight: 'calc(100vh - 64px)'`,
  `width: '100%', maxWidth: modalMaxW, height: modalH, maxHeight: 'calc(100vh - 48px)'`
);
console.log('✓ modal dimensions updated');

// 3. Update the AuroraChart div in ExpandedModal to use type as string (no cast needed)
c = c.replace(
  `<AuroraChart type={chartType} data={auroraData} gradient="aurora" height="100%" bare />`,
  `<AuroraChart type={chartType as never} data={auroraData} gradient="aurora" height="100%" bare />`
);
console.log('✓ AuroraChart type cast updated');

fs.writeFileSync(file, c, 'utf8');
console.log('✅ Done');
