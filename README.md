# CommonGrants Grant Seeker (MCP server)

An [MCP](https://modelcontextprotocol.io/) server that searches grant
opportunities across multiple [CommonGrants](https://commongrants.org)-compliant
APIs from a single set of tools. Ask an MCP client (Claude, ChatGPT, the MCP
Inspector, …) to _"find workforce development grants"_ and it fans out across
every registered source and returns combined, labeled results.

Ships with five sources out of the box:

| Source                              | URL                                                    | Auth                          |
| ----------------------------------- | ------------------------------------------------------ | ----------------------------- |
| **federal** — Simpler.Grants.gov    | `https://api.simpler.grants.gov`                       | API key (`FEDERAL_API_TOKEN`) |
| **pa** — Pennsylvania               | `https://pa.api.cg.a6lab.ai`                           | none                          |
| **ca** — California                 | `https://ca.api.cg.a6lab.ai`                           | none                          |
| **wa** — Washington FundHub         | `https://wa.api.cg.a6lab.ai`                           | none                          |
| **md** — Maryland Community Compass | `https://md-commongrants-api.brian-derfer.workers.dev` | none                          |

Because they all speak CommonGrants, the same tools work against any additional
source you register.

## Tools

| Tool                   | What it does                                                          |
| ---------------------- | --------------------------------------------------------------------- |
| `list_grant_sources`   | Lists the registered CommonGrants sources                             |
| `search_opportunities` | Searches bounded pages from one source or fans out across all sources |
| `get_opportunity`      | Fetches the complete SDK-validated opportunity from a named source    |

The hosted MCP App also exposes `present_opportunity_shortlist`. An assistant
uses the three headless tools for iterative research, then automatically calls
the presentation tool once per completed shortlist revision without requiring
the user to know about or request the shortlist. The host may still ask the
user for permission before running the tool. A successful call produces one
stable, globally ranked review surface instead of attaching transient UI to
every search; a denied or failed call falls back to a concise plain-text
shortlist. The stdio server remains headless.

All tools are read-only and carry the MCP annotations (`readOnlyHint`,
`openWorldHint`) the Claude and OpenAI marketplaces require.

## Quick start (local, stdio)

```bash
corepack enable
pnpm install

export FEDERAL_API_TOKEN="your-simpler-grants-key"   # optional; PA + CA + WA + MD are public
pnpm run start:stdio
```

Then connect it to a client — see [DEVELOPMENT.md](DEVELOPMENT.md) for the Claude
Desktop config and the MCP Inspector. A single-file, copy-paste demo also lives
outside this repo for zero-setup demos.

## Configuration

The default registry (federal/pa/ca/wa/md) is defined in
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

Each source may optionally provide an SDK `Plugin`. When present, the server
constructs that source's client with `plugin.getClient()` so the plugin's
compiled opportunity schema is used while parsing responses.

Federal, California, Pennsylvania, Washington, and Maryland use small, standalone consumer plugins
derived from their existing adapter custom-field contracts. The MCP does not
copy provider-native transforms because all five APIs already return
CommonGrants opportunities. Each local plugin can later be replaced wholesale
by an import from a corrected published provider package. User-configured
sources continue to use the base SDK client unless their configuration supplies
a plugin. Consumer plugins omit static field descriptions because SDK 0.6
otherwise repeats them in every result; descriptions should later be exposed
once through a deduplicated field-definition surface. The federal consumer also
declares the four custom search filters implemented by the Simpler adapter,
although the current MCP search tool does not expose plugin filters yet.

`isDefault` is reserved source configuration and has no routing effect today.
Omitting `source` from `search_opportunities` fans out across every configured
source, while `get_opportunity` always requires an explicit source. Do not rely
on `isDefault` until default-source behavior is defined.

## Architecture

```
src/
├── core/          # transport- & host-agnostic: ICommonGrantsClient seam,
│   │              # SDK-backed client and lossless tool registration
│   ├── client.ts  #   constructs and calls @common-grants/sdk clients
│   ├── tools.ts   #   list_grant_sources / search_opportunities / get_opportunity
│   ├── server.ts  #   createServer(sources) → standard MCP SDK server
│   └── types.ts   #   SDK-derived domain types and the client seam
├── app/           # host-neutral app tools, models, and components
│   ├── tools/     #   final-shortlist definition and bounded hydration
│   ├── models/    #   display projection and persistent-state rules
│   ├── components/#   pure React components receiving props/callbacks
│   └── hosts/
│       └── skybridge/
│           ├── server.ts  # adapts unchanged core tools to Skybridge
│           └── views/     # Skybridge hooks-to-props container
├── config/        # data-driven source registry (types, Zod schema,
│                  # defineConfig, defaults, jiti loader)
├── plugins/       # localized consumer plugins for built-in source extensions
├── views/         # behavior-free shims required by Skybridge view scanning
├── stdio.ts       # local entrypoint (Claude Desktop, Inspector, self-hosters)
└── server.ts      # Skybridge HTTP entrypoint used by local and hosted runtimes
```

The shared core depends on an `ICommonGrantsClient` interface rather than an SDK
client directly. SDK client construction and network calls stay in `client.ts`;
domain types and enumerations are derived from the installed SDK. Tool results
preserve the opportunity fields returned by the SDK instead of maintaining a
second MCP-specific projection. The app's structured shortlist also preserves
complete opportunities while its human display selects a concise subset.
Skybridge is isolated to the app host adapter, scanner shim, and thin HTTP
entrypoint; the standard MCP core, presentation handler, display model, and
pure components do not import it.
The tool layer imports SDK schemas for its
agent-facing output contract, so the boundary is intentionally narrow rather
than absolute. See
[docs/adr/001-architecture.md](docs/adr/001-architecture.md).

## Hosting & marketplaces

Both the Claude Connectors Directory and the OpenAI Apps SDK require a **remote,
HTTPS-hosted** server; a single hosted URL is submitted to both. Because grant
search is public, read-only data, the hosted server holds one server-side
federal key and needs **no per-user OAuth** — users connect with zero config.
The stdio server is for local/self-hosted use. Skybridge packages the HTTP MCP
entrypoint for local development and the remote Cloudflare Worker deployed at
`https://mcp.cg.a6lab.ai/mcp`. See
[docs/adr/002-hosting-and-distribution.md](docs/adr/002-hosting-and-distribution.md).

## Scripts

| Script                                 | Purpose                                          |
| -------------------------------------- | ------------------------------------------------ |
| `pnpm run start:stdio` / `dev:stdio`   | Run the headless stdio MCP server                |
| `pnpm start` / `pnpm run dev`          | Run the Skybridge HTTP server and local devtools |
| `pnpm test` / `pnpm run test:coverage` | Run unit tests                                   |
| `pnpm run checks`                      | Lint + format + typecheck                        |
| `pnpm run ci`                          | Full CI sequence (types + checks + build + test) |
| `pnpm run dev:worker`                  | Run the built Cloudflare Worker locally          |
| `pnpm run deploy`                      | Deploy the remote Cloudflare Worker              |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [DEVELOPMENT.md](DEVELOPMENT.md).
Licensed under [MIT](LICENSE).
