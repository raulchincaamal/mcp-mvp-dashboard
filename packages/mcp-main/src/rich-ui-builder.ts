import {
  BedrockRuntimeClient,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime';

// ─── Types ────────────────────────────────────────────────────

export interface ParsedIntentSlim {
  template: string;
  chartTypes: string[];
  colorTheme?: string;
  groupBy?: string | null;
  metricField?: string | null;
  filters?: Record<string, unknown>;
}

// ─── Decision: which tier to use ──────────────────────────────

type Tier = 'custom' | 'rich' | 'standard';

function decideTier(intent: string, parsedIntent: ParsedIntentSlim): Tier {
  const lower = intent.toLowerCase();

  // CUSTOM: user asked for specific chart types, or the intent is very specific/creative
  const hasSpecificCharts = parsedIntent.chartTypes.length > 0 &&
    !['bar', 'line'].every(t => parsedIntent.chartTypes.includes(t)); // not just defaults
  const isCreativeIntent = /treemap|heatmap|radar|funnel|gauge|scatter|dona|pastel|embudo|medidor|araña|calor|jerarqu/i.test(lower);
  const isMultiChart = /y (tambi[eé]n|adem[aá]s)|m[aá]s (una|un) gr[aá]fica|varios|m[uú]ltiples/i.test(lower);
  const isVerySpecific = parsedIntent.chartTypes.length >= 2;

  if (hasSpecificCharts || isCreativeIntent || isMultiChart || isVerySpecific) {
    return 'custom';
  }

  // RICH: dense templates without specific chart requests → deterministic, guaranteed
  if (['category', 'executive', 'credit'].includes(parsedIntent.template)) {
    return 'rich';
  }

  // STANDARD: everything else goes through existing generateUIConfig
  return 'standard';
}

// ─── Pre-compute aggregations ─────────────────────────────────

export function computeRichAggregations(
  records: Record<string, unknown>[],
): Record<string, unknown> {
  if (!records.length) return {};

  const total = records.length;
  const fmt = (n: number) =>
    n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M`
    : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}K`
    : `$${Math.round(n).toLocaleString('es-MX')}`;

  const totalMonto = records.reduce((s, r) => s + (Number(r.monto_total_credito) || 0), 0);
  const totalPrecio = records.reduce((s, r) => s + (Number(r.precio_contado) || 0), 0);

  const byCat: Record<string, { count: number; monto: number }> = {};
  for (const r of records) {
    const k = String(r.categoria ?? 'N/A');
    if (!byCat[k]) byCat[k] = { count: 0, monto: 0 };
    byCat[k].count++;
    byCat[k].monto += Number(r.monto_total_credito) || 0;
  }
  const catEntries = Object.entries(byCat).sort((a, b) => b[1].count - a[1].count);

  const byEst: Record<string, { count: number; monto: number; atrasados: number }> = {};
  for (const r of records) {
    const k = String(r.estado ?? 'N/A');
    if (!byEst[k]) byEst[k] = { count: 0, monto: 0, atrasados: 0 };
    byEst[k].count++;
    byEst[k].monto += Number(r.monto_total_credito) || 0;
    if (r.estatus_credito === 'atrasado') byEst[k].atrasados++;
  }
  const estEntries = Object.entries(byEst).sort((a, b) => b[1].count - a[1].count).slice(0, 10);

  const byStatus: Record<string, { count: number; monto: number }> = {};
  for (const r of records) {
    const k = String(r.estatus_credito ?? 'N/A');
    if (!byStatus[k]) byStatus[k] = { count: 0, monto: 0 };
    byStatus[k].count++;
    byStatus[k].monto += Number(r.monto_total_credito) || 0;
  }
  const statusEntries = Object.entries(byStatus).sort((a, b) => b[1].count - a[1].count);
  const atrasadosCount = byStatus['atrasado']?.count ?? 0;

  const byCanal: Record<string, number> = {};
  for (const r of records) {
    const k = String(r.canal_venta ?? 'N/A');
    byCanal[k] = (byCanal[k] ?? 0) + 1;
  }
  const canalEntries = Object.entries(byCanal).sort((a, b) => b[1] - a[1]);

  // Monthly trend
  const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
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
    readyCategoryChart: {
      labels: catEntries.map(([k]) => k),
      counts: catEntries.map(([, d]) => d.count),
      montos: catEntries.map(([, d]) => Math.round(d.monto)),
      promedios: catEntries.map(([, d]) => Math.round(d.monto / d.count)),
    },
    readyCategoryTable: catEntries.map(([cat, d]) => ({
      categoria: cat,
      ventas: d.count,
      monto_total: fmt(d.monto),
      ticket_promedio: fmt(d.monto / d.count),
      pct_total: `${((d.count / total) * 100).toFixed(1)}%`,
    })),
    readyEstadoChart: {
      labels: estEntries.map(([k]) => k),
      counts: estEntries.map(([, d]) => d.count),
      montos: estEntries.map(([, d]) => Math.round(d.monto)),
    },
    readyEstadoTable: estEntries.map(([est, d]) => ({
      estado: est,
      ventas: d.count,
      monto_total: fmt(d.monto),
      pct_atrasados: `${d.count > 0 ? ((d.atrasados / d.count) * 100).toFixed(1) : 0}%`,
    })),
    readyStatusChart: {
      labels: statusEntries.map(([k]) => k),
      counts: statusEntries.map(([, d]) => d.count),
    },
    readyStatusTable: statusEntries.map(([st, d]) => ({
      estatus: st,
      cantidad: d.count,
      monto_total: fmt(d.monto),
      pct_total: `${((d.count / total) * 100).toFixed(1)}%`,
    })),
    readyCanalChart: {
      labels: canalEntries.map(([k]) => k),
      counts: canalEntries.map(([, v]) => v),
    },
    readyMonthChart: {
      labels: monthEntries.map(([k]) => k),
      counts: monthEntries.map(([, d]) => d.count),
      montos: monthEntries.map(([, d]) => Math.round(d.monto)),
    },
    readyTransactions: records.slice(0, 8).map(r => ({
      title: String(r.cliente ?? ''),
      subtitle: String(r.producto ?? r.categoria ?? ''),
      amount: fmt(Number(r.monto_total_credito) || 0),
      date: String(r.fecha_venta ?? ''),
      status: r.estatus_credito === 'atrasado' ? 'negative'
        : r.estatus_credito === 'liquidado' ? 'positive' : 'neutral',
    })),
  };
}

// ─── TIER 1: CUSTOM — Bedrock decides everything ──────────────
// Used when user asks for specific chart types or creative layouts

async function buildCustom(
  bedrockClient: BedrockRuntimeClient,
  modelId: string,
  intent: string,
  parsedIntent: ParsedIntentSlim,
  agg: Record<string, unknown>,
  colors: string[],
): Promise<unknown> {
  const systemPrompt = `Eres un experto en visualizacion de datos para Macropay (ventas a credito en Mexico).
El usuario hizo una peticion ESPECIFICA. Tienes libertad total para decidir la estructura del dashboard.

DATOS PRE-COMPUTADOS disponibles (usa SOLO estos, no inventes numeros):
  readyKPIs: { totalVentasFmt, montoTotal, ticketPromedio, pctAtrasados, montoAtrasados, precioPromedio, atrasadosCount }
  readyCategoryChart: { labels[], counts[], montos[], promedios[] }  — por categoria
  readyCategoryTable: [{ categoria, ventas, monto_total, ticket_promedio, pct_total }]
  readyEstadoChart: { labels[], counts[], montos[] }  — top 10 estados
  readyEstadoTable: [{ estado, ventas, monto_total, pct_atrasados }]
  readyStatusChart: { labels[], counts[] }  — estatus credito
  readyStatusTable: [{ estatus, cantidad, monto_total, pct_total }]
  readyCanalChart: { labels[], counts[] }  — canal de venta
  readyMonthChart: { labels[], counts[], montos[] }  — por mes cronologico
  readyTransactions: [{ title, subtitle, amount, date, status }]

TIPOS DE CHART disponibles: bar, line, area, doughnut, pie, treemap, funnel, gauge, radar, heatmap, scatter

COMO CONSTRUIR CHARTS:
  gauge: data.datasets[0].data[0] = valor 0-100, data.labels[0] = nombre del KPI
  treemap: data.labels = nombres, data.datasets[0].data = valores de tamano
  funnel: data.labels = etapas desc, data.datasets[0].data = valores
  heatmap: data.labels = columnas, data.datasets[i].label = fila, data.datasets[i].data = valores por columna
  scatter: data.labels = valores X (strings), data.datasets[i].data = valores Y
  radar: data.labels = metricas, data.datasets[i].data = valores (misma escala)

REGLAS:
1. Responde el intent del usuario de la forma mas util y visual posible
2. Minimo 1 KPIGrid + 2 Charts + 1 DataSummary
3. Maximo 9 componentes
4. USA SOLO datos de precomputedData
5. Responde SOLO JSON valido sin markdown

Colores: ${JSON.stringify(colors.slice(0, 9))}
UIConfig: { "title": string, "layout": "vertical", "components": [{"component": string, "props": {}}] }
Componentes: KPIGrid, Chart, DataSummary, TransactionList, ProgressGroup, StatCard`;

  const userMessage = `Intent del usuario: "${intent}"
Tipos de grafica pedidos: ${parsedIntent.chartTypes.join(', ') || 'decide tu'}
Template: ${parsedIntent.template}

DATOS:
${JSON.stringify(agg, null, 2)}

Genera el UIConfig JSON que mejor responda al intent.`;

  const response = await bedrockClient.send(new ConverseCommand({
    modelId,
    system: [{ text: systemPrompt }],
    messages: [{ role: 'user', content: [{ text: userMessage }] }],
    inferenceConfig: { maxTokens: 6000, temperature: 0.2 },
  }));

  const block = response.output?.message?.content?.[0];
  if (!block || !('text' in block)) throw new Error('no response');
  const raw = block.text!.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  const parsed = JSON.parse(raw);
  return (parsed as Record<string, unknown>).uiConfig ?? parsed;
}

// ─── TIER 2: RICH — deterministic, guaranteed 6-7 components ──
// Used for dense templates: executive, category, credit

function buildRich(
  parsedIntent: ParsedIntentSlim,
  records: Record<string, unknown>[],
  agg: Record<string, unknown>,
  colors: string[],
): unknown {
  const kpis = agg.readyKPIs as Record<string, unknown>;
  const catChart = agg.readyCategoryChart as Record<string, unknown> | undefined;
  const catTable = agg.readyCategoryTable as Record<string, unknown>[] | undefined;
  const estChart = agg.readyEstadoChart as Record<string, unknown> | undefined;
  const estTable = agg.readyEstadoTable as Record<string, unknown>[] | undefined;
  const statusChart = agg.readyStatusChart as Record<string, unknown> | undefined;
  const statusTable = agg.readyStatusTable as Record<string, unknown>[] | undefined;
  const canalChart = agg.readyCanalChart as Record<string, unknown> | undefined;
  const txns = agg.readyTransactions as Record<string, unknown>[] | undefined;

  const kpiItems = [
    { title: 'Total Ventas', value: String(kpis.totalVentasFmt), icon: '📊' },
    { title: 'Monto Total', value: String(kpis.montoTotal), icon: '💰' },
    { title: 'Ticket Promedio', value: String(kpis.ticketPromedio), icon: '🏷️' },
    ...(kpis.pctAtrasados ? [{ title: 'Morosidad', value: String(kpis.pctAtrasados), icon: '⚠️', trendDirection: 'down' }] : []),
  ];

  if (parsedIntent.template === 'category') {
    const components: unknown[] = [{ component: 'KPIGrid', props: { items: kpiItems } }];
    if (catChart) {
      components.push({ component: 'Chart', props: { type: 'bar', title: 'Ventas por Categoría', data: { labels: catChart.labels, datasets: [{ label: 'Ventas', data: catChart.counts, backgroundColor: colors.slice(0, (catChart.labels as string[]).length) }] } } });
      components.push({ component: 'Chart', props: { type: 'doughnut', title: 'Distribución de Monto por Categoría', data: { labels: catChart.labels, datasets: [{ label: 'Monto', data: catChart.montos, backgroundColor: colors.slice(0, (catChart.labels as string[]).length) }] } } });
      components.push({ component: 'Chart', props: { type: 'bar', title: 'Ticket Promedio por Categoría', data: { labels: catChart.labels, datasets: [{ label: 'Promedio', data: catChart.promedios, backgroundColor: colors.slice(0, (catChart.labels as string[]).length) }] } } });
      if (statusChart) components.push({ component: 'Chart', props: { type: 'doughnut', title: 'Estatus de Créditos', data: { labels: statusChart.labels, datasets: [{ label: 'Créditos', data: statusChart.counts, backgroundColor: ['#059669', '#D97706', '#2563EB', '#DC2626'] }] } } });
    }
    if (catTable) {
      components.push({ component: 'ProgressGroup', props: { title: '% Participación por Categoría', items: catTable.slice(0, 6).map((r, i) => ({ label: `${r.categoria} (${r.ventas})`, value: Math.round((Number(r.ventas) / records.length) * 100), color: colors[i % colors.length] })) } });
      components.push({ component: 'DataSummary', props: { title: 'Resumen por Categoría', highlightFirst: true, columns: [{ key: 'categoria', label: 'Categoría' }, { key: 'ventas', label: 'Ventas' }, { key: 'monto_total', label: 'Monto Total' }, { key: 'ticket_promedio', label: 'Ticket Prom.' }, { key: 'pct_total', label: '% del Total' }], rows: catTable } });
    }
    return { title: 'Análisis por Categoría', layout: 'vertical', components };
  }

  if (parsedIntent.template === 'executive') {
    const components: unknown[] = [{ component: 'KPIGrid', props: { items: kpiItems } }];
    if (estChart) components.push({ component: 'Chart', props: { type: 'bar', title: 'Ventas por Estado (Top 10)', data: { labels: estChart.labels, datasets: [{ label: 'Ventas', data: estChart.counts, backgroundColor: colors.slice(0, (estChart.labels as string[]).length) }] } } });
    if (catChart) components.push({ component: 'Chart', props: { type: 'doughnut', title: 'Distribución por Categoría', data: { labels: catChart.labels, datasets: [{ label: 'Ventas', data: catChart.counts, backgroundColor: colors.slice(0, (catChart.labels as string[]).length) }] } } });
    if (statusChart) components.push({ component: 'Chart', props: { type: 'doughnut', title: 'Estatus de Créditos', data: { labels: statusChart.labels, datasets: [{ label: 'Créditos', data: statusChart.counts, backgroundColor: ['#059669', '#D97706', '#2563EB', '#DC2626'] }] } } });
    if (canalChart) components.push({ component: 'Chart', props: { type: 'bar', title: 'Ventas por Canal', data: { labels: canalChart.labels, datasets: [{ label: 'Ventas', data: canalChart.counts, backgroundColor: colors.slice(0, 3) }] } } });
    if (estTable) components.push({ component: 'DataSummary', props: { title: 'Top Estados', highlightFirst: true, columns: [{ key: 'estado', label: 'Estado' }, { key: 'ventas', label: 'Ventas' }, { key: 'monto_total', label: 'Monto Total' }, { key: 'pct_atrasados', label: '% Atrasados' }], rows: estTable } });
    if (txns) components.push({ component: 'TransactionList', props: { title: 'Últimas Operaciones', items: txns } });
    return { title: 'Resumen Ejecutivo', layout: 'vertical', components };
  }

  if (parsedIntent.template === 'credit') {
    const atrasados = records.filter(r => r.estatus_credito === 'atrasado');
    const avgPlazo = records.reduce((s, r) => s + (Number(r.plazo_semanas) || 0), 0) / records.length;
    const fmt = (n: number) => n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}K` : `$${Math.round(n).toLocaleString('es-MX')}`;
    const components: unknown[] = [{ component: 'KPIGrid', props: { items: [
      { title: 'Total Créditos', value: String(kpis.totalVentasFmt), icon: '💳' },
      { title: 'Monto en Riesgo', value: String(kpis.montoAtrasados ?? '$0'), icon: '🚨', trendDirection: 'down' },
      { title: '% Morosidad', value: String(kpis.pctAtrasados ?? '0%'), icon: '⚠️', trendDirection: 'down' },
      { title: 'Plazo Promedio', value: `${Math.round(avgPlazo)} sem`, icon: '📅' },
    ] } }];
    if (statusTable) {
      const sc: Record<string, string> = { al_corriente: '#059669', liquidado: '#2563EB', atrasado: '#D97706', cancelado: '#DC2626' };
      components.push({ component: 'ProgressGroup', props: { title: 'Distribución por Estatus', items: statusTable.map(r => ({ label: `${r.estatus} (${r.cantidad})`, value: Math.round(parseFloat(String(r.pct_total)) || 0), color: sc[String(r.estatus)] ?? '#6366F1' })) } });
    }
    if (atrasados.length > 0) {
      const byEst: Record<string, number> = {};
      for (const r of atrasados) { const k = String(r.estado ?? 'N/A'); byEst[k] = (byEst[k] ?? 0) + 1; }
      const ee = Object.entries(byEst).sort((a, b) => b[1] - a[1]).slice(0, 10);
      components.push({ component: 'Chart', props: { type: 'bar', title: 'Créditos Atrasados por Estado', data: { labels: ee.map(([k]) => k), datasets: [{ label: 'Atrasados', data: ee.map(([, v]) => v), backgroundColor: colors.slice(0, ee.length) }] } } });
    }
    if (canalChart) components.push({ component: 'Chart', props: { type: 'doughnut', title: 'Distribución por Canal', data: { labels: canalChart.labels, datasets: [{ label: 'Ventas', data: canalChart.counts, backgroundColor: colors.slice(0, 3) }] } } });
    if (statusChart) components.push({ component: 'Chart', props: { type: 'doughnut', title: 'Estatus de Créditos', data: { labels: statusChart.labels, datasets: [{ label: 'Créditos', data: statusChart.counts, backgroundColor: ['#059669', '#D97706', '#2563EB', '#DC2626'] }] } } });
    if (statusTable) components.push({ component: 'DataSummary', props: { title: 'Resumen por Estatus', highlightFirst: true, columns: [{ key: 'estatus', label: 'Estatus' }, { key: 'cantidad', label: 'Cantidad' }, { key: 'monto_total', label: 'Monto Total' }, { key: 'pct_total', label: '% del Total' }], rows: statusTable } });
    const topAt = atrasados.sort((a, b) => (Number(b.monto_total_credito) || 0) - (Number(a.monto_total_credito) || 0)).slice(0, 8).map(r => ({ title: String(r.cliente ?? ''), subtitle: String(r.producto ?? r.categoria ?? ''), amount: fmt(Number(r.monto_total_credito) || 0), date: String(r.fecha_venta ?? ''), status: 'negative' }));
    if (topAt.length > 0) components.push({ component: 'TransactionList', props: { title: 'Créditos Atrasados — Mayor Monto', items: topAt } });
    return { title: 'Seguimiento de Créditos', layout: 'vertical', components };
  }

  return { title: 'Dashboard', layout: 'vertical', components: [{ component: 'KPIGrid', props: { items: kpiItems } }] };
}

// ─── Main entry point ──────────────────────────────────────────

export async function buildRichUIConfig(
  bedrockClient: BedrockRuntimeClient,
  modelId: string,
  intent: string,
  parsedIntent: ParsedIntentSlim,
  records: Record<string, unknown>[],
  colors: string[],
): Promise<unknown> {
  const agg = computeRichAggregations(records);
  const tier = decideTier(intent, parsedIntent);

  console.log(`[rich-ui] tier=${tier} template=${parsedIntent.template} chartTypes=${parsedIntent.chartTypes.join(',')}`);

  if (tier === 'rich') {
    return buildRich(parsedIntent, records, agg, colors);
  }

  if (tier === 'custom') {
    try {
      const result = await buildCustom(bedrockClient, modelId, intent, parsedIntent, agg, colors);
      const comps = (result as Record<string, unknown>).components as unknown[];
      const chartCount = comps?.filter((c: unknown) => (c as Record<string, unknown>).component === 'Chart').length ?? 0;
      console.log(`[rich-ui] custom: ${comps?.length ?? 0} components, ${chartCount} charts`);
      // If Bedrock generated too few charts, augment with rich fallback
      if (chartCount < 2) throw new Error(`only ${chartCount} charts`);
      return result;
    } catch (err) {
      console.log(`[rich-ui] custom failed (${(err as Error).message}), falling back to rich`);
      return buildRich(parsedIntent, records, agg, colors);
    }
  }

  // standard — should not reach here, handled by orchestrator
  return buildRich(parsedIntent, records, agg, colors);
}
