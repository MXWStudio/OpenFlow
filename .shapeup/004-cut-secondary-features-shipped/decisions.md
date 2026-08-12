# Decisions Made — 次要功能砍范围

**Feature ID**: 004-cut-secondary-features
**Shipped**: 2026-06-03
**Appetite**: Medium Batch
**Actual effort**: 1 build session plus ship archival

## Key Architectural Decisions

- **Retire by deleting runtime surfaces, not only UI entries**: The feature removed routes, settings, renderer files, preload APIs, main IPC handlers, tray/shortcut paths, Vite inputs, and unused dependencies so product focus and runtime surface match.
- **Preserve old user data while removing access paths**: Old SQLite files, Excel backups, game dictionary images, and retired config keys stay on disk; the app no longer reads or writes them.
- **Use static contract tests for deletion safety**: `featureRetirement.test.ts` proves retained core workflow IPC/preload surfaces remain and retired surfaces/files/dependencies are absent.

## What Was Cut (Scope Hammering)

- **Retired tool recovery/export UI**: Out of appetite because the goal was surface reduction, not adding a new migration workflow.
- **A smoke helper listing retained app views from one source of truth**: Nice-to-have left for later; existing static contract, TypeScript, node tests, and build verification were enough for this cut.
- **Destructive cleanup of old data**: Explicitly rejected because it would risk user data for little product value.

## What Surprised Us

- **The screenshot feature was wider than its visible UI**: It owned independent HTML entries, renderer entrypoints, BrowserWindows, preload APIs, IPC channels, tray items, shortcuts, and canvas dependencies.
- **The side table and library shared more runtime cost than their navigation suggested**: Removing them required database, Excel, game-image storage, dependencies, and organizer side-action cleanup.
- **The safest build path was a contract test first**: Once retained IPC and retired surfaces were encoded, broad deletion became much less risky.

## Future Improvement Areas

- **Optional old-data export**: Shape separately only if users request access to old data table or game library records.
- **Retained workflow smoke automation**: Add runtime smoke tests for daily import, validation, rename, organizer, and format processing if the app grows more deletion/refactor work.
- **Main process modularization**: `src/main/index.ts` is smaller after 004 but still owns many IPC concerns; future work could extract retained workflow handlers by domain.
