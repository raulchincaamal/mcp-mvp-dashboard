$lines = Get-Content 'packages\mcp-main\src\orchestrator.ts'
$insertAt = 1270

$newFunc = @'

// --- Rich UIConfig builder (bypasses Bedrock for dense templates) ---
function buildRichUIConfig(_intent: string, parsedIntent: ParsedIntent, records: Record<string, unknown>[]): unknown {
  const agg = computeAggregations(records, parsedIntent);
  const kpis = agg.readyKPIs as Record<string, unknown>;
  const catChart = agg.readyCategoryChart as Record<string, unknown> | undefined;
  const catTable = agg.readyCategoryTable as Record<string, unknown>[] | undefined;
  const estChart = agg.readyEstadoChart as Record<string, unknown> | undefined;
  const estTable = agg.readyEstadoTable as Record<string, unknown>[] | undefined;
  const statusChart = agg.readyStatusChart as Record<string, unknown> | undefined;
  const statusTable = agg.readyStatusTable as Record<string, unknown>[] | undefined;
  const canalChart = agg.readyCanalChart as Record<string, unknown> | undefined;
  const txns = agg.readyTransactions as Record<string, unknown>[] | undefined;
  const colors = COLOR_THEMES.default;

  if (parsedIntent.template === 'category') {
    const components: unknown[] = [];
    components.push({ component: 'KPIGrid', props: { items: [
      { title: 'Total Ventas', value: String(kpis.totalVentasFmt), icon: '📊' },
      { title: 'Monto Total', value: String(kpis.montoTotal), icon: '💰' },
      { title: 'Ticket Promedio', value: String(kpis.ticketPromedio), icon: '🏷️' },
      ...(kpis.pctAtrasados ? [{ title: 'Morosidad', value: String(kpis.pctAtrasados), icon: '⚠️', trendDirection: 'down' }] : []),
      ...(catChart ? [{ title: 'Categoría Líder', value: String((catChart.labels as string[])[0] ?? ''), icon: '🏆' }] : []),
    ]}});
    if (catChart) {
      components.push({ component: 'Chart', props: { type: 'bar', title: 'Ventas por Categoría', data: { labels: catChart.labels, datasets: [{ label: 'Ventas', data: catChart.counts, backgroundColor: colors.slice(0, (catChart.labels as string[]).length) }] } }});
      components.push({ component: 'Chart', props: { type: 'doughnut', title: 'Distribución de Monto por Categoría', data: { labels: catChart.labels, datasets: [{ label: 'Monto', data: catChart.montos, backgroundColor: colors.slice(0, (catChart.labels as string[]).length) }] } }});
      components.push({ component: 'Chart', props: { type: 'bar', title: 'Ticket Promedio por Categoría', data: { labels: catChart.labels, datasets: [{ label: 'Promedio', data: catChart.promedios, backgroundColor: colors.slice(0, (catChart.labels as string[]).length) }] } }});
    }
    if (catTable) {
      components.push({ component: 'ProgressGroup', props: { title: '% Participación por Categoría', items: catTable.slice(0, 6).map((r, i) => ({ label: `${r.categoria} (${r.ventas} ventas)`, value: Math.round((Number(r.ventas) / records.length) * 100), color: colors[i % colors.length] })) }});
      components.push({ component: 'DataSummary', props: { title: 'Resumen por Categoría', highlightFirst: true, columns: [{ key: 'categoria', label: 'Categoría' }, { key: 'ventas', label: 'Ventas' }, { key: 'monto_total', label: 'Monto Total' }, { key: 'ticket_promedio', label: 'Ticket Prom.' }, { key: 'pct_total', label: '% del Total' }], rows: catTable }});
    }
    return { title: 'Análisis por Categoría', layout: 'vertical', components };
  }

  if (parsedIntent.template === 'executive') {
    const components: unknown[] = [];
    components.push({ component: 'KPIGrid', props: { items: [{ title: 'Total Ventas', value: String(kpis.totalVentasFmt), icon: '📊' }, { title: 'Monto Total', value: String(kpis.montoTotal), icon: '💰' }, { title: 'Ticket Promedio', value: String(kpis.ticketPromedio), icon: '🏷️' }, ...(kpis.pctAtrasados ? [{ title: 'Morosidad', value: String(kpis.pctAtrasados), icon: '⚠️', trendDirection: 'down' }] : []), ...(estChart ? [{ title: 'Top Estado', value: String((estChart.labels as string[])[0] ?? ''), icon: '📍' }] : [])] }});
    if (estChart) components.push({ component: 'Chart', props: { type: 'bar', title: 'Ventas por Estado (Top 10)', data: { labels: estChart.labels, datasets: [{ label: 'Ventas', data: estChart.counts, backgroundColor: colors.slice(0, (estChart.labels as string[]).length) }] } }});
    if (catChart) components.push({ component: 'Chart', props: { type: 'doughnut', title: 'Distribución por Categoría', data: { labels: catChart.labels, datasets: [{ label: 'Ventas', data: catChart.counts, backgroundColor: colors.slice(0, (catChart.labels as string[]).length) }] } }});
    if (statusChart) components.push({ component: 'Chart', props: { type: 'doughnut', title: 'Estatus de Créditos', data: { labels: statusChart.labels, datasets: [{ label: 'Créditos', data: statusChart.counts, backgroundColor: ['#059669','#D97706','#2563EB','#DC2626'] }] } }});
    if (canalChart) components.push({ component: 'Chart', props: { type: 'bar', title: 'Ventas por Canal', data: { labels: canalChart.labels, datasets: [{ label: 'Ventas', data: canalChart.counts, backgroundColor: colors.slice(0, 3) }] } }});
    if (estTable) components.push({ component: 'DataSummary', props: { title: 'Top Estados', highlightFirst: true, columns: [{ key: 'estado', label: 'Estado' }, { key: 'ventas', label: 'Ventas' }, { key: 'monto_total', label: 'Monto Total' }, { key: 'pct_atrasados', label: '% Atrasados' }], rows: estTable }});
    if (txns) components.push({ component: 'TransactionList', props: { title: 'Últimas Operaciones', items: txns }});
    return { title: 'Resumen Ejecutivo', layout: 'vertical', components };
  }

  if (parsedIntent.template === 'credit') {
    const components: unknown[] = [];
    const atrasados = records.filter(r => r.estatus_credito === 'atrasado');
    const avgPlazo = records.reduce((s, r) => s + (Number(r.plazo_semanas) || 0), 0) / records.length;
    components.push({ component: 'KPIGrid', props: { items: [{ title: 'Total Créditos', value: String(kpis.totalVentasFmt), icon: '💳' }, { title: 'Monto en Riesgo', value: String(kpis.montoAtrasados ?? '$0'), icon: '🚨', trendDirection: 'down' }, { title: '% Morosidad', value: String(kpis.pctAtrasados ?? '0%'), icon: '⚠️', trendDirection: 'down' }, { title: 'Plazo Promedio', value: `${Math.round(avgPlazo)} sem`, icon: '📅' }] }});
    if (statusTable) { const sc: Record<string,string> = { al_corriente: '#059669', liquidado: '#2563EB', atrasado: '#D97706', cancelado: '#DC2626' }; components.push({ component: 'ProgressGroup', props: { title: 'Distribución por Estatus', items: statusTable.map(r => ({ label: `${r.estatus} (${r.cantidad})`, value: Math.round(parseFloat(String(r.pct_total)) || 0), color: sc[String(r.estatus)] ?? '#6366F1' })) }}); }
    if (atrasados.length > 0) { const byEst: Record<string,number> = {}; for (const r of atrasados) { const k = String(r.estado ?? 'N/A'); byEst[k] = (byEst[k] ?? 0) + 1; } const ee = Object.entries(byEst).sort((a,b) => b[1]-a[1]).slice(0,10); components.push({ component: 'Chart', props: { type: 'bar', title: 'Créditos Atrasados por Estado', data: { labels: ee.map(([k])=>k), datasets: [{ label: 'Atrasados', data: ee.map(([,v])=>v), backgroundColor: colors.slice(0,ee.length) }] } }}); }
    if (canalChart) components.push({ component: 'Chart', props: { type: 'doughnut', title: 'Distribución por Canal', data: { labels: canalChart.labels, datasets: [{ label: 'Ventas', data: canalChart.counts, backgroundColor: colors.slice(0,3) }] } }});
    if (statusTable) components.push({ component: 'DataSummary', props: { title: 'Resumen por Estatus', highlightFirst: true, columns: [{ key: 'estatus', label: 'Estatus' }, { key: 'cantidad', label: 'Cantidad' }, { key: 'monto_total', label: 'Monto Total' }, { key: 'pct_total', label: '% del Total' }], rows: statusTable }});
    const topAt = atrasados.sort((a,b) => (Number(b.monto_total_credito)||0)-(Number(a.monto_total_credito)||0)).slice(0,8).map(r => ({ title: String(r.cliente??''), subtitle: String(r.producto??r.categoria??''), amount: fmt(Number(r.monto_total_credito)||0), date: String(r.fecha_venta??''), status: 'negative' }));
    if (topAt.length > 0) components.push({ component: 'TransactionList', props: { title: 'Créditos Atrasados — Mayor Monto', items: topAt }});
    return { title: 'Seguimiento de Créditos', layout: 'vertical', components };
  }

  return null;
}

'@

$newLines = $lines[0..($insertAt-1)] + $newFunc.Split("`n") + $lines[$insertAt..($lines.Length-1)]
$newLines | Set-Content 'packages\mcp-main\src\orchestrator.ts' -Encoding UTF8
Write-Host "Done - total lines: $($newLines.Length)"
