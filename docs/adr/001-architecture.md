# ADR 001: Architecture

**Status:** Accepted (2026-07-07); implementation notes updated 2026-07-23
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
   connects it to `StdioServerTransport`; `worker.ts` serves it over stateless,
   JSON-response Streamable HTTP on Cloudflare Workers. This mirrors the api-ca/api-pa
   convention where only one or two files are host-aware.

2. **SDK network access sits behind an `ICommonGrantsClient` interface.** The
   server depends on this interface for API calls, so client upgrades and future
   retries, caching, or pagination helpers have one primary integration point in
   `src/core/client.ts`. Tool output deliberately reuses SDK schemas rather than
   maintaining an MCP-specific opportunity projection. Domain types (`Opportunity`, `SearchResult`,
   `OpportunityStatus`) are **derived** from the installed SDK via
   `Awaited<ReturnType<...>>` so incompatible SDK changes surface during
   compilation. Tool contracts also import SDK schemas; the SDK boundary is
   narrow, not absolute.

3. **A data-driven source registry.** Sources are plain config
   (`SourceConfig[]`), not code. Adding a source — built-in or user-supplied —
   automatically extends the `source` argument on every tool and the search
   fan-out. Self-hosters override the registry with a `commongrants-mcp.config.ts`
   loaded via jiti (so `.ts` works at runtime with no build step) and validated
   with Zod. The hosted server reads its registry from the environment.

4. **Cloudflare Workers is the remote runtime** (ADR 002), matching the sibling
   api-ca/api-pa deployments and reusing the same wrangler + GitHub Actions CI/CD
   model. The implemented remote transport is the MCP SDK's
   `WebStandardStreamableHTTPServerTransport`, configured without sessions and
   with JSON responses. A fresh server and transport are created for every
   request. `McpAgent` and Durable Objects remain a possible later upgrade if
   mutations, per-user state, authentication, or server-initiated streaming
   require sessions.

5. **Generic, annotated tools.** `list_grant_sources`, `search_opportunities`,
   and `get_opportunity` mirror the SDK's opportunity resource group. Search may
   target one source or omit `source` to fan out across all sources; retrieval
   requires the source-scoped ID and an explicit source. Every tool carries MCP
   annotations (`readOnlyHint`, `openWorldHint`) required by both marketplaces.
   The MCP preserves every opportunity field returned by the corresponding SDK
   method. The SDK/API, rather than the MCP, owns the evolving distinction
   between search-summary and detail data.

6. **The SDK's actual surface, verified.** As of `@common-grants/sdk@0.6`, only
   `client.opportunities` exists (`search`/`list`/`get`); `status` is an object
   (`.status.value`), money fields are `Money` objects, dates live under
   `keyDates`, and reusable catalog fields are extensions rather than base
   opportunity properties. A source may optionally supply an SDK `Plugin`; the
   client is then constructed through `plugin.getClient()`. The generic MCP
   tools preserve plugin data carried in `customFields`, but do not yet
   automatically expose every plugin-specific search filter.

   Federal, California, and Pennsylvania are bounded proofs of this plugin
   path. The MCP carries standalone consumer plugins whose custom-field names
   and value schemas are derived from `common-grants/ts-cg-grants-gov`,
   `agilesix/cg-api-ca/src/adapter/plugin.ts`, and
   `agilesix/cg-api-pa/src/adapter/plugin.ts`. They intentionally exclude native
   source schemas and bidirectional transforms: those belong to the API
   adapters that convert provider data, while this MCP consumes
   already-normalized CommonGrants responses. Each plugin is attached only
   through its source configuration; tools contain no provider-specific routing
   branches.

   The three local plugins remain self-contained even where their adapters
   define identical ecosystem fields. The MCP does not introduce another
   shared-field contract; each local file can be replaced wholesale by a
   corrected formal package import. Consumer definitions omit static
   descriptions because SDK 0.6 repeats them in every parsed record; a future
   field-definition surface should expose that documentation once rather than
   inflate each result. Registered object schemas use passthrough behavior to
   preserve provider additions that the local contract does not yet know. The
   federal plugin also declares the Simpler adapter's four custom filters, but
   the generic MCP search contract does not expose plugin-specific filters yet.
   User-configured sources without plugins continue to use the plain SDK client,
   which validates core fields and preserves unregistered custom fields with
   unknown values.

7. **Reserved default-source configuration.** `SourceConfig.isDefault` is
   retained as a reserved configuration field but is not consulted by current
   tool routing. Omitting a search source means fan-out, not selection of the
   marked source. Retrieval always requires a source. No caller should depend
   on `isDefault` until its behavior is separately specified.

## Alternatives considered

- **A runtime transport factory (discriminated union on `mode`).** The original
  plan proposed one. Rejected in favor of two thin entrypoints whose transports
  have different host APIs and lifecycles.
- **Scaffolding empty resource groups** (organizations, applications, awards).
  Rejected — they don't exist in the SDK yet. We add tool files when the SDK does.
- **Depending on the SDK client directly in tools.** Rejected — the
  `ICommonGrantsClient` seam keeps network behavior and client construction out
  of tool code. Importing SDK schemas and extensions remains intentional.

## Consequences

- The same core serves both stdio and HTTP; adding a source is a config
  edit, not a code change.
- SDK client changes are concentrated in `client.ts`; SDK-derived types,
  schemas, and extension imports elsewhere recompile against an upgrade and
  surface incompatible changes at build time.
- `src/core/` is a clean candidate for later extraction to its own package.
