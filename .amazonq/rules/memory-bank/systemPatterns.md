# System Patterns — MCP MVP Dashboard

## Architecture Pattern
Bedrock tool-use loop orchestrated by a central HTTP server. Each MCP server is a child process via stdio.

```
mcp-main (Fastify :4000)
  └── orchestrate()
        ├── normalizeDateExpressions()   ← before anything
        ├── createMcpClients()
        └── runBedrockLoop()
              ├── query_data → filter normalization → mcp-gcp-mock
              └── generate_ui → template override → mcp-ui → double-parse
```

## Date Normalization Pattern
Applied **before** Bedrock sees the intent. Converts relative expressions to concrete ranges:
```ts
"ventas de este mes"
→ "ventas de el mes 2026-08 (del 2026-08-01 al 2026-08-31)"
```
Handles: "este mes", "mes pasado", "este año", "año pasado", "hoy", named months.
Nova's date hallucination (using training cutoff year) is mitigated because the dates are explicit in the text.

## Filter Normalization Pattern
Applied in orchestrator before calling `query_data`:
- `KNOWN_VALUES` map for `estado` (32 states with accents), `estatus_credito`, `canal_venta`
- Date range clamping: future years (2027+) → current year
- Default: capitalize each word for proper nouns

## Template Override Pattern
After `generate_ui` is called, orchestrator checks `stashedRecords` and overrides:
1. All records share one `estatus_credito` → force `[template:credit]`
2. General query (ventas/mes/año keywords, no chart/table keywords) + >50 records + Nova chose `chart` → force `[template:executive]`

## Double-Parse Pattern
`mcp-ui` returns `JSON.stringify(config)`. Orchestrator loops until object:
```ts
while (typeof raw === 'string') {
  try { raw = JSON.parse(raw); } catch { break; }
}
```

## Local Parser Pattern (`interpretIntentWithBedrock`)
Pure regex, no Bedrock. Handles:
- 9 categorías with 30+ keyword synonyms
- 32 estados de México with aliases (CDMX, Edomex, Monterrey, Cancún, etc.)
- 18 colores
- Estatus crédito with conversational variants ("debe", "vencido", "pagado")
- Canal de venta
- Fechas: meses, "este mes", "este año", "año pasado" → concrete ranges
- Template from conversational patterns ("cómo van", "muéstrame", "dame")
- groupBy from question words ("qué estado", "quién vende")
- Accent normalization via `normalize('NFD')` before matching

## Smart Pivot Pattern (mcp-ui)
When filtered data has low cardinality:
- 1 categoria → group by `estado`
- 1 estado → group by `ciudad`
- 1 estatus_credito → show breakdown by `categoria` in ProgressGroup + chart by `ciudad`

## Color Pattern
- Pie/doughnut: `backgroundColor: colors.slice(0, labels.length)` — one per segment
- Bar single dataset: `backgroundColor: colors.slice(0, labels.length)` — one per bar
- Bar multiple datasets: `backgroundColor: colors[i * 4 % colors.length]` — skip 4 for contrast
- ProgressGroup: `color: progressColors[idx % progressColors.length]` — one per item

## Staggered Animation Pattern (DynamicRenderer)
```tsx
style={{
  opacity: 0,
  animationName: 'componentEnter',
  animationDuration: '0.6s',
  animationTimingFunction: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  animationFillMode: 'forwards',
  animationDelay: `${i * 0.08}s`,
}}
```
Keyframe injected inline via `<style>` tag — not globals.css.

## Theme Persistence Pattern
1. `layout.tsx`: `<html data-theme="light" suppressHydrationWarning>` + inline script reads localStorage before first paint
2. `Navbar.tsx`: reads localStorage on mount, writes on change, default `light`
3. Dropdown uses fixed dark background (`#1a1d27`) independent of current theme

## Nova vs Claude Tool-Use Difference
- Nova: `toolChoice` forced to `{ tool: { name: 'query_data' } }` first, then `{ tool: { name: 'generate_ui' } }`
- Claude: `{ any: {} }` first, then `{ auto: {} }`

## Error Handling
- AWS credential error → 401 with actionable message
- Bedrock loop failure → local parser fallback
- 0 records → styled empty state with 🔍 icon and tip
- Redis unavailable → uncaughtException suppresses, pipeline continues
- Unknown UIConfig component → red dashed border with component name
