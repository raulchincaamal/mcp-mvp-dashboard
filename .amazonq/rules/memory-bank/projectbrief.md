# Project Brief — MCP MVP Dashboard

## Purpose

Monorepo that implements a dynamic dashboard generation pipeline using Model Context Protocol (MCP). Transforms natural language intents (Spanish) into renderable React UIs through a sequential orchestrated flow with AWS Bedrock LLM interpretation.

## Core Requirements

- Accept natural language intents in Spanish (e.g. "gráfica de ventas de motos por estado")
- Interpret intent via AWS Bedrock Claude Haiku → structured ParsedIntent
- Query mock sales data (5,000 records, ventas-credito dataset)
- Generate declarative UIConfig JSON via mcp-ui
- Render UIConfig dynamically in Next.js frontend via DynamicRenderer

## Stack

- **Runtime**: Node.js >= 18, npm workspaces monorepo
- **Backend**: Fastify (port 4000), MCP SDK (stdio transport)
- **LLM**: AWS Bedrock Claude Haiku 4.5 (`us.anthropic.claude-haiku-4-5-20251001-v1:0`)
- **Frontend**: Next.js 16, React 19, Tailwind 4, D3.js
- **UI Library**: `@macropaytd/lib-front-ui-components` (GitHub Packages)
- **Cache**: Redis via ioredis (optional, graceful degradation)

## Packages

| Package         | Role                                | Port  |
| --------------- | ----------------------------------- | ----- |
| `mcp-gcp-mock`  | Data source (mock GCP/SAP)          | stdio |
| `mcp-ui`        | Data → UIConfig transformer         | stdio |
| `mcp-main`      | HTTP orchestrator + LLM interpreter | 4000  |
| `dashboard-app` | Next.js frontend                    | 3000  |

## Global Imperatives

- NEVER manually edit `package-lock.json`
- NEVER commit `.env` or `.npmrc` files
- ALWAYS run `npm run build` after modifying MCP server source files
- ALWAYS update AGENTS.md when adding tools, endpoints, or changing behavior
