import {
  BedrockRuntimeClient,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime';

const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION,
});
const MODEL_ID = process.env.BEDROCK_MODEL_ID;

/**
 * Structured query parsed from a natural language intent.
 */
export interface ParsedIntent {
  filters: Record<string, unknown>;
  groupBy: string | null;
  metric: 'count' | 'sum' | 'avg' | 'max' | 'min';
  metricField: string | null;
  chartType: 'bar' | 'line' | 'pie' | 'doughnut' | 'area' | null;
  template: 'executive' | 'category' | 'credit' | 'table' | 'cards' | 'chart';
  limit: number | null;
  title: string | null;
}

const SYSTEM_PROMPT = `Eres un intérprete de consultas para un dashboard de ventas a crédito. Tu trabajo es convertir un intent en lenguaje natural a un JSON estructurado.

El dataset tiene estos campos:
- id (string): ID de venta
- fecha_venta (string, formato YYYY-MM-DD): fecha de la venta
- cliente (string): nombre del cliente
- edad_cliente (number): edad
- genero (string): M o F
- estado (string): estado de México
- ciudad (string): ciudad
- sucursal (string): nombre de sucursal
- categoria (string): Motos, Celulares, Bicicletas Eléctricas, Pantallas/TV, Audio, Tablets, Consolas, Climatización, Accesorios
- producto (string): nombre completo del producto
- color (string): color del producto
- precio_contado (number): precio en pesos
- enganche (number): pago inicial
- monto_financiado (number): monto del crédito
- tasa_interes (number): tasa de interés (0-1)
- monto_total_credito (number): monto total a pagar
- plazo_semanas (number): plazo en semanas
- pago_semanal (number): pago semanal
- semanas_pagadas (number): semanas ya pagadas
- estatus_credito (string): al_corriente, atrasado, liquidado, cancelado
- canal_venta (string): tienda_fisica, en_linea, telefono
- vendedor (string): nombre del vendedor

Responde SOLO con un JSON válido (sin markdown, sin explicación) con esta estructura:
{
  "filters": {},          // filtros exactos o rangos. Ej: {"categoria": "Motos"} o {"fecha_venta": {"gte": "2025-07-01", "lte": "2025-07-31"}}
  "groupBy": null,        // campo para agrupar. Ej: "estado", "categoria", "canal_venta"
  "metric": "count",      // count = contar registros, sum/avg/max/min = operación sobre metricField
  "metricField": null,    // campo numérico para sum/avg/max/min. Ej: "precio_contado", "monto_total_credito"
  "chartType": null,      // bar, line, pie, doughnut, area, o null si no es gráfica
  "template": "executive",// executive, category, credit, table, cards, chart
  "limit": null,          // número de registros máximo, null = sin límite específico
  "title": null           // título sugerido para el dashboard, o null
}

Reglas:
- Si mencionan "cantidad", "cuántos", "número de": metric = "count"
- Si mencionan "total", "suma": metric = "sum"
- Si mencionan "promedio": metric = "avg"
- Si mencionan "por estado/categoría/mes/etc": usa groupBy
- Si mencionan una categoría específica (motos, celulares, etc): agrégala a filters
- Si mencionan un mes: agrega filtro de rango en fecha_venta
- Si mencionan "tabla" o "listado": template = "table"
- Si mencionan "gráfica" o "chart": template = "chart"
- Si mencionan "crédito" o "estatus": template = "credit"
- Si mencionan "categoría" o "por categoría": template = "category"
- Si mencionan un número (últimas 10, top 20): ponlo en limit
- La fecha actual es ${new Date().toISOString().split('T')[0]}`;

/**
 * Interprets a natural language intent into a structured query using Claude Haiku via Bedrock.
 */
export async function interpretIntent(intent: string): Promise<ParsedIntent> {
  try {
    const command = new ConverseCommand({
      modelId: MODEL_ID,
      system: [{ text: SYSTEM_PROMPT }],
      messages: [
        {
          role: 'user',
          content: [{ text: intent }],
        },
      ],
      inferenceConfig: {
        maxTokens: 512,
        temperature: 0,
      },
    });

    const response = await client.send(command);
    const responseText = response.output?.message?.content?.[0]?.text || '{}';

    // Strip markdown code fences if present (```json ... ```)
    const cleanJson = responseText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();

    // Parse the JSON response
    const parsed = JSON.parse(cleanJson) as ParsedIntent;

    // Validate and set defaults
    return {
      filters: parsed.filters || {},
      groupBy: parsed.groupBy || null,
      metric: parsed.metric || 'count',
      metricField: parsed.metricField || null,
      chartType: parsed.chartType || null,
      template: parsed.template || 'executive',
      limit: parsed.limit || null,
      title: parsed.title || null,
    };
  } catch (error) {
    console.error(
      '[intent-interpreter] Error calling Bedrock:',
      (error as Error).message,
    );
    // Fallback: return a basic executive template with no filters
    return {
      filters: {},
      groupBy: null,
      metric: 'count',
      metricField: null,
      chartType: null,
      template: 'executive',
      limit: 100,
      title: null,
    };
  }
}

