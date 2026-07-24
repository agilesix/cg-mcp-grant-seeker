# Grant Seeker MCP App

## Status

Local Skybridge prototype. This specification records the provider-neutral product direction for the visual layer. It does not authorize deployment or change the existing three-tool agent contract.

## Value Proposition

Help a person and their AI assistant discover and inspect grant opportunities from multiple CommonGrants-compatible sources without forcing either participant to navigate a wide portal or parse source-specific payloads.

The target user is a grant seeker working with an AI assistant. Today the assistant can already search and retrieve normalized grant data, but the human review surface is either prose in the conversation or a developer-oriented tool inspector. The visual layer should make a small result set easier to scan and one opportunity easier to verify while keeping reasoning, refinement, and comparison in the conversation.

Core actions:

1. Scan a bounded set of normalized search results.
2. Review one opportunity's most decision-relevant details.
3. Open the provider page, when one is available, and continue the analysis with the assistant.

## Why an AI Assistant?

Conversation is the best place to express an imprecise need such as “find workforce grants for a small nonprofit in Maryland,” refine it, compare candidates, and ask follow-up questions. The assistant contributes intent interpretation, source selection, iterative search, and reasoning across normalized results.

The assistant does not necessarily have direct access to current opportunity data. This MCP server supplies normalized provider data and source-scoped retrieval actions. The view is a shared surface for the human and assistant, not a replacement search portal or dashboard.

## Personas

- **Grant seeker:** describes a need conversationally, scans candidates, verifies one opportunity, and asks the assistant to assess fit.
- **AI assistant:** chooses and calls the small MCP tool surface, reasons over structured results, and uses detail on demand.
- **Headless MCP client:** consumes the same structured tool contracts without rendering a view.

No host-specific persona is assumed. ChatGPT, Claude, and other MCP Apps hosts should receive the same journey where their capabilities permit it.

## User Journey

1. The user asks the assistant to find grants in natural language.
2. The assistant calls `search_opportunities`; the app does not duplicate this with a search form.
3. The host renders a compact inline result card:
   - results are stacked vertically;
   - multi-source results are grouped into vertical source sections, not columns;
   - the initial view shows at most two results per source when several sources were searched, or five for a targeted source;
   - each row shows title, source, status, maximum award, and close-date evidence;
   - errors, unknowns, and omitted malformed rows remain explicit.
4. The user chooses **Review** on one result. The search view calls the headless `get_opportunity` tool with the source-scoped ID and replaces the list with a focused detail card.
5. The detail card shows source, status, award range, close-date evidence, applicant types, a bounded description, eligibility/contact information when present, and warnings about source verification.
6. The user can open the provider page, when the source data includes a URL or the source configuration declares a stable opportunity-page route, or return to results. Comparison, refinement, and fit assessment continue in the host conversation rather than becoming a multi-screen app workflow.

## Product and Technical Context

- Existing MCP tools: `list_grant_sources`, `search_opportunities`, and `get_opportunity`.
- Existing data path: MCP tools → CommonGrants SDK client boundary → federal, Pennsylvania, and California APIs.
- The built-in federal source declares Simpler.Grants.gov's stable `/opportunity/{id}` provider-page route; source-provided CommonGrants URLs take precedence for every provider.
- Existing contracts remain authoritative for agents and headless clients.
- Skybridge packages the React views and adapts the same hooks across ChatGPT Apps and standard MCP Apps runtimes.
- The implementation must use Skybridge abstractions and standard MCP Apps capabilities; it must not access `window.openai` or name a specific assistant provider in product copy.
- Local Skybridge DevTools is an implementation harness, not the user journey. Final portability requires validation in a real MCP Apps client because DevTools currently mocks the Apps SDK runtime.

## View Contracts

### Search results

- Inline, single-purpose, compact, and vertically responsive.
- No Kanban board, tabs, carousel, nested scrolling, fixed drawer, or fullscreen requirement.
- Progressive disclosure: summaries first, one opportunity's details on demand.
- At most one visible collection-level action, **Show more results**, when already-returned rows are hidden.
- Source-specific network pagination remains available only when the search targeted one source; broad continuation should be requested conversationally to avoid hidden cross-source pagination decisions.

### Opportunity detail

- Inline and focused on one opportunity within the same end-to-end discovery view.
- Reuses `get_opportunity` structured output; the view does not fetch provider APIs directly.
- At most two primary actions: return to results when invoked from search, and open the provider page when a URL exists.
- Long descriptions are visually bounded. The complete structured value remains available to the assistant.
- `null` means unknown or unavailable, never “no” or “ineligible.”
- A source-provided close date can be an administrative horizon rather than a fixed deadline; verification with the grant provider remains explicit.

## Provider-Neutral Architecture

- Use `skybridge/server` for tool-to-view bindings.
- Bind `search_opportunities` to the single `grant-results` view because discovery and review are states in one flow. Keep `get_opportunity` headless and call it from that view.
- Use `useToolInfo`, `useCallTool`, `useLayout`, and `useOpenExternal` from `skybridge/web`.
- Use host-provided theme and layout context and system-compatible CSS tokens with local fallbacks.
- Avoid provider-only hooks and globals.
- Preserve meaningful structured tool responses for clients that do not render views.
- Treat Skybridge as tooling and an adapter, not as visible product identity.

Skybridge normally recommends returning all data needed by a view up front instead of lazy-loading detail. This app retains the existing headless `get_opportunity` boundary as a deliberate exception: search summaries are already a bounded, stable agent contract, while fetching every source record's full detail would increase provider requests and response volume. The view reuses that existing backend action and does not introduce a duplicate tool or second view.

## Non-Goals

- Recreating a grant portal or adding a second search form.
- Ranking, eligibility determination, or fit scoring in the view.
- A comparison dashboard, application workflow, authentication, writes, or fullscreen browsing.
- Provider-specific copy, APIs, or deployment assumptions.
- Changing CommonGrants SDK schemas, plugin behavior, or the existing MCP output contract.

## Acceptance Checks

- Existing tool names, inputs, structured outputs, error semantics, and headless behavior remain unchanged apart from intentional view metadata on search and detail.
- Search renders as a compact vertical experience at narrow and wide inline sizes.
- Review loads the correct source-scoped opportunity and renders the shared detail component.
- The visual review state reuses `get_opportunity`; direct assistant calls remain structured and headless.
- Provider links open through the Skybridge host abstraction.
- Light and dark themes remain readable using host context.
- No provider-specific runtime global or copy appears in the view.
- Type checking, linting, formatting, tests, Skybridge build, and a local visual journey pass.

## Deferred Questions

- Whether a later host-mediated “Discuss eligibility” action materially improves the journey across MCP Apps clients.
- Whether true all-source continuation needs a new conversational affordance or a bounded aggregate pagination contract.
- Whether the visual layer should ship on the existing endpoint after validation in at least one real standard MCP Apps host.
