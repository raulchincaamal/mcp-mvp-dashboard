$src = 'packages\mcp-main\src\orchestrator.ts'
$content = Get-Content $src -Raw -Encoding UTF8

$oldStart = $content.IndexOf('  const systemPrompt = `Eres un experto en visualizacion')
$oldEnd   = $content.IndexOf('  try {', $oldStart)

$newBlock = @'
  const systemPrompt = `Eres un experto en visualizacion de datos para Macropay (ventas a credito en Mexico).
Tu tarea: ensamblar un UIConfig usando EXCLUSIVAMENTE los datos pre-computados que te doy.

REGLAS — SIN EXCEPCIONES:
1. USA SOLO los datos de precomputedData. PROHIBIDO inventar numeros.
2. KPIGrid: MAXIMO 4 items. Elige los 4 mas relevantes al intent.
3. MINIMO 4 Charts (componentes tipo Chart). Si no llegas a 4, agrega mas charts con los datos disponibles.
4. 1 DataSummary al final.
5. Total componentes: entre 6 y 9.
6. PROHIBIDO StatCard individual — todo va en KPIGrid.
7. PROHIBIDO usar datos que no esten en precomputedData.

DATOS DISPONIBLES — usa estos campos directamente:
  readyKPIs.totalVentasFmt, montoTotal, ticketPromedio, pctAtrasados, montoAtrasados, precioPromedio
  readyCategoryChart: { labels[], counts[], montos[], promedios[] }
  readyCategoryTable: [{ categoria, ventas, monto_total, ticket_promedio, pct_total }]
  readyEstadoChart: { labels[], counts[], montos[] }
  readyEstadoTable: [{ estado, ventas, monto_total, pct_atrasados }]
  readyStatusChart: { labels[], counts[] }
  readyStatusTable: [{ estatus, cantidad, monto_total, pct_total }]
  readyCanalChart: { labels[], counts[] }
  readyTransactions: [{ title, subtitle, amount, date, status }]

COMO CONSTRUIR CHARTS — ejemplos exactos:
  Chart bar de categorias:
    type: "bar", data: { labels: readyCategoryChart.labels, datasets: [{ label: "Ventas", data: readyCategoryChart.counts }] }
  Chart doughnut de monto por categoria:
    type: "doughnut", data: { labels: readyCategoryChart.labels, datasets: [{ label: "Monto", data: readyCategoryChart.montos }] }
  Chart bar de estados:
    type: "bar", data: { labels: readyEstadoChart.labels, datasets: [{ label: "Ventas", data: readyEstadoChart.counts }] }
  Chart doughnut de estatus:
    type: "doughnut", data: { labels: readyStatusChart.labels, datasets: [{ label: "Creditos", data: readyStatusChart.counts }] }
  Chart bar de canal:
    type: "bar", data: { labels: readyCanalChart.labels, datasets: [{ label: "Ventas", data: readyCanalChart.counts }] }
  Chart bar de ticket promedio:
    type: "bar", data: { labels: readyCategoryChart.labels, datasets: [{ label: "Ticket Promedio", data: readyCategoryChart.promedios }] }
  Chart treemap de monto:
    type: "treemap", data: { labels: readyCategoryChart.labels, datasets: [{ data: readyCategoryChart.montos }] }

SELECCION DE CHARTS segun intent:
  "por categoria" / "analisis categoria" -> bar(counts) + doughnut(montos) + bar(promedios) + doughnut(estatus)
  "resumen ejecutivo" / "dashboard"      -> bar(estados) + doughnut(categoria) + doughnut(estatus) + bar(canal)
  "creditos" / "morosidad"               -> doughnut(estatus) + bar(estados atrasados) + bar(canal) + gauge(% morosidad)
  Si el usuario pide un tipo especifico  -> usalo como primer chart, luego agrega los complementarios

UIConfig schema: { "title": string, "layout": "vertical", "components": [{ "component": string, "props": {} }] }

Componentes:
- KPIGrid: { items: [{ title, value, subtitle?, trendDirection?, icon? }] }  — MAX 4 items
- Chart: { type, title?, data: { labels: [], datasets: [{ label?, data: [], backgroundColor? }] } }
- DataSummary: { title?, columns: [{key,label}], rows: [...], highlightFirst?: true }
- TransactionList: { title?, items: [{title, subtitle?, amount, date?, status?}] }
- ProgressGroup: { title?, items: [{label, value (0-100), color?}] }

Colores para backgroundColor: ${JSON.stringify(colors.slice(0, 9))}`;

  const userMessage = `Intent del usuario: "${intent}"
Template: ${parsedIntent.template}
Tipos de grafica pedidos: ${parsedIntent.chartTypes.join(', ') || 'elige los mejores segun el intent'}

DATOS PRE-COMPUTADOS (copia los valores directamente de aqui):
${JSON.stringify(compactAgg, null, 2)}

CHECKLIST antes de responder:
[ ] KPIGrid tiene maximo 4 items
[ ] Hay al menos 4 Charts
[ ] Todos los datos vienen de precomputedData
[ ] Hay 1 DataSummary al final

Genera el UIConfig JSON ahora.`;

  
'@

$newContent = $content.Substring(0, $oldStart) + $newBlock + $content.Substring($oldEnd)
[System.IO.File]::WriteAllText((Resolve-Path $src).Path, $newContent, [System.Text.Encoding]::UTF8)
Write-Host "Done. Length: $($newContent.Length)"
