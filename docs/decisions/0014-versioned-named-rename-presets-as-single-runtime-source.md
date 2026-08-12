# ADR 0014: Versioned Named Rename Presets as the Single Runtime Source

**Status**: Accepted
**Date**: 2026-07-14
**Feature**: 2026-07-13-robust-custom-renaming — robust custom renaming

## Context

OpenFlow stored the same six rename templates under both `workflow.renameTemplates` and a
top-level `renameTemplates` key. The settings page edited one in-memory copy, while the daily
execution path read the top-level copy again immediately before renaming. A 500ms settings-page
save could also be cancelled when the user left the page. This allowed a visible “手搓命名”
custom text value to differ from the rule that renamed the file.

The product also needed more than six fixed slots: teams need named templates that can be found,
copied, and selected for sudden requirements, with different image and video rules.

## Decision

Introduce the versioned `openflow.rename.v2` model under `workflow.renameSettings`:

- A `RenamePreset` has a stable ID, user-facing name, `regular | special | custom` kind, and
  separate image/video `RenameRule` values.
- A rule owns ordered stable-ID tokens, separator, date format, and sequence formatting.
- Renderer settings, renderer preview requests, and main-process execution all consume this
  model. Runtime execution never rereads the old top-level key.
- Old six-template data is read only at startup migration and becomes regular, special, and a
  named custom “手搓命名” preset without losing custom text or field order.
- Rule rendering and producer formatting live in the shared domain module so the settings sample,
  daily preview, and executor use the same values.

## Rationale

A single versioned contract removes the state split that caused the original failure while
providing a stable place to extend template management. Startup-only migration preserves existing
users without keeping two live sources of truth. Stable preset and token IDs support editing and
reordering without tying identity to a list position or display name.

## Alternatives Considered

- **Keep the six fixed template keys and repair the save timing**: Smaller change, but still leaves
  duplicate runtime storage and cannot support arbitrary named templates.
- **Keep the top-level key as execution authority**: Preserves old behavior but guarantees renderer
  state and execution can diverge again.
- **Delete old keys during migration**: Cleaner disk state, but unnecessarily destructive if a user
  needs to downgrade or inspect historic configuration.

## Consequences

**Positive**:

- A template visible in settings is the template sent to preview and execution.
- Teams can create and find any number of named custom presets.
- Image and video rules evolve together under one backward-compatible schema.

**Negative / Trade-offs**:

- Legacy template fields remain in stored workflow objects for compatibility, although runtime
  code ignores them after migration.
- Sharing pinyin formatting with the renderer increases the renderer bundle size.

**Future considerations**:

- A future import/export contract should version external preset files independently of the local
  workflow schema.
- If schema v3 is needed, migration should again happen only at the hydration boundary.
