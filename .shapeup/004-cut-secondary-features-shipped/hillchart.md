# Hill Chart — 次要功能砍范围
**Updated**: 2026-06-03
**Session**: 01

## Scopes
  ● 基础功能保护门槛 — Done (retained IPC and retired-surface tests pass)
  ● 次要入口从产品表面消失 — Done (nav, settings, renderer views, organizer library action removed)
  ● 退役运行时能力与依赖 — Done (main/preload/type/package surfaces removed and build verified)

## Risk
Resolved for this cut: retained daily JSON import, folder creation, validation, rename, organizer, undo, format processing, and shell open IPC are still covered by static regression checks and TypeScript/build verification.

## Next
Ready for handoff or ship review.
