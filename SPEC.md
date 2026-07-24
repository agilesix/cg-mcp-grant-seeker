# CommonGrants Grant Seeker MCP

## Status

Existing headless MCP server with a bounded California consumer-plugin proof. This specification
records the source-integration contract without introducing a visual interface or changing the
current research-tool contract.

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
4. A headless client consumes the same structured results without parsing Markdown or source-specific
   payloads.

## Product and Technical Context

- Tools: `list_grant_sources`, `search_opportunities`, and `get_opportunity`.
- Data path: MCP tools → CommonGrants SDK client boundary → federal, Pennsylvania, and California
  CommonGrants APIs.
- Sources are configured data. Core tools do not branch on a provider's identity.
- A source may optionally supply an SDK plugin. Plugin-bound clients validate registered custom
  fields; plain clients validate core fields and preserve unregistered custom-field values as
  unknown.
- Search and detail results preserve every field supplied by the corresponding SDK operation. The API
  and SDK—not the MCP—own the summary-versus-detail boundary.

## California Plugin Proof

California is the first bounded proof of plugin-backed source consumption:

- Its built-in source configuration supplies a local consumer plugin.
- The plugin's field names and value schemas are derived from the existing
  `agilesix/cg-api-ca/src/adapter/plugin.ts` contract.
- The plugin contains only CommonGrants custom-field definitions needed to parse the already-normalized
  API response.
- It does not copy California's native source schema or bidirectional transformations; those remain in
  the API proxy that converts native portal data.
- Federal, Pennsylvania, and user-configured sources continue to work without plugins.
- If a shared California package is published later, the local definition can be replaced by an
  import without changing clients or tools.

## Tool Contracts

- Existing tool names, inputs, structured outputs, pagination, and error semantics remain unchanged.
- California plugin parsing is an internal source-boundary improvement.
- Complete standard and custom fields remain available to the assistant.
- One malformed search row does not discard valid rows; raw malformed rows are not returned.

## Non-Goals

- Adding Pennsylvania or federal plugin bindings.
- Publishing a California plugin package.
- Exposing plugin capability discovery or custom-filter inputs.
- Copying California native transformations into the MCP.
- Making plugins mandatory for CommonGrants interoperability.
- Adding or changing a visual interface.

## Acceptance Checks

- California search and detail calls are constructed through `plugin.getClient()`.
- Live California responses parse with representative shared and `ca*` custom fields intact.
- Unregistered custom fields still pass through.
- Federal, Pennsylvania, and a configured no-plugin source retain the plain SDK-client path.
- No California conditional is introduced in core tools.
- The proof requires one localized plugin module and one source-configuration reference.
- Tests, lint, formatting, type checking, build, and live validation pass.

## Follow-up Decision

After the proof, decide whether to publish/extract the California plugin, repeat the pattern for
Pennsylvania, use the published federal plugin to prove custom filters, or stop if the integration
does not create meaningful consumer value.
