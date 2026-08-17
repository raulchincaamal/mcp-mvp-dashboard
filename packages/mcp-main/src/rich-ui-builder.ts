import {
  BedrockRuntimeClient,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime';

// ─── Types ────────────────────────────────────────────────────

export interface ParsedIntentSlim {
  template: string;
  chartTypes: string[];
  colorTheme?: string;
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

  // By estatus
  const byStatus: Record<string, { count: number; monto: number }> = {};
  for (const r of records) {
    const k = String(r.estatus_credito ?? 'N/A');
    if (!byStatus[k]) byStatus[k] = { count: 0, monto: 0 };
    byStatus[k].count++;
    byStatus[k].monto += Number(r.monto_total_credito) || 0;
  }
  const statusEntries = Object.entries(byStatus).sort((a, b) => b[1].count - a[1].count);
  const atrasadosCount = byStatus['atrasado']?.count ?? 0;

  // By canal
  const byCanal: Record<string, number> = {};
  for (const r of records) {
    const k = String(r.canal_venta ?? 'N/A');
    byCanal[k] = (byCanal[k] ?? 0) + 1;
  }
  const canalEntries = Object.entries(byCanal).sort((a, b) => b[1] - a[1]);

  return {
    totalRecords: total,
    readyKPIs: {
      totalVentasFmt: total.toLocaleString('es-MX'),
      montoTotal: fmt(totalMonto),
      ticketPromedio: fmt(totalMonto / total),
      precioPromedio: fmt(totalPrecio / total),
      pctAtrasados: `${((atrasadosCount / total) * 100).toFixed(1)}%`,
      montoAtrasados: fmt(byStatus['atrasado']?.monto ?? 0),
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

// ─── Fallback determinista ─────────────────────────────────────

function fallback(
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
      components.push({ component: 'Chart', props: { type: 'doughnut', title: 'Distribución de Monto', data: { labels: catChart.labels, datasets: [{ label: 'Monto', data: catChart.montos, backgroundColor: colors.slice(0, (catChart.labels as string[]).length) }] } } });
      components.push({ component: 'Chart', props: { type: 'bar', title: 'Ticket Promedio por Categoría', data: { labels: catChart.labels, datasets: [{ label: 'Promedio', data: catChart.promedios, backgroundColor: colors.slice(0, (catChart.labels as string[]).length) }] } } });
      components.push({ component: 'Chart', props: { type: 'doughnut', title: 'Estatus de Créditos', data: { labels: (agg.readyStatusChart as Record<string, unknown>)?.labels, datasets: [{ label: 'Créditos', data: (agg.readyStatusChart as Record<string, unknown>)?.counts, backgroundColor: ['#059669', '#D97706', '#2563EB', '#DC2626'] }] } } });
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
    const components: unknown[] = [{
      component: 'KPIGrid', props: { items: [
        { title: 'Total Créditos', value: String(kpis.totalVentasFmt), icon: '💳' },
        { title: 'Monto en Riesgo', value: String(kpis.montoAtrasados ?? '$0'), icon: '🚨', trendDirection: 'down' },
        { title: '% Morosidad', value: String(kpis.pctAtrasados ?? '0%'), icon: '⚠️', trendDirection: 'down' },
        { title: 'Plazo Promedio', value: `${Math.round(avgPlazo)} sem`, icon: '📅' },
      ] }
    }];
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
    if (statusTable) components.push({ component: 'DataSummary', props: { title: 'Resumen por Estatus', highlightFirst: true, columns: [{ key: 'estatus', label: 'Estatus' }, { key: 'cantidad', label: 'Cantidad' }, { key: 'monto_total', label: 'Monto Total' }, { key: 'pct_total', label: '% del Total' }], rows: statusTable } });
    const topAt = atrasados.sort((a, b) => (Number(b.monto_total_credito) || 0) - (Number(a.monto_total_credito) || 0)).slice(0, 8).map(r => ({ title: String(r.cliente ?? ''), subtitle: String(r.producto ?? r.categoria ?? ''), amount: fmt(Number(r.monto_total_credito) || 0), date: String(r.fecha_venta ?? ''), status: 'negative' }));
    if (topAt.length > 0) components.push({ component: 'TransactionList', props: { title: 'Créditos Atrasados — Mayor Monto', items: topAt } });
    return { title: 'Seguimiento de Créditos', layout: 'vertical', components };
  }

  return { title: 'Dashboard', layout: 'vertical', components: [{ component: 'KPIGrid', props: { items: kpiItems } }] };
}

// ─── Main: Bedrock decides structure, fallback if it fails ─────

export async function buildRichUIConfig(
  bedrockClient: BedrockRuntimeClient,
  modelId: string,
  intent: string,
  parsedIntent: ParsedIntentSlim,
  records: Record<string, unknown>[],
  colors: string[],
): Promise<unknown> {
  const agg = computeRichAggregations(records);

  const compactAgg = {
    totalRecords: agg.totalRecords,
    readyKPIs: agg.readyKPIs,
    readyCategoryChart: agg.readyCategoryChart,
    readyCategoryTable: agg.readyCategoryTable,
    readyEstadoChart: agg.readyEstadoChart,
    readyEstadoTable: agg.readyEstadoTable,
    readyStatusChart: agg.readyStatusChart,
    readyStatusTable: agg.readyStatusTable,
    readyCanalChart: agg.readyCanalChart,
    readyTransactions: agg.readyTransactions,
  };

  const systemPrompt = `Eres un experto en visualizacion de datos para Macropay (ventas a credito en Mexico).
Ensambla un UIConfig usando EXCLUSIVAMENTE los datos pre-computados que te doy.

REGLAS OBLIGATORIAS:
1. USA SOLO los datos de precomputedData. PROHIBIDO inventar numeros.
2. KPIGrid: MAXIMO 4 items. Elige los mas relevantes al intent.
3. MINIMO 4 Charts (tipo Chart). Innegociable.
4. 1 DataSummary al final con la tabla mas relevante.
5. Total componentes: entre 6 y 9.
6. PROHIBIDO StatCard individual.

DATOS DISPONIBLES:
  readyKPIs: totalVentasFmt, montoTotal, ticketPromedio, pctAtrasados, montoAtrasados, precioPromedio
  readyCategoryChart: labels[], counts[], montos[], promedios[]
  readyCategoryTable: [{categoria, ventas, monto_total, ticket_promedio, pct_total}]
  readyEstadoChart: labels[], counts[], montos[]
  readyEstadoTable: [{estado, ventas, monto_total, pct_atrasados}]
  readyStatusChart: labels[], counts[]
  readyStatusTable: [{estatus, cantidad, monto_total, pct_total}]
  readyCanalChart: labels[], counts[]
  readyTransactions: [{title, subtitle, amount, date, status}]

CHARTS DISPONIBLES por datos:
  bar(categorias)   -> labels: readyCategoryChart.labels, data: readyCategoryChart.counts
  doughnut(monto)   -> labels: readyCategoryChart.labels, data: readyCategoryChart.montos
  bar(promedios)    -> labels: readyCategoryChart.labels, data: readyCategoryChart.promedios
  bar(estados)      -> labels: readyEstadoChart.labels,   data: readyEstadoChart.counts
  doughnut(estatus) -> labels: readyStatusChart.labels,   data: readyStatusChart.counts
  bar(canal)        -> labels: readyCanalChart.labels,    data: readyCanalChart.counts
  treemap(monto)    -> labels: readyCategoryChart.labels, data: readyCategoryChart.montos

Colores: ${JSON.stringify(colors.slice(0, 9))}

UIConfig schema: { "title": string, "layout": "vertical", "components": [{ "component": string, "props": {} }] }
Componentes: KPIGrid, Chart, DataSummary, TransactionList, ProgressGroup
Responde SOLO con JSON valido, sin markdown.`;

  const userMessage = `Intent: "${intent}"
Template: ${parsedIntent.template}
Tipos de grafica pedidos: ${parsedIntent.chartTypes.join(', ') || 'elige los mejores'}

DATOS:
${JSON.stringify(compactAgg, null, 2)}

CHECKLIST: KPIGrid<=4 items | >=4 Charts | 1 DataSummary | sin datos inventados
Genera el UIConfig JSON ahora.`;

  try {
    const response = await bedrockClient.send(new ConverseCommand({
      modelId,
      system: [{ text: systemPrompt }],
      messages: [{ role: 'user', content: [{ text: userMessage }] }],
      inferenceConfig: { maxTokens: 6000, temperature: 0.1 },
    }));
    const block = response.output?.message?.content?.[0];
    if (!block || !('text' in block)) throw new Error('no response');
    const raw = block.text!.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    const parsed = JSON.parse(raw);
    return (parsed as Record<string, unknown>).uiConfig ?? parsed;
  } catch (err) {
    console.log('[buildRichUIConfig] Bedrock failed, using fallback:', (err as Error).message);
    return fallback(parsedIntent, records, agg, colors);
  }
}
