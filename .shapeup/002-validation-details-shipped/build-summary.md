# Build Summary — 校验详情降噪与异常优先

**Feature ID**: 002-validation-details  
**Build sessions**: 1  
**Date completed**: 2026-06-02

## What Was Built

- Added a renderer-side validation presentation model that groups results by project/folder.
- Sorted validation details by action priority: blocking issues first, quantity shortages next, passed files last.
- Added exact summary counts for blocking issues, missing rows, total missing assets, and passed assets.
- Updated the material details card to show a compact overall summary.
- Updated each project group header to show blocking, missing, and passed counts.
- Changed details toggle copy from always saying `隐藏详情` to `查看详情` / `收起详情`.
- Hid passed files behind an explicit `查看已通过 N 项` control so they no longer bury issues.
- Kept missing-only validation non-blocking and surfaced `可先重命名已有素材`.
- Distinguished extra non-required size folders from true size errors. If a file's real size matches its size folder but that size is not required by the JSON, it is now shown as `非需求` and skipped instead of blocking rename.
- Replaced misleading size-error copy that pointed users to the left size selector. True size errors now explain the actual cause, such as `目标 1080*607，实际 900*614`.
- Renamed the detail column to `原因 / 建议` and the mismatch status to `尺寸错误`.
- Added an inline `移到废纸篓` action for actionable bad/extra files in validation details. Missing quantity rows and passed files do not show this destructive action.
- Added `fs:trashFile` IPC using Electron's system trash instead of permanent deletion.
- Slightly muted passed status badges when shown in the expanded passed-file list.

## What Was Cut (Scope Hammering)

- No scope was cut. The package stayed inside the renderer display layer.

## Files Changed

- `src/renderer/src/validationPresentation.ts`
- `src/renderer/src/validationPresentation.test.ts`
- `src/renderer/src/views/DailyWorkspace.tsx`
- `src/renderer/src/StatusBadge.tsx`
- `src/renderer/src/App.tsx`
- `src/preload/index.ts`
- `src/renderer/src/types/electron.d.ts`
- `src/main/index.ts`
- `.shapeup/002-validation-details-building/hillchart.md`
- `.shapeup/002-validation-details-building/scopes/scope-validation-details-next-action.md`

## Verification

- `node --test src/renderer/src/validationPresentation.test.ts`
- `node --test src/renderer/src/validationPresentation.test.ts src/renderer/src/utils.test.ts`
- `npm run lint`
- Added regression coverage for extra size folders such as `1080x607`.
- Added regression coverage for true size-error explanations that do not mention the left size selector.
- Added regression coverage for which validation rows may expose the trash action.
- Current Electron window sanity check: default `素材详情` area renders, details toggle shows `查看详情`, and no new top-right action button was introduced.

## What Surprised Us

- The existing 001 data model already had all the fields 002 needed, so no main-process IPC or plugin changes were necessary.
- The biggest improvement came from changing display hierarchy rather than adding more validation logic.
