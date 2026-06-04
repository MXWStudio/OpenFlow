# OpenFlow Architecture Notes

This document records architectural patterns and constraints as shipped features accumulate.

## Plugin-to-Desktop Core Workflow Stabilization (2026-06-01)

### Patterns Introduced

- **Versioned file handoff**: The browser extension continues to hand data to the desktop app through downloaded JSON, but the preferred contract is now `schemaVersion: "openflow.requirements.v1"` with source metadata, extraction time, warnings, and normalized `projects[]`.
- **Desktop normalization boundary**: `src/main/requirements.ts` converts v1 JSON, current Chinese-key plugin JSON, and old object formats into one internal requirement shape before renderer or validation logic uses it.
- **Warning-level quantity shortages**: Quantity gaps are represented as `missing` validation rows with `requiredQuantity`, `actualQuantity`, and `missingCount`. They warn the user but do not block renaming already valid assets.
- **Safe filesystem segments at write boundaries**: Directory names, rename template variables, and plugin download filenames are sanitized before filesystem writes or downloads.

### Data Model Changes

- **RequirementProject / RequirementDetail**: Desktop state now carries requirements as project-level sizes with optional quantity, raw metadata, and normalized resolutions.
- **ParsedRequirementJson**: Import results include project lists, warnings, source-derived fields, and backward-compatible aggregate size data.
- **ValidationResult**: Validation rows now support `missing` status plus quantity fields so UI can explain exact gaps.

### API Changes

- **`dialog:openJson`**: Returns normalized requirement data and warnings instead of only loosely parsed project/size information.
- **`fs:startValidation`**: Accepts both legacy size strings and requirement objects with quantities.
- **`fs:initFolders`**: Returns created project paths from the main process, but the renderer does not automatically add generated output folders to the upload-material list.
- **Plugin JSON export**: Emits `openflow.requirements.v1` while preserving legacy Chinese fields during transition.

### Conventions Established

- New plugin-to-desktop data should extend the versioned JSON contract first, not add another ad hoc fallback path.
- Backward compatibility should be handled inside the desktop normalizer so renderer workflows consume one shape.
- Missing quantity is a workflow warning; dimensions/read failures are blocking quality issues.
- Generated output directories are not automatically treated as input material directories.

### Known Limitations

- The plugin still depends on target page DOM classes and text structure; 001 added metadata and warnings but did not rewrite extraction.
- There is no direct plugin-to-desktop transport yet. The current stable handoff is still JSON download plus desktop import.
- The desktop main process file remains large. 001 extracted requirement parsing but did not reorganize all IPC handlers.
- Validation details are still visually noisy when many rows pass. This is framed separately as 002.

## Validation Details As Action Panel (2026-06-02)

### Patterns Introduced

- **Renderer presentation model**: `src/renderer/src/validationPresentation.ts` derives grouped, counted, and sorted presentation data from `ValidationResult[]` before the UI renders it.
- **Action-oriented validation taxonomy**: Validation rows are classified as blocking, missing, extra, or passed so the UI can decide what blocks rename, what warns, what is skipped, and what can be collapsed.
- **Recoverable row cleanup**: Validation details can move bad or extra real files to the system trash through a narrow `fs:trashFile` IPC.

### Data Model Changes

- **Validation presentation summary**: Renderer-only summaries now track blocking count, extra count, missing rows, total missing assets, passed count, and whether passed files can be renamed.
- **Validation row kind**: The renderer derives row kind from existing `ValidationResult` fields without changing the main-process validation return shape.

### API Changes

- **`fs:trashFile`**: Added a small IPC that accepts one file path, verifies it is a file, and moves it to the OS trash through `shell.trashItem()`.

### Conventions Established

- Validation UI should explain the cause and next action, not point users at generic controls such as the left size selector.
- Passed rows should be summarized and collapsible by default when the user is resolving validation issues.
- Destructive file actions should be recoverable and row-scoped unless a future frame explicitly shapes batch cleanup.
- Missing quantity rows are virtual warnings and must not expose file actions.

### Known Limitations

- The left size selector still mixes JSON-required sizes and workspace-detected sizes. This can be shaped separately if it keeps causing confusion.
- Renderer hot reload is not enough when main/preload IPC changes. Electron must be restarted for new IPC such as `fs:trashFile`.
- Moving files to trash can fail because of OS permissions, locked files, or unusual volumes.

## Night Dark Theme Alignment (2026-06-03)

### Patterns Introduced

- **Resolved theme rendering boundary**: Renderer components that branch on light/dark presentation use resolved color scheme state, not the raw saved `light | dark | auto` preference.
- **Focused surface alignment**: Dark-mode fixes stay on the visible shell and page surfaces named by the frame instead of becoming a full app redesign.
- **Theme helper coverage**: Small theme helpers can be covered with deterministic `node:test` cases while Mantine remains responsible for runtime OS color-scheme resolution.

### Data Model Changes

- None. The existing `SystemSettings.theme` values remain `light`, `dark`, and `auto`.

### API Changes

- None. Feature 003 changed renderer presentation only and did not touch IPC contracts.

### Conventions Established

- Use `useComputedColorScheme()` when a renderer component needs concrete visual theme state.
- Keep `useMantineColorScheme()` for reading or updating the user's stored preference.
- Do not add new top-right controls while fixing theme issues; this preserves the project UI guideline about notification overlap.
- Prefer Mantine CSS variables and narrow local constants for themed surfaces before introducing global CSS overrides.

### Known Limitations

- The shipped scope covers the global sidebar and organizer first screen, not every low-frequency page with custom colors.
- Some fixed body/global CSS may still exist outside the full-height app shell; future visual frames should handle those only if they become visible product issues.

## Secondary Tool Retirement (2026-06-03)

### Patterns Introduced

- **Runtime retirement over UI hiding**: Retired tools are removed from renderer routes, settings, preload APIs, main IPC handlers, tray/shortcut paths, Vite entries, and package dependencies instead of being hidden behind dead UI.
- **Preserve data, remove access paths**: Old retired-feature data stays on disk while the current app stops reading and writing those runtime paths.
- **Deletion contract tests**: `src/renderer/src/featureRetirement.test.ts` guards both retained core workflow IPC/preload surfaces and absence of retired feature surfaces.

### Data Model Changes

- **App state defaults**: Removed current-state defaults and types for AI keys, screenshot settings, data stats settings, AI image template tokens, screenshot-specific shortcuts, and screenshot-specific processing fields.
- **Retired storage models**: Removed runtime use of SQLite-backed imported data, Excel files, and game mappings. Existing on-disk files are intentionally left in place.

### API Changes

- **Renderer routes**: App navigation now exposes daily, organizer, format processing, settings, and message center only.
- **Preload API**: Removed `screenshot`, `pin`, `db`, `dialog.importExcel`, `fs.saveImageToLocal`, and `fs.cleanupOldExcels` surfaces.
- **Main IPC**: Removed screenshot/pin IPC, Excel/table IPC, AI image rename IPC, game mapping IPC, game image save IPC, and retired tray/shortcut behavior.
- **Build entries**: Removed screenshot and pin renderer entry points from Electron/Vite build input.
- **Dependencies**: Removed retired-only AI SDK, table/charting, screenshot canvas, SQLite, and Excel parsing packages.

### Conventions Established

- Feature retirement must clean all owned runtime boundaries, not only visible navigation.
- Old user data is not deleted during scope-reduction work unless a separate frame explicitly shapes an opt-in cleanup or export.
- Before pruning dependencies, run static reference checks and keep only dependencies used by retained flows.
- Retained daily, organizer, format, store, shell, and window IPC contracts must remain aligned across main, preload, and ElectronAPI types.
- Do not move removed actions into top-right controls; keep remaining controls in established left-nav and settings patterns.

### Known Limitations

- Old SQLite files, Excel backups, game library images, and retired config keys may remain in user data directories without an in-app viewer.
- `featureRetirement.test.ts` proves contract presence/absence, not full runtime success of every retained workflow.
- `src/main/index.ts` remains a broad main-process module even after retired IPC removal; future work can modularize retained handlers by domain.
