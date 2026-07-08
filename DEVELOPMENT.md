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

## The remote server (Cloudflare Workers)

The remote server — the artifact submitted to the Claude and OpenAI
marketplaces — lives in [`src/worker.ts`](src/worker.ts). It serves the same
`createServer()` core over the MCP SDK's Web-standard Streamable HTTP transport,
run **statelessly** (no Durable Object). See
[`docs/adr/002-hosting-and-distribution.md`](docs/adr/002-hosting-and-distribution.md).

### Run it locally

```bash
cp .dev.vars.example .dev.vars   # optional: add a FEDERAL_API_TOKEN for federal
pnpm run dev:worker              # wrangler dev on http://127.0.0.1:8787
```

The MCP endpoint is `POST /mcp`. Quick check that it's alive:

```bash
curl http://127.0.0.1:8787/health
```

### Test it with an MCP client

The endpoint speaks Streamable HTTP, so point any HTTP MCP client at
`http://127.0.0.1:8787/mcp`:

- **MCP Inspector (browser):** `pnpm dlx @modelcontextprotocol/inspector`, choose
  transport **Streamable HTTP**, URL `http://127.0.0.1:8787/mcp`, Connect.
- **Claude Desktop:** Claude connects to *stdio* servers from its config, so
  bridge to the HTTP server with [`mcp-remote`](https://www.npmjs.com/package/mcp-remote).
  For a local (http) URL you must pass `--allow-http`:

  ```jsonc
  {
    "mcpServers": {
      "commongrants-remote": {
        "command": "npx",
        "args": ["-y", "mcp-remote", "http://127.0.0.1:8787/mcp", "--allow-http"]
      }
    }
  }
  ```

  Against a deployed `https://` URL, drop `--allow-http`. Restart Claude Desktop
  fully after editing.

### Preview deploy (test a real hosted URL before production)

Cloudflare **versions** let you upload a build and get a throwaway preview URL
*without* shifting production traffic — ideal for testing the marketplace path
end-to-end before committing.

```bash
pnpm exec wrangler login                 # once (interactive)
pnpm exec wrangler versions upload       # prints a preview URL:
                                         #   https://<version>-cg-mcp-grant-seeker.<subdomain>.workers.dev
```

Point Claude Desktop (via `mcp-remote`, no `--allow-http`) or the Inspector at
`<preview-url>/mcp` and exercise it. When satisfied, promote it:

```bash
pnpm exec wrangler versions deploy       # promote the version to production
```

> Set the federal key on the deployed Worker with
> `pnpm exec wrangler secret put FEDERAL_API_TOKEN`. PA and CA need no secret.

### Production deploy

Handled by `.github/workflows/cd-production.yml` on push to `main` (and
`workflow_dispatch`), or manually with `pnpm run deploy`. Required repo secrets:
`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and `FEDERAL_API_TOKEN`.
