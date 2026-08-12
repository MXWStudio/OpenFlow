# ADR 0013: Guided Daily Workflow Over Draggable Panel Layout

**Status**: Accepted
**Date**: 2026-06-11
**Feature**: 005 - guided-daily-workflow

## Context

The daily page had grown into a draggable two-column panel library containing today's data,
folder creation, size preview, system status, material upload, special naming, quick actions,
and validation details. The layout was flexible, but high-frequency users had to mentally
assemble the order of operations each day.

The user asked for a guided daily flow and the project has a UI constraint to avoid placing
buttons in the application top-right because system notifications can obscure them.

## Decision

Replace the draggable daily panel library with a fixed `DailyWorkspace` flow:

1. Today's requirement context.
2. Directory creation.
3. Material upload and folder list.
4. Validation feedback and detail expansion.
5. Rename actions.

Special/manual naming controls remain in the daily flow near the processing steps. Settings
and history stay available as secondary controls away from the application top-right. The old
layout config keys are tolerated but no longer drive visible daily layout.

After removing all imports and runtime references, remove the `@hello-pangea/dnd` dependency.

## Rationale

The daily workflow is operational and repetitive, so fixed ordering reduces decision overhead
more than per-user panel rearrangement helps. Removing drag/drop also reduces renderer
dependency surface and eliminates layout state that no longer represents product value.

Keeping this change limited to `DailyWorkspace` respects the appetite and avoids a full app
shell redesign.

## Alternatives Considered

- **Keep drag/drop and ship a default layout reset**: Less code churn, but still exposes the
  panel-library concept that the user found cumbersome.
- **Move to a full wizard with hard step locks**: Stronger guidance, but too rigid for users
  who need to revalidate, add folders, or rename partial valid assets.
- **Redesign the entire app shell**: Could unify navigation, but outside 005 and unnecessary
  for the daily workflow problem.

## Consequences

**Positive**:

- The daily page now reflects the actual work sequence.
- Size and validation feedback sit in the same flow instead of competing panels.
- The unused DnD dependency is removed from the package tree.

**Negative / Trade-offs**:

- Users can no longer rearrange the daily page panels.
- Old `dailyLayoutLeft` and `dailyLayoutRight` config values may remain in config storage as
  ignored legacy data.

**Future considerations**:

- If future user testing needs personalization, add small scoped preferences for the guided
  flow instead of restoring general drag/drop.
- Keep critical workflow buttons away from top-right placements in future daily-page changes.
