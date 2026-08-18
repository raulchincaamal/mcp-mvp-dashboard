$src = 'packages\mcp-main\src\orchestrator.ts'
$content = Get-Content $src -Raw -Encoding UTF8

$oldStart = $content.IndexOf('// --- Rich UIConfig builder')
$depth = 0; $inFunc = $false; $oldEnd = -1
for ($i = $oldStart; $i -lt $content.Length; $i++) {
    if ($content[$i] -eq '{') { $depth++; $inFunc = $true }
    elseif ($content[$i] -eq '}') { $depth--; if ($inFunc -and $depth -eq 0) { $oldEnd = $i + 1; break } }
}
if ($oldEnd -lt 0) { Write-Host "ERROR: end not found"; exit 1 }

$newFunc = @'
// --- Rich UIConfig builder: pre-computes data, Bedrock decides structure ---
async function buildRichUIConfig(intent: string, parsedIntent: ParsedIntent, records: Record<string, unknown>[]): Promise<unknown> {
  const agg = computeAggregations(records, parsedIntent);
  const colors = COLOR_THEMES[parsedIntent.colorTheme ?? 'default'] ?? COLOR_THEMES.default;

  // Strip heavy fields to keep prompt small
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
    groupBy: agg.groupBy,
  };

  const systemPrompt = `Eres un experto en visualizacion de datos para Macropay (ventas a credito en Mexico).
Tu tarea: dado un intent y datos PRE-COMPUTADOS, decide la mejor estructura de dashboard y ensambla el UIConfig.

REGLAS CRITICAS:
1. USA SOLO los datos de "precomputedData" — NO inventes ni calcules numeros
2. Decide TU cuantos charts incluir, en que orden, y que tipos usar segun el intent
3. Minimo 4 componentes, maximo 8
4. Siempre empieza con KPIGrid usando readyKPIs
5. Elige chart types apropiados: bar para comparar, doughnut para distribucion, line/area para tiempo, treemap para jerarquia de montos, funnel para embudos, gauge para % unico
6. Incluye siempre una DataSummary con la tabla mas relevante al final
7. Responde SOLO con JSON valido del UIConfig, sin markdown

UIConfig schema:
{ "title": string, "layout": "vertical", "components": [{ "component": string, "props": {} }] }

Componentes disponibles:
- KPIGrid: { items: [{ title, value, subtitle?, trendDirection?: "up"|"down"|"neutral", icon? }] }
- Chart: { type: "bar"|"line"|"area"|"doughnut"|"pie"|"treemap"|"funnel"|"gauge"|"radar"|"heatmap"|"scatter", title?, data: { labels: [], datasets: [{ label?, data: [] }] } }
  gauge: data.datasets[0].data[0] = valor 0-100, data.labels[0] = nombre
  treemap: labels = nombres, datasets[0].data = valores de tamano
  funnel: labels = etapas desc, datasets[0].data = valores
- DataSummary: { title?, columns: [{key,label}], rows: [...], highlightFirst?: true }
- TransactionList: { title?, items: [{title, subtitle?, amount, date?, status?: "positive"|"negative"|"neutral"}] }
- ProgressGroup: { title?, items: [{label, value (0-100), color?}] }
- StatCard: { title, value, subtitle?, trendDirection?, icon? }

Colores disponibles: ${JSON.stringify(colors.slice(0, 9))}`;

  const userMessage = `Intent: "${intent}"
Template detectado: ${parsedIntent.template}
Tipos de grafica pedidos: ${parsedIntent.chartTypes.join(', ') || 'ninguno especifico'}

DATOS PRE-COMPUTADOS (usa estos directamente, no calcules nada):
${JSON.stringify(compactAgg, null, 2)}

Decide la mejor estructura de dashboard para este intent y genera el UIConfig JSON ahora.`;

  try {
    const response = await bedrockClient.send(new ConverseCommand({
      modelId: MODEL_ID,
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
    return buildRichUIConfigFallback(parsedIntent, records, agg, colors);
  }
}

// Fallback determinista si Bedrock falla
function buildRichUIConfigFallback(parsedIntent: ParsedIntent, records: Record<string, unknown>[], agg: Record<string, unknown>, colors: string[]): unknown {
  const kpis = agg.readyKPIs as Record<string, unknown>;
  const catChart = agg.readyCategoryChart as Record<string, unknown> | undefined;
  const catTable = agg.readyCategoryTable as Record<string, unknown>[] | undefined;
  const estChart = agg.readyEstadoChart as Record<string, unknown> | undefined;
  const estTable = agg.readyEstadoTable as Record<string, unknown>[] | undefined;
  const statusChart = agg.readyStatusChart as Record<string, unknown> | undefined;
  const statusTable = agg.readyStatusTable as Record<string, unknown>[] | undefined;
  const canalChart = agg.readyCanalChart as Record<string, unknown> | undefined;
  const txns = agg.readyTransactions as Record<string, unknown>[] | undefined;

  const components: unknown[] = [];
  components.push({ component: 'KPIGrid', props: { items: [
    { title: 'Total Ventas', value: String(kpis.totalVentasFmt), icon: '\uD83D\uDCCA' },
    { title: 'Monto Total', value: String(kpis.montoTotal), icon: '\uD83D\uDCB0' },
    { title: 'Ticket Promedio', value: String(kpis.ticketPromedio), icon: '\uD83C\uDFF7\uFE0F' },
    ...(kpis.pctAtrasados ? [{ title: 'Morosidad', value: String(kpis.pctAtrasados), icon: '\u26A0\uFE0F', trendDirection: 'down' }] : []),
  ]}});

  if (parsedIntent.template === 'category' && catChart) {
    components.push({ component: 'Chart', props: { type: 'bar', title: 'Ventas por Categoria', data: { labels: catChart.labels, datasets: [{ label: 'Ventas', data: catChart.counts, backgroundColor: colors.slice(0, (catChart.labels as string[]).length) }] } }});
    components.push({ component: 'Chart', props: { type: 'doughnut', title: 'Distribucion de Monto', data: { labels: catChart.labels, datasets: [{ label: 'Monto', data: catChart.montos, backgroundColor: colors.slice(0, (catChart.labels as string[]).length) }] } }});
    if (catTable) components.push({ component: 'DataSummary', props: { title: 'Resumen por Categoria', highlightFirst: true, columns: [{ key: 'categoria', label: 'Categoria' }, { key: 'ventas', label: 'Ventas' }, { key: 'monto_total', label: 'Monto Total' }, { key: 'ticket_promedio', label: 'Ticket Prom.' }, { key: 'pct_total', label: '% del Total' }], rows: catTable }});
    return { title: 'Analisis por Categoria', layout: 'vertical', components };
  }

  if (parsedIntent.template === 'executive') {
    if (estChart) components.push({ component: 'Chart', props: { type: 'bar', title: 'Ventas por Estado', data: { labels: estChart.labels, datasets: [{ label: 'Ventas', data: estChart.counts, backgroundColor: colors.slice(0, (estChart.labels as string[]).length) }] } }});
    if (catChart) components.push({ component: 'Chart', props: { type: 'doughnut', title: 'Por Categoria', data: { labels: catChart.labels, datasets: [{ label: 'Ventas', data: catChart.counts, backgroundColor: colors.slice(0, (catChart.labels as string[]).length) }] } }});
    if (statusChart) components.push({ component: 'Chart', props: { type: 'doughnut', title: 'Estatus Creditos', data: { labels: statusChart.labels, datasets: [{ label: 'Creditos', data: statusChart.counts, backgroundColor: ['#059669','#D97706','#2563EB','#DC2626'] }] } }});
    if (txns) components.push({ component: 'TransactionList', props: { title: 'Ultimas Operaciones', items: txns }});
    if (estTable) components.push({ component: 'DataSummary', props: { title: 'Top Estados', highlightFirst: true, columns: [{ key: 'estado', label: 'Estado' }, { key: 'ventas', label: 'Ventas' }, { key: 'monto_total', label: 'Monto Total' }, { key: 'pct_atrasados', label: '% Atrasados' }], rows: estTable }});
    return { title: 'Resumen Ejecutivo', layout: 'vertical', components };
  }

  if (parsedIntent.template === 'credit') {
    const atrasados = records.filter(r => r.estatus_credito === 'atrasado');
    const avgPlazo = records.reduce((s, r) => s + (Number(r.plazo_semanas) || 0), 0) / records.length;
    (components[0] as Record<string, unknown>).props = { items: [
      { title: 'Total Creditos', value: String(kpis.totalVentasFmt), icon: '\uD83D\uDCB3' },
      { title: 'Monto en Riesgo', value: String(kpis.montoAtrasados ?? '$0'), icon: '\uD83D\uDEA8', trendDirection: 'down' },
      { title: '% Morosidad', value: String(kpis.pctAtrasados ?? '0%'), icon: '\u26A0\uFE0F', trendDirection: 'down' },
      { title: 'Plazo Promedio', value: `${Math.round(avgPlazo)} sem`, icon: '\uD83D\uDCC5' },
    ]};
    if (statusTable) { const sc: Record<string,string> = { al_corriente: '#059669', liquidado: '#2563EB', atrasado: '#D97706', cancelado: '#DC2626' }; components.push({ component: 'ProgressGroup', props: { title: 'Distribucion por Estatus', items: statusTable.map(r => ({ label: `${r.estatus} (${r.cantidad})`, value: Math.round(parseFloat(String(r.pct_total)) || 0), color: sc[String(r.estatus)] ?? '#6366F1' })) }}); }
    if (atrasados.length > 0) { const byEst: Record<string,number> = {}; for (const r of atrasados) { const k = String(r.estado ?? 'N/A'); byEst[k] = (byEst[k] ?? 0) + 1; } const ee = Object.entries(byEst).sort((a,b) => b[1]-a[1]).slice(0,10); components.push({ component: 'Chart', props: { type: 'bar', title: 'Atrasados por Estado', data: { labels: ee.map(([k])=>k), datasets: [{ label: 'Atrasados', data: ee.map(([,v])=>v), backgroundColor: colors.slice(0,ee.length) }] } }}); }
    if (statusTable) components.push({ component: 'DataSummary', props: { title: 'Resumen por Estatus', highlightFirst: true, columns: [{ key: 'estatus', label: 'Estatus' }, { key: 'cantidad', label: 'Cantidad' }, { key: 'monto_total', label: 'Monto Total' }, { key: 'pct_total', label: '% del Total' }], rows: statusTable }});
    return { title: 'Seguimiento de Creditos', layout: 'vertical', components };
  }

  return { title: 'Dashboard', layout: 'vertical', components };
}
'@

$newContent = $content.Substring(0, $oldStart) + $newFunc + $content.Substring($oldEnd)
[System.IO.File]::WriteAllText((Resolve-Path $src).Path, $newContent, [System.Text.Encoding]::UTF8)
Write-Host "Done. Length: $($newContent.Length)"
