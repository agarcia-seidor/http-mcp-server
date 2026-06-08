# MCP Mock HTTP

Mock HTTP server for MCP-style clients.

## Quick path

1. Put `PORT` and `MCP_NAME` in `.env` at the repo root.
2. Run `pnpm dev` or `pnpm start`.
3. Open `http://localhost:<PORT>/health` or connect a client to `http://localhost:<PORT>/mcp`.

## Runtime configuration

| Source | Behavior |
|--------|----------|
| `.env` in the repo root | Loaded by `src/server.ts` before env parsing |
| Shell environment | Takes precedence over `.env` values |
| `src/config/env.ts` | Validates `PORT` and `MCP_NAME`, then applies defaults |

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3000` | HTTP listen port |
| `MCP_NAME` | `mcp-mock` | MCP server name and health payload name |

## Versioning

| Source | Purpose |
|--------|---------|
| `package.json` | Single source of truth for the server version |
| `src/version.ts` | Runtime accessor used by the MCP server and tests |
| `CHANGELOG.md` | Repository-level release tracking |

When reusing this repository as a base for another MCP server, update the package version and add a changelog entry before the first release.

## Requirements

- Node.js 26.0.0
- pnpm

## Install

```bash
pnpm install
```

## Run

```bash
pnpm dev
```

The server bootstrap loads `.env` automatically, so local values apply without exporting them in the shell.

## Build

```bash
pnpm build
```

## Docker

Build the production image:

```bash
docker build -t mcp-server .
```

Run it with runtime environment variables:

```bash
docker run --rm -p 3000:3000 --env-file .env mcp-server
```

Override values at runtime when needed:

```bash
docker run --rm -p 3000:3000 -e PORT=8080 -e MCP_NAME=my-mcp mcp-server
```

The image does not contain your `.env` file. That keeps secrets out of the image while still letting the server read `.env`-style values if you provide them at runtime.

## Quality checks

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm coverage
pnpm format
```

`pnpm coverage` runs Vitest with the v8 coverage provider and prints a coverage summary in the terminal.

## Endpoints

- `GET /health` — JSON health response with `ok`, `name`, and `uptime`.
- `/mcp*` — MCP streamable HTTP transport handled by the SDK bridge.

## MCP Inspector

Use the Inspector as a client against the running HTTP server:

1. Start this project.
2. Launch the Inspector:

   ```bash
   npx @modelcontextprotocol/inspector
   ```

3. In the Inspector, choose the Streamable HTTP transport and connect to `http://localhost:<PORT>/mcp`.
4. Verify the connection by listing tools or calling one of the registered tools.

## Project structure

- `src/server.ts` — process bootstrap only
- `src/app.ts` — HTTP server composition and routing
- `src/config/env.ts` — environment parsing and validation
- `src/http/routes/health.ts` — health route handler
- `src/mcp/create-server.ts` — MCP server construction and tool registration
- `src/version.ts` — runtime version resolution from `package.json`
- `src/mcp/tools/echo.ts` — echo tool registration
- `src/mcp/tools/time.ts` — time tool registration
- `src/mcp/transport.ts` — Node HTTP to MCP transport bridge
