# ADR 0017: Bounded Field Customization and Explicit Fallback

**Status**: Accepted
**Date**: 2026-07-14
**Feature**: 2026-07-13-robust-custom-renaming — robust custom renaming

## Context

The user needs highly adaptable naming for sudden channel and delivery requests, but the resulting
rules must remain understandable to a team and safe for batch filesystem changes. An unrestricted
script or regular-expression engine would be more expressive, yet it would be hard to validate,
preview, explain, and support. Likewise, silently switching to regular naming when a custom rule is
invalid would keep the button working at the cost of producing unapproved names.

## Decision

Provide high customization through a bounded visual field model and make degradation explicit:

- Rules are ordered combinations of nine known variable types plus literal custom text.
- Users can add, delete, and move fields; configure separators, three date formats, and sequence
  start/padding/prefix/suffix; and define separate image/video rules.
- Static invalid values and missing runtime variables are preflight blockers with actionable copy.
- Daily mode selection is mutually exclusive: auto, forced regular, forced special, or a named
  custom preset.
- When a custom preset cannot execute, the UI offers “改用常规模板” only when the system regular
  preset is itself valid. The user must choose it; no automatic fallback occurs.
- Searchable named presets, text labels, badges, and semantic colors make the active rule legible
  without relying on color alone or top-right actions.

## Rationale

The field model covers the observed urgent naming requests while keeping every output deterministic
and previewable. Explicit fallback preserves user intent: a blocked batch is recoverable, while a
silently renamed batch can require costly manual repair.

## Alternatives Considered

- **Arbitrary JavaScript or shell snippets**: Maximally expressive but unsafe, difficult to migrate,
  and impossible to validate comprehensively within the appetite.
- **Regular-expression replacement rules**: Useful for renaming existing text, but less suitable for
  composing project, date, resolution, producer, and sequence metadata for a team.
- **Automatic regular fallback**: Keeps execution moving but violates the visible template choice and
  can create a whole batch of unexpected names.
- **Fixed regular/special/manual slots**: Familiar, but does not let teams name, search, and retain
  multiple sudden-use templates.

## Consequences

**Positive**:

- Every supported rule is editable without code and can be fully previewed before mutation.
- Team members can identify the active mode and template by name and category.
- Invalid custom requirements fail loudly and have an intentional recovery path.

**Negative / Trade-offs**:

- Some niche conditional or text-transformation rules remain impossible without manual work.
- Field order uses accessible arrow actions rather than direct drag-and-drop.

**Future considerations**:

- Add new well-defined token types when repeated real requirements justify them.
- Template import/export can be shaped once the local field contract has sufficient production
  history; arbitrary scripts should remain a separate security decision.
