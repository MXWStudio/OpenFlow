# ADR 0005: Validation Cleanup Uses System Trash

**Status**: Accepted  
**Date**: 2026-06-02  
**Feature**: 002 — validation-details

## Context

Once validation details became action-oriented, the user wanted to fix obvious bad rows
without leaving the table. The most common case is a real file that is either a true size
error or a non-required extra asset. Missing quantity rows are not files, and passed files
should not expose destructive controls.

Deleting media files is risky because OpenFlow is used on real production folders.

## Decision

Expose an inline `移到废纸篓` action only for actionable validation rows with a real file path:
blocking file rows and extra non-required file rows. Passed rows and virtual `missing` rows
do not show the action.

The renderer calls a scoped `fs:trashFile` IPC. The main process validates that the path
exists and is a file, then uses Electron's `shell.trashItem()` to move it to the system trash.
It does not permanently delete files.

## Rationale

Using the system trash gives the user a recovery path while still reducing workflow friction.
Scoping the action to single validation rows avoids bulk destructive behavior and keeps the
button tied to an obvious problem row.

The IPC is deliberately small: one file path in, `{ success, error? }` out. This avoids
giving the renderer a broad filesystem deletion capability.

## Alternatives Considered

- **Permanent delete**: Faster, but too risky for production media folders.
- **Bulk delete all bad rows**: Efficient but too easy to remove more than intended.
- **Open folder and let the user delete manually**: Safer but does not reduce the workflow steps that 002 is meant to shorten.

## Consequences

**Positive**:

- Users can resolve bad/extra assets directly from validation details.
- File removal is recoverable through the OS trash.
- Missing and passed rows remain protected from accidental deletion.

**Negative / Trade-offs**:

- The main and preload process must be restarted in development when this IPC changes; renderer hot reload alone is not enough.
- Moving to trash can fail because of OS permissions, locked files, or files on unusual volumes.

**Future considerations**:

- Add a confirmation step only if user testing shows accidental clicks.
- Consider a "re-run validation after cleanup" shortcut if users repeatedly remove several bad rows.
