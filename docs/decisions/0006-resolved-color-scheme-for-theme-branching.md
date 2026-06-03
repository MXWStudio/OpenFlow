# ADR 0006: Resolved Color Scheme for Theme Branching

**Status**: Accepted
**Date**: 2026-06-03
**Feature**: 003 — dark-theme-alignment

## Context

OpenFlow stores the appearance preference as `light`, `dark`, or `auto`. The default
expectation is follow-system, but several renderer components compared the stored value
directly with `dark`. When the stored value was `auto`, those components fell through to
light-mode styling even while Mantine and the OS had resolved the app to dark mode.

This showed up most visibly in the global sidebar and the organizer first screen.

## Decision

Renderer components that need light/dark presentation branches must use Mantine's resolved
color scheme rather than the raw stored preference. The stored preference remains the
settings value; the resolved scheme is the rendering input.

For deterministic tests and readable local checks, feature 003 introduced a small
`src/renderer/src/theme.ts` helper that models `auto` resolution and dark-scheme detection.

## Rationale

The stored preference and rendered color scheme answer different questions. `auto` is a
valid preference, but it is not a concrete visual state. Component styling needs a concrete
state so that follow-system dark behaves the same as fixed dark.

Using Mantine's resolved scheme keeps the implementation aligned with the provider's
existing system-color handling instead of introducing a parallel global theme manager.

## Alternatives Considered

- **Continue checking the raw stored preference**: This preserves the bug because `auto`
  is neither `dark` nor `light`.
- **Add a new night-mode setting**: Out of scope and duplicates the existing
  follow-system preference.
- **Patch global CSS for the affected surfaces**: Faster locally, but it hides the
  underlying distinction between preference and rendered theme.

## Consequences

**Positive**:

- Follow-system dark and fixed dark now share the same component-level dark branches.
- Future renderer components have a clear pattern for theme-dependent styling.
- The existing settings model stays unchanged.

**Negative / Trade-offs**:

- Components that need theme branches must import/use resolved theme state explicitly.
- The tiny helper tests the resolution model, while runtime OS subscription remains owned
  by Mantine.

**Future considerations**:

- If more screens need the same surface palette, extract shared shell/page surface tokens
  rather than adding many independent local constants.
