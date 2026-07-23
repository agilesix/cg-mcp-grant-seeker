# CommonGrants Grant Seeker (MCP server)

An [MCP](https://modelcontextprotocol.io/) server that searches grant
opportunities across multiple [CommonGrants](https://commongrants.org)-compliant
APIs from a single set of tools. Ask an MCP client (Claude, ChatGPT, the MCP
Inspector, …) to _"find workforce development grants"_ and it fans out across
every registered source and returns combined, labeled results.

Ships with three sources out of the box:

| Source                           | URL                              | Auth                          |
| -------------------------------- | -------------------------------- | ----------------------------- |
| **federal** — Simpler.Grants.gov | `https://api.simpler.grants.gov` | API key (`FEDERAL_API_TOKEN`) |
| **pa** — Pennsylvania            | `https://pa.api.cg.a6lab.ai`     | none                          |
| **ca** — California              | `https://ca.api.cg.a6lab.ai`     | none                          |

Because they all speak CommonGrants, the same tools work against any additional
source you register.

## Tools

| Tool                   | What it does                                                          |
| ---------------------- | --------------------------------------------------------------------- |
| `list_grant_sources`   | Lists the registered CommonGrants sources                             |
| `search_opportunities` | Searches bounded pages from one source or fans out across all sources |
| `get_opportunity`      | Fetches normalized core and catalog details from a named source       |

All tools are read-only and carry the MCP annotations (`readOnlyHint`,
`openWorldHint`) the Claude and OpenAI marketplaces require.

## Quick start (local, stdio)

```bash
corepack enable
pnpm install

export FEDERAL_API_TOKEN="your-simpler-grants-key"   # optional; PA + CA are public
pnpm start
```

Then connect it to a client — see [DEVELOPMENT.md](DEVELOPMENT.md) for the Claude
Desktop config and the MCP Inspector. A single-file, copy-paste demo also lives
outside this repo for zero-setup demos.

## Configuration

The default registry (federal/pa/ca) is defined in
[`src/config/defaults.ts`](src/config/defaults.ts). To add your own sources or
supply your own credentials, create a `commongrants-mcp.config.ts` in your
working directory (or point `CG_MCP_CONFIG` at one):

```ts
import { defineConfig } from '@common-grants/mcp-grant-seeker/config';

export default defineConfig({
  sources: [
    { name: 'ca', label: 'California', baseUrl: 'https://ca.api.cg.a6lab.ai' },
    {
      name: 'my-foundation',
      label: 'My Foundation',
      baseUrl: 'https://grants.example.org',
      auth: { type: 'bearer', token: process.env.MY_FOUNDATION_TOKEN },
    },
  ],
});
```

See [`examples/commongrants-mcp.config.ts`](examples/commongrants-mcp.config.ts)
for the full annotated example.

## Architecture

```
src/
├── core/          # transport- & host-agnostic: ICommonGrantsClient seam,
│   │              # SDK-backed client, tool registration, formatting
│   ├── client.ts  #   the only file that calls @common-grants/sdk clients
│   ├── catalog-fields.ts # validates reusable CommonGrants catalog fields
│   ├── tools.ts   #   list_grant_sources / search_opportunities / get_opportunity
│   ├── server.ts  #   createServer(sources) → wired McpServer
│   └── format.ts
├── config/        # data-driven source registry (types, Zod schema,
│                  # defineConfig, defaults, jiti loader)
├── stdio.ts       # local entrypoint (Claude Desktop, Inspector, self-hosters)
└── worker.ts      # remote entrypoint — Cloudflare Workers (Phase 2 stub)
```

The server depends on an `ICommonGrantsClient` interface rather than an SDK
client directly. SDK network calls stay isolated to `client.ts`; domain types,
enumerations, and custom-field extraction reuse the installed SDK contracts.
See
[docs/adr/001-architecture.md](docs/adr/001-architecture.md).

## Hosting & marketplaces

Both the Claude Connectors Directory and the OpenAI Apps SDK require a **remote,
HTTPS-hosted** server; a single hosted URL is submitted to both. Because grant
search is public, read-only data, the hosted server holds one server-side
federal key and needs **no per-user OAuth** — users connect with zero config.
The stdio server here is for local/self-hosted use. The remote Cloudflare
Workers server is Phase 2 — see
[docs/adr/002-hosting-and-distribution.md](docs/adr/002-hosting-and-distribution.md).

## Scripts

| Script                                 | Purpose                                          |
| -------------------------------------- | ------------------------------------------------ |
| `pnpm start` / `pnpm run dev`          | Run the stdio server (dev watches for changes)   |
| `pnpm test` / `pnpm run test:coverage` | Run unit tests                                   |
| `pnpm run checks`                      | Lint + format + typecheck                        |
| `pnpm run ci`                          | Full CI sequence (types + checks + build + test) |
| `pnpm run deploy`                      | Deploy the remote Worker (Phase 2)               |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [DEVELOPMENT.md](DEVELOPMENT.md).
Licensed under [MIT](LICENSE).
