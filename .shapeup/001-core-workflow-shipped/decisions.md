# Decisions Made — 插件到桌面端核心流程稳定化

**Feature ID**: 001-core-workflow  
**Shipped**: 2026-06-01  
**Appetite**: Medium Batch (2-3 sessions)  
**Actual effort**: 1 build session plus real-test follow-up fixes

## Key Architectural Decisions

- **Use a versioned JSON handoff instead of direct plugin-to-desktop communication**: This stabilized the shared data contract without introducing native messaging, custom protocols, or cross-platform setup risk.
- **Normalize requirements in the desktop main process**: JSON import, quantity parsing, safe names, and missing requirement calculation now live behind `src/main/requirements.ts`, giving the app one internal model for new and old files.
- **Treat quantity shortages as warnings, not hard blockers**: Missing rows reveal requirement gaps, but valid assets can still be renamed when there are no mismatches or read errors.
- **Keep generated output folders out of the upload-material list**: Real testing showed that auto-adding created folders created noise and manual cleanup, so the shipped behavior only creates folders and reports success.
- **Sanitize at filesystem/write boundaries**: Project folder names, rename variables, and plugin JSON filenames are cleaned before writes or downloads while preserving Chinese names.

## What Was Cut (Scope Hammering)

- **Direct plugin-to-desktop communication**: Deferred until the JSON contract proves stable.
- **Full DOM scraper rewrite**: Existing scraper remains, with warnings, metadata, and cache guardrails added.
- **Cross-repo shared package**: Deferred because the extension is plain MV3 JavaScript and the desktop app is Electron/TypeScript.
- **Excel template redesign**: JSON export changed; Excel stayed on its existing path.
- **Deleting `OpenFlow-Plugin/openflow-desktop`**: Confirmed obsolete, but deletion stayed outside this package.
- **Auto-adding output folders to upload materials**: Removed after testing because it polluted the material list.

## What Surprised Us

- The existing desktop hooks were enough to stabilize the main workflow without new transport work.
- Node's built-in test runner can run the current TypeScript test files directly, with only a module-type warning.
- The first shorter-handoff idea created the wrong kind of automation: fewer clicks, but more cleanup. That became evidence for 002's focus on reducing UI noise.

## Future Improvement Areas

- **Validation details information architecture**: Already framed as 002 because passed rows currently overwhelm the anomalies users need to act on.
- **Requirement correction**: Users need a small way to handle plugin over-extraction, under-extraction, and intentional partial work.
- **Plugin extraction robustness**: The scraper still depends on target page structure and should eventually get stronger fixtures or page-specific smoke tests.
- **Direct handoff**: Native messaging or protocol handoff may be worth shaping after the file contract is stable and trusted.
