# ADR 006: Semantic MCP App theming

**Status:** Accepted
**Date:** 2026-07-28

## Context

ADR 003 isolated the MCP App from the headless server and from Skybridge. ADR
005 established a functional, accessible shortlist/detail surface with a small
neutral style layer. The visual choices in that layer were provisional.

Team feedback identified two legitimate deployment needs:

1. the Agile Six-hosted product should have a recognizable CommonGrants visual
   character;
2. a self-hosted or differently hosted MCP App should be able to remain neutral
   without forking components or tool behavior.

The app must still respect host light/dark mode and safe-area/layout signals. It
must not display company names or logos merely because a theme is selected.

## Decision

### 1. Separate semantic tokens from component rules

Theme values live under `src/app/theme/`. Component CSS refers only to
purpose-based custom properties such as:

```text
--grant-color-text
--grant-color-surface
--grant-color-surface-subtle
--grant-color-accent
--grant-color-on-accent
--grant-color-muted
--grant-color-danger
--grant-color-danger-surface
--grant-color-focus
--grant-color-border
--grant-radius-card
--grant-font-size-title
```

Layout and interaction rules remain with the component. A theme may change
color, typography, radii, borders, and elevation; it may not change information
architecture, visibility, focus behavior, or tool calls.

Every visual role has an explicit foreground/background pairing:

- text on surface;
- muted text on surface and subtle surface;
- accent text on surface;
- on-accent text on accent;
- danger text on danger surface;
- border against surface;
- focus indicator against surface and adjacent control backgrounds.

Theme stylesheets contain only custom-property declarations under preset and
scheme selectors. They contain no layout, `display`, `visibility`, interaction,
pseudo-element `content`, or component-specific rules. Components never use
host variables directly.

### 2. Support two explicit presets

The supported presets are:

- `common-grants` — the default, based on the public CommonGrants visual
  language: restrained green accent, neutral surfaces, compact type, and modest
  rounding;
- `host-neutral` — consumes host semantic CSS variables when available and
  supplies conservative fallbacks.

Unknown configuration values resolve to `common-grants`. The preset list and
resolver are pure, tested code.

The default establishes a product decision without hard-coding product names,
organization names, or logos into the rendered app.

The host-neutral preset uses an explicit allowlist:

```text
--color-text-primary
--color-text-secondary
--color-text-link
--color-background-primary
--color-background-secondary
--color-border-primary
```

Allowlisted host values map only into internal `--grant-*` tokens. Every token
has a complete app-owned fallback, including roles for which no host variable
exists. Environment configuration cannot supply arbitrary CSS values.

The app guarantees contrast for app-owned preset values, host-neutral
fallbacks, and tested representative host-variable fixtures. A host that
overrides allowlisted values is responsible for satisfying the documented
contrast contract.

### 3. Keep product theme and host color scheme orthogonal

The selected preset is represented by `data-visual-theme` on the pure app root.
The host adapter independently normalizes the host signal to `light | dark` and
passes it as the existing scheme state. The root always carries both dimensions.

Each preset defines light and dark semantic values. Theme selection does not
override or infer the host's color-scheme decision. The CSS `color-scheme`
property matches the normalized host scheme.

### 4. Localize build-time configuration

One Skybridge-specific module,
`src/app/hosts/skybridge/theme-config.ts`, is the sole reader of one build-time
setting:

```text
VITE_GRANT_VISUAL_THEME=common-grants|host-neutral
```

It passes the unknown setting to a host-neutral resolver in `src/app/theme/`.
The resolver accepts `unknown`, recognizes only the two enum values, and knows
nothing about Vite or environment variables. The adapter passes the resolved
value to loading, error, shortlist, and detail roots as ordinary data.
Components do not read `import.meta.env`, Skybridge hooks, or global host APIs.

`VITE_GRANT_VISUAL_THEME` is public build metadata and must never contain
secrets. Future hosts obtain and pass the same resolved preset through their own
adapter.

The default works without configuration. Self-hosters may select
`host-neutral` without changing source.

### 5. Preserve the app/host replacement boundary

Theme modules contain no Skybridge imports. The pure component contract accepts
the resolved preset, so a future MCP App host can select a theme by any
mechanism.

The thin `src/views/` Skybridge scanner shim remains behavior-free.

### 6. Treat visual work as a regression-sensitive change

Tests verify:

- resolver defaults and supported values;
- the selected preset reaches the pure app root;
- light/dark and theme attributes coexist;
- equivalent renders preserve text, roles, information hierarchy, callbacks,
  and visible sections across presets;
- list/detail navigation, focus restoration, show-more, persistence, loading,
  and error behavior pass under both presets;
- theme CSS contains no pseudo-element `content` or behavior/layout rules.

Automated contrast checks require WCAG AA:

- at least 4.5:1 for normal text;
- at least 3:1 for large text, controls, state-bearing borders, and focus
  indicators where applicable.

They cover text, muted text, error text, accent text, button
foreground/background, borders, and focus indicators for both presets in light
and dark mode. Host-neutral checks cover its complete fallback palette and
representative supported host-variable fixtures.

Because the preset is build-time configuration, preview validation uses two
separate builds or deployments—one per preset—at narrow and wide widths.

## Alternatives considered

- **Hard-code CommonGrants values in component CSS.** Rejected because it makes
  neutral reuse and future restyling expensive.
- **Use host variables only.** Rejected because the hosted product needs a
  deliberate default and host variable availability is inconsistent.
- **Runtime user-facing theme picker.** Rejected because theme is a deployment
  decision, not an end-user workflow for this prototype.
- **Separate component stylesheets per preset.** Rejected because duplicated
  layout rules would drift.
- **Add logos or organization names per theme.** Rejected because this decision
  concerns visual language, not product identity content.

## Consequences

### Positive

- One component implementation supports branded and neutral deployments.
- Host light/dark behavior remains authoritative.
- Visual decisions become explicit and reviewable.
- Skybridge can be replaced without rewriting the theme system.
- Future palettes can be added by defining tokens rather than copying layout
  CSS.

### Costs

- Component CSS gains a semantic-token vocabulary.
- Build-time preset changes require a rebuild/deploy.
- The project owns contrast checks for each supported preset and color scheme.
- Arbitrary conforming host overrides cannot be exhaustively contrast-tested by
  this repository.

## Acceptance criteria

- `common-grants` is the default; `host-neutral` is an explicit alternative.
- Unknown configuration fails safely to the default.
- No logo, company name, or product name is injected by theme selection.
- Components contain no environment or Skybridge access.
- Only `src/app/hosts/skybridge/theme-config.ts` reads
  `VITE_GRANT_VISUAL_THEME`; the value is public metadata, never a secret.
- Theme changes affect presentation only, not data, tool contracts, state, or
  interaction behavior.
- Equivalent preset renders have identical text, roles, hierarchy, callbacks,
  and visible sections.
- Theme CSS declares tokens only and cannot inject content or behavior.
- Both presets support host light and dark schemes.
- Separate CommonGrants and host-neutral builds pass narrow and wide preview
  checks without clipping or overflow.
- WCAG AA contrast checks pass for app-owned palettes and representative
  allowlisted host-variable fixtures.
- `SPEC.md` describes this as a configurable prototype visual system and
  CommonGrants-inspired default, not finalized product identity.
- The full functional suite passes under both presets.
- Architecture and implementation reviews have no unresolved findings before
  merge.
