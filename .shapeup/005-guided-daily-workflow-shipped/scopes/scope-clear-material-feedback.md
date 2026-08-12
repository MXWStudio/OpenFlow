# Scope: Clear Material Feedback

## Hill Position
✓ Done — empty-folder result semantics and size-state separation are implemented and tested.

## Must-Haves
- [x] Split requirement sizes, detected folder sizes, and manual fallback target sizes.
- [x] Stop JSON import from toggling size preview as feedback.
- [x] Keep validation targets driven by matching JSON requirements when available.
- [x] Emit one explicit empty-folder validation issue instead of per-size missing rows.
- [x] Preserve rename gating: missing and extra issues do not block valid-file rename, true blocking issues still block.
- [x] Cover empty-folder and feedback priority behavior with tests.

## Nice-to-Haves (~)
- [ ] ~ Add more detailed copy for folders that contain non-media files only.

## Notes
The old `selectedSizes` mixed three meanings. Build should remove that ambiguity without changing JSON parsing or the true blocking rules.

## Build Notes
- Empty uploaded folders now produce one `缺失文件` row with `missingKind: empty_folder`.
- Validation presentation and status badges prioritize empty folders before quantity shortage copy.
