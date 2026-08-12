# ADR 0011: Separate Requirement, Detected, and Manual Size State

**Status**: Accepted
**Date**: 2026-06-11
**Feature**: 005 - guided-daily-workflow

## Context

The previous daily workflow used one `selectedSizes` array for several different meanings:
sizes imported from JSON requirements, sizes detected from local material folders, and sizes
manually selected by the user. That made the size preview look like JSON import feedback and
let folder detection overwrite state that also acted as validation targets.

The user clarified that JSON is system input, while missing, extra, and local material feedback
are user-facing workflow signals. Those meanings needed separate state.

## Decision

Split size state by meaning:

- `requirementSizes` is derived from imported JSON `projectsList` and shown as read-only
  requirement context.
- `detectedFolderSizes` is populated from `fs.readProjectSizes()` after adding folders and
  shown as local material context.
- `manualTargetSizes` is controlled by the user and is used as a fallback validation target
  only when no JSON requirement context is available.

Validation targets are chosen from matching project requirements first, all imported
requirements second, and manual/detected fallback sizes last.

## Rationale

This keeps JSON as the requirement source without letting it masquerade as an interactive
manual selection. It also preserves the no-JSON workflow: a user can still validate against
manual or detected sizes when no requirement JSON has been imported.

The split is local to renderer state and the `DailyWorkspace` contract, so it avoids rewriting
the requirement parser or main-process validation algorithm.

## Alternatives Considered

- **Keep `selectedSizes` and add more labels**: Lower churn, but the same array would still
  carry conflicting meanings.
- **Remove manual size controls entirely**: Simpler UI, but breaks the no-JSON fallback path.
- **Make JSON requirements editable in the daily page**: Could solve some mismatch cases, but
  it is a separate requirements editor outside the 005 appetite.

## Consequences

**Positive**:

- JSON import no longer lights up the manual size preview.
- Future UI can present requirement, detected, and fallback state independently.
- Validation can prefer exact JSON requirement quantities without depending on UI selection state.

**Negative / Trade-offs**:

- `DailyWorkspace` receives more explicit props.
- Multi-project matching still uses the existing folder-name heuristic when more than one
  project exists.

**Future considerations**:

- If multi-project matching remains fragile, shape a dedicated project-to-folder binding flow.
- If manual validation becomes a core flow, it may deserve its own compact mode instead of a
  secondary fallback panel.
