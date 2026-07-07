# Development

Local development guide for the CommonGrants MCP server.

## Prerequisites

- **Node.js** 22 or higher. A `.node-version` and `.nvmrc` are checked in; run `nvm use` (or `fnm use`) after cloning.
- **pnpm** 10 or higher. This repo pins the exact version via the `packageManager` field. Run `corepack enable` once after cloning to let Corepack auto-install the pinned pnpm.
- **Cloudflare account** (optional, only needed to deploy the remote server in Phase 2). Local development uses the stdio server and needs no Cloudflare account.

## Installation

```bash
git clone <repo-url> cg-mcp-grant-seeker
cd cg-mcp-grant-seeker
corepack enable        # once, if you haven't already
pnpm install
```

## Running the server locally (stdio)

```bash
# Optional: a federal key enables the federal source (PA and CA are public).
export FEDERAL_API_TOKEN="your-simpler-grants-key"

pnpm run dev     # tsx watch src/stdio.ts, hot-reloads on change
# or
pnpm start       # one-shot
```

An MCP stdio server communicates over stdin/stdout, so there's nothing to see
in the terminal — connect it to a client (below) to exercise it.

> **Keep stdout clean.** A stdio MCP server may emit **only** JSON-RPC on
> stdout. Do **not** launch it through `pnpm run <script>` in a client config:
> pnpm prints a `> script` banner to stdout that corrupts the protocol stream.
> Launch the binary directly (`node dist/...` or `tsx src/stdio.ts`), as below.
> Diagnostics in the server go to stderr, which is safe.

The MCP Inspector is the fastest way to poke at tools directly — point it at the
`tsx` binary (no build needed):

```bash
pnpm dlx @modelcontextprotocol/inspector ./node_modules/.bin/tsx src/stdio.ts
```

## Connecting to Claude Desktop

Build once so the client can launch plain `node` (most robust, no runtime tsx
resolution):

```bash
pnpm build
```

Then add to `~/Library/Application Support/Claude/claude_desktop_config.json`
(macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows), and fully
restart Claude Desktop:

```json
{
  "mcpServers": {
    "commongrants": {
      "command": "node",
      "args": ["/absolute/path/to/cg-mcp-grant-seeker/dist/src/stdio.js"],
      "env": { "FEDERAL_API_TOKEN": "your-simpler-grants-key" }
    }
  }
}
```

(For a no-build setup you can instead use `"command": "npx"` with
`"args": ["tsx", "/absolute/path/to/cg-mcp-grant-seeker/src/stdio.ts"]`.)

Ask Claude: _"find workforce development grants"_ — it fans out across federal,
PA, and CA and returns labeled results in one response.

## Configuration

By default the server registers three sources (federal, PA, CA). To add your
own sources or supply your own credentials, drop a `commongrants-mcp.config.ts`
in the working directory (or point `CG_MCP_CONFIG` at one). See
[`examples/commongrants-mcp.config.ts`](examples/commongrants-mcp.config.ts).

## Tests

```bash
pnpm test              # run all tests once
pnpm run test:coverage # with v8 coverage report

pnpm test __tests__/core/format.test.ts   # a single file
```

Tests are pure unit tests (formatting, config validation) under vitest's Node
environment. They make no network calls — the SDK is exercised only through the
`ICommonGrantsClient` seam, which is mocked or bypassed.

## Checks

All checks that run in CI are wrapped in local scripts:

```bash
pnpm run check:types     # tsc --noEmit
pnpm run check:lint      # eslint .
pnpm run check:format    # prettier --check .
pnpm run checks          # lint + format + types in sequence
pnpm run ci              # full CI sequence: wrangler:types + checks + build + test
```

Autofix equivalents:

```bash
pnpm run lint            # eslint . --fix
pnpm run format          # prettier --write .
```

## Deployment (remote server)

The remote (Cloudflare Workers) MCP server — the artifact submitted to the
Claude and OpenAI marketplaces — is **Phase 2** and not yet implemented. See
[`docs/adr/002-hosting-and-distribution.md`](docs/adr/002-hosting-and-distribution.md)
for the plan and [`src/worker.ts`](src/worker.ts) for the stub. Once built,
deploy happens via GitHub Actions on push to `main`, or manually:

```bash
pnpm run deploy          # wrangler deploy
```

Required Cloudflare secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`,
and `FEDERAL_API_TOKEN` (set via `wrangler secret put`).
