const http = require('http');

function post(intent, limit = 200) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ dataset: 'ventas-credito', intent, limit });
    const req = http.request({
      hostname: '127.0.0.1', port: 4000, path: '/api/generate-ui',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

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
  const hasMultiDataset = charts.some(c => (c.chartOptions?._auroraData?.datasets?.length ?? 0) > 1);
  if (hasMultiDataset && charts.length >= 2) return { variant: 'comparison', seed };
  if (charts.length === 1 && kpis.length >= 1) return { variant: 'hero', seed };
  if (charts.length >= 4 || total >= 8) return { variant: 'bento-asym', seed };
  const bv = ['bento-asym','bento-asym','bento-asym','bento-asym','bento-asym','bento-asym','bento-sym','bento-sym','bento-sym','bento-sym','bento-sym'];
  return { variant: bv[seed % bv.length], seed };
}

function countInsights(components) {
  let kpis = 0, charts = 0, lists = 0;
  const chartInsights = [];
  for (const c of components) {
    if (c.component === 'KPIGrid') kpis += (c.props?.items?.length ?? 0);
    else if (c.component === 'Chart' || c.component === 'ProgressGroup') {
      charts++;
      // Detectar multi-dataset real
      const datasets = c.props?.data?.datasets ?? [];
      chartInsights.push({ id:'chart-'+charts, chartOptions: { _auroraData:{ datasets } } });
    }
    else if (c.component === 'TransactionList') lists++;
  }
  const insights = [
    ...Array(kpis).fill(null).map((_,i) => ({ id:'kpi-'+i, chartOptions: null })),
    ...chartInsights,
    ...Array(lists).fill(null).map((_,i) => ({ id:'txn-'+i, chartOptions: null, listItems:[{}] })),
  ];
  return { kpis, charts, lists, insights };
}

async function run() {
  const tests = [
    // bento-asym (muchos componentes)
    { intent: 'resumen ejecutivo de ventas' },
    { intent: 'grafica de ventas por estado' },
    { intent: 'creditos atrasados' },
    // comparison (multi-dataset)
    { intent: 'ventas de celulares y motos por estado' },
    // hero (1 chart + KPIs — template:chart con pocos componentes)
    { intent: 'tabla de las ultimas 10 ventas de motos' },
  ];

  let passed = 0;
  for (const t of tests) {
    process.stdout.write(`\n>>> "${t.intent}"\n`);
    try {
      const res = await post(t.intent);
      if (res.status !== 200) { console.log('  ERROR HTTP', res.status); continue; }
      const comps = res.body.data?.components ?? [];
      const { kpis, charts, lists, insights } = countInsights(comps);
      const layout = selectLayout(insights, t.intent);
      console.log(`  title: ${res.body.data?.title}`);
      console.log(`  components: ${comps.map(c=>`${c.component}${c.props?.type?'('+c.props.type+')':''}`).join(', ')}`);
      console.log(`  counts: kpis=${kpis} charts=${charts} lists=${lists} total=${insights.length}`);
      console.log(`  layout: ${layout.variant} (seed=${layout.seed})`);
      passed++;
    } catch(e) {
      console.log('  EXCEPTION:', e.message);
    }
  }
  console.log(`\n${passed}/${tests.length} intents procesados correctamente`);
}

run();
