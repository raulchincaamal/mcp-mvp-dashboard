/**
 * orchestrator-tooluse.ts
 * 
 * Implementación con Tool Use nativo de Amazon Bedrock.
 * Nova Pro decide cuándo usar herramientas en un loop dinámico.
 */

import {
  BedrockRuntimeClient,
  ConverseCommand,
  type Message,
  type ContentBlock,
  type ToolConfiguration,
  type ToolResultContentBlock,
} from '@aws-sdk/client-bedrock-runtime';
import { generateCacheKey, cacheGet, cacheSet, TTL } from './cache.js';

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION,
});
const MODEL_ID = process.env.BEDROCK_MODEL_ID!;

// ─── Tool Definitions for Bedrock ─────────────────────────────

const TOOL_CONFIG: ToolConfiguration = {
  tools: [
    {
      toolSpec: {
        name: 'query_data',
        description: `Consulta el dataset de ventas a crédito de Macropay (5000 registros).
Campos disponibles: id, fecha_venta, cliente, edad_cliente, genero, estado, ciudad, sucursal, categoria, producto, color, precio_contado, enganche, monto_financiado, monto_total_credito, plazo_semanas, pago_semanal, semanas_pagadas, estatus_credito, canal_venta, vendedor.
Categorías: Motos, Celulares, Bicicletas Eléctricas, Pantallas/TV, Audio, Tablets, Consolas, Climatización, Accesorios.
Estatus crédito: al_corriente, atrasado, liquidado, cancelado.
Canales: tienda_fisica, en_linea, telefono.`,
        inputSchema: {
          json: {
            type: 'object',
            properties: {
              filters: {
                type: 'object',
                description: 'Filtros exactos o rangos. Ej: {"categoria":"Motos"} o {"monto_total_credito":{"gte":10000}}',
              },
              limit: {
                type: 'number',
                description: 'Máximo de registros (default: 100, max: 5000)',
                default: 100,
              },
            },
          },
        },
      },
    },
    {
      toolSpec: {
        name: 'generate_dashboard',
        description: `Genera un UIConfig JSON para renderizar un dashboard.
Usa los datos obtenidos de query_data para crear visualizaciones.
Componentes disponibles: KPIGrid, Chart (bar/line/pie/doughnut), DataSummary, TransactionList, ProgressGroup, StatCard.`,
        inputSchema: {
          json: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'Título del dashboard',
              },
              template: {
                type: 'string',
                enum: ['executive', 'chart', 'table', 'credit', 'category'],
                description: 'Tipo de dashboard: executive (KPIs+charts), chart (gráfica principal), table (datos), credit (estatus créditos), category (por categoría)',
              },
              groupBy: {
                type: 'string',
                description: 'Campo para agrupar datos (estado, categoria, mes, etc.)',
              },
              chartType: {
                type: 'string',
                enum: ['bar', 'line', 'pie', 'doughnut'],
                description: 'Tipo de gráfica principal',
              },
              metric: {
                type: 'string',
                enum: ['count', 'sum', 'avg'],
                description: 'Métrica a calcular',
                default: 'count',
              },
              metricField: {
                type: 'string',
                description: 'Campo numérico para sum/avg (monto_total_credito, precio_contado, etc.)',
              },
              records: {
                type: 'array',
                description: 'Datos obtenidos de query_data',
              },
            },
            required: ['title', 'template', 'records'],
          },
        },
      },
    },
  ],
};

// ─── MCP Client Interface ─────────────────────────────────────

interface McpClientInterface {
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  disconnect: () => Promise<void>;
}

let mcpClients: { gcpClient: McpClientInterface; uiClient: McpClientInterface } | null = null;

async function getMcpClients(): Promise<{ gcpClient: McpClientInterface; uiClient: McpClientInterface }> {
  if (!mcpClients) {
    const { createMcpClients } = await import('./mcp-client.js');
    mcpClients = await createMcpClients();
  }
  return mcpClients;
}

// ─── Stashed data between tool calls ──────────────────────────

let stashedRecords: Record<string, unknown>[] = [];
let stashedFilters: Record<string, unknown> = {};

// ─── Intent Parser (fallback) ─────────────────────────────────

interface ParsedIntent {
  filters: Record<string, unknown>;
  groupBy: string | null;
  chartType: string;
  template: string;
  title: string;
  limit: number;
}

function parseIntentLocally(intent: string): ParsedIntent {
  const intentLower = intent.toLowerCase();
  const result: ParsedIntent = {
    filters: {},
    groupBy: null,
    chartType: 'bar',
    template: 'executive',
    title: 'Dashboard',
    limit: 100,
  };

  // Detectar categoría
  const categorias: Record<string, string> = {
    'moto': 'Motos', 'motos': 'Motos',
    'celular': 'Celulares', 'celulares': 'Celulares', 'telefono': 'Celulares',
    'bici': 'Bicicletas Eléctricas', 'bicicleta': 'Bicicletas Eléctricas',
    'pantalla': 'Pantallas/TV', 'tv': 'Pantallas/TV', 'television': 'Pantallas/TV',
    'audio': 'Audio', 'bocina': 'Audio',
    'tablet': 'Tablets', 'tablets': 'Tablets',
    'consola': 'Consolas', 'consolas': 'Consolas', 'xbox': 'Consolas', 'playstation': 'Consolas',
    'clima': 'Climatización', 'aire': 'Climatización', 'ventilador': 'Climatización',
    'accesorio': 'Accesorios', 'accesorios': 'Accesorios',
  };
  for (const [key, value] of Object.entries(categorias)) {
    if (intentLower.includes(key)) {
      result.filters['categoria'] = value;
      result.title = `Ventas de ${value}`;
      break;
    }
  }

  // Detectar estado
  const estados: Record<string, string> = {
    'jalisco': 'Jalisco', 'guadalajara': 'Jalisco',
    'nuevo leon': 'Nuevo León', 'monterrey': 'Nuevo León', 'nl': 'Nuevo León',
    'cdmx': 'Ciudad de México', 'ciudad de mexico': 'Ciudad de México', 'df': 'Ciudad de México',
    'estado de mexico': 'México', 'edomex': 'México',
    'veracruz': 'Veracruz', 'puebla': 'Puebla', 'guanajuato': 'Guanajuato',
    'chihuahua': 'Chihuahua', 'sonora': 'Sonora', 'sinaloa': 'Sinaloa',
    'yucatan': 'Yucatán', 'quintana roo': 'Quintana Roo', 'cancun': 'Quintana Roo',
  };
  for (const [key, value] of Object.entries(estados)) {
    if (intentLower.includes(key)) {
      result.filters['estado'] = value;
      result.title += ` en ${value}`;
      break;
    }
  }

  // Detectar estatus de crédito
  if (/atrasad|moroso|vencid|deuda/.test(intentLower)) {
    result.filters['estatus_credito'] = 'atrasado';
    result.template = 'credit';
    result.title = 'Créditos Atrasados';
  } else if (/liquidado|pagado|saldado/.test(intentLower)) {
    result.filters['estatus_credito'] = 'liquidado';
    result.template = 'credit';
    result.title = 'Créditos Liquidados';
  } else if (/credito|estatus|pago/.test(intentLower)) {
    result.template = 'credit';
    result.title = 'Estatus de Créditos';
  }

  // Detectar agrupación
  const groupByPatterns: [RegExp, string][] = [
    [/por\s+estado/i, 'estado'],
    [/por\s+categor[ií]a/i, 'categoria'],
    [/por\s+ciudad/i, 'ciudad'],
    [/por\s+sucursal/i, 'sucursal'],
    [/por\s+canal/i, 'canal_venta'],
    [/por\s+vendedor/i, 'vendedor'],
    [/por\s+mes/i, 'mes'],
    [/por\s+producto/i, 'producto'],
  ];
  for (const [pattern, field] of groupByPatterns) {
    if (pattern.test(intentLower)) {
      result.groupBy = field;
      result.template = 'chart';
      result.title += ` por ${field.charAt(0).toUpperCase() + field.slice(1)}`;
      break;
    }
  }

  // Detectar tipo de gráfica
  if (/pastel|pie|circular/.test(intentLower)) {
    result.chartType = 'pie';
  } else if (/dona|donut|doughnut/.test(intentLower)) {
    result.chartType = 'doughnut';
  } else if (/linea|tendencia|evolucion/.test(intentLower)) {
    result.chartType = 'line';
  } else if (/barra|columna/.test(intentLower)) {
    result.chartType = 'bar';
  }

  // Detectar template
  if (/resumen|ejecutivo|dashboard|general|kpi/.test(intentLower)) {
    result.template = 'executive';
    result.title = result.filters['categoria'] 
      ? `Resumen de ${result.filters['categoria']}` 
      : 'Resumen Ejecutivo';
  } else if (/tabla|listado|registro|detalle/.test(intentLower)) {
    result.template = 'table';
    result.title = 'Listado de Ventas';
  } else if (/gr[aá]fica|chart/.test(intentLower) && !result.groupBy) {
    result.groupBy = 'categoria';
    result.template = 'chart';
  }

  // Detectar límite
  const limitMatch = intentLower.match(/(\d+)\s*(registro|venta|ultim)/i);
  if (limitMatch) {
    result.limit = Math.min(parseInt(limitMatch[1]), 500);
  } else if (/ultim/.test(intentLower)) {
    result.limit = 20;
  }

  // Limpiar título
  result.title = result.title.replace(/^Dashboard\s*/, '').trim() || 'Dashboard';

  return result;
}

// ─── Tool Executor ────────────────────────────────────────────

async function executeTool(
  name: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  console.log(`[tool-use] Executing: ${name}`);
  console.log(`[tool-use] Input: ${JSON.stringify(input).slice(0, 300)}`);

  const startTime = Date.now();

  try {
    switch (name) {
      case 'query_data': {
        const { gcpClient } = await getMcpClients();
        const limit = Math.min(Number(input.limit) || 100, 500);
        const result = await gcpClient.callTool('query_data', {
          dataset: 'ventas-credito',
          filters: input.filters ?? {},
          limit,
        }) as { records?: Record<string, unknown>[]; totalRecords?: number };
        
        const records = result.records ?? [];
        stashedRecords = records; // Guardar para generate_dashboard
        
        const elapsed = Date.now() - startTime;
        console.log(`[tool-use] query_data completed in ${elapsed}ms, ${records.length} records`);
        
        // Retornar solo resumen para no exceder tokens
        return {
          success: true,
          totalRecords: records.length,
          message: `Se obtuvieron ${records.length} registros. Usa generate_dashboard para crear la visualización.`,
        };
      }

      case 'generate_dashboard': {
        // Usar los records guardados
        const paramsWithRecords = {
          ...input,
          records: stashedRecords,
        };
        const uiConfig = buildUIConfig(paramsWithRecords);
        const elapsed = Date.now() - startTime;
        console.log(`[tool-use] generate_dashboard completed in ${elapsed}ms`);
        return uiConfig;
      }

      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (error) {
    console.error(`[tool-use] Error in ${name}:`, (error as Error).message);
    return { error: (error as Error).message };
  }
}

// ─── UIConfig Builder ─────────────────────────────────────────

function buildUIConfig(params: Record<string, unknown>): unknown {
  const {
    title,
    template,
    groupBy,
    chartType = 'bar',
    metric = 'count',
    metricField,
    records = [],
  } = params as {
    title: string;
    template: string;
    groupBy?: string;
    chartType?: string;
    metric?: string;
    metricField?: string;
    records: Record<string, unknown>[];
  };

  if (!records.length) {
    return {
      title: title || 'Sin resultados',
      layout: 'vertical',
      components: [{
        component: 'StatCard',
        props: {
          title: 'No se encontraron datos',
          value: 'Intenta con otros filtros',
          icon: '🔍',
        },
      }],
    };
  }

  const components: unknown[] = [];
  const colors = ['#49a4d8', '#7C3AED', '#059669', '#D97706', '#DC2626', '#2563EB', '#6366F1', '#0891B2', '#10B981', '#F59E0B'];

  // Helper functions
  const fmt = (n: number) => n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}K` : `$${Math.round(n).toLocaleString('es-MX')}`;
  const countBy = (field: string) => {
    const counts: Record<string, number> = {};
    for (const r of records) {
      const k = String(r[field] ?? 'N/A');
      counts[k] = (counts[k] ?? 0) + 1;
    }
    return counts;
  };
  const sumBy = (groupField: string, sumField: string) => {
    const sums: Record<string, number> = {};
    for (const r of records) {
      const k = String(r[groupField] ?? 'N/A');
      sums[k] = (sums[k] ?? 0) + (Number(r[sumField]) || 0);
    }
    return sums;
  };

  // KPIGrid (siempre incluir)
  const totalRecords = records.length;
  const totalMonto = records.reduce((s, r) => s + (Number(r.monto_total_credito) || 0), 0);
  const avgMonto = totalMonto / totalRecords;
  const atrasados = records.filter(r => r.estatus_credito === 'atrasado').length;
  const tasaMorosidad = ((atrasados / totalRecords) * 100).toFixed(1);

  components.push({
    component: 'KPIGrid',
    props: {
      items: [
        { title: 'Total Ventas', value: String(totalRecords), icon: '📊' },
        { title: 'Monto Total', value: fmt(totalMonto), icon: '💰' },
        { title: 'Promedio', value: fmt(avgMonto), icon: '📈' },
        ...(atrasados > 0 ? [{ title: 'Morosidad', value: `${tasaMorosidad}%`, icon: '⚠️', trendDirection: Number(tasaMorosidad) > 15 ? 'down' : 'neutral' }] : []),
      ],
    },
  });

  // Template-specific components
  if (template === 'executive' || template === 'category') {
    // Chart por groupBy o categoria
    const field = groupBy || 'categoria';
    const data = metric === 'count' ? countBy(field) : sumBy(field, metricField || 'monto_total_credito');
    const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 10);

    components.push({
      component: 'Chart',
      props: {
        type: chartType,
        title: `${metric === 'count' ? 'Ventas' : 'Monto'} por ${field}`,
        data: {
          labels: sorted.map(([k]) => k),
          datasets: [{
            label: metric === 'count' ? 'Cantidad' : 'Monto',
            data: sorted.map(([, v]) => Math.round(v)),
            backgroundColor: colors.slice(0, sorted.length),
          }],
        },
      },
    });

    // Doughnut de estatus
    if (template === 'executive') {
      const statusData = countBy('estatus_credito');
      const statusSorted = Object.entries(statusData).sort((a, b) => b[1] - a[1]);
      components.push({
        component: 'Chart',
        props: {
          type: 'doughnut',
          title: 'Distribución por Estatus',
          data: {
            labels: statusSorted.map(([k]) => k),
            datasets: [{
              label: 'Estatus',
              data: statusSorted.map(([, v]) => v),
              backgroundColor: ['#10B981', '#EF4444', '#6366F1', '#F59E0B'],
            }],
          },
        },
      });
    }
  }

  if (template === 'chart' && groupBy) {
    const data = metric === 'count' ? countBy(groupBy) : sumBy(groupBy, metricField || 'monto_total_credito');
    const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 15);

    components.push({
      component: 'Chart',
      props: {
        type: chartType,
        title: `${metric === 'count' ? 'Ventas' : 'Monto'} por ${groupBy}`,
        data: {
          labels: sorted.map(([k]) => k),
          datasets: [{
            label: metric === 'count' ? 'Cantidad' : 'Monto',
            data: sorted.map(([, v]) => Math.round(v)),
            backgroundColor: chartType === 'pie' || chartType === 'doughnut' 
              ? colors.slice(0, sorted.length) 
              : colors[0],
          }],
        },
      },
    });
  }

  if (template === 'table') {
    const columns = ['fecha_venta', 'cliente', 'categoria', 'producto', 'monto_total_credito', 'estatus_credito']
      .filter(c => records[0]?.[c] !== undefined)
      .map(c => ({ key: c, label: c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) }));

    components.push({
      component: 'DataSummary',
      props: {
        title: 'Registros',
        columns,
        rows: records.slice(0, 20).map(r => ({
          ...r,
          monto_total_credito: fmt(Number(r.monto_total_credito) || 0),
        })),
      },
    });
  }

  if (template === 'credit') {
    const statusData = countBy('estatus_credito');
    const total = records.length;

    components.push({
      component: 'ProgressGroup',
      props: {
        title: 'Distribución de Estatus',
        items: Object.entries(statusData).map(([status, count]) => ({
          label: `${status} (${count})`,
          value: Math.round((count / total) * 100),
          color: status === 'al_corriente' ? '#10B981' : status === 'atrasado' ? '#EF4444' : status === 'liquidado' ? '#6366F1' : '#F59E0B',
        })),
      },
    });

    // Atrasados por estado
    const atrasadosRecords = records.filter(r => r.estatus_credito === 'atrasado');
    if (atrasadosRecords.length > 0) {
      const byEstado = countBy.call({ records: atrasadosRecords }, 'estado');
      const sorted = Object.entries(byEstado).sort((a, b) => b[1] - a[1]).slice(0, 10);
      components.push({
        component: 'Chart',
        props: {
          type: 'bar',
          title: 'Créditos Atrasados por Estado',
          data: {
            labels: sorted.map(([k]) => k),
            datasets: [{
              label: 'Atrasados',
              data: sorted.map(([, v]) => v),
              backgroundColor: '#EF4444',
            }],
          },
        },
      });
    }
  }

  // TransactionList para executive/credit
  if (template === 'executive' || template === 'credit') {
    const recent = records.slice(0, 6);
    components.push({
      component: 'TransactionList',
      props: {
        title: 'Últimas Operaciones',
        items: recent.map(r => ({
          title: String(r.cliente || r.id),
          subtitle: String(r.producto || r.categoria),
          amount: fmt(Number(r.monto_total_credito) || 0),
          date: String(r.fecha_venta || ''),
          status: r.estatus_credito === 'atrasado' ? 'negative' : r.estatus_credito === 'liquidado' ? 'positive' : 'neutral',
        })),
      },
    });
  }

  return {
    title,
    layout: 'vertical',
    components,
  };
}

// ─── Main Tool Use Loop ───────────────────────────────────────

export interface OrchestrationParams {
  intent: string;
  dataset?: string;
  filters?: Record<string, unknown>;
  limit?: number;
  sessionId?: string;
}

export async function orchestrateWithToolUse(params: OrchestrationParams): Promise<unknown> {
  const { intent } = params;
  
  // Reset stashed data
  stashedRecords = [];
  stashedFilters = {};
  
  // Validate intent
  if (!intent || intent.trim().length < 3) {
    return {
      title: 'Necesito más información',
      layout: 'vertical',
      components: [{
        component: 'StatCard',
        props: {
          title: '¿Qué te gustaría ver?',
          value: 'Escribe qué información necesitas. Ejemplo: "ventas de motos por estado"',
          icon: '❓',
        },
      }],
    };
  }

  // Check cache
  const cacheKey = generateCacheKey('ui-tooluse', { intent, filters: params.filters, limit: params.limit });
  const cached = await cacheGet<unknown>(cacheKey);
  if (cached) {
    console.log('[orchestrator-tooluse] cache hit');
    return cached;
  }

  console.log(`[orchestrator-tooluse] Starting tool use loop for: "${intent}"`);
  const startTime = Date.now();

  // Normalize dates in intent
  const normalizedIntent = normalizeDates(intent);

  const systemPrompt = `Eres un asistente de dashboards para Macropay, empresa mexicana de ventas a crédito.
FECHA ACTUAL: ${new Date().toISOString().split('T')[0]}

Tu trabajo es generar dashboards usando las herramientas disponibles:
1. query_data: Consulta datos de ventas
2. generate_dashboard: Genera el UIConfig del dashboard

FLUJO OBLIGATORIO:
1. PRIMERO usa query_data para obtener los datos necesarios
2. DESPUÉS usa generate_dashboard con los datos obtenidos

REGLAS:
- Siempre consulta datos antes de generar el dashboard
- Para "resumen ejecutivo" o consultas generales: template="executive"
- Para "gráfica de X por Y": template="chart", groupBy=Y
- Para "tabla" o "listado": template="table"
- Para "créditos" o "morosidad": template="credit"
- Para "por categoría": template="category"
- Detecta el tipo de gráfica: "pastel/pie" → pie, "dona/donut" → doughnut, "barras" → bar, "líneas" → line
- Detecta filtros: "de motos" → filters.categoria="Motos", "en Jalisco" → filters.estado="Jalisco"
- Detecta agrupación: "por estado" → groupBy="estado"

Responde en español. Después de generar el dashboard, da una breve descripción de lo que muestra.`;

  const messages: Message[] = [
    { role: 'user', content: [{ text: normalizedIntent }] },
  ];

  let iteration = 0;
  const maxIterations = 5;
  let finalResult: unknown = null;

  while (iteration < maxIterations) {
    iteration++;
    console.log(`[orchestrator-tooluse] Iteration ${iteration}`);

    try {
      const response = await bedrockClient.send(new ConverseCommand({
        modelId: MODEL_ID,
        system: [{ text: systemPrompt }],
        messages,
        toolConfig: TOOL_CONFIG,
        inferenceConfig: {
          maxTokens: 4096,
          temperature: 0,
        },
      }));

      const stopReason = response.stopReason;
      const assistantMessage = response.output?.message;
      const usage = response.usage;

      console.log(`[orchestrator-tooluse] Stop reason: ${stopReason}, tokens: in=${usage?.inputTokens} out=${usage?.outputTokens}`);

      if (!assistantMessage) {
        console.error('[orchestrator-tooluse] No assistant message');
        break;
      }

      messages.push(assistantMessage);

      // Process tool uses
      if (stopReason === 'tool_use') {
        const toolResults: ContentBlock[] = [];

        for (const block of assistantMessage.content ?? []) {
          if ('toolUse' in block && block.toolUse) {
            const { toolUseId, name, input } = block.toolUse;
            
            const result = await executeTool(name!, input as Record<string, unknown>);
            
            // Si es generate_dashboard, guardar el resultado
            if (name === 'generate_dashboard') {
              finalResult = result;
            }

            // Preparar resultado para enviar de vuelta
            const resultContent: ToolResultContentBlock[] = [{
              text: JSON.stringify(result),
            }];

            toolResults.push({
              toolResult: {
                toolUseId: toolUseId!,
                content: resultContent,
              },
            });
          }
        }

        // Agregar resultados como mensaje del usuario
        if (toolResults.length > 0) {
          messages.push({ role: 'user', content: toolResults });
        }
      }

      // Si terminó, extraer resultado
      if (stopReason === 'end_turn') {
        // Si ya tenemos un UIConfig de generate_dashboard, usarlo
        if (finalResult) {
          break;
        }

        // Buscar texto en la respuesta final
        for (const block of assistantMessage.content ?? []) {
          if ('text' in block) {
            console.log(`[orchestrator-tooluse] Final text: ${block.text?.slice(0, 200)}`);
          }
        }
        break;
      }

      if (stopReason === 'max_tokens') {
        console.warn('[orchestrator-tooluse] Max tokens reached');
        break;
      }
    } catch (error) {
      const errorMsg = (error as Error).message;
      console.error(`[orchestrator-tooluse] Error in iteration ${iteration}:`, errorMsg);
      
      // Si es error de tool use inválido o tokens, usar fallback
      if (errorMsg.includes('invalid sequence') || errorMsg.includes('ToolUse') || errorMsg.includes('tokens')) {
        console.log('[orchestrator-tooluse] Tool use error, will use fallback');
        break; // Salir del loop, el fallback se ejecutará después
      }
      
      // Errores de credenciales - propagar
      if (errorMsg.includes('security token') || errorMsg.includes('credentials')) {
        throw error;
      }
      
      // Otros errores, intentar continuar o salir
      if (iteration >= 2) break;
    }
  }

  const elapsed = Date.now() - startTime;
  console.log(`[orchestrator-tooluse] Completed in ${elapsed}ms, ${iteration} iterations`);

  // Si no obtuvimos resultado, usar fallback inteligente
  if (!finalResult) {
    console.log('[orchestrator-tooluse] No result from loop, using intelligent fallback');
    finalResult = await runFallbackPipeline(intent, params);
  }

  // Cache result
  await cacheSet(cacheKey, finalResult, TTL.INTENT);

  // Cleanup MCP clients
  if (mcpClients) {
    await mcpClients.gcpClient.disconnect();
    await mcpClients.uiClient.disconnect();
    mcpClients = null;
  }

  return finalResult;
}

// ─── Fallback Pipeline ────────────────────────────────────────

async function runFallbackPipeline(
  intent: string,
  params: OrchestrationParams,
): Promise<unknown> {
  console.log('[fallback] Running intelligent fallback pipeline');
  
  // Parsear intent localmente
  const parsed = parseIntentLocally(intent);
  console.log('[fallback] Parsed intent:', JSON.stringify(parsed));
  
  // Si no tenemos datos, consultarlos
  if (stashedRecords.length === 0) {
    try {
      const { gcpClient } = await getMcpClients();
      const mergedFilters = { ...parsed.filters, ...params.filters };
      
      console.log('[fallback] Querying data with filters:', JSON.stringify(mergedFilters));
      
      const result = await gcpClient.callTool('query_data', {
        dataset: params.dataset ?? 'ventas-credito',
        filters: mergedFilters,
        limit: parsed.limit,
      }) as { records?: Record<string, unknown>[] };
      
      stashedRecords = result.records ?? [];
      console.log(`[fallback] Got ${stashedRecords.length} records`);
    } catch (error) {
      console.error('[fallback] Query failed:', (error as Error).message);
    }
  }
  
  // Generar UIConfig
  if (stashedRecords.length === 0) {
    return {
      title: 'Sin resultados',
      layout: 'vertical',
      components: [{
        component: 'StatCard',
        props: {
          title: 'No se encontraron datos',
          value: `No hay registros para "${intent}"`,
          subtitle: 'Intenta con otros filtros',
          icon: '🔍',
        },
      }],
    };
  }
  
  return buildUIConfig({
    title: parsed.title,
    template: parsed.template,
    groupBy: parsed.groupBy,
    chartType: parsed.chartType,
    records: stashedRecords,
  });
}

// ─── Date Normalization ───────────────────────────────────────

function normalizeDates(intent: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const pad = (n: number) => String(n).padStart(2, '0');

  let normalized = intent;

  // "este mes"
  if (/este\s+mes/i.test(normalized)) {
    const start = `${year}-${pad(month + 1)}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const end = `${year}-${pad(month + 1)}-${lastDay}`;
    normalized = normalized.replace(/este\s+mes/gi, `${monthNames[month]} ${year} (${start} al ${end})`);
  }

  // "mes pasado"
  if (/mes\s+pasado/i.test(normalized)) {
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const start = `${prevYear}-${pad(prevMonth + 1)}-01`;
    const lastDay = new Date(prevYear, prevMonth + 1, 0).getDate();
    const end = `${prevYear}-${pad(prevMonth + 1)}-${lastDay}`;
    normalized = normalized.replace(/mes\s+pasado/gi, `${monthNames[prevMonth]} ${prevYear} (${start} al ${end})`);
  }

  // "este año"
  if (/este\s+a[ñn]o/i.test(normalized)) {
    normalized = normalized.replace(/este\s+a[ñn]o/gi, `año ${year} (${year}-01-01 al ${year}-12-31)`);
  }

  return normalized;
}

// ─── Export for index.ts ──────────────────────────────────────

export { orchestrateWithToolUse as orchestrate };
