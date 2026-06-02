# Hill Chart — 插件到桌面端核心流程稳定化
**Updated**: 2026-06-01
**Session**: 01

## Scopes
  ✓ 桌面端读懂需求并保留数量 — Done (tests passing, wired into import)
  ✓ 桌面端按数量校验素材 — Done (quantity shortages return missing results)
  ~ 创建目录后直接进入工作区 — Cut after testing (created output folders polluted the upload-material list)
  ✓ 插件导出可信 JSON — Done (schema v1, metadata, warnings, safe filename)

## Risk
No remaining must-have risk. Plugin runtime still needs manual browser smoke testing on the real target page.

## Next
Run real-page plugin extraction and desktop import smoke test, then ship.
