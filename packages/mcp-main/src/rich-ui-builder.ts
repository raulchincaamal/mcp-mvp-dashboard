import type { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';

// Types
export interface ParsedIntentSlim {
  template: string;
  chartTypes: string[];
  colorTheme?: string;
  groupBy?: string | null;
  metricField?: string | null;
  filters?: Record<string, unknown>;
}

interface ChartData { category: string; value: number; group?: string }
interface KPIItem { title: string; value: string; icon: string; trendDirection?: string }
interface TxnItem { title: string; subtitle: string; amount: string; date: string; status: string }

// Helpers
const fmt = (n: number) =>
  n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}K` : `$${Math.round(n).toLocaleString('es-MX')}`;

const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// Pre-compute aggregations
export function computeRichAggregations(records: Record<string, unknown>[]): Record<string, unknown> {
  if (!records.length) return {};

  const total = records.length;
  const totalMonto = records.reduce((s, r) => s + (Number(r.monto_total_credito) || 0), 0);
  const totalPrecio = records.reduce((s, r) => s + (Number(r.precio_contado) || 0), 0);

  // By categoria
  const byCat: Record<string, { count: number; monto: number }> = {};
  for (const r of records) {
    const k = String(r.categoria ?? 'N/A');
    if (!byCat[k]) byCat[k] = { count: 0, monto: 0 };
    byCat[k].count++;
    byCat[k].monto += Number(r.monto_total_credito) || 0;
  }
  const catEntries = Object.entries(byCat).sort((a, b) => b[1].count - a[1].count);

  // By estado
  const byEst: Record<string, { count: number; monto: number; atrasados: number }> = {};
  for (const r of records) {
    const k = String(r.estado ?? 'N/A');
    if (!byEst[k]) byEst[k] = { count: 0, monto: 0, atrasados: 0 };
    byEst[k].count++;
    byEst[k].monto += Number(r.monto_total_credito) || 0;
    if (r.estatus_credito === 'atrasado') byEst[k].atrasados++;
  }
  const estEntries = Object.entries(byEst).sort((a, b) => b[1].count - a[1].count).slice(0, 10);

  // By estatus_credito
  const byStatus: Record<string, { count: number; monto: number }> = {};
  for (const r of records) {
    const k = String(r.estatus_credito ?? 'N/A');
    if (!byStatus[k]) byStatus[k] = { count: 0, monto: 0 };
    byStatus[k].count++;
    byStatus[k].monto += Number(r.monto_total_credito) || 0;
  }
  const statusEntries = Object.entries(byStatus).sort((a, b) => b[1].count - a[1].count);
  const atrasadosCount = byStatus['atrasado']?.count ?? 0;

  // By canal_venta
  const byCanal: Record<string, number> = {};
  for (const r of records) {
    const k = String(r.canal_venta ?? 'N/A');
    byCanal[k] = (byCanal[k] ?? 0) + 1;
  }
  const canalEntries = Object.entries(byCanal).sort((a, b) => b[1] - a[1]);

  // By producto
  const byProduct: Record<string, { count: number; monto: number }> = {};
  for (const r of records) {
    const k = String(r.producto ?? 'N/A');
    if (!byProduct[k]) byProduct[k] = { count: 0, monto: 0 };
    byProduct[k].count++;
    byProduct[k].monto += Number(r.monto_total_credito) || 0;
  }
  const productEntries = Object.entries(byProduct).sort((a, b) => b[1].count - a[1].count).slice(0, 12);

  // By vendedor
  const byVendedor: Record<string, { count: number; monto: number }> = {};
  for (const r of records) {
    const k = String(r.vendedor ?? 'N/A');
    if (!byVendedor[k]) byVendedor[k] = { count: 0, monto: 0 };
    byVendedor[k].count++;
    byVendedor[k].monto += Number(r.monto_total_credito) || 0;
  }
  const vendedorEntries = Object.entries(byVendedor).sort((a, b) => b[1].count - a[1].count).slice(0, 10);

  // By month
  const byMonth: Record<string, { count: number; monto: number }> = {};
  for (const r of records) {
    if (!r.fecha_venta) continue;
    const d = new Date(String(r.fecha_venta));
    const k = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
    if (!byMonth[k]) byMonth[k] = { count: 0, monto: 0 };
    byMonth[k].count++;
    byMonth[k].monto += Number(r.monto_total_credito) || 0;
  }
  const monthEntries = Object.entries(byMonth).sort(([a], [b]) => {
    const p = (s: string) => { const [m, y] = s.split(' '); return parseInt(y) * 12 + monthNames.indexOf(m); };
    return p(a) - p(b);
  });

  return {
    totalRecords: total,
    readyKPIs: {
      totalVentasFmt: total.toLocaleString('es-MX'),
      montoTotal: fmt(totalMonto),
      ticketPromedio: fmt(totalMonto / total),
      precioPromedio: fmt(totalPrecio / total),
      pctAtrasados: `${((atrasadosCount / total) * 100).toFixed(1)}%`,
      montoAtrasados: fmt(byStatus['atrasado']?.monto ?? 0),
      atrasadosCount,
    },
    readyCategoryChart: { labels: catEntries.map(([k]) => k), counts: catEntries.map(([, d]) => d.count), montos: catEntries.map(([, d]) => Math.round(d.monto)), promedios: catEntries.map(([, d]) => Math.round(d.monto / d.count)) },
    readyCategoryTable: catEntries.map(([cat, d]) => ({ categoria: cat, ventas: d.count, monto_total: fmt(d.monto), ticket_promedio: fmt(d.monto / d.count), pct_total: `${((d.count / total) * 100).toFixed(1)}%` })),
    readyEstadoChart: { labels: estEntries.map(([k]) => k), counts: estEntries.map(([, d]) => d.count), montos: estEntries.map(([, d]) => Math.round(d.monto)) },
    readyEstadoTable: estEntries.map(([est, d]) => ({ estado: est, ventas: d.count, monto_total: fmt(d.monto), pct_atrasados: `${d.count > 0 ? ((d.atrasados / d.count) * 100).toFixed(1) : 0}%` })),
    readyStatusChart: { labels: statusEntries.map(([k]) => k), counts: statusEntries.map(([, d]) => d.count) },
    readyStatusTable: statusEntries.map(([st, d]) => ({ estatus: st, cantidad: d.count, monto_total: fmt(d.monto), pct_total: `${((d.count / total) * 100).toFixed(1)}%` })),
    readyCanalChart: { labels: canalEntries.map(([k]) => k), counts: canalEntries.map(([, v]) => v) },
    readyMonthChart: { labels: monthEntries.map(([k]) => k), counts: monthEntries.map(([, d]) => d.count), montos: monthEntries.map(([, d]) => Math.round(d.monto)) },
    readyProductChart: { labels: productEntries.map(([k]) => k), counts: productEntries.map(([, d]) => d.count), montos: productEntries.map(([, d]) => Math.round(d.monto)) },
    readyVendedorChart: { labels: vendedorEntries.map(([k]) => k), counts: vendedorEntries.map(([, d]) => d.count), montos: vendedorEntries.map(([, d]) => Math.round(d.monto)) },
    readyTransactions: records.slice(0, 8).map(r => ({ title: String(r.cliente ?? ''), subtitle: String(r.producto ?? r.categoria ?? ''), amount: fmt(Number(r.monto_total_credito) || 0), date: String(r.fecha_venta ?? ''), status: r.estatus_credito === 'atrasado' ? 'negative' : r.estatus_credito === 'liquidado' ? 'positive' : 'neutral' })),
  };
}


// Convert pre-computed chart to flat array format
function toFlatData(labels: string[], values: number[]): ChartData[] {
  return labels.map((cat, i) => ({ category: cat, value: values[i] }));
}

// Build KPI items
function buildKPIs(kpis: Record<string, unknown>, template: string): KPIItem[] {
  if (template === 'credit') {
    return [
      { title: 'Total Creditos', value: String(kpis.totalVentasFmt), icon: '💳' },
      { title: 'Monto en Riesgo', value: String(kpis.montoAtrasados ?? '$0'), icon: '🚨', trendDirection: 'down' },
      { title: '% Morosidad', value: String(kpis.pctAtrasados ?? '0%'), icon: '⚠️', trendDirection: 'down' },
    ];
  }
  return [
    { title: 'Total Ventas', value: String(kpis.totalVentasFmt), icon: '📊' },
    { title: 'Monto Total', value: String(kpis.montoTotal), icon: '💰' },
    { title: 'Ticket Promedio', value: String(kpis.ticketPromedio), icon: '🏷️' },
  ];
}

// Group records dynamically by any field
function groupByField(records: Record<string, unknown>[], field: string): { labels: string[]; counts: number[]; montos: number[] } {
  const grouped: Record<string, { count: number; monto: number }> = {};
  for (const r of records) {
    let k: string;
    if (field === 'mes') {
      if (!r.fecha_venta) continue;
      const d = new Date(String(r.fecha_venta));
      k = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
    } else {
      k = String(r[field] ?? 'N/A');
    }
    if (!grouped[k]) grouped[k] = { count: 0, monto: 0 };
    grouped[k].count++;
    grouped[k].monto += Number(r.monto_total_credito) || 0;
  }
  let entries = Object.entries(grouped);
  if (field === 'mes') {
    entries = entries.sort(([a], [b]) => {
      const p = (s: string) => { const [m, y] = s.split(' '); return parseInt(y) * 12 + monthNames.indexOf(m); };
      return p(a) - p(b);
    });
  } else {
    entries = entries.sort((a, b) => b[1].count - a[1].count).slice(0, 12);
  }
  return { labels: entries.map(([k]) => k), counts: entries.map(([, d]) => d.count), montos: entries.map(([, d]) => Math.round(d.monto)) };
}

// Main deterministic builder
function buildRich(
  parsedIntent: ParsedIntentSlim,
  records: Record<string, unknown>[],
  agg: Record<string, unknown>,
  colors: string[],
): unknown {
  const kpis = agg.readyKPIs as Record<string, unknown>;
  const catChart = agg.readyCategoryChart as { labels: string[]; counts: number[]; montos: number[]; promedios: number[] };
  const catTable = agg.readyCategoryTable as Record<string, unknown>[];
  const estChart = agg.readyEstadoChart as { labels: string[]; counts: number[]; montos: number[] };
  const estTable = agg.readyEstadoTable as Record<string, unknown>[];
  const statusChart = agg.readyStatusChart as { labels: string[]; counts: number[] };
  const statusTable = agg.readyStatusTable as Record<string, unknown>[];
  const canalChart = agg.readyCanalChart as { labels: string[]; counts: number[] };
  const monthChart = agg.readyMonthChart as { labels: string[]; counts: number[]; montos: number[] };
  const productChart = agg.readyProductChart as { labels: string[]; counts: number[]; montos: number[] };
  const vendedorChart = agg.readyVendedorChart as { labels: string[]; counts: number[]; montos: number[] };
  const txns = agg.readyTransactions as TxnItem[];

  const template = parsedIntent.template;
  const chartType = parsedIntent.chartTypes?.[0] ?? 'bar';
  const groupBy = parsedIntent.groupBy;

  const kpiGrid = { component: 'KPIGrid', props: { items: buildKPIs(kpis, template) } };
  const statusColors = ['#059669', '#D97706', '#2563EB', '#DC2626'];

  // TEMPLATE: chart
  if (template === 'chart') {
    const components: unknown[] = [kpiGrid];
    let chartData: { labels: string[]; counts: number[]; montos: number[] };
    let title = 'Grafica';

    if (groupBy === 'mes') { chartData = monthChart; title = 'Ventas por Mes'; }
    else if (groupBy === 'estado') { chartData = estChart; title = 'Ventas por Estado'; }
    else if (groupBy === 'categoria') { chartData = catChart; title = 'Ventas por Categoria'; }
    else if (groupBy === 'canal_venta') { chartData = { labels: canalChart.labels, counts: canalChart.counts, montos: canalChart.counts }; title = 'Ventas por Canal'; }
    else if (groupBy === 'estatus_credito') { chartData = { labels: statusChart.labels, counts: statusChart.counts, montos: statusChart.counts }; title = 'Ventas por Estatus'; }
    else if (groupBy === 'producto') { chartData = productChart; title = 'Ventas por Producto'; }
    else if (groupBy === 'vendedor') { chartData = vendedorChart; title = 'Ventas por Vendedor'; }
    else if (groupBy) { chartData = groupByField(records, groupBy); title = `Ventas por ${groupBy.charAt(0).toUpperCase() + groupBy.slice(1)}`; }
    else { chartData = catChart; title = 'Ventas por Categoria'; }

    if (chartData.labels.length > 1) {
      components.push({ component: 'Chart', props: { type: chartType, title, data: toFlatData(chartData.labels, chartData.counts) } });
    } else if (chartData.labels.length === 1) {
      components.push({ component: 'StatCard', props: { title: chartData.labels[0], value: String(chartData.counts[0]), icon: '📊' } });
    }

    const tableRows = records.slice(0, 10).map(r => ({
      fecha: String(r.fecha_venta ?? ''),
      cliente: String(r.cliente ?? ''),
      producto: String(r.producto ?? ''),
      categoria: String(r.categoria ?? ''),
      monto: fmt(Number(r.monto_total_credito) || 0),
      estatus: String(r.estatus_credito ?? ''),
    }));
    components.push({ component: 'DataSummary', props: { title: 'Detalle (Top 10)', columns: [{ key: 'fecha', label: 'Fecha' }, { key: 'cliente', label: 'Cliente' }, { key: 'producto', label: 'Producto' }, { key: 'monto', label: 'Monto' }, { key: 'estatus', label: 'Estatus' }], rows: tableRows } });

    return { title, layout: 'vertical', components };
  }

  // TEMPLATE: table
  if (template === 'table') {
    const tableRows = records.slice(0, 20).map(r => ({
      fecha: String(r.fecha_venta ?? ''),
      cliente: String(r.cliente ?? ''),
      producto: String(r.producto ?? ''),
      categoria: String(r.categoria ?? ''),
      monto: fmt(Number(r.monto_total_credito) || 0),
      estatus: String(r.estatus_credito ?? ''),
    }));
    return {
      title: 'Listado de Ventas',
      layout: 'vertical',
      components: [
        kpiGrid,
        { component: 'DataSummary', props: { title: 'Registros', highlightFirst: true, columns: [{ key: 'fecha', label: 'Fecha' }, { key: 'cliente', label: 'Cliente' }, { key: 'producto', label: 'Producto' }, { key: 'categoria', label: 'Categoria' }, { key: 'monto', label: 'Monto' }, { key: 'estatus', label: 'Estatus' }], rows: tableRows } },
      ],
    };
  }

  // TEMPLATE: cards
  if (template === 'cards') {
    const items = records.slice(0, 12).map(r => ({
      title: String(r.cliente ?? ''),
      subtitle: String(r.producto ?? r.categoria ?? ''),
      amount: fmt(Number(r.monto_total_credito) || 0),
      date: String(r.fecha_venta ?? ''),
      status: r.estatus_credito === 'atrasado' ? 'negative' : r.estatus_credito === 'liquidado' ? 'positive' : 'neutral',
    }));
    return {
      title: 'Tarjetas de Ventas',
      layout: 'vertical',
      components: [kpiGrid, { component: 'TransactionList', props: { title: 'Operaciones', items } }],
    };
  }

  // TEMPLATE: category
  if (template === 'category') {
    const isSingleCategory = catChart.labels.length <= 1;
    const categoryName = isSingleCategory ? catChart.labels[0] ?? 'Categoria' : null;
    const components: unknown[] = [kpiGrid];

    if (isSingleCategory) {
      if (estChart.labels.length > 1) {
        components.push({ component: 'Chart', props: { type: 'bar', title: `${categoryName} - Ventas por Estado`, data: toFlatData(estChart.labels, estChart.counts) } });
      }
      if (statusChart.labels.length > 1) {
        components.push({ component: 'Chart', props: { type: 'doughnut', title: `${categoryName} - Estatus de Creditos`, data: toFlatData(statusChart.labels, statusChart.counts) } });
      }
      if (monthChart.labels.length > 1) {
        components.push({ component: 'Chart', props: { type: 'line', title: `${categoryName} - Tendencia Mensual`, data: toFlatData(monthChart.labels, monthChart.counts) } });
      }
      if (canalChart.labels.length > 1) {
        components.push({ component: 'Chart', props: { type: 'doughnut', title: `${categoryName} - Canal de Venta`, data: toFlatData(canalChart.labels, canalChart.counts) } });
      }
      if (statusTable.length > 0) {
        components.push({ component: 'ProgressGroup', props: { title: 'Distribucion por Estatus', items: statusTable.map((r, i) => ({ label: `${r.estatus} (${r.cantidad})`, value: Math.round(parseFloat(String(r.pct_total)) || 0), color: statusColors[i % statusColors.length] })) } });
      }
      if (estTable.length > 0) {
        components.push({ component: 'DataSummary', props: { title: `Top Estados - ${categoryName}`, highlightFirst: true, columns: [{ key: 'estado', label: 'Estado' }, { key: 'ventas', label: 'Ventas' }, { key: 'monto_total', label: 'Monto Total' }, { key: 'pct_atrasados', label: '% Atrasados' }], rows: estTable } });
      }
      if (txns.length > 0) components.push({ component: 'TransactionList', props: { title: `Ultimas Ventas - ${categoryName}`, items: txns } });
      return { title: `Analisis: ${categoryName}`, layout: 'vertical', components };
    }

    if (catChart.labels.length > 1) {
      components.push({ component: 'Chart', props: { type: 'bar', title: 'Ventas por Categoria', data: toFlatData(catChart.labels, catChart.counts) } });
      components.push({ component: 'Chart', props: { type: 'doughnut', title: 'Distribucion de Monto por Categoria', data: toFlatData(catChart.labels, catChart.montos) } });
    }
    if (statusChart.labels.length > 1) {
      components.push({ component: 'Chart', props: { type: 'doughnut', title: 'Estatus de Creditos', data: toFlatData(statusChart.labels, statusChart.counts) } });
    }
    if (catTable.length > 0) {
      components.push({ component: 'ProgressGroup', props: { title: '% Participacion por Categoria', items: catTable.slice(0, 6).map((r, i) => ({ label: `${r.categoria} (${r.ventas})`, value: Math.round((Number(r.ventas) / records.length) * 100), color: colors[i % colors.length] })) } });
      components.push({ component: 'DataSummary', props: { title: 'Resumen por Categoria', highlightFirst: true, columns: [{ key: 'categoria', label: 'Categoria' }, { key: 'ventas', label: 'Ventas' }, { key: 'monto_total', label: 'Monto Total' }, { key: 'ticket_promedio', label: 'Ticket Prom.' }, { key: 'pct_total', label: '% del Total' }], rows: catTable } });
    }
    return { title: 'Analisis por Categoria', layout: 'vertical', components };
  }

  // TEMPLATE: credit
  if (template === 'credit') {
    const atrasados = records.filter(r => r.estatus_credito === 'atrasado');
    const avgPlazo = records.reduce((s, r) => s + (Number(r.plazo_semanas) || 0), 0) / records.length;
    const creditKpis: KPIItem[] = [
      { title: 'Total Creditos', value: String(kpis.totalVentasFmt), icon: '💳' },
      { title: 'Monto en Riesgo', value: String(kpis.montoAtrasados ?? '$0'), icon: '🚨', trendDirection: 'down' },
      { title: '% Morosidad', value: String(kpis.pctAtrasados ?? '0%'), icon: '⚠️', trendDirection: 'down' },
      { title: 'Plazo Promedio', value: `${Math.round(avgPlazo)} sem`, icon: '📅' },
    ];
    const components: unknown[] = [{ component: 'KPIGrid', props: { items: creditKpis } }];

    if (statusTable.length > 0) {
      components.push({ component: 'ProgressGroup', props: { title: 'Distribucion por Estatus', items: statusTable.map((r, i) => ({ label: `${r.estatus} (${r.cantidad})`, value: Math.round(parseFloat(String(r.pct_total)) || 0), color: statusColors[i % statusColors.length] })) } });
    }
    if (atrasados.length > 0) {
      const byEst: Record<string, number> = {};
      for (const r of atrasados) { const k = String(r.estado ?? 'N/A'); byEst[k] = (byEst[k] ?? 0) + 1; }
      const ee = Object.entries(byEst).sort((a, b) => b[1] - a[1]).slice(0, 10);
      if (ee.length > 1) {
        components.push({ component: 'Chart', props: { type: 'bar', title: 'Creditos Atrasados por Estado', data: ee.map(([cat, val]) => ({ category: cat, value: val })) } });
      }
    }
    if (canalChart.labels.length > 1) {
      components.push({ component: 'Chart', props: { type: 'doughnut', title: 'Distribucion por Canal', data: toFlatData(canalChart.labels, canalChart.counts) } });
    }
    if (statusChart.labels.length > 1) {
      components.push({ component: 'Chart', props: { type: 'doughnut', title: 'Estatus de Creditos', data: toFlatData(statusChart.labels, statusChart.counts) } });
    }
    if (statusTable.length > 0) {
      components.push({ component: 'DataSummary', props: { title: 'Resumen por Estatus', highlightFirst: true, columns: [{ key: 'estatus', label: 'Estatus' }, { key: 'cantidad', label: 'Cantidad' }, { key: 'monto_total', label: 'Monto Total' }, { key: 'pct_total', label: '% del Total' }], rows: statusTable } });
    }
    const topAt = atrasados.sort((a, b) => (Number(b.monto_total_credito) || 0) - (Number(a.monto_total_credito) || 0)).slice(0, 8).map(r => ({ title: String(r.cliente ?? ''), subtitle: String(r.producto ?? r.categoria ?? ''), amount: fmt(Number(r.monto_total_credito) || 0), date: String(r.fecha_venta ?? ''), status: 'negative' }));
    if (topAt.length > 0) components.push({ component: 'TransactionList', props: { title: 'Creditos Atrasados - Mayor Monto', items: topAt } });

    return { title: 'Seguimiento de Creditos', layout: 'vertical', components };
  }

  // TEMPLATE: executive (default)
  const components: unknown[] = [kpiGrid];
  if (estChart.labels.length > 1) components.push({ component: 'Chart', props: { type: 'bar', title: 'Ventas por Estado (Top 10)', data: toFlatData(estChart.labels, estChart.counts) } });
  if (catChart.labels.length > 1) components.push({ component: 'Chart', props: { type: 'doughnut', title: 'Distribucion por Categoria', data: toFlatData(catChart.labels, catChart.counts) } });
  if (statusChart.labels.length > 1) components.push({ component: 'Chart', props: { type: 'doughnut', title: 'Estatus de Creditos', data: toFlatData(statusChart.labels, statusChart.counts) } });
  if (monthChart.labels.length > 1) components.push({ component: 'Chart', props: { type: 'line', title: 'Tendencia Mensual de Ventas', data: toFlatData(monthChart.labels, monthChart.counts) } });
  if (canalChart.labels.length > 1) components.push({ component: 'Chart', props: { type: 'bar', title: 'Ventas por Canal', data: toFlatData(canalChart.labels, canalChart.counts) } });
  if (estTable.length > 0) components.push({ component: 'DataSummary', props: { title: 'Top Estados', highlightFirst: true, columns: [{ key: 'estado', label: 'Estado' }, { key: 'ventas', label: 'Ventas' }, { key: 'monto_total', label: 'Monto Total' }, { key: 'pct_atrasados', label: '% Atrasados' }], rows: estTable } });
  if (txns.length > 0) components.push({ component: 'TransactionList', props: { title: 'Ultimas Operaciones', items: txns } });

  return { title: 'Resumen Ejecutivo', layout: 'vertical', components };
}


// Main entry point (100% deterministic - no Bedrock calls)
export async function buildRichUIConfig(
  _bedrockClient: BedrockRuntimeClient,
  _modelId: string,
  intent: string,
  parsedIntent: ParsedIntentSlim,
  records: Record<string, unknown>[],
  colors: string[],
): Promise<unknown> {
  const agg = computeRichAggregations(records);
  console.log(`[rich-ui] template=${parsedIntent.template} chartTypes=${parsedIntent.chartTypes.join(',')} groupBy=${parsedIntent.groupBy ?? 'none'}`);
  return buildRich(parsedIntent, records, agg, colors);
}
