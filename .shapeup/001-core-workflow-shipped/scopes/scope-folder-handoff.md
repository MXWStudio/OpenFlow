# Scope: 创建目录后直接进入工作区

## Hill Position
✓ Done — created project folders are returned and added to the workspace.

## Must-Haves
- [x] Return created project paths from `fs:initFolders`.
- [x] Add created project paths to the workspace after successful folder creation.
- [x] Sanitize project directory names before creating folders.

## Nice-to-Haves (~)
- [ ] ~ Persist the last chosen destination folder for the next creation.

## Notes
This reduces one repeated manual step after importing a需求表.
