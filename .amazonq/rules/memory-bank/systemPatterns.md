# System Patterns — MCP MVP Dashboard

## Architecture Pattern
Sequential MCP pipeline orchestrated by a central HTTP server. Each MCP server is a child process communicating via stdio.

```
mcp-main (Fastify :4000)
  ├── McpClient → mcp-gcp-mock (child process, stdio)
  ├── McpClient → mcp-ui (child process, stdio)
  └── McpClient → library-context (node_modules, stdio)
```

## MCP Client Pattern
`McpClient` wraps `@modelcontextprotocol/sdk` Client. Two connection methods:
- `connect(serverPath)` — spawns `node <path>`
- `connectCommand(command, args, env)` — arbitrary command (used for library-context)

Tool responses are `content[]` arrays; text content is extracted and JSON-parsed automatically.

## Pipeline Class Pattern (`Pipeline.generateUi()`)
Single entry point for the full pipeline:
1. Check Redis cache by SHA-256 hash of `{ dataset, intent, filters, limit }`
2. `interpretIntent(intent)` → Bedrock ConverseCommand → `ParsedIntent`
3. `getComponentCatalog()` → library-context MCP → hardcoded list + regex augmentation
4. Merge `parsed.filters` + `params.filters` (params override)
5. `queryData(dataset, filters, limit)` → mcp-gcp-mock `query_data`
6. Build enhanced intent: `"<intent> [groupBy:x] [metric:x] [metricField:x] [chartType:x] [template:x]"`
7. `uiClient.callTool('generate_ui', { intent, records, componentCatalog, title, layout, columns })`
8. Cache UIConfig in Redis (TTL.INTENT = 60 min)

## Intent Interpreter Pattern (`interpretIntent()`)
- Sends system prompt + user intent to Bedrock via `ConverseCommand`
- System prompt defines all dataset fields + JSON output schema + inference rules
- Strips markdown code fences from response before JSON.parse
- Returns `ParsedIntent` with defaults on any error

## MCP Server Pattern (mcp-gcp-mock, mcp-ui)
Both use `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js` with `StdioServerTransport`.
Tools registered with `server.tool(name, description, zodSchema, handler)`.

## UIConfig Schema
```typescript
interface UIConfig {
  title: string;
  description?: string;
  layout: 'vertical' | 'grid';
  columns?: number;
  components: UIComponentConfig[];
}
interface UIComponentConfig {
  component: string;  // component name
  props: Record<string, unknown>;
  children?: (UIComponentConfig | string)[];
}
```

## DynamicRenderer Pattern
Switch-based dispatch in `RenderComponent`:
- Composite components (StatCard, KPIGrid, ProgressGroup, TransactionList, MiniChart, DataSummary, Chart) → custom render functions
- Base components (Button, Card, Badge, Text, etc.) → `componentMap` lookup → `@macropaytd` library
- Unknown component → renders dashed red border with component name (dev fallback)

## Filter Pattern (mcp-gcp-mock)
- Exact match: `{ campo: valor }`
- Range operators: `{ campo: { gte, lte, gt, lt } }` (works for dates and numbers)

## Cache Key Pattern
`mcp-dashboard:<prefix>:<sha256(JSON.stringify(data))>`

## Component Catalog Pattern
Hardcoded list of 19 known components in `parseComponentsFromContext()` (pipeline.ts).
Augmented at runtime by regex `/**(\w+)**/g` on library-context response text.

## Build Pattern
All MCP packages (`mcp-gcp-mock`, `mcp-ui`, `mcp-main`) use `tsup` for bundling.
`npm run build` must be run after source changes before child processes can be spawned.

## Error Handling
- Bedrock failures → fallback `ParsedIntent` (executive template, no filters, limit 100)
- Redis unavailable → `uncaughtException` handler suppresses ioredis errors; pipeline continues
- Unknown UIConfig component → red dashed border with component name
