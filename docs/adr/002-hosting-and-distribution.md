# ADR 002: Hosting and distribution

**Status:** Accepted (2026-07-07); implementation notes updated 2026-07-23
**Context:** deciding how this MCP server is hosted and distributed, driven by
the goal of publishing to the Claude Connectors Directory and the OpenAI Apps
SDK marketplace.

## Context

We researched what each marketplace requires. The finding that shapes everything:

- **Claude Connectors Directory** lists **remote MCP servers** — internet-hosted,
  reachable over HTTPS (Streamable HTTP / SSE), with a CA-signed certificate
  (self-signed fails silently), a privacy policy, a support channel, and accurate
  tool annotations. Submission happens from a **Team/Enterprise org's admin
  settings**. Servers that touch user accounts / private data / paid quotas must
  use **OAuth** with a real consent flow — API keys in config do **not** qualify.
  Local stdio servers cannot be listed directly.
  (Refs: Claude "Remote MCP Server Submission Guide" and Connectors Directory FAQ.)
- **OpenAI Apps SDK** requires the MCP server to be reachable over **HTTPS**,
  **identity/business verification** before publishing under a name, **tool
  annotations** (`readOnlyHint`, `openWorldHint`, `destructiveHint`), and review
  access via **test credentials with no MFA**.
  (Refs: OpenAI Apps SDK "Build your MCP server" and "Submit and maintain your app".)
- **Claude Desktop Extensions (`.mcpb`)** are the one non-hosted channel: a local
  **stdio** server bundled to run on the user's machine, needing **no OAuth**, via
  a separate submission form. Useful for internal/private distribution; not the
  same as the remote directory, and OpenAI has no local-server equivalent.

## Decision

1. **One remote HTTPS server, submitted to both marketplaces.** A single hosted
   URL is submitted to both Claude and OpenAI — one deployment, two listings.
   This makes remote HTTP a **day-one, first-class** concern, not a later phase.

2. **Host on Cloudflare Workers with the MCP SDK's Web-standard transport.**
   This matches the sibling deployments and reuses the wrangler + GitHub
   Actions model. The implemented server uses
   `WebStandardStreamableHTTPServerTransport` in stateless, JSON-response mode,
   which fits the current public, read-only tools without Durable Objects.
   `McpAgent` remains a future option if the server adds session state,
   authenticated mutations, or server-initiated streaming.

3. **No per-user OAuth — because grant search is public, read-only data.** The
   marketplaces mandate OAuth only for servers touching user accounts / private
   data / paid quotas. This server exposes public grant search, so the hosted
   deployment holds **one server-side federal API key** as a Cloudflare secret
   and users connect with zero configuration. This is the clean marketplace UX
   and sidesteps the OAuth requirement legitimately.

4. **Two-tier distribution:**
   - **Hosted (marketplace):** operator-fixed sources, server-side federal key,
     zero-config connect. The remote server is implemented and deployed at
     `https://mcp.cg.a6lab.ai/mcp`.
   - **Self-hosted (stdio, and later `.mcpb`):** users add their **own** sources
     and supply their **own** credentials via `commongrants-mcp.config.ts` and the
     environment. This is where "add your own credentials / new sources" lives.

5. **Publishing updates:**
   - Hosted server: an update is a **redeploy to the same URL** — no
     re-submission for routine changes. Material changes to the tool surface or
     auth model, or to listing metadata (name, logo, description), go through each
     platform's submission portal and may trigger re-review.
   - Self-hosted: ordinary versioned releases.

6. **npm publishing is deferred.** No Changesets/semantic-release for now. When we
   do publish an installable package (and/or `.mcpb`), model the release workflow
   on **`release-please`** as used in the sibling `ts-grants-gov` repo.

## Consequences

- The core and remote Worker are implemented. Remaining distribution work is
  marketplace submission and optional self-hosted packaging. Remote HTTP moved
  **up** from the original plan's Phase 4.
- No OAuth server to build or operate, as long as the server stays scoped to
  public data. If a future source requires per-user private data, that source
  would need OAuth and should be gated accordingly.
- The federal key is a single operator secret; protect and rotate it (see
  SECURITY.md). Self-hosters bring their own.

## Open items before marketplace submission

- Privacy policy URL and support channel.
- Branding assets (name, logo, description) per each platform.
- A Team/Enterprise Claude org to submit from; OpenAI identity/business
  verification.
- Test access for reviewers (no MFA).
- Confirm the federal API's expected auth header (`X-API-Key` vs bearer).
