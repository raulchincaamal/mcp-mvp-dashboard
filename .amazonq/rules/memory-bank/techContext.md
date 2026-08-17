# Tech Context — MCP MVP Dashboard

## Key Dependencies

### mcp-main
- `fastify` — HTTP server
- `@aws-sdk/client-bedrock-runtime` — Bedrock ConverseCommand
- `@modelcontextprotocol/sdk` — MCP Client + Server
- `ioredis` — Redis cache (optional)
- `zod` — tool schema validation
- `tsup` — bundler

### mcp-gcp-mock / mcp-ui
- `@modelcontextprotocol/sdk` — MCP Server + StdioServerTransport
- `zod` — tool input validation
- `tsup` — bundler

### dashboard-app
- `next` 16, `react` 19
- `chart.js` + `react-chartjs-2`
- `@macropaytd/lib-front-ui-components` — private GitHub Packages registry
- `@macropaytd/lib-front-mcp-library-context` — MCP server for component catalog
- Tailwind CSS 4

## Environment Variables

### packages/mcp-main/.env
```
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_SESSION_TOKEN=        # SSO/temporary credentials only
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=us.anthropic.claude-haiku-4-5-20251001-v1:0
PORT=4000
DASHBOARD_URL=            # Base URL for shareable dashboard links (e.g. http://localhost:3000)
REDIS_HOST=               # Optional — omit to run without cache
REDIS_PORT=6379
REDIS_USER=
REDIS_PASS=
REDIS_TLS=true            # Set to 'false' to disable TLS
```

### packages/dashboard-app/.env.local
```
NEXT_PUBLIC_MCP_API_URL=http://localhost:4000
```

## Private Registry
`@macropaytd/*` packages require `.npmrc` at monorepo root:
```
@macropaytd:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=<TOKEN>
```

## MCP Server Paths (relative from mcp-main dist/)
| Server | Path |
|---|---|
| mcp-gcp-mock | `../../mcp-gcp-mock/dist/index.js` |
| mcp-ui | `../../mcp-ui/dist/index.js` |
| library-context | `node_modules/@macropaytd/lib-front-mcp-library-context/dist/index.js` |

## Frontend Routes
| Route | Description |
|---|---|
| `/` | Home page |
| `/dashboard` | Static dashboard with sample data |
| `/dynamic` | Dynamic UI from mcp-main API (intent input + render) |

## Build & Dev Commands
```bash
npm run build              # Build all packages (tsup + next build)
npm run dev:mcp-main       # Start API :4000
npm run dev:dashboard      # Start frontend :3000
npm run dev:mcp-gcp        # Watch mode mcp-gcp-mock
npm run dev:mcp-ui         # Watch mode mcp-ui
```

## Data Generation
```bash
node packages/mcp-gcp-mock/scripts/generate-ventas.mjs
# Regenerates packages/mcp-gcp-mock/data/ventas-credito.json (5,000 records)
```

## Constraints
- MCP servers must be built before mcp-main can spawn them as child processes
- AWS credentials expire with SSO — update `.env` on expiry
- Bedrock model ID must use geo inference prefix (`us.anthropic.*`)
- `package-lock.json` must never be manually edited
- `.env` and `.npmrc` must never be committed

## Troubleshooting
| Error | Fix |
|---|---|
| `EADDRINUSE :4000` | `netstat -ano \| grep 4000` → `taskkill //PID <pid> //F` |
| Bedrock "security token invalid" | Renew SSO credentials, update `.env` |
| Bedrock "model end of life" | Update `BEDROCK_MODEL_ID` to latest active model |
| MCP "Connection closed" | Run `npm run build` to rebuild child process binaries |
