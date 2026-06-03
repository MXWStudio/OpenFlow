# ADR 0007: Retire Secondary Tools by Removing Runtime Surfaces

**Status**: Accepted
**Date**: 2026-06-03
**Feature**: 004 — cut-secondary-features

## Context

OpenFlow's current product value is the daily AIGC production workflow: import requirement
JSON, create folders, add material folders, validate assets, rename, organize, and process
formats. Screenshot/pin tools, the side data table, AI image recognition, and the game
library were outside that core workflow but still existed across navigation, settings,
renderer entries, preload APIs, main-process IPC, tray items, global shortcuts, local
storage, and package dependencies.

Hiding the visible buttons would reduce some UI noise, but it would leave the maintenance
and regression surface in place.

## Decision

Retire the four secondary tool lines by deleting their product and runtime surfaces, not
only hiding their navigation entries.

The build removed:

- AI/data/library routes, imports, and workspace render branches from the renderer shell.
- Screenshot/pin secondary renderer entries and Vite inputs.
- Screenshot/pin BrowserWindows, IPC handlers, tray items, preload APIs, and global shortcut registration.
- Excel/data table, AI image rename, and game library IPC/preload/type surfaces.
- Retired renderer views and dependencies after static reference checks.

The retained runtime surface now centers on the main app window, daily workflow IPC,
organizer IPC, format processing IPC, store/window/shell APIs, and the main-panel toggle
shortcut.

## Rationale

The frame identified product focus and maintenance cost as the core problem. A UI-only
hide would leave the same hidden IPC handlers, dependencies, and independent windows for
future changes to trip over. Removing runtime surfaces makes the app boundary match the
current product boundary.

This also prevents stale or unreachable features from continuing to request shortcuts,
own preload API names, or influence package size.

## Alternatives Considered

- **Hide the nav buttons only**: Faster, but keeps dead runtime and dependency surface alive.
- **Move retired tools behind a debug or experimental entry**: Preserves fallback access but keeps the product and test boundary wide.
- **Extract retired tools into a plugin/module now**: Potentially useful later, but out of the Medium Batch appetite and not needed for current users.

## Consequences

**Positive**:

- The visible app and runtime API now match the daily production focus.
- Future main-flow work has fewer unrelated modules, preload APIs, and dependencies to preserve.
- Retired features cannot still be reached through shortcuts, tray items, or hidden renderer entries.

**Negative / Trade-offs**:

- Reintroducing any retired tool will require a deliberate new feature instead of toggling a hidden route back on.
- There is no in-app path to view old data-table or game-library records after this cut.

**Future considerations**:

- If a retired tool becomes valuable again, shape it as a focused feature with explicit ownership and current workflow fit.
- If plugin-style optional tools become a product direction, revisit the app extension boundary instead of restoring ad hoc side routes.
