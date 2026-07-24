# CommonGrants Grant Seeker MCP

## Status

Existing headless MCP server with bounded federal, California, and Pennsylvania consumer-plugin
proofs. This
specification records the source-integration contract without introducing a visual interface or
changing the current research-tool contract.

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

## Consumer Plugin Proofs

Federal, California, and Pennsylvania are bounded proofs of plugin-backed source consumption:

- Each built-in source supplies its own standalone local consumer plugin.
- Field names and value schemas are derived from the existing `cg-api-ca`, `cg-api-pa`, and
  `@common-grants/cg-grants-gov` adapter contracts.
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

## Non-Goals

- Publishing California or Pennsylvania plugin packages.
- Exposing plugin capability discovery or custom-filter inputs.
- Copying provider-native transformations into the MCP.
- Making plugins mandatory for CommonGrants interoperability.
- Adding or changing a visual interface.

## Acceptance Checks

- Federal, California, and Pennsylvania search and detail calls are constructed through
  `plugin.getClient()`.
- Live built-in-source responses parse with representative shared and provider-specific custom
  fields intact.
- Unregistered custom fields still pass through.
- A configured no-plugin source retains the plain SDK-client path.
- No state conditional is introduced in core tools.
- Each provider requires one localized plugin module and one source-configuration reference.
- Tests, lint, formatting, type checking, build, and live validation pass.

## Follow-up Decision

After the proofs, decide whether to publish/extract the state plugins, replace the local federal
consumer with the corrected published package, expose plugin filters through a provider-neutral MCP
contract, or stop if further integration does not create meaningful consumer value.
