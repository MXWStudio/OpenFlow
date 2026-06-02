# Scope: 插件导出可信 JSON

## Hill Position
✓ Done — plugin export now includes schema metadata, warnings, and safer filenames.

## Must-Haves
- [x] Export `openflow.requirements.v1` JSON with metadata and `projects[]`.
- [x] Keep legacy Chinese fields during transition so current desktop imports still work.
- [x] Add extraction metadata and warnings for empty dimensions or missing quantities.
- [x] Make restored cached data visibly distinguishable from a fresh extraction.
- [x] Sanitize JSON download file names.

## Nice-to-Haves (~)
- [ ] ~ Reuse the same normalized project builder for Excel export.

## Notes
Touched only `OpenFlow-Plugin/popup.js` and `OpenFlow-Plugin/content.js`; `OpenFlow-Plugin/openflow-desktop` remains untouched.
