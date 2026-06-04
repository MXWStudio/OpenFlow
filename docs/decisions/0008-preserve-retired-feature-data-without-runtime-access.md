# ADR 0008: Preserve Retired Feature Data Without Runtime Access

**Status**: Accepted
**Date**: 2026-06-03
**Feature**: 004 — cut-secondary-features

## Context

The retired data table and game library features had written local SQLite records, Excel
backups, game dictionary images, and configuration keys. Removing the feature code raised
a data-handling decision: delete old data, migrate/export it, or leave it in place.

The frame's goal was reducing product and maintenance surface, not performing a destructive
cleanup or a migration project.

## Decision

Leave old retired-feature data on disk and old config keys in config storage, but remove
the runtime paths that read or write them.

Feature 004 removed SQLite handlers, Excel import/cleanup handlers, game image save paths,
AI/image/data settings reads, and related preload/type surfaces. It did not delete existing
SQLite files, imported Excel backups, game dictionary images, or old config keys such as
`apiKeys`, `screenshotSettings`, `dataStatsSettings`, `screenshotShortcut`, or `aiImage`
templates.

## Rationale

Deleting user data would be riskier than the product cleanup itself. Exporting or migrating
old data would add a new workflow to a feature whose point was to reduce scope. Leaving data
in place is the safest reversible choice while still achieving the main maintenance goal:
the current app no longer depends on those data paths.

The app must tolerate stale config keys during startup by ignoring them rather than trying
to coerce them into current state.

## Alternatives Considered

- **Delete old data automatically**: Cleanest disk state, but too destructive for production user machines.
- **Build a migration/export panel**: User-friendly for some cases, but adds a new feature outside the appetite.
- **Keep read-only viewers for retired data**: Reduces anxiety about old records, but keeps product surface and dependencies alive.

## Consequences

**Positive**:

- No destructive cleanup is performed on user machines.
- The retired runtime and dependency surface can still be removed.
- Future recovery remains possible from files already left on disk.

**Negative / Trade-offs**:

- Old files may remain in user data directories even though the app no longer exposes them.
- Users who relied on the old data table or game library need an explicit future export/recovery feature if that data matters.

**Future considerations**:

- If users ask for old records, shape a one-time export/recovery utility rather than restoring the retired runtime.
- Document any future destructive cleanup as a separate, opt-in maintenance feature.
