# Scope: 桌面端读懂需求并保留数量

## Hill Position
✓ Done — desktop imports normalize new and legacy JSON while keeping required quantities.

## Must-Haves
- [x] Parse `openflow.requirements.v1` JSON into desktop project requirements.
- [x] Parse existing plugin Chinese-key JSON arrays without losing `所需数量`.
- [x] Parse old `{ projectName, sizes }` objects with backward-compatible default quantity.
- [x] Surface parser warnings to the renderer instead of silently dropping malformed rows.
- [x] Update renderer/preload types so project requirements can carry quantities.

## Nice-to-Haves (~)
- [ ] ~ Move all requirement parsing out of `src/main/index.ts` if it stays small enough to avoid broad refactor.

## Notes
Implemented in `src/main/requirements.ts`, covered by `src/main/requirements.test.ts`, and wired through `dialog:openJson`.
