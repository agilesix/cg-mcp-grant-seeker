# ADR 004: Wire-safe MCP output schemas

**Status:** Accepted  
**Date:** 2026-07-28

## Context

The CommonGrants SDK schemas are runtime parsing schemas. Several protocol
scalars accept wire strings and transform them into richer JavaScript values:

- date-only strings become `Date` subclasses;
- timestamps become `Date` objects;
- time strings pass through preprocessing.

MCP `structuredContent`, however, is JSON. The server serializes SDK-parsed
opportunities before returning them. The SDK's parsing schema and the JSON value
on the wire are therefore related but not identical contracts.

Both MCP hosts previously advertised `OpportunityBaseSchema` directly as their
output schema. The standard host did not expose the mismatch in fixtures where
nullable event times were omitted. The Skybridge host's generated JSON Schema
rejected valid live federal records containing `time: null`, despite the SDK
having already validated those records.

This is a transport-boundary defect, not a provider-data or app-view defect.

## Decision

### 1. Introduce one canonical wire opportunity schema

`src/core/wire.ts` owns `OpportunityWireSchema`, the schema for the serialized
JSON opportunity returned in MCP `structuredContent`.

It composes the SDK's exported schemas and overrides only fields whose SDK
parsers transform wire scalars:

- every single-date event's `date` and `time`;
- every date-range event's `startDate`, `startTime`, `endDate`, and `endTime`;
- events reached through `postDate`, `closeDate`, and `otherDates`;
- system `createdAt` and `lastModifiedAt` timestamps.

The serialized formats are:

- dates: `YYYY-MM-DD`;
- times: timezone-free `HH:MM:SS[.fraction]`, `null`, or absent;
- timestamps: UTC ISO datetime strings ending in `Z`.

The time scalar uses the SDK's actual post-parse `HH:MM:SS[.fraction]`
semantics expressed as a JSON Schema pattern, not JSON Schema `format: time`.
The latter requires an RFC 3339 timezone offset in common validators and
incorrectly rejects SDK-valid values such as `12:00:00`.

The rest of `OpportunityBaseSchema`, including status, funding, applicant
types, source, and arbitrary custom-field values, remains SDK-defined. We do
not fork or manually reproduce the complete opportunity model.

The wire schema is transform-free. For every accepted value:

```text
OpportunityWireSchema.parse(serializedOpportunity)
  deeply equals serializedOpportunity
```

Wire validation must not transform, strip, or normalize the JSON further.

### 2. Validate at both sides of the boundary

Provider responses continue to be parsed by the SDK and its
`OpportunityBaseSchema`.

`wireOpportunity()` serializes the parsed SDK value and validates the resulting
JSON with `OpportunityWireSchema`. If the SDK output and MCP wire contract ever
diverge again, the failure occurs in one named boundary instead of surfacing as
a host-specific response-validation error.

“Lossless” at this boundary means lossless relative to the JSON-serializable
SDK-parsed opportunity. JSON serialization is itself part of the MCP boundary;
non-JSON plugin values such as `BigInt`, `undefined`, or nested `Date` objects
are outside that guarantee.

A wire-contract failure is an integration or programming defect, not a provider
row-parse warning. Detail fails. Search marks that source page as failed. The
MCP must not silently omit or project the affected opportunity.

### 3. Advertise the wire schema from every MCP output

Core search, core detail, and hosted presentation outputs use
`OpportunityWireSchema`. Input parsing and source/plugin behavior remain
unchanged.

The standard and hosted MCP servers must expose semantically equivalent core
output schemas. Skybridge-specific code does not define or patch CommonGrants
wire fields.

### 4. Prove nullable and transformed values through real MCP validation

Contract tests exercise both MCP hosts with an SDK-parsed opportunity that
contains:

- date-only post and close dates;
- explicitly nullable event times and a timezone-unspecified `12:00:00` time;
- serialized creation and modification timestamps;
- custom fields.

The test calls tools through an MCP client after tool discovery so it exercises
the advertised output schema, not only direct Zod parsing.

The contract matrix includes:

- a single-date event with `time: null`;
- a date-range event with nullable start and end times;
- omitted event times;
- events under `otherDates`, including an `other` event;
- nested JSON custom-field values;
- the non-mutating parse invariant.

The deployed preview smoke continues to cover a real Worker-backed source.
Feature PRs may add broader provider smoke coverage, but they must not weaken
the wire contract to bypass provider failures.

## Alternatives considered

- **Omit MCP output schemas.** Rejected because agents and hosts benefit from an
  explicit structured result contract, and removing validation would hide
  regressions.
- **Keep using `OpportunityBaseSchema` and omit `null` values.** Rejected because
  it changes complete source data to accommodate a schema-generation mismatch.
- **Recreate the full CommonGrants opportunity schema locally.** Rejected
  because it would drift from the SDK and duplicate provider-independent
  protocol modeling.
- **Patch only the Skybridge adapter.** Rejected because the distinction is
  between SDK runtime values and JSON wire values, not between hosts.
- **Wait for a new SDK release.** Rejected for the immediate hosted regression.
  An upstream SDK wire-schema export could replace the local composition later
  without changing callers.

## Consequences

### Positive

- Valid nullable dates and times survive complete structured responses.
- Both MCP hosts advertise the JSON they actually return.
- The workaround is centralized at the SDK-to-MCP boundary.
- Most of the opportunity model still comes directly from the SDK.
- A future SDK-provided wire schema can replace one core export.
- `src/core/wire.ts` remains the stable internal facade if the SDK later exports
  its own wire schema or serializer; tools and hosts do not change.

### Costs

- The server owns a small composition layer for transformed date/time fields.
- SDK changes to transformed scalar behavior require a focused wire-boundary
  review.

## Acceptance criteria

- Search and detail return SDK-validated opportunities without field filtering.
- `time: null`, omitted times, date-only strings, timestamps, and custom fields
  validate through both the standard and hosted MCP servers, including
  date-range and `otherDates` branches.
- Parsing with `OpportunityWireSchema` deeply preserves the serialized input.
- A wire-contract failure fails detail or the affected search source page
  rather than filtering a record.
- Core tool schemas remain semantically equivalent across hosts.
- No provider or Skybridge adapter contains date/time schema patches.
- Existing provider, plugin, pagination, and data-completeness tests remain
  green.
- Local CI and deployed preview smoke pass before merge.
