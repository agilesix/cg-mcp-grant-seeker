# ADR 001: Architecture

**Status:** Accepted (2026-07-07)
**Context:** scaffolding an MCP server that searches grants across multiple
CommonGrants-compliant APIs, with an immediate goal of publishing to the Claude
and OpenAI MCP marketplaces.

## Context

The CommonGrants protocol lets many grant sources (federal Simpler.Grants.gov,
Pennsylvania, California, and more) expose the same API shape. An MCP server on
top of that standard can search all of them with one set of tools — the
compelling demo being a single natural-language query that fans out across every
source and returns combined, labeled results.

We need this to run in two very different places: locally over stdio (Claude
Desktop, MCP Inspector, self-hosters) and remotely over HTTPS (the marketplaces,
which require a hosted server — see ADR 002).

## Decision

1. **A transport- and hosting-agnostic core.** `src/core/` builds a fully-wired
   `McpServer` from a list of sources (`createServer(sources)`) and knows nothing
   about how it's transported or where it runs. Entry points are thin: `stdio.ts`
   connects it to `StdioServerTransport`; `worker.ts` (Phase 2) serves it over
   Streamable HTTP on Cloudflare Workers. This mirrors the api-ca/api-pa
   convention where only one or two files are host-aware.

2. **SDK network access sits behind an `ICommonGrantsClient` interface.** The
   server depends on this interface for API calls, so client upgrades and future
   retries, caching, or pagination helpers stay isolated to `src/core/client.ts`.
   The parsing layer deliberately reuses SDK schemas and extensions for runtime
   validation. Domain types (`Opportunity`, `SearchResult`,
   `OpportunityStatus`) are **derived** from the installed SDK via
   `Awaited<ReturnType<...>>` so they never drift.

3. **A data-driven source registry.** Sources are plain config
   (`SourceConfig[]`), not code. Adding a source — built-in or user-supplied —
   automatically extends the `source` argument on every tool and the search
   fan-out. Self-hosters override the registry with a `commongrants-mcp.config.ts`
   loaded via jiti (so `.ts` works at runtime with no build step) and validated
   with Zod. The hosted server reads its registry from the environment.

4. **Cloudflare Workers is the remote runtime** (ADR 002), matching the sibling
   api-ca/api-pa deployments and reusing the same wrangler + GitHub Actions CI/CD
   model. The remote transport will use Cloudflare's `McpAgent` (Durable
   Objects), not the MCP SDK's Node-only `StreamableHTTPServerTransport`.

5. **Generic, annotated tools.** `list_grant_sources`, `search_opportunities`,
   and `get_opportunity` — with an optional `source` argument — mirror the SDK's
   single resource group (`opportunities`). Every tool carries MCP annotations
   (`readOnlyHint`, `openWorldHint`) required by both marketplaces.

6. **The SDK's actual surface, verified.** As of `@common-grants/sdk@0.5`, only
   `client.opportunities` exists (`search`/`list`/`get`); `status` is an object
   (`.status.value`), money fields are `Money` objects, dates live under
   `keyDates`, there is no base `agency` field, and `search()` auto-paginates up
   to 1000 items unless `page`/`pageSize` are passed. The code reflects this — do
   not assume a flatter shape.

## Alternatives considered

- **A runtime transport factory (discriminated union on `mode`).** The original
  plan proposed one. Rejected in favor of two thin entrypoints: on Workers the
  HTTP path is `McpAgent`, not a drop-in MCP-SDK transport, so a single factory
  would leak runtime differences anyway.
- **Scaffolding empty resource groups** (organizations, applications, awards).
  Rejected — they don't exist in the SDK yet. We add tool files when the SDK does.
- **Depending on the SDK directly in tools.** Rejected — the `ICommonGrantsClient`
  seam keeps SDK churn out of tool code.

## Consequences

- The same core serves both stdio and (soon) HTTP; adding a source is a config
  edit, not a code change.
- SDK upgrades touch one file. Domain types recompile against the new SDK
  automatically, surfacing breaking changes at build time.
- `src/core/` is a clean candidate for later extraction to its own package.
