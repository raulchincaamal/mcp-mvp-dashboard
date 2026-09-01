const fs = require('fs');
const file = 'packages/dashboard-app/src/app/(pages)/observatory/components/ScrollPresentation.tsx';
let c = fs.readFileSync(file, 'utf8');

// The second chartType block starts at char 53199 — replace from there
// Find the end of that block (ends before "useEffect" with requestAnimationFrame)
const start = 53199;
const anchor = c.indexOf("useEffect(() => {\n\n    requestAnimationFrame", start);
if (anchor === -1) {
  // try without extra newline
  const anchor2 = c.indexOf("useEffect(() => {", start);
  console.log('anchor2 at:', anchor2);
  const oldBlock = c.slice(start, anchor2);
  console.log('Old block:', JSON.stringify(oldBlock.slice(0, 150)));
  const newBlock = `const chartType = insight.chartOptions ? (() => {\n    const opts = insight.chartOptions as Record<string, unknown>;\n    if (opts._auroraType) return opts._auroraType as string;\n    const series = opts.series as { type?: string; radius?: unknown }[] | undefined;\n    const t = series?.[0]?.type ?? 'bar';\n    if (t === 'pie') { const r = series?.[0]?.radius; return Array.isArray(r) && r[0] !== '0%' ? 'doughnut' : 'pie'; }\n    const supported = ['bar','line','area','pie','doughnut','scatter','radar','funnel','gauge','heatmap','treemap'];\n    return (supported.includes(t) ? t : 'bar') as string;\n  })() : 'bar';\n\n  // Adaptive modal sizing\n  const WIDE_TYPES = new Set(['line','area','stacked-area','bollinger','bar-race','theme-river','calendar-heatmap','candlestick','candlestick-ma']);\n  const TALL_TYPES = new Set(['map','heatmap','hierarchical-bar','diverging-bar','radial-stacked-bar','sankey','sunburst']);\n  const modalMaxW = WIDE_TYPES.has(chartType) ? 1280 : TALL_TYPES.has(chartType) ? 860 : 900;\n  const modalH = isStatCard ? 'auto' : WIDE_TYPES.has(chartType) ? 'min(78vh, calc(100vh - 48px))' : 'min(80vh, calc(100vh - 48px))';\n\n  `;
  c = c.slice(0, start) + newBlock + c.slice(anchor2);
  console.log('✓ replaced');
  fs.writeFileSync(file, c, 'utf8');
  console.log('✅ Done');
  process.exit(0);
}

const oldBlock = c.slice(start, anchor);
console.log('Old block (first 100 chars):', JSON.stringify(oldBlock.slice(0, 100)));

const newBlock = `const chartType = insight.chartOptions ? (() => {\n    const opts = insight.chartOptions as Record<string, unknown>;\n    if (opts._auroraType) return opts._auroraType as string;\n    const series = opts.series as { type?: string; radius?: unknown }[] | undefined;\n    const t = series?.[0]?.type ?? 'bar';\n    if (t === 'pie') { const r = series?.[0]?.radius; return Array.isArray(r) && r[0] !== '0%' ? 'doughnut' : 'pie'; }\n    const supported = ['bar','line','area','pie','doughnut','scatter','radar','funnel','gauge','heatmap','treemap'];\n    return (supported.includes(t) ? t : 'bar') as string;\n  })() : 'bar';\n\n  // Adaptive modal sizing\n  const WIDE_TYPES = new Set(['line','area','stacked-area','bollinger','bar-race','theme-river','calendar-heatmap','candlestick','candlestick-ma']);\n  const TALL_TYPES = new Set(['map','heatmap','hierarchical-bar','diverging-bar','radial-stacked-bar','sankey','sunburst']);\n  const modalMaxW = WIDE_TYPES.has(chartType) ? 1280 : TALL_TYPES.has(chartType) ? 860 : 900;\n  const modalH = isStatCard ? 'auto' : WIDE_TYPES.has(chartType) ? 'min(78vh, calc(100vh - 48px))' : 'min(80vh, calc(100vh - 48px))';\n\n  `;

c = c.slice(0, start) + newBlock + c.slice(anchor);
console.log('✓ chartType block replaced in ExpandedModal');

fs.writeFileSync(file, c, 'utf8');
console.log('✅ Done');
