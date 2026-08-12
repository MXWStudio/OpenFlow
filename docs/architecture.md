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

## Guided Daily Workflow and Same-Day Requirements (2026-06-11)

### Patterns Introduced

- **Same-day requirement session snapshot**: The renderer stores a normalized `dailyRequirementSession` in the existing config store after JSON import. It is restored only when the local date still matches the import date and the snapshot is younger than 24 hours.
- **Meaning-specific size state**: Requirement sizes, detected folder sizes, and manual fallback target sizes are separate concepts. JSON requirements do not drive manual size selection UI.
- **Explicit empty-folder validation semantics**: Main-process validation emits one `missingKind: "empty_folder"` row when no media files are found, letting the renderer show `缺失文件` instead of per-size shortage rows.
- **Guided daily workspace**: The daily page uses a fixed workflow order for requirement import, directory creation, material upload, validation feedback, and renaming instead of a draggable panel library.

### Data Model Changes

- **DailyRequirementSession**: Renderer/AppConfig state now carries `importedAt`, `importedDateKey`, JSON file metadata, normalized projects, aggregate sizes, warnings, and optional user-info fields from the import.
- **ValidationResult**: Validation rows now support `missingKind?: "empty_folder"` so virtual missing rows can distinguish an empty material folder from ordinary quantity shortage.
- **ValidationPresentationSummary**: Renderer summaries now include `emptyFolderCount` in addition to blocking, missing, extra, and passed counts.

### API Changes

- **Config store**: Uses the existing `store.set("dailyRequirementSession")` and `store.delete("dailyRequirementSession")` paths. No new IPC was added for requirement memory.
- **`fs:startValidation` result shape**: Existing validation IPC can now return a virtual missing row with `missingKind: "empty_folder"`.
- **Renderer dependencies**: Removed `@hello-pangea/dnd` because the daily workspace no longer uses drag/drop layout wiring.

### Conventions Established

- Same-day workflow memory must use local real-world date plus an explicit age limit when the user asks for "today only" behavior.
- Store normalized workflow snapshots, not source file paths, when same-day recovery should survive moved or deleted JSON files.
- Do not let display controls become validation source of truth. Requirement data, local material observations, and manual fallback choices should have distinct state.
- Empty or virtual validation issues should be explicit in `ValidationResult` rather than inferred from several generic rows in the renderer.
- High-frequency operational pages should prefer guided flow ordering over configurable panel layouts unless personalization is explicitly shaped.
- Critical daily workflow controls should stay away from top-right placement to avoid notification overlap.

### Known Limitations

- Stale `dailyLayoutLeft` and `dailyLayoutRight` config keys may remain on disk but no longer drive the daily page.
- Same-day restore uses local machine time. Clock changes can affect the freshness decision.
- The empty-folder path also covers folders that contain no supported media; unsupported-only folders do not yet get distinct copy.
- Multi-project folder matching still relies on loose folder-name matching when deciding which imported requirements apply to a folder.

## Robust Named Custom Renaming (2026-07-14)

### Patterns Introduced

- **Versioned named rename presets**: `src/shared/renameTemplates.ts` owns the `openflow.rename.v2` contract. Regular, special, and custom presets have stable IDs, user-facing names, and separate image/video rules.
- **Shared deterministic rendering**: Settings samples, daily previews, and main-process plans use the same token renderer, date/sequence formatting, and producer abbreviation logic.
- **Plan-before-mutate filesystem workflow**: `src/main/rename.ts` produces a full structured rename preview before executing any file changes, then replans and executes sequentially with path-level results.
- **Explicit recovery state**: Invalid custom presets block with an actionable error and an explicit regular-mode option; partial filesystem failures keep only failed validation rows for retry.
- **Single-writer JSON configuration**: Store mutations are queued, written to unique same-directory temporary files, file-fsynced and atomically replaced with `node:fs` rename; Electron's single-instance lock removes competing app writers.

### Data Model Changes

- **`RenameSettingsV2`**: Workflow state now carries schema version, named presets, and the last selected custom preset ID under `workflow.renameSettings`.
- **`RenamePreset` / `RenameRule` / `RenameToken`**: Presets distinguish regular, special, and custom kinds; rules own ordered stable-ID tokens plus separator, date, and sequence settings.
- **`RenameSelection`**: Daily state uses one mutually exclusive `auto | regular | special | custom` mode plus optional custom preset ID instead of two independent switches.
- **`RenamePreview` / `RenameBatchResult`**: Rename IPC results contain planned old/new paths, effective preset, media type, status, error code, and success/failure counts.

### API Changes

- **`fs:previewRename`**: Added a read-only IPC that validates the current batch and returns exact candidate file names or blockers.
- **`fs:executeRename`**: Now accepts one typed `RenameRequest`, replans with the same domain rules, preserves original extensions, and returns a structured batch result.
- **Preload/ElectronAPI rename surface**: Renderer types and preload expose matching typed preview and execute calls from the shared contract.
- **Config store behavior**: Existing `store:set`, `store:get`, `store:getAll`, and `store:delete` channels retain their signatures but serialize mutations and read stable snapshots. Replacement failure leaves the prior live JSON intact and cleans the temporary file.

### Conventions Established

- Legacy configuration may be read at hydration for migration, but must not remain a second runtime authority.
- Batch filesystem features should separate deterministic planning from mutation and return one result per input path.
- Never silently degrade a user-selected destructive/batch rule; surface the blocker and require an explicit alternative selection.
- Keep customization bounded to values that can be validated and previewed; add new token types before considering arbitrary scripts.
- Preserve media extensions during renaming. Media conversion belongs to the separate format-processing workflow.
- Critical template actions belong in the library footer or editor action band, not the application top-right.

### Known Limitations

- Presets are local to one OpenFlow installation; there is no cloud sync, permission model, or preset package import/export.
- Field customization does not support arbitrary JavaScript, regex transformation, or conditional routing.
- Execution is sequential and does not provide an all-or-nothing rollback journal.
- An external process can still race the final target existence check; the affected item returns a recoverable failure instead of receiving a cross-process transaction guarantee.

## Chrome Extension Integration (2026-08-12)

### Repository Boundary

- `extensions/chrome` is the maintained Manifest V3 extension source inside the OpenFlow repository.
- The Electron desktop and Chrome extension are maintained together in this repository without a submodule or external source-repository dependency.
- The retired PySide6 desktop prototype and repository-maintenance Python scripts are not part of the current product.

### Handoff Contract

- The extension extracts requirements from the active tab and exports `openflow.requirements.v1` JSON.
- The Electron desktop imports that JSON through `parseRequirementJson`, then owns folder creation, validation, and local rename execution.
- `extensions/chrome/fixtures/requirements-v1.example.json` and `src/main/extensionContract.test.ts` form the cross-component contract test.
- There is no background bridge, native-messaging host, custom protocol, or persistent website access in this integration.

### Packaging and Verification

- `npm run check:extension` validates Manifest V3, the approved permission set, local resource references, script syntax, and exporter contract markers.
- `npm test` runs the extension check before the desktop test suite.
- Electron Builder copies the unpacked extension to `resources/chrome-extension`; installation does not modify Chrome or silently enable the extension.

### Security Conventions

- Keep `activeTab` plus on-demand `scripting` instead of broad `host_permissions` unless a separately reviewed feature requires persistent access.
- Any permission change must update the automated permission contract and receive an explicit privacy/security review.
- Browser extraction remains read-oriented; destructive local filesystem operations stay in the Electron main process.
