# ADR 003: MCP app and host boundary

**Status:** Accepted  
**Date:** 2026-07-28

## Context

The grant-seeker repository already contains a useful, headless MCP server. An
MCP App can add a shared visual surface for a grant seeker and an AI assistant,
but it should not make the existing research server depend on one app framework
or one assistant host.

The experimental implementation in PR #15 proved the journey with Skybridge,
but it mixed framework registration, app-specific tools, view models, React
components, and styling into the same core files. That makes the change harder
to review and would make a future host migration unnecessarily invasive.

## Decision

### 1. Preserve a standard MCP core

`src/core/` remains a standard MCP SDK implementation:

- it owns CommonGrants clients, source-neutral research tools, and the headless
  server factory;
- it does not import Skybridge, React, app views, or host-specific APIs;
- stdio continues to use this server directly.

### 2. Treat Skybridge as one host adapter

Skybridge-specific code lives under:

```text
src/app/hosts/skybridge/
```

The adapter:

- creates the Skybridge server;
- translates the core tool-registration signature at one boundary;
- registers later app-only tool definitions/handlers from `src/app/tools/` and
  adds Skybridge view metadata;
- translates Skybridge web hooks into host-neutral component inputs.

The root `src/server.ts` remains the thin conventional entrypoint required by
Skybridge's build.

### 3. Keep app behavior host-neutral

App code is divided by responsibility:

```text
src/app/
  tools/       presentation handlers and schemas
  models/      opportunity-to-display selection
  components/  pure React components receiving data and host actions as props
  hosts/
    skybridge/ Skybridge server and web-hook containers
```

Presentation logic and display selection must not import `skybridge/*`.
Components must not read host globals or call Skybridge hooks directly.
Components receive concrete values and callbacks such as `onOpenExternal`
rather than a general host context.

The dependency direction is:

```text
core ← host-neutral app logic ← host adapter ← root entrypoint
```

The host adapter may depend on core and host-neutral app modules. Neither core
nor host-neutral app modules may depend on a host adapter.

### 4. Enforce the boundary

- ESLint rejects `skybridge/*` imports outside `src/app/hosts/skybridge/` and
  the build entry/configuration files.
- A parity test compares semantically meaningful fields of the named core-tool
  definitions across the standard and Skybridge-hosted servers. It canonicalizes
  harmless host defaults such as absent versus empty metadata and ignores later
  app-only tools.
- App-only tools are registered by the host adapter and do not appear on stdio
  unless that is separately designed and approved.

### 5. Avoid a speculative host framework

We will not introduce a broad `AppHost` interface before a second host exists.
The current seam consists of pure functions/components, explicit props, and one
localized adapter. A future host can implement the same small responsibilities;
shared abstractions should be extracted only from demonstrated duplication.

Replacing Skybridge would change the host adapter, root entrypoint,
dependencies, and build/deployment configuration. It would not require changes
to the MCP core, presentation handlers, display models, or pure components.

## Sequencing and review gates

The app will be extracted from PR #15 in three independently merged changes:

1. **Host/runtime foundation:** boundary, Skybridge packaging, parity tests; no
   app-only tool or view.
2. **Functional app:** final-shortlist tool, host-neutral display model, pure
   shortlist/detail components, and Skybridge container.
3. **Visual system:** semantic theme tokens and visual polish.

Each change receives:

1. a written design update and architecture review;
2. implementation and automated validation;
3. a separate implementation/regression review;
4. fixes before merge.

## Alternatives considered

- **Make the standard MCP core use Skybridge directly.** Rejected because it
  couples stdio and CommonGrants research behavior to the visual-app framework.
- **Cast a partial adapter object to an entire MCP server.** Rejected because
  future core use of another server method would compile but fail at runtime.
  The selected seam is an explicit `CoreToolRegistrar` capability.
- **Create a general multi-host framework now.** Rejected until a second host
  demonstrates real shared requirements.
- **Keep the complete experiment in one PR.** Rejected because runtime,
  functional behavior, and visual design require different review criteria and
  rollback boundaries.

## Consequences

### Positive

- The existing MCP server can evolve independently from the visual app.
- Replacing Skybridge does not require changes to core or host-neutral app behavior.
- Framework-specific types do not leak into CommonGrants or tool logic.
- Reviewers can evaluate runtime, behavior, and styling separately.

### Costs

- Core tools require a small registration adapter when hosted by Skybridge.
- The app has an additional directory boundary and thin container components.
- Full end-to-end tests must verify both the standard server and hosted app.

## Acceptance criteria for the foundation

- `src/core/` contains no `skybridge/*` imports.
- Skybridge imports are confined to `src/app/hosts/skybridge/`, `src/server.ts`,
  and build configuration.
- The standard and Skybridge servers discover semantically equivalent
  definitions for the named core tools.
- Both servers expose federal, Pennsylvania, California, and Washington.
- No app-only tool, view, React component, or visual theme is included.
- CI, production build, local HTTP smoke test, and stdio tests pass.
- The deployed preview smoke test reaches a Worker-backed source as well as
  the hosted MCP endpoint.
