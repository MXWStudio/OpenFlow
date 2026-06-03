# Decisions Made — Night Dark Theme Alignment

**Feature ID**: 003-dark-theme-alignment
**Shipped**: 2026-06-03
**Appetite**: Small Batch (1 session)
**Actual effort**: 1 build session plus ship archival

## Key Architectural Decisions

- **Separate stored theme preference from rendered color scheme**: `auto` remains a saved preference, while components use resolved `light` or `dark` state for visual branches.
- **Keep Mantine as the runtime theme authority**: The build uses Mantine's computed color scheme instead of adding a parallel theme manager.
- **Constrain the visual fix to named surfaces**: The sidebar and organizer first screen were aligned without changing scan, organize, undo, validation, rename, settings persistence, or IPC behavior.
- **Use deterministic helper tests for the local resolution model**: Runtime OS subscription is left to Mantine, while local helper behavior is covered by `node:test`.

## What Was Cut (Scope Hammering)

- **Full application dark-mode polish**: Cut because the frame targeted visible launch/night inconsistencies, not a full design-system pass.
- **New theme preference values or controls**: Cut because existing `light | dark | auto` settings already express the product need.
- **Top-right theme controls**: Cut to follow the project UI guideline and because no new user-facing control was required.

## What Surprised Us

- **The underlying issue was semantic, not a missing dark palette**: Mantine already resolves `auto`; the bug came from component branches reading the raw stored preference.
- **Organizer needed visual restraint more than new layout**: Replacing the light-looking status gradient and aligning local surfaces fixed the main split without reworking workflow structure.

## Future Improvement Areas

- **Shared surface tokens**: If more pages need theme cleanup, extract reusable shell/page surface names instead of adding per-screen constants.
- **Low-frequency page audit**: Other pages may still have hand-written colors, but they should be framed separately if users notice them.
- **Global background cleanup**: Fixed body/global background CSS can be revisited if it becomes visible outside the current full-height shell.
