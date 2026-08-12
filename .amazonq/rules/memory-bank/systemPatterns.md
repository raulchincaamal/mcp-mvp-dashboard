# System Patterns — MCP MVP Dashboard

## Architecture Pattern
Bedrock tool-use loop orchestrated by a central HTTP server. Each MCP server is a child process communicating via stdio. `orchestrator.ts` is the primary entry point; `pipeline.ts` exists but is unused by current routes.

```
mcp-main (Fastify :4000)
  └── orchestrate() → createMcpClients() per request
        ├── McpClient → mcp-gcp-mock (child process, stdio)
        └── McpClient → mcp-ui (child process, stdio)
```

## Orchestrator Pattern (`orchestrate()` — PRIMARY)
Single entry point for all HTTP routes:
1. Check Redis cache by SHA-256 hash of `{ dataset, intent, filters, limit }`
2. `createMcpClients()` → spawns mcp-gcp-mock + mcp-ui child processes
3. `runBedrockLoop()` — Bedrock tool-use loop (max 10 iterations):
   - Bedrock calls `query_data` → orchestrator calls `gcpClient.callTool('query_data', ...)` → returns summary (not full records) to Bedrock
   - Bedrock calls `generate_ui` → orchestrator injects `stashedRecords` + `COMPONENT_CATALOG` → calls `uiClient.callTool('generate_ui', ...)` → UIConfig
4. On loop failure → `runHardcodedPipeline()` fallback (Bedrock ConverseCommand for intent parsing + direct MCP calls)
5. Cache UIConfig in Redis (TTL.INTENT = 60 min)
6. Disconnect MCP clients in `finally` block

## Nova vs Claude Tool-Use Difference
- Nova models: `toolChoice` forced to `{ tool: { name: 'query_data' } }` on first call, then `{ tool: { name: 'generate_ui' } }`
- Claude models: `toolChoice: { any: {} }` on first call, then `{ auto: {} }`

## MCP Client Pattern
`McpClient` wraps `@modelcontextprotocol/sdk` Client. Two connection methods:
- `connect(serverPath)` — spawns `node <path>`
- `connectCommand(command, args, env)` — arbitrary command (used for library-context)

Tool responses are `content[]` arrays; text content is extracted and JSON-parsed automatically.

## Pipeline Class Pattern (`Pipeline.generateUi()` — UNUSED)
`pipeline.ts` contains a sequential pipeline class that is no longer called by HTTP routes. It uses `interpretIntent()` + `library-context` MCP + direct `mcp-gcp-mock` + `mcp-ui` calls. Kept for reference.

## Intent Interpreter Pattern (`interpretIntent()`)
- Used only by `pipeline.ts` (unused path) and `runHardcodedPipeline()` fallback
- Sends system prompt + user intent to Bedrock via `ConverseCommand`
- Strips markdown code fences before JSON.parse
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
`COMPONENT_CATALOG` is a hardcoded array of 10 components in `orchestrator.ts`, injected directly into `generate_ui` calls. Not fetched from library-context at runtime.

## Build Pattern
All MCP packages (`mcp-gcp-mock`, `mcp-ui`, `mcp-main`) use `tsup` for bundling.
`npm run build` must be run after source changes before child processes can be spawned.

## Error Handling
- Bedrock loop failure → `runHardcodedPipeline()` fallback
- Redis unavailable → `uncaughtException` handler suppresses ioredis errors; pipeline continues
- Unknown UIConfig component → red dashed border with component name
