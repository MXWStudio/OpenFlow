# Scope: 桌面端按数量校验素材

## Hill Position
✓ Done — validation compares actual media counts against required quantities.

## Must-Haves
- [x] Pass requirement quantities from renderer to `fs:startValidation`.
- [x] Count valid files per normalized resolution.
- [x] Return missing results when actual count is below required quantity.
- [x] Preserve old behavior for imports that only provide sizes.
- [x] Keep rename blocked until quantity-related missing results are resolved.

## Nice-to-Haves (~)
- [ ] ~ Show missing count as a single summarized row instead of one row per missing asset.

## Notes
Stayed close to existing `ValidationResult[]`; quantity shortages use `missing` status and therefore keep rename blocked.
