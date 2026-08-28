function intentSeed(intent) {
  return intent.split('').reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) & 0xffff, 0);
}
function selectLayout(insights, intent) {
  const seed = intentSeed(intent);
  const kpis   = insights.filter(i => !i.chartOptions && !i.listItems);
  const charts = insights.filter(i => !!i.chartOptions);
  const total  = insights.length;
  if (total <= 2) return { variant: 'minimal', seed };
  if (charts.length === 0 && kpis.length >= 1) return { variant: 'focus', seed };
  const hasMultiDataset = charts.some(c => {
    const data = c.chartOptions?._auroraData;
    return (data?.datasets?.length ?? 0) > 1;
  });
  if (hasMultiDataset && charts.length >= 2) return { variant: 'comparison', seed };
  if (charts.length === 1 && kpis.length >= 1) return { variant: 'hero', seed };
  if (charts.length >= 4 || total >= 8) return { variant: 'bento-asym', seed };
  const bentoVariants = ['bento-asym','bento-asym','bento-asym','bento-asym','bento-asym','bento-asym','bento-sym','bento-sym','bento-sym','bento-sym','bento-sym'];
  return { variant: bentoVariants[seed % bentoVariants.length], seed };
}

const cases = [
  {
    label: 'ventas de motos (5 KPIs + 3 charts + 1 list)',
    intent: 'ventas de motos',
    insights: [
      ...Array(5).fill(null).map((_,i) => ({ id:'kpi-'+i, chartOptions: null })),
      ...Array(3).fill(null).map((_,i) => ({ id:'chart-'+i, chartOptions: { _auroraData:{ datasets:[{data:[1]}] } } })),
      { id:'txn-0', chartOptions: null, listItems:[{title:'x'}] },
    ]
  },
  {
    label: 'resumen ejecutivo (5 KPIs + 4 charts + 1 list)',
    intent: 'resumen ejecutivo de ventas',
    insights: [
      ...Array(5).fill(null).map((_,i) => ({ id:'kpi-'+i, chartOptions: null })),
      ...Array(4).fill(null).map((_,i) => ({ id:'chart-'+i, chartOptions: { _auroraData:{ datasets:[{data:[1]}] } } })),
      { id:'txn-0', chartOptions: null, listItems:[{title:'x'}] },
    ]
  },
  {
    label: 'comparacion multi-dataset (3 KPIs + 2 charts multi-serie)',
    intent: 'ventas de celulares y motos',
    insights: [
      ...Array(3).fill(null).map((_,i) => ({ id:'kpi-'+i, chartOptions: null })),
      { id:'chart-0', chartOptions: { _auroraData:{ datasets:[{data:[1]},{data:[2]}] } } },
      { id:'chart-1', chartOptions: { _auroraData:{ datasets:[{data:[1]},{data:[2]}] } } },
    ]
  },
  {
    label: 'solo KPIs (3 KPIs, sin charts)',
    intent: 'cuantas motos se vendieron',
    insights: [
      ...Array(3).fill(null).map((_,i) => ({ id:'kpi-'+i, chartOptions: null })),
    ]
  },
  {
    label: 'hero (4 KPIs + 1 chart)',
    intent: 'grafica de ventas por estado',
    insights: [
      ...Array(4).fill(null).map((_,i) => ({ id:'kpi-'+i, chartOptions: null })),
      { id:'chart-0', chartOptions: { _auroraData:{ datasets:[{data:[1]}] } } },
    ]
  },
  {
    label: 'minimal (2 componentes)',
    intent: 'total de ventas',
    insights: [
      { id:'kpi-0', chartOptions: null },
      { id:'kpi-1', chartOptions: null },
    ]
  },
];

let allPassed = true;
const expected = ['bento-asym', 'bento-asym', 'comparison', 'focus', 'hero', 'minimal'];

cases.forEach((c, i) => {
  const kpis   = c.insights.filter(x => !x.chartOptions && !x.listItems).length;
  const charts = c.insights.filter(x => !!x.chartOptions).length;
  const result = selectLayout(c.insights, c.intent);
  const pass   = result.variant === expected[i];
  if (!pass) allPassed = false;
  console.log(`${pass ? 'PASS' : 'FAIL'} [${result.variant}] seed=${result.seed} — ${c.label} (kpis:${kpis} charts:${charts} total:${c.insights.length})`);
});

console.log('\n' + (allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'));
