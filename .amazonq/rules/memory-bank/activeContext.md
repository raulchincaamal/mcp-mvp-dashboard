# Active Context — MCP MVP Dashboard

## Current State
Phase 1 (MVP local) — pipeline end-to-end validated.

## Active Architecture Decision
mcp-main is now an **MCP Server** (not Fastify HTTP). It exposes a `generate_dashboard` tool via stdio transport, replacing the previous REST API approach. The tool:
1. Runs the full pipeline (interpret → catalog → data → UIConfig)
2. Caches UIConfig in Redis
3. Returns `{ url, key, title, cached }` — a shareable dashboard URL

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

## Known Issues / Watch Points
- `uncaughtException` handler suppresses ioredis errors to prevent MCP server crash
- Redis TLS enabled by default (`REDIS_TLS !== 'false'`)
- `DASHBOARD_URL` env var must be set for the returned URL to be valid
- Component catalog is hardcoded in `parseComponentsFromContext()` — not purely dynamic from library-context response

## Roadmap
| Phase | Status | Description |
|---|---|---|
| Phase 1 | **Current** | MVP local — pipeline end-to-end |
| Phase 2 | Next | API Gateway + Event Bus, multi-channel |
| Phase 3 | Future | Stateless orchestrator + MCP Server Registry |
| Phase 4 | Future | Observability + CI/CD for UI artifacts |
