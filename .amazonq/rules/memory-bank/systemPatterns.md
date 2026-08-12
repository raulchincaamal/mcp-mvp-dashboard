# System Patterns — MCP MVP Dashboard

## Architecture Pattern
Bedrock tool-use loop orchestrated by a central HTTP server. Each MCP server is a child process via stdio. `orchestrator.ts` is the primary entry point.

```
mcp-main (Fastify :4000)
  └── orchestrate() → createMcpClients() per request
        ├── McpClient → mcp-gcp-mock (child process, stdio)
        └── McpClient → mcp-ui (child process, stdio)
```

## Orchestrator Pattern (`orchestrate()` — PRIMARY)
1. Check Redis cache by SHA-256 hash
2. `createMcpClients()` → spawns child processes
3. `runBedrockLoop()` — Bedrock tool-use (max 10 iterations):
   - `query_data` → normalize filters → stash records → return summary to Bedrock
   - `generate_ui` → strip duplicate hints → override template if needed → inject records + catalog → double-parse result
4. On credential error → throw 401 (never fallback)
5. On other loop failure → `runHardcodedPipeline()` with local regex parser
6. Cache result, disconnect clients

## Filter Normalization Pattern
Applied in orchestrator before calling `query_data`:
- Known value map for `estado` (32 states with accent variants), `estatus_credito`, `canal_venta`
- Default: capitalize first letter of each word for proper nouns
- Prevents mismatch between Bedrock output casing and dataset exact strings

## Template Override Pattern
After `generate_ui` is called by Bedrock, orchestrator checks `stashedRecords`:
- If all records share one `estatus_credito` → force `[template:credit]`
- Prevents Bedrock from choosing `chart` when `credit` is semantically correct

## Double-Parse Pattern
`mcp-ui` returns `JSON.stringify(config)` as text content. `McpClient` parses it to string. Orchestrator loops `JSON.parse` until result is an object:
```ts
while (typeof raw === 'string') {
  try { raw = JSON.parse(raw); } catch { break; }
}
```

## Local Parser Pattern (`interpretIntentWithBedrock`)
Pure regex parser, no Bedrock call. Handles:
- Categorías (20+ keywords including synonyms)
- 32 estados de México with aliases (CDMX, Edomex, Monterrey, etc.)
- Colores (18 values)
- Estatus crédito (atrasado/liquidado/cancelado/al_corriente with conversational variants)
- Canal de venta
- Fechas: meses by name, "este mes", "este año", "año pasado"
- Template detection from conversational patterns ("cómo van", "qué pasó", "muéstrame")
- groupBy inference from question words ("qué estado", "quién vende")
- Accent normalization via `normalize('NFD')` before matching

## Smart Pivot Pattern (mcp-ui)
When filtered data has low cardinality on the natural grouping field:
- 1 categoria in data → group by `estado` instead
- 1 estado in data → group by `ciudad` instead
- 1 estatus_credito in data → show breakdown by `categoria` in ProgressGroup

## Color Pattern
- Pie/doughnut: always `backgroundColor: colors.slice(0, labels.length)` (array, one per segment)
- Bar chart single dataset: `backgroundColor: colors.slice(0, labels.length)` (one per bar)
- Bar chart multiple datasets: `backgroundColor: colors[i]` (one per dataset)
- ProgressGroup: `color: progressColors[idx % progressColors.length]` (one per item)

## Staggered Animation Pattern (DynamicRenderer)
```tsx
<div style={{
  opacity: 0,
  animationName: 'componentEnter',
  animationDuration: '0.6s',
  animationTimingFunction: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  animationFillMode: 'forwards',
  animationDelay: `${i * 0.08}s`,
}}>
```
Keyframe injected inline via `<style>` tag (not globals.css) to guarantee availability at render time.

## Theme Persistence Pattern
1. `layout.tsx`: `<html data-theme="light" suppressHydrationWarning>` + inline script reads localStorage before first paint
2. `Navbar.tsx`: reads localStorage on mount, writes on change
3. Dropdown uses fixed dark background (`#1a1d27`) independent of current theme

## Nova vs Claude Tool-Use Difference
- Nova: `toolChoice` forced to `{ tool: { name: 'query_data' } }` first, then `{ tool: { name: 'generate_ui' } }`
- Claude: `{ any: {} }` first, then `{ auto: {} }`

## MCP Server Pattern
Both use `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js` with `StdioServerTransport`.

## UIConfig Schema
```typescript
interface UIConfig {
  title: string;
  description?: string;
  layout: 'vertical' | 'grid';
  columns?: number;
  components: UIComponentConfig[];
}
```

## Error Handling
- AWS credential error → 401 with actionable message (update .env + restart)
- Bedrock loop failure → local parser fallback
- 0 records → empty state with 🔍 icon and suggestion text
- Redis unavailable → uncaughtException suppresses, pipeline continues
- Unknown UIConfig component → red dashed border with component name
