import { readFileSync, writeFileSync } from 'fs';

const file = 'c:/Users/MauricioMadrugaOlver/Desktop/03-MCP-Proyectos/MCP IA Main/mcp-mvp-dashboard/packages/mcp-main/src/orchestrator.ts';
let c = readFileSync(file, 'utf8');

// 1. barCount > 1 → > 2 (allow 2 bars per dashboard)
c = c.replace('if (barCount > 1) {', 'if (barCount > 2) {');

// 2. Enrich fieldSummaries topValues with monto sum
// 2. Enrich fieldSummaries topValues with monto sum (use regex to handle extra blank lines)
const fieldSummariesRegex = /(\/\/ \u2500+ String fields: cardinality \+ top values \u2500+)[\s\S]*?(agg\.fieldSummaries = fieldSummaries;)/;
if (fieldSummariesRegex.test(c)) {
  c = c.replace(fieldSummariesRegex, `  // \u2500\u2500\u2500 String fields: cardinality + top values (with monto sum) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r\n  const fieldSummaries: Record<string, unknown> = {};\r\n  const montoField = numericFields.includes('monto_total_credito') ? 'monto_total_credito'\r\n    : numericFields.includes('precio_contado') ? 'precio_contado' : null;\r\n  for (const field of stringFields) {\r\n    const counts: Record<string, number> = {};\r\n    const montoSums: Record<string, number> = {};\r\n    for (const r of records) {\r\n      const key = String(r[field] ?? '');\r\n      counts[key] = (counts[key] ?? 0) + 1;\r\n      if (montoField) montoSums[key] = (montoSums[key] ?? 0) + Number(r[montoField] ?? 0);\r\n    }\r\n    // Sort by monto sum (financial value) when available, else by count\r\n    const sorted = Object.entries(counts).sort((a, b) =>\r\n      montoField ? (montoSums[b[0]] ?? 0) - (montoSums[a[0]] ?? 0) : b[1] - a[1]\r\n    );\r\n    fieldSummaries[field] = {\r\n      uniqueValues: sorted.length,\r\n      topValues: sorted\r\n        .slice(0, 10)\r\n        .map(([value, count]) => ({ value, count, sum: montoField ? Math.round(montoSums[value] ?? 0) : count })),\r\n    };\r\n  }\r\n  agg.fieldSummaries = fieldSummaries;`);
  console.log('\u2713 fieldSummaries enriched with sum');
} else {
  console.error('\u2717 fieldSummaries block not found');
}

// 3. Add metricVal helper after estatusTop line
const oldEstatusTop = `  const estatusTop  = fieldSummaries.estatus_credito?.topValues ?? [];`;
const newEstatusTop = `  const estatusTop  = fieldSummaries.estatus_credito?.topValues ?? [];
  // Use monto sum when available, else count
  const metricVal = (item: { count: number; sum?: number }) => item.sum ?? item.count;`;

if (c.includes(oldEstatusTop) && !c.includes('const metricVal')) {
  c = c.replace(oldEstatusTop, newEstatusTop);
  console.log('✓ metricVal helper added');
} else {
  console.log('~ metricVal already present or estatusTop not found');
}

// 4. Update fieldSummaries type to include sum
c = c.replace(
  `const fieldSummaries = (aggregations.fieldSummaries ?? {}) as Record<string, { topValues: { value: string; count: number }[] }>;`,
  `const fieldSummaries = (aggregations.fieldSummaries ?? {}) as Record<string, { topValues: { value: string; count: number; sum?: number }[] }>;`
);
console.log('✓ fieldSummaries type updated');

// 5. Replace count with metricVal in sanitize replacement charts
// Rule 0b (map → bar by ciudad/categoria)
c = c.replace(
  `datasets: [{ label: 'Ventas', data: source.map(s => s.count), backgroundColor: '#5bb8f5' }],\n            },\n            title: props.title ?? \`Ventas por \${groupLabel} — \${filterEstado}\``,
  `datasets: [{ label: 'Monto Total', data: source.map(s => metricVal(s)), backgroundColor: '#5bb8f5' }],\n            },\n            title: props.title ?? \`Monto por \${groupLabel} — \${filterEstado}\``
);
console.log('✓ Rule 0b updated');

// Rule 1 (1 label = filtered categoria → bar by producto)
c = c.replace(
  `datasets: [{ label: 'Ventas', data: productoTop.map(p => p.count), backgroundColor: '#5bb8f5' }],\n            },\n            title: props.title ?? \`Ventas por Producto — \${filterCategoria}\``,
  `datasets: [{ label: 'Monto Total', data: productoTop.map(p => metricVal(p)), backgroundColor: '#5bb8f5' }],\n            },\n            title: props.title ?? \`Monto por Producto — \${filterCategoria}\``
);
c = c.replace(
  `datasets: [{ label: 'Ventas', data: estadoTop.map(e => e.count), backgroundColor: '#a78bfa' }],\n            },\n            title: props.title ?? \`Ventas por Estado — \${filterCategoria}\``,
  `datasets: [{ label: 'Monto Total', data: estadoTop.map(e => metricVal(e)), backgroundColor: '#a78bfa' }],\n            },\n            title: props.title ?? \`Monto por Estado — \${filterCategoria}\``
);
console.log('✓ Rule 1 updated');

// Rule 2 (labels = filtered categoria → bar by producto)
c = c.replace(
  `datasets: [{ label: 'Ventas', data: productoTop.map(p => p.count), backgroundColor: '#34d399' }],\n              },\n              title: props.title ?? \`Ventas por Producto — \${filterCategoria}\``,
  `datasets: [{ label: 'Monto Total', data: productoTop.map(p => metricVal(p)), backgroundColor: '#34d399' }],\n              },\n              title: props.title ?? \`Monto por Producto — \${filterCategoria}\``
);
c = c.replace(
  `datasets: [{ label: 'Ventas', data: estadoTop.map(e => e.count), backgroundColor: '#34d399' }],\n              },\n              title: props.title ?? \`Ventas por Estado — \${filterCategoria}\``,
  `datasets: [{ label: 'Monto Total', data: estadoTop.map(e => metricVal(e)), backgroundColor: '#34d399' }],\n              },\n              title: props.title ?? \`Monto por Estado — \${filterCategoria}\``
);
console.log('✓ Rule 2 updated');

// Rule 4 (singleEstado bar by categoria)
c = c.replace(
  `datasets: [{ label: 'Ventas', data: catTop.map(c => c.count), backgroundColor: '#fbbf24' }],\n            },\n            title: \`Ventas por Categoría — \${filterEstado}\``,
  `datasets: [{ label: 'Monto Total', data: catTop.map(c => metricVal(c)), backgroundColor: '#fbbf24' }],\n            },\n            title: \`Monto por Categoría — \${filterEstado}\``
);
console.log('✓ Rule 4 updated');

// Rule 5 (hexbin-map → treemap by producto)
c = c.replace(
  `datasets: [{ data: productoTop.map(p => p.count) }],\n            },\n            title: \`Distribución por Producto — \${filterCategoria}\``,
  `datasets: [{ data: productoTop.map(p => metricVal(p)) }],\n            },\n            title: \`Monto por Producto — \${filterCategoria}\``
);
c = c.replace(
  `datasets: [{ label: 'Ventas', data: estadoTop.map(e => e.count), backgroundColor: '#22d3ee' }],\n            },\n            title: \`Ventas por Estado — \${filterCategoria}\``,
  `datasets: [{ label: 'Monto Total', data: estadoTop.map(e => metricVal(e)), backgroundColor: '#22d3ee' }],\n            },\n            title: \`Monto por Estado — \${filterCategoria}\``
);
console.log('✓ Rule 5 updated');

// 6. Update system prompt rule 6
c = c.replace(
  `6. Usa aggregations.fieldSummaries[campo].topValues para charts de distribución secundarios (cuando necesites conteos por categoría)`,
  `6. Usa aggregations.fieldSummaries[campo].topValues para charts de distribución secundarios — usa el campo \`sum\` (monto_total_credito) de cada topValue como valor del chart, NO el campo \`count\`. El campo \`sum\` ya está pre-calculado en cada topValue.`
);
console.log('✓ System prompt rule 6 updated');

// 7. Update system prompt rule 4 (metric rule)
c = c.replace(
  `4. Usa aggregations.groupBy.data para labels/values del Chart principal — los values son MONTOS en MXN (sum de monto_total_credito) salvo que metric sea "count"`,
  `4. Usa aggregations.groupBy.data para labels/values del Chart principal — los values son MONTOS en MXN (sum de monto_total_credito) salvo que metric sea "count"\n   REGLA CRÍTICA DE MÉTRICAS: En TODOS los charts (bar, treemap, doughnut, area, line, map, etc.), usa SIEMPRE el campo \`sum\` de monto_total_credito como valor, NO el campo \`count\`. Solo usa \`count\` cuando el usuario pida explícitamente "cuántos", "cantidad", "número de". Los valores de fieldSummaries.topValues tienen tanto \`count\` como \`sum\` — usa \`sum\`.`
);
console.log('✓ System prompt rule 4 updated');

writeFileSync(file, c, 'utf8');
console.log('\n✅ All changes applied successfully');
