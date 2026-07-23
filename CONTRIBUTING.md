# Contributing guidelines

This project is an MCP (Model Context Protocol) server that searches grant
opportunities across CommonGrants-compliant APIs. It is designed to be both a
usable tool and a reference for connecting an LLM client to the CommonGrants
ecosystem.

Before contributing, please read our [LICENSE](LICENSE) and [README](README.md).
By submitting a contribution, you agree that your code is licensed under the MIT
License (the license of this project).

## Table of contents

- [Ways to contribute](#ways-to-contribute)
- [Project conventions](#project-conventions)
  - [Directory layout and import zones](#directory-layout-and-import-zones)
  - [Adding a source](#adding-a-source)
  - [Adding or changing a tool](#adding-or-changing-a-tool)
  - [Tool annotations](#tool-annotations)
- [Getting started](#getting-started)
- [Questions?](#questions)

## Ways to contribute

- **Report a bug** — open an issue with what you did, what happened, and what you
  expected. For CommonGrants-protocol-level issues, file upstream at
  [HHS/simpler-grants-protocol](https://github.com/HHS/simpler-grants-protocol/issues).
- **Request functionality** — open an issue describing the feature and the
  problem it solves.
- **Contribute code** — fork, branch (e.g. `issue-10-add-retry`), add tests, run
  `pnpm run ci` locally, and open a PR filling out the template.

## Project conventions

### Directory layout and import zones

The `src/` tree is layered so each concern can evolve independently:

- `src/core/` — the transport- and hosting-agnostic heart: the
  `ICommonGrantsClient` seam, the SDK-backed client, tool registration, and
  opportunity projection. It depends **only** on `zod`, `@common-grants/sdk`, and
  `@modelcontextprotocol/sdk` — never on other `src/**` directories. This is
  enforced by ESLint (`no-restricted-imports`) so it stays extractable.
- `src/config/` — the source registry: types, Zod validation, the
  `defineConfig` helper, built-in defaults, and the jiti-based config loader.
  Depends on `src/core/` for shared types.
- `src/stdio.ts` — the local (stdio) entrypoint.
- `src/worker.ts` — the remote (Cloudflare Workers) entrypoint using the MCP
  SDK's Web-standard Streamable HTTP transport.

Always import through a directory's `index.ts` public surface; do not deep-import
across `src/<dir>/` boundaries.

### Adding a source

Sources are data-driven — no code change is needed to add one at runtime. Users
add an entry to their `commongrants-mcp.config.ts` (see
[`examples/`](examples/commongrants-mcp.config.ts)). To change the **built-in**
defaults, edit [`src/config/defaults.ts`](src/config/defaults.ts). Any
CommonGrants-compliant `baseUrl` works; the `source` argument on every tool and
search fan-out picks it up automatically.

### Adding or changing a tool

Tools live in [`src/core/tools.ts`](src/core/tools.ts) and are registered on the
`McpServer` by `registerTools`. Keep network behavior behind the
`ICommonGrantsClient` interface rather than calling the SDK client directly.
Tool contracts and projections may import SDK schemas and extension helpers so
their types remain aligned with the installed SDK.

### Tool annotations

Every tool **must** declare accurate [annotations](https://modelcontextprotocol.io/)
(`readOnlyHint`, `openWorldHint`, and `destructiveHint` when relevant). These are
required by both the Claude Connectors Directory and the OpenAI Apps SDK. Search
and get tools are read-only and open-world; do not drop these hints.

## Getting started

See [DEVELOPMENT.md](DEVELOPMENT.md) for local setup, running the server,
connecting a client, and running tests.

## Questions?

Open a discussion or issue on this repository. For CommonGrants-protocol
questions, post on the upstream
[community forum](https://forum.simpler.grants.gov/c/commongrants/8).
