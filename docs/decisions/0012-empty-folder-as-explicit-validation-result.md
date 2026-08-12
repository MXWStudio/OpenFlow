# ADR 0012: Empty Folder as Explicit Validation Result

**Status**: Accepted
**Date**: 2026-06-11
**Feature**: 005 - guided-daily-workflow

## Context

When a material folder contained no media files, the old validation pipeline still generated
one missing row per target size. The UI then showed several `缺 1 张` rows, even though the
user's actual problem was simpler: the selected folder had no files to validate.

The renderer already had a validation presentation model from feature 002, but it could not
reliably infer an empty folder from multiple generic missing rows.

## Decision

Emit one virtual validation row from `fs:startValidation` when `collectMediaFiles()` returns
an empty file list:

- `status: "missing"`
- `targetSize: "缺失文件"`
- `missingKind: "empty_folder"`
- `missingCount` equal to the total required quantity, or `1` without targets
- `error: "素材目录内没有可校验文件"`

The renderer presentation summary tracks `emptyFolderCount`, prioritizes empty-folder rows
before ordinary quantity shortages, and renders the user-facing copy as `缺失文件` /
`素材目录为空，请添加素材后重验`.

## Rationale

Main-process validation is the only layer that knows whether no media files were collected
before quantity shortages are calculated. Making this state explicit avoids fragile renderer
guessing and keeps the detail table focused on the user's next action.

The row remains a `missing` warning, so it preserves the established rule that missing issues
do not block renaming valid files when valid files exist elsewhere.

## Alternatives Considered

- **Infer empty folders in the renderer**: Avoids IPC shape change, but would depend on row
  counts and target sizes rather than direct scan evidence.
- **Add a new top-level validation status outside rows**: More explicit globally, but would
  complicate grouping by folder and table rendering.
- **Keep per-size missing rows and change only copy**: Still noisy and still makes the user
  inspect requirement sizes before learning the folder has no files.

## Consequences

**Positive**:

- Empty material folders produce one clear feedback item.
- Status badges, notifications, and detail rows can prioritize "missing files" over quantity math.
- The behavior is covered by presentation tests.

**Negative / Trade-offs**:

- `ValidationResult` gains a display-oriented discriminator, `missingKind`.
- Non-empty folders containing only unsupported non-media files follow the same empty media
  path for now.

**Future considerations**:

- If users need a distinction between truly empty folders and folders containing unsupported
  files only, extend `missingKind` with another explicit value.
- If validation statuses become shared across main and renderer, move the taxonomy into a
  shared module.
