# Grant Seeker MCP App

## Status

Skybridge prototype on an experimental pull-request preview. This specification records the provider-neutral product direction for the visual layer. It adds one presentation tool without changing the existing research-tool contracts.

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
2. The assistant calls the headless `search_opportunities` tool as many times as needed, optionally using `get_opportunity` to investigate candidates. Intermediate searches do not render user-facing cards.
3. The assistant deduplicates the results and calls `present_opportunity_shortlist` once with a bounded set of source-scoped opportunity references and a concise record of the searches performed.
4. The host renders one compact inline shortlist:
   - results are stacked vertically;
   - multi-source results are grouped into vertical source sections, not columns;
   - the initial view shows at most two results per source when several sources are represented, or five for a single source;
   - each row shows title, source, status, maximum award, and close-date evidence;
   - the header reports how many searches informed the shortlist;
   - the queries are available through compact disclosure;
   - candidate-fetch failures and unknown fields remain explicit.
5. The user chooses **Review** on one result. Because the presentation tool returned the complete SDK-validated opportunity, the view replaces the list with a focused detail card without another network request.
6. The detail card shows source, status, award range, close-date evidence, applicant types, a bounded description, eligibility/contact information when present, and warnings about source verification.
7. The user can open the provider page, when the source data includes a URL or the source configuration declares a stable opportunity-page route, or return to results. Comparison, refinement, and fit assessment continue in the host conversation rather than becoming a multi-screen app workflow.

## Product and Technical Context

- Research tools: `list_grant_sources`, `search_opportunities`, and `get_opportunity`.
- Presentation view: `present_opportunity_shortlist`.
- Existing data path: MCP tools → CommonGrants SDK client boundary → federal, Pennsylvania, and California APIs.
- The built-in federal source declares Simpler.Grants.gov's stable `/opportunity/{id}` provider-page route; source-provided CommonGrants URLs take precedence for every provider.
- Existing contracts remain authoritative for agents and headless clients.
- Skybridge packages the React views and adapts the same hooks across ChatGPT Apps and standard MCP Apps runtimes.
- The implementation must use Skybridge abstractions and standard MCP Apps capabilities; it must not access `window.openai` or name a specific assistant provider in product copy.
- Local Skybridge DevTools is an implementation harness, not the user journey. Final portability requires validation in a real MCP Apps client because DevTools currently mocks the Apps SDK runtime.

## View Contracts

### Opportunity shortlist

- Inline, single-purpose, compact, and vertically responsive.
- No Kanban board, tabs, carousel, nested scrolling, fixed drawer, or fullscreen requirement.
- Progressive disclosure: summaries first, one opportunity's details on demand.
- At most one visible collection-level action, **Show more results**, when already-returned rows are hidden.
- Represents the completed research result, not any individual intermediate search.
- Accepts at most eight unique source-scoped references.
- Reports the number of searches performed and allows the user to inspect the query list.
- Shows an empty state only when the final shortlist itself is empty; an intermediate zero-result search never produces a view.

### Opportunity detail

- Inline and focused on one opportunity within the same end-to-end discovery view.
- Reuses the complete SDK-validated opportunity returned by `present_opportunity_shortlist`; the view does not fetch provider APIs directly.
- Selects a concise human display from that opportunity without narrowing the structured data available to the assistant.
- At most two primary actions: return to results when invoked from search, and open the provider page when a URL exists.
- Long descriptions are visually bounded. The complete structured value remains available to the assistant.
- Descriptions that contain provider-authored HTML are converted to safe readable text before display; raw markup is never rendered or shown to the user.
- Optional fact cards, rows, sections, disclosures, and provider actions are omitted when their source values are unavailable. Remaining facts reflow to use the available width.
- A sparse opportunity remains a compact, intentional card anchored by title, status, and source. It may include one concise unknown-data note rather than empty sections or repeated “Not provided” placeholders.
- The default inline state keeps headline facts, the bounded description, applicants, funding, and both actions visible. Eligibility, dates/contact, deadline guidance, and source-specific fields share one **More opportunity details** disclosure so rich records do not push actions outside the host's inline frame.
- Standard CommonGrants fields are preferred for display. Recognized plugin/custom fields supplement them without becoming required for the layout.
- `null` means unknown or unavailable, never “no” or “ineligible.”
- A source-provided close date can be an administrative horizon rather than a fixed deadline; verification with the grant provider remains explicit.

## Provider-Neutral Architecture

- Use `skybridge/server` for tool-to-view bindings.
- Keep `search_opportunities` and `get_opportunity` headless so an assistant can iterate without producing intermediate user interfaces.
- Bind only `present_opportunity_shortlist` to the `grant-results` view. Its handler resolves source-scoped references in parallel and returns each complete SDK-validated opportunity for the bounded shortlist.
- Use `useToolInfo`, `useLayout`, and `useOpenExternal` from `skybridge/web`.
- Use host-provided theme and layout context and system-compatible CSS tokens with local fallbacks.
- Avoid provider-only hooks and globals.
- Preserve meaningful structured tool responses for clients that do not render views.
- Keep the visual selection layer separate from the CommonGrants data contract: the API/SDK decides which fields exist, the MCP preserves them, and the view decides which fields to render.
- Treat Skybridge as tooling and an adapter, not as visible product identity.

This architecture follows Skybridge's recommendation to return all data needed by a view up front. The presentation tool fetches only the assistant's bounded final shortlist, rather than every result from every exploratory search.

## Non-Goals

- Recreating a grant portal or adding a second search form.
- Ranking, eligibility determination, or fit scoring in the view.
- A comparison dashboard, application workflow, authentication, writes, or fullscreen browsing.
- Provider-specific copy, APIs, or deployment assumptions.
- Changing CommonGrants SDK schemas, plugin behavior, or the existing MCP output contract.

## Acceptance Checks

- Existing research-tool names, inputs, structured outputs, and error semantics remain unchanged and headless.
- The assistant can perform several searches without rendering intermediate cards, then present one shortlist.
- The shortlist renders as a compact vertical experience at narrow and wide inline sizes.
- Review uses the correct source-scoped opportunity detail already returned by the presentation tool.
- Provider links open through the Skybridge host abstraction.
- Light and dark themes remain readable using host context.
- No provider-specific runtime global or copy appears in the view.
- Type checking, linting, formatting, tests, Skybridge build, and a local visual journey pass.

## Deferred Questions

- Whether a later host-mediated “Discuss eligibility” action materially improves the journey across MCP Apps clients.
- Whether the visual layer should ship on the existing endpoint after validation in at least one real standard MCP Apps host.
