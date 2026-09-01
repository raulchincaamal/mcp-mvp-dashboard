const fs = require('fs');
const file = 'packages/dashboard-app/src/app/(pages)/observatory/components/ScrollPresentation.tsx';
let c = fs.readFileSync(file, 'utf8');

// Replace chartType block in ExpandedModal using regex (handles CRLF/LF)
// Unique anchor: this block is followed by useEffect with requestAnimationFrame (only in ExpandedModal)
const regex = /(const chartType = insight\.chartOptions \? \(\(\) => \{[\s\S]*?'bar';\s*\}\)\(\) : 'bar';)([\s\S]*?)(useEffect\(\(\) => \{\s*requestAnimationFrame)/;

const match = c.match(regex);
if (match) {
  const newChartTypeBlock = `const chartType = insight.chartOptions ? (() => {\n    const opts = insight.chartOptions as Record<string, unknown>;\n    if (opts._auroraType) return opts._auroraType as string;\n    const series = opts.series as { type?: string; radius?: unknown }[] | undefined;\n    const t = series?.[0]?.type ?? 'bar';\n    if (t === 'pie') { const r = series?.[0]?.radius; return Array.isArray(r) && r[0] !== '0%' ? 'doughnut' : 'pie'; }\n    const supported = ['bar','line','area','pie','doughnut','scatter','radar','funnel','gauge','heatmap','treemap'];\n    return (supported.includes(t) ? t : 'bar') as string;\n  })() : 'bar';\n\n  // Adaptive modal sizing\n  const WIDE_TYPES = new Set(['line','area','stacked-area','bollinger','bar-race','theme-river','calendar-heatmap','candlestick','candlestick-ma']);\n  const TALL_TYPES = new Set(['map','heatmap','hierarchical-bar','diverging-bar','radial-stacked-bar','sankey','sunburst']);\n  const modalMaxW = WIDE_TYPES.has(chartType) ? 1280 : TALL_TYPES.has(chartType) ? 860 : 900;\n  const modalH = isStatCard ? 'auto' : WIDE_TYPES.has(chartType) ? 'min(78vh, calc(100vh - 48px))' : 'min(80vh, calc(100vh - 48px))';\n`;
  c = c.replace(regex, newChartTypeBlock + match[2] + match[3]);
  console.log('✓ chartType block replaced');
} else {
  // Try to find how many matches exist
  const all = [...c.matchAll(/const chartType = insight\.chartOptions/g)];
  console.log('chartType occurrences:', all.length, 'at positions:', all.map(m => m.index));
}

fs.writeFileSync(file, c, 'utf8');
console.log('✅ Done');
