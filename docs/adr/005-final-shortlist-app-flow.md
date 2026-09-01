# ADR 005: Final-shortlist MCP App flow

**Status:** Accepted  
**Date:** 2026-07-28

## Context

An assistant often needs several searches and detail lookups to answer one grant
question well. Attaching a view to each research call produced a confusing
conversation: intermediate searches created repeated app frames, an empty later
search could visually replace useful earlier results, and host rerenders could
reset local navigation.

The user needs one stable review surface after the assistant has completed its
research. The assistant still needs complete structured CommonGrants data for
reasoning, filtering, and explanation.

ADR 003 established a standard MCP core, host-neutral app behavior, and a
localized Skybridge adapter. This decision defines the first app behavior built
on that boundary.

## Decision

### 1. Research remains headless

`search_opportunities` and `get_opportunity` remain unchanged core tools with no
view metadata. An assistant may call them as many times as needed without
creating user-facing app frames.

Their structured results remain complete for the corresponding SDK operation.
The app does not narrow the data available to the assistant.

The app host asks assistants to begin shortlist work with one targeted search.
Because search rows preserve every provider field and the presentation tool
hydrates selected records in parallel, the assistant should not run synonym
searches, paginate, or fetch every candidate individually unless the first
search is insufficient. This is execution guidance rather than a core-tool
contract change.

### 2. Add one explicit presentation tool

The hosted app adds `present_opportunity_shortlist`. The assistant calls it once
per completed shortlist revision with one to eight ordered, unique references:

```text
{ source, id }
```

The tool:

- deduplicates by source and ID while preserving rank;
- retrieves each complete SDK-validated opportunity from its source;
- returns successes and per-item failures in one structured result;
- optionally records normalized research queries and the search-call count;
- attaches the shortlist view only in the hosted app.

The server retrieves canonical details rather than accepting opportunity
payloads assembled by the assistant.

Research context is explicitly marked `assistant_supplied` in structured
content. The UI may disclose the reported queries but does not present the
reported search count as observed server telemetry.

### 3. Keep presentation behavior host-neutral

The implementation follows this layout:

```text
src/app/
  tools/                         shortlist schema, definition, and handler
  models/                        opportunity-to-display projection
  components/                    pure shortlist and detail React components
  hosts/skybridge/
    register-app-tools.ts        Skybridge view metadata and registration
    views/grant-results.tsx      hooks-to-props container
src/views/grant-results.tsx      thin Skybridge scanner shim
```

The scanner shim exists only because Skybridge discovers views under
`src/views/`. It re-exports the host container and contains no behavior.

Pure components receive concrete values and callbacks, including layout values
and `onOpenExternal`. They do not import Skybridge or access host globals.

### 4. Persist state by presentation identity

Each tool invocation creates a `presentationId` that is returned with the
structured result. It remains stable whenever the host remounts that result.

The Skybridge container uses `useViewState` for:

- the current `presentationId`;
- the selected source-scoped opportunity key;
- the number of visible rows;
- expanded-description state.

On mount or output update, the container resets persisted state only when the
output `presentationId` differs from the stored one. Remounting the same result
therefore preserves navigation; a new shortlist revision starts cleanly.

The Skybridge container also owns the concise `data-llm` annotation for the
current list or selected item. Pure components receive ordinary values and
callbacks and know nothing about persistence or LLM context APIs.

### 5. Bound retrieval, latency, and payload

The handler admits candidates in at most two batches of four. Each batch has an
eight-second response deadline. After that deadline the handler records safe
timeouts and admits the next batch, so the presentation wait is bounded at
approximately 16 seconds. A retrieval failure affects only its item; the result
is not all-or-nothing.

The current SDK does not expose an abort signal on opportunity `get()`, so the
deadline bounds the tool's wait but cannot cancel the underlying request. This
means timed-out requests from the first batch may still be in flight when the
second batch starts. Their promises are observed to prevent unhandled
rejections, and the absolute underlying-request count remains bounded by the
eight-item shortlist cap. This limitation is localized in the retrieval helper
and can be removed when the SDK supports cancellation.

The tool never silently truncates opportunity fields. Validation includes a
representative eight-item payload across the built-in providers and records
serialized size and elapsed time. The prototype uses 750 KB as a soft
structured-result budget and 16 seconds as a worst-case retrieval budget. If
representative full results exceed the payload budget, reduce the documented
shortlist cap and schema limit; do not project or discard structured fields.

### 6. Make the UI a stable local review surface

The presentation result contains all shortlist details up front. Opening a
candidate, returning to the list, expanding a description, and showing more
results are local UI state changes; they do not invoke MCP tools.

A new presentation result resets local selection and expansion state exactly
once. Intermediate research calls cannot replace the shortlist because they
have no attached view.

The view:

- preserves one global assistant-supplied rank and displays the source on each
  candidate;
- supports a compact shortlist and an in-place detail view;
- adapts the number initially visible to available host height;
- omits absent sections instead of rendering empty placeholders;
- shows a clear sparse-data explanation when only core identity fields exist;
- converts source-provided HTML descriptions to readable text rather than
  rendering untrusted markup;
- uses host-mediated external-link opening;
- reports per-candidate retrieval errors without hiding valid candidates.

An empty shortlist is not a valid presentation call. When research finds
nothing, the assistant explains that result conversationally and no app frame
is created.

### 7. Separate complete data from display projection

`structuredContent` contains each complete wire-safe opportunity returned by
the SDK. The display model selects a concise subset for human review and never
mutates or replaces the structured opportunity.

The initial projection favors protocol fields and genuinely shared custom
fields. Provider-specific enrichments are deferred unless implemented as
isolated, tested display enrichers. Unknown custom fields remain available to
the assistant even when the view does not render them.

### 8. Sanitize errors and outbound links

Raw upstream exceptions are logged server-side with source and ID. Structured
results expose only a stable category (`timeout`, `not_found`, or
`unavailable`) and a bounded user-safe message.

Provider links must use `https:`. `http:` is accepted only for `localhost`,
`127.0.0.1`, or `[::1]` during local development. Invalid or unsafe URLs are
omitted. The view uses the host-mediated external-link API and retains the
host's confirmation behavior.

### 9. Separate functional and visual work

This PR owns semantic HTML, keyboard and focus behavior, responsive layout,
overflow handling, missing/error/loading states, and host light/dark
compatibility.

The next PR owns product palette, typography, radii, elevation, semantic theme
presets, and brand polish. Functional behavior must remain usable before that
visual layer lands.

## Alternatives considered

- **Attach the view to every search.** Rejected because iterative agent research
  creates repeated, transient, and sometimes contradictory app frames.
- **Render only the last search.** Rejected because the last search is not
  necessarily the best or complete result set.
- **Allow an empty presentation.** Rejected because it creates an app frame
  without anything for the user to review.
- **Have the assistant send complete opportunity objects.** Rejected because
  agent-assembled payloads can be partial, stale, or altered.
- **Have shortlist rows call `get_opportunity`.** Rejected for this bounded
  shortlist because host tool calls caused navigation/rerender instability and
  N additional calls. Revisit if shortlist size or payload cost materially
  changes.
- **Put the presentation tool in core/stdio.** Rejected because it exists to
  drive an attached app view, not to expand the headless research contract.

## Consequences

### Positive

- The user sees one intentional, stable result surface per request.
- The assistant can research freely without UI noise.
- Complete opportunity data remains available for agent reasoning.
- Most UI behavior is testable without Skybridge.
- A future host replaces the container and registration adapter, not the
  presentation handler, model, or components.

### Costs

- The final presentation call refetches up to eight opportunities with bounded
  concurrency.
- The assistant must understand when one shortlist revision is complete.
- The view deliberately renders less data than the assistant receives.
- Skybridge's scanner convention requires one thin file outside the host folder.

## Acceptance criteria

- Core research tool definitions remain semantically equivalent across stdio
  and the hosted server.
- Only the hosted server exposes `present_opportunity_shortlist`.
- The presentation tool deduplicates references, preserves order, limits input
  to one through eight, and returns complete wire-safe opportunities with
  categorized per-item errors.
- Search and detail calls create no attached view.
- Pure components and display models contain no Skybridge imports.
- List/detail navigation, expansion, and show-more behavior require no MCP
  calls and survive remounting the same `presentationId`.
- Missing fields, empty shortlists, partial failures, long descriptions, and
  source-provided HTML have explicit tested behavior.
- Retrieval admits batches of four with an eight-second batch deadline; timed
  out SDK requests may continue in the background but remain bounded by the
  eight-item cap.
- Unsafe URLs and raw upstream errors never reach the view.
- Federal, Pennsylvania, California, Washington, and Maryland candidates can appear in
  one globally ranked shortlist.
- A representative eight-item payload across the built-in providers remains under the
  measured 750 KB soft budget; otherwise the input cap is reduced.
- CI, local app smoke tests, deployed preview smoke tests, and one agent
  usability pass succeed before merge.
