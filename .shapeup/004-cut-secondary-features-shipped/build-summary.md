# Build Summary — 次要功能砍范围

**Feature ID**: 004-cut-secondary-features
**Completed**: 2026-06-03

## Shipped Changes

- Removed AI识图, 表格, and 库 from the renderer route union, left navigation, and workspace render branches.
- Rebuilt Settings around retained core configuration only: 常规, 账户, 工作区, 命名模板, 快捷键, 处理引擎, 关于.
- Removed screenshot/pin renderer entries, views, Vite inputs, preload APIs, main-process windows, IPC handlers, tray items, and shortcut registration.
- Removed Excel/data table, AI image rename, and game library IPC/preload/type surfaces.
- Removed the organizer card action that wrote images into 游戏库.
- Removed retired source files and package dependencies for AI SDK, data table/charting, screenshot canvas, SQLite, and Excel parsing.

## Preserved Core Flow

- Daily JSON requirement import.
- Folder creation.
- Material folder add/remove/drop.
- Size and quantity validation.
- Trash invalid validation files.
- Batch rename.
- Organizer scan, execute, undo, and open path.
- Format processing.
- Existing user data on disk and old config keys.

## Verification

- `node --test src/renderer/src/featureRetirement.test.ts`
- `npm run lint`
- `node --test src/main/requirements.test.ts src/renderer/src/validationPresentation.test.ts src/renderer/src/utils.test.ts src/renderer/src/theme.test.ts src/renderer/src/featureRetirement.test.ts`
- `npx electron-vite build`
- `git diff --check`

## Notes

Old SQLite files, Excel backups, game library images, and retired config keys are intentionally left in place. The app no longer reads or writes those retired capabilities.
