# Scope: 退役运行时能力与依赖

## Hill Position
● Done — Screenshot/pin, Excel table, AI rename, game library APIs, and unused dependencies were removed from runtime manifests.

## Must-Haves
- [x] Remove screenshot/pin BrowserWindow, IPC, tray, shortcut, preload, and Vite entry surfaces.
- [x] Remove Excel/data table and game library IPC/preload/type surfaces.
- [x] Remove AI image rename IPC surface.
- [x] Remove retired dependencies only after static reference checks prove they are unused.
- [x] Preserve old user data on disk; do not delete databases, backups, images, or config keys.

## Nice-to-Haves (~)
- [x] ~ Remove obsolete comments that describe retired APIs.

## Notes
This scope carries the highest risk because it touches shared app boundaries.
