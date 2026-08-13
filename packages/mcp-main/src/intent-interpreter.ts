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
 * Completely domain-agnostic — field names come from the dataset, not hardcoded.
 */
export interface ParsedIntent {
  filters: Record<string, unknown>;
  groupBy: string | null;
  metric: 'count' | 'sum' | 'avg' | 'max' | 'min';
  metricField: string | null;
  chartType: 'bar' | 'line' | 'pie' | 'doughnut' | 'area' | null;
  template: 'dashboard' | 'chart' | 'table' | 'kpi' | 'cards';
  limit: number | null;
  title: string | null;
}

/**
 * Describes a single field in a dataset for LLM context.
 */
export interface FieldSchema {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date';
  description?: string;
  sampleValues?: unknown[];
  uniqueCount?: number;
}

/**
 * Dataset schema passed dynamically to the interpreter.
 */
export interface DatasetSchema {
  name: string;
  description?: string;
  fields: FieldSchema[];
  totalRecords?: number;
}

/**
 * Builds the system prompt dynamically from the dataset schema.
 * No hardcoded field names or domain logic.
 */
function buildSystemPrompt(schema: DatasetSchema): string {
  const fieldsDescription = schema.fields
    .map((f) => {
      let line = `- ${f.name} (${f.type})`;
      if (f.description) line += `: ${f.description}`;
      if (f.sampleValues && f.sampleValues.length > 0) {
        line += ` [examples: ${f.sampleValues.slice(0, 4).join(', ')}]`;
      }
      if (f.uniqueCount !== undefined) {
        line += ` (${f.uniqueCount} unique values)`;
      }
      return line;
    })
    .join('\n');

  const numericFields = schema.fields
    .filter((f) => f.type === 'number')
    .map((f) => f.name);
  const stringFields = schema.fields
    .filter((f) => f.type === 'string')
    .map((f) => f.name);
  const dateFields = schema.fields
    .filter((f) => f.type === 'date')
    .map((f) => f.name);

  return `You are a query interpreter for a data dashboard system. Your job is to convert a natural language intent into a structured JSON query.

Dataset: "${schema.name}"${schema.description ? ` — ${schema.description}` : ''}
${schema.totalRecords ? `Total records: ${schema.totalRecords}` : ''}

Available fields:
${fieldsDescription}

Field categories:
- Numeric fields (usable as metrics): ${numericFields.join(', ') || 'none'}
- Categorical fields (usable for groupBy): ${stringFields.join(', ') || 'none'}
- Date fields (usable for time filtering/grouping): ${dateFields.join(', ') || 'none'}

Respond ONLY with valid JSON (no markdown, no explanation) using this structure:
{
  "filters": {},
  "groupBy": null,
  "metric": "count",
  "metricField": null,
  "chartType": null,
  "template": "dashboard",
  "limit": null,
  "title": null
}

Field descriptions:
- "filters": exact match or range filters. Example: {"field": "value"} or {"date_field": {"gte": "2025-01-01", "lte": "2025-12-31"}}. Only use field names from the dataset.
- "groupBy": a field name to group/aggregate by (must be one of the available fields). Best used with categorical or date fields.
- "metric": the aggregation type — "count" (count records), "sum", "avg", "max", "min" (applied to metricField).
- "metricField": the numeric field to apply the metric on. Required when metric is sum/avg/max/min. Must be one of the numeric fields.
- "chartType": "bar", "line", "pie", "doughnut", "area", or null. Use "line" for time series, "doughnut"/"pie" for few categories, "bar" for comparisons.
- "template": the layout template — "dashboard" (KPIs + chart + table), "chart" (focused chart), "table" (data listing), "kpi" (metrics only), "cards" (card list).
- "limit": max records to return, or null for default.
- "title": a suggested title for the visualization, or null.

Rules:
- If the intent mentions quantity/count/number of items: metric = "count"
- If the intent mentions total/sum: metric = "sum", set metricField to the relevant numeric field
- If the intent mentions average/mean: metric = "avg", set metricField
- If the intent mentions "by X" or "per X" or "grouped by X": set groupBy to the matching field
- If the intent mentions a specific category value: add it to filters
- If the intent mentions a date range: add range filter on the date field
- If the intent says "table" or "list" or "records": template = "table"
- If the intent says "chart" or "graph": template = "chart"
- If a number is mentioned (top 10, last 20): set limit
- ONLY use field names that exist in the dataset. Do not invent field names.
- Current date: ${new Date().toISOString().split('T')[0]}`;
}

/**
 * Interprets a natural language intent into a structured query using Claude via Bedrock.
 * The dataset schema is injected dynamically — no hardcoded domain knowledge.
 */
export async function interpretIntent(
  intent: string,
  schema: DatasetSchema,
): Promise<ParsedIntent> {
  const systemPrompt = buildSystemPrompt(schema);

  try {
    const command = new ConverseCommand({
      modelId: MODEL_ID,
      system: [{ text: systemPrompt }],
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

    const parsed = JSON.parse(cleanJson) as ParsedIntent;

    // Validate and set defaults
    return {
      filters: parsed.filters || {},
      groupBy: parsed.groupBy || null,
      metric: parsed.metric || 'count',
      metricField: parsed.metricField || null,
      chartType: parsed.chartType || null,
      template: normalizeTemplate(parsed.template),
      limit: parsed.limit || null,
      title: parsed.title || null,
    };
  } catch (error) {
    console.error(
      '[intent-interpreter] Error calling Bedrock:',
      (error as Error).message,
    );
    // Fallback: return a basic dashboard template with no filters
    return {
      filters: {},
      groupBy: null,
      metric: 'count',
      metricField: null,
      chartType: null,
      template: 'dashboard',
      limit: 100,
      title: null,
    };
  }
}

/**
 * Normalize template value to the supported set.
 */
function normalizeTemplate(
  template: string | undefined | null,
): ParsedIntent['template'] {
  const valid = ['dashboard', 'chart', 'table', 'kpi', 'cards'];
  if (template && valid.includes(template)) {
    return template as ParsedIntent['template'];
  }
  // Map legacy/alternative names
  if (template === 'executive') return 'dashboard';
  if (template === 'category') return 'chart';
  if (template === 'credit') return 'dashboard';
  return 'dashboard';
}

