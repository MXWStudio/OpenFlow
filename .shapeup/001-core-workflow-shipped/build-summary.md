# Build Summary — 插件到桌面端核心流程稳定化

**Feature ID**: 001-core-workflow  
**Build sessions**: 1  
**Date completed**: 2026-06-01
**Status**: Shipped — 2026-06-01

## What Was Built

- Desktop now normalizes `openflow.requirements.v1`, current Chinese-key plugin JSON, and old `{ projectName, sizes }` JSON through one parser.
- Required quantities are preserved from JSON and carried through renderer/preload/main process validation.
- Validation now reports `missing` rows when a resolution has fewer valid assets than required.
- Folder creation returns created project paths, but the renderer does not auto-add generated output folders to the upload-material workspace after real-use testing showed that polluted the material list.
- Project folder names and rename template variables are sanitized before filesystem writes.
- Plugin JSON export now emits `schemaVersion`, source metadata, extracted time, warnings, and `projects[]`.
- Plugin preview distinguishes restored cached data from fresh extraction and warns about missing dimensions or quantities.
- Plugin JSON download filenames are sanitized.
- Follow-up UX fixes from real testing:
  - Creating today's project folders no longer auto-adds generated output folders to the upload-material list.
  - Missing quantity rows now show the actual gap (`缺 N 张`, `需要 X / 已有 Y`).
  - Quantity-only shortages no longer block renaming of already valid assets.
  - Single-project manual size selection can supplement JSON requirements when the plugin under-extracts a size.

## What Was Cut (Scope Hammering)

- Direct plugin-to-desktop communication: kept out of scope to avoid native messaging/protocol setup.
- Full DOM scraper rewrite: kept existing scraper and added guardrails.
- Cross-repo shared package: duplicated small normalizer helpers in plugin JS for now.
- Excel template redesign: JSON export changed; Excel remains on the existing path.
- Deleting `OpenFlow-Plugin/openflow-desktop`: explicitly out of scope.
- Auto-adding newly created output folders to the upload-material list: removed after real testing because it created noisy folders the user then had to clear manually.

## Files Changed

- `src/main/requirements.ts`
- `src/main/requirements.test.ts`
- `src/main/index.ts`
- `src/preload/index.ts`
- `src/renderer/src/App.tsx`
- `src/renderer/src/appState.ts`
- `src/renderer/src/StatusBadge.tsx`
- `src/renderer/src/views/DailyWorkspace.tsx`
- `src/renderer/src/types/electron.d.ts`
- `/Users/neo/Documents/Projects/OpenFlow-Plugin/popup.js`
- `/Users/neo/Documents/Projects/OpenFlow-Plugin/content.js`
- `.shapeup/001-core-workflow-building/*`

## What Surprised Us

- Node's built-in test runner can run the existing `.ts` tests directly, with only a module-type warning.
- The desktop had enough existing hooks to avoid new transport work; the main risk was preserving quantities through the existing selected-size flow.
- `OpenFlow-Plugin` being outside the current writable root required an explicit write approval, but no new plugin/dialog workflow was needed.
