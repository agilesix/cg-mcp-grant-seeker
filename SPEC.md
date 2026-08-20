# CommonGrants Grant Seeker MCP

## Status

Headless MCP research server with bounded federal, California, Pennsylvania, Washington, and Maryland
consumer-plugin proofs, plus an intentionally separate hosted app flow. Skybridge packages the
existing research tools and adds one final-shortlist presentation tool without attaching UI to
intermediate searches.

## Value Proposition

Help a grant seeker and an AI assistant search multiple CommonGrants-compatible providers through one
small, consistent tool surface. The assistant contributes natural-language intent, iterative search,
and cross-source reasoning; the MCP supplies current provider data that the assistant does not
otherwise possess.

Core actions:

1. Discover configured grant sources.
2. Search one source or fan out across all sources.
3. Retrieve the complete SDK-validated details for one source-scoped opportunity.

## Personas

- **Grant seeker:** expresses an imprecise need and reviews the assistant's findings.
- **AI assistant:** searches, retrieves, and reasons over structured CommonGrants results.
- **Developer or self-hoster:** adds CommonGrants sources without changing core tools.

## User Journey

1. The user describes a funding need conversationally.
2. The assistant discovers available sources and searches one or several of them.
3. The assistant preserves each result's source and ID, retrieves promising details, and explains
   findings in the conversation.
4. In an app-capable host, the assistant calls `present_opportunity_shortlist` once per completed
   shortlist revision with its strongest source-scoped candidates.
5. The user reviews one stable shortlist, opens details, and follows provider links without creating
   additional MCP calls.
6. A headless client continues to consume the research tools without parsing Markdown or
   source-specific payloads.

## Product and Technical Context

- Tools: `list_grant_sources`, `search_opportunities`, and `get_opportunity`.
- Data path: MCP tools → CommonGrants SDK client boundary → federal, Pennsylvania, California, Washington, and Maryland
  CommonGrants APIs.
- Sources are configured data. Core tools do not branch on a provider's identity.
- A source may optionally supply an SDK plugin. Plugin-bound clients validate registered custom
  fields; plain clients validate core fields and preserve unregistered custom-field values as
  unknown.
- Search and detail results preserve every field supplied by the corresponding SDK operation. The API
  and SDK—not the MCP—own the summary-versus-detail boundary.
- SDK 0.6.1 owns protocol-safe JSON serialization for plain dates. The MCP performs ordinary JSON
  serialization at its structured-content boundary without field-name-specific date handling.
- Skybridge owns HTTP packaging and the local HTTP development harness. The stdio entrypoint remains
  available for headless clients and self-hosters.
- Skybridge is isolated to `src/app/` and the thin HTTP entrypoint. `src/core/` remains a standard
  MCP SDK implementation and is shared unchanged with stdio.
- The shortlist handler, display model, and React components are host-neutral. Skybridge owns only
  registration metadata, web hooks, and its required `src/views/` scanner shim.

## Consumer Plugin Proofs

Federal, California, Pennsylvania, Washington, and Maryland are bounded proofs of plugin-backed source consumption:

- Each built-in source supplies its own standalone local consumer plugin.
- Field names and value schemas are derived from the existing `cg-api-ca`, `cg-api-pa`, `cg-api-wa`, `cg-api-md`,
  and `@common-grants/cg-grants-gov` adapter contracts.
- Each plugin contains only CommonGrants custom-field definitions needed to parse its normalized API
  response.
- Native source schemas and bidirectional transformations remain in the API proxies.
- The MCP does not create a shared state-field abstraction between the plugins. Each file remains
  independently replaceable by a future formal package import.
- Consumer plugins omit static field descriptions because SDK 0.6 materializes them into every
  opportunity. Descriptions remain valuable schema documentation and should later be exposed once
  per source or response through a deduplicated field-definition surface.
- Registered object schemas preserve unknown nested properties so provider additions are not deleted
  before the consumer plugin is updated.
- The federal consumer also declares the four custom search filters implemented by the Simpler
  adapter. The current MCP search tool does not expose plugin filters yet.
- User-configured sources continue to work without plugins.

## Tool Contracts

- Existing tool names, inputs, structured outputs, pagination, and error semantics remain unchanged.
- Consumer-plugin parsing is an internal source-boundary improvement.
- Complete standard and custom fields remain available to the assistant.
- One malformed search row does not discard valid rows; raw malformed rows are not returned.
- `present_opportunity_shortlist` is app-only. It retrieves one to eight complete opportunities with
  bounded concurrency and per-candidate deadlines, then attaches the sole user-facing view after
  research is complete.

## Non-Goals

- Publishing California, Pennsylvania, Washington, or Maryland plugin packages.
- Exposing plugin capability discovery or custom-filter inputs.
- Copying provider-native transformations into the MCP.
- Making plugins mandatory for CommonGrants interoperability.
- Finalizing product identity or brand standards. The app may use the configurable prototype visual
  system in ADR 006, with a CommonGrants-inspired default and a host-neutral alternative.
- Attaching views to search or detail tools.

## Acceptance Checks

- Federal, California, Pennsylvania, Washington, and Maryland search and detail calls are constructed through
  `plugin.getClient()`.
- Live built-in-source responses parse with representative shared and provider-specific custom
  fields intact.
- Unregistered custom fields still pass through.
- A configured no-plugin source retains the plain SDK-client path.
- No state conditional is introduced in core tools.
- Each provider requires one localized plugin module and one source-configuration reference.
- Tests, lint, formatting, type checking, build, and live validation pass.
- The Skybridge HTTP endpoint and stdio entrypoint expose the same three headless tools and schemas.
- An automated parity test compares the named core tools' meaningful contract fields across both
  runtimes while ignoring harmless host-added defaults and later app-only tools.

## Follow-up Decision

After the proofs, decide whether to publish/extract the state plugins, replace the local federal
consumer with the corrected published package, expose plugin filters through a provider-neutral MCP
contract, or stop if further integration does not create meaningful consumer value.
