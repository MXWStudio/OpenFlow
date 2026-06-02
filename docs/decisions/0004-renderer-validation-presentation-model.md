# ADR 0004: Renderer Validation Presentation Model

**Status**: Accepted  
**Date**: 2026-06-02  
**Feature**: 002 — validation-details

## Context

Validation originally returned a flat list of file rows. That list was technically complete,
but it forced the user to inspect many passed rows before finding the actual next action.
After 001, the underlying validation data already carried enough information to distinguish
valid files, quantity shortages, read failures, and dimension mismatches.

The 002 frame required better prioritization without rewriting the validation algorithm,
plugin scraper, or IPC contract.

## Decision

Create a renderer-side validation presentation model in
`src/renderer/src/validationPresentation.ts`. It transforms `ValidationResult[]` into
grouped, counted, and action-prioritized presentation data before `DailyWorkspace` renders it.

The model classifies rows into:

- **blocking**: true file quality issues such as wrong dimensions or unreadable files
- **missing**: virtual quantity gaps, shown as warnings and exact counts
- **extra**: files whose actual size matches their size folder but whose size is not required by the JSON
- **passed**: valid files that can be renamed

The UI renders action rows first and collapses passed rows behind a `查看已通过 N 项` affordance.

## Rationale

The renderer already receives every field needed for this presentation decision:
`status`, `actualWidth`, `actualHeight`, `folderName`, `requiredQuantity`,
`actualQuantity`, `missingCount`, and `workspaceProjectName`.

Keeping classification in a pure renderer helper makes the behavior easy to test and avoids
turning `DailyWorkspace.tsx` into a larger rule engine. It also protects 001's main-process
validation contract from churn while still improving the user-facing workflow.

## Alternatives Considered

- **Change `fs:startValidation` to emit more statuses**: More explicit, but it would expand the IPC contract and main-process algorithm for a display problem.
- **Keep sorting and copy rules inline in `DailyWorkspace`**: Faster initially, but the view was already large and would be harder to test.
- **Hide passed rows entirely**: Reduces noise but removes useful traceability when the user needs to inspect what will be renamed.

## Consequences

**Positive**:

- Validation details now answer "what needs action?" before showing long file lists.
- Row classification and copy have focused unit coverage.
- Extra non-required size folders no longer masquerade as hard blockers.

**Negative / Trade-offs**:

- The renderer now owns part of validation semantics for display and rename gating.
- If future validation statuses are added in main, this presentation model must be updated.

**Future considerations**:

- If validation grows beyond display classification, consider moving shared status taxonomy into a shared module used by both main and renderer.
- The left size selector still mixes requirement sizes and detected workspace sizes; a future frame could separate those concepts visually.
