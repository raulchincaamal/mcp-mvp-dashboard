# Active Context — MCP MVP Dashboard

## Current State
Phase 1 (MVP local) — pipeline end-to-end validated.

## Active Architecture Decision
mcp-main exposes **two modes** from the same binary:
- `PORT=4000 node dist/index.js` → Fastify HTTP server (for frontend + Alexa)
- `node dist/index.js --mcp` → MCP Server via stdio (for IDE)

Bedrock is now the **orchestrator** (not just a parser). It receives the user intent + tool definitions and decides dynamically which tools to call (query_data, generate_ui) and in what order via a ConverseCommand tool-use loop.

## MCP Tool: generate_dashboard
```typescript
{
  intent: string;           // Natural language (Spanish)
  dataset?: string;         // Default: "ventas-credito"
  filters?: Record<string, unknown>;
  limit?: number;
}
// Returns: { url, key, title, cached }
```

## HTTP Endpoint: POST /api/generate-ui
```bash
curl -X POST http://localhost:4000/api/generate-ui \
  -H "Content-Type: application/json" \
  -d '{ "intent": "gráfica de motos por estado", "dataset": "ventas-credito" }'
```

## Bedrock Tool-Use Loop (orchestrator.ts)
1. Send intent + tool definitions to Bedrock
2. Bedrock responds with tool_use → mcp-main executes the tool via McpClient
3. Tool result sent back to Bedrock
4. Loop until stopReason = end_turn → UIConfig returned

## Known Issues / Watch Points
- `uncaughtException` handler suppresses ioredis errors to prevent process crash
- Redis TLS enabled by default (`REDIS_TLS !== 'false'`)
- `DASHBOARD_URL` env var must be set for the returned URL to be valid
- Component catalog is hardcoded in `orchestrator.ts` COMPONENT_CATALOG constant

## Roadmap
| Phase | Status | Description |
|---|---|---|
| Phase 1 | **Current** | MVP local — pipeline end-to-end |
| Phase 2 | Next | API Gateway + Event Bus, multi-channel |
| Phase 3 | Future | Stateless orchestrator + MCP Server Registry |
| Phase 4 | Future | Observability + CI/CD for UI artifacts |
