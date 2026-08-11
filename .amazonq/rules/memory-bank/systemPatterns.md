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

Tool responses are always `content[]` arrays; text content is extracted and JSON-parsed automatically.

## Pipeline Class Pattern
`Pipeline.generateUi()` is the single entry point:
1. Check Redis cache by request hash
2. `interpretIntent()` → Bedrock ConverseCommand → ParsedIntent
3. `getComponentCatalog()` → library-context MCP → parsed component list
4. `queryData()` → mcp-gcp-mock `query_data` tool
5. Build enhanced intent string with `[hint:value]` brackets
6. `uiClient.callTool('generate_ui', ...)` → UIConfig
7. Cache UIConfig in Redis

## MCP Server Pattern (mcp-gcp-mock, mcp-ui)
Both use `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js` with `StdioServerTransport`. Tools registered with `server.tool(name, description, zodSchema, handler)`.

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

## Filter Pattern (mcp-gcp-mock)
Supports exact match `{ campo: valor }` and range operators `{ campo: { gte, lte, gt, lt } }`.

## Cache Key Pattern
`mcp-dashboard:<prefix>:<sha256(JSON.stringify(data))>`
The hash suffix is used as the dashboard URL key: `/dashboard?key=<hash>`

## Build Pattern
All MCP packages use `tsup` for bundling. Must run `npm run build` after source changes before the child processes can be spawned.

## Error Handling
- Bedrock failures → fallback ParsedIntent (executive template, no filters, limit 100)
- Redis unavailable → pipeline continues without cache
- Unknown UIConfig component → renders dashed red border with component name
