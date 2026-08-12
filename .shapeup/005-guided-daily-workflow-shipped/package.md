# Package: 日常流程引导化与 JSON 状态记忆

**Feature ID**: 005-guided-daily-workflow
**Created**: 2026-06-11
**Frame**: [frame.md](./frame.md)
**Status**: Shipped — 2026-06-11

---

## Problem

OpenFlow 的日常页现在能完成需求 JSON 导入、目录创建、素材添加、校验和重命名，但这些能力被拆成可拖拽面板，状态语义也混在一起：JSON 导入会点亮尺寸预览，素材目录检测也会覆盖同一个尺寸状态，空素材目录会被解释成多条“尺寸缺 1 张”，关闭再打开还要重新导入同一份 JSON。

这个 package 的目标是把日常页从“面板库 + 多个隐式状态”改成“当天需求上下文 + 引导式素材处理流程”。JSON 仍然是系统理解需求的内部依据，但用户看到的是当前步骤、素材反馈和下一步动作。

## Appetite

Medium Batch（2-3 个会话）。

范围超过单点修补：要同时处理本地状态记忆、尺寸状态拆分、校验反馈语义和日常页信息架构。但它仍然只限于日常主流程，不碰插件抓取、整理页、格式处理页或全应用重设计。

## Requirements (R)

| ID | Requirement | Status |
|----|-------------|--------|
| R0 | 日常页变成按步骤推进的主流程，而不是用户自己拼装的可拖拽面板库 | Core goal |
| R1 | 需求 JSON 导入后在本机现实时间内只保留当天/24 小时；同一天误关重开可恢复，跨到明天必须重新导入 | Must-have |
| R2 | JSON 是系统需求上下文，不再把尺寸预览当成导入反馈来全量点亮 | Must-have |
| R3 | 尺寸状态拆分清楚：需求尺寸、素材目录检测尺寸、无 JSON 时的手动目标尺寸不能继续共用一个含义不清的 `selectedSizes` | Must-have |
| R4 | 添加空素材目录后校验，应优先显示“缺失文件/素材目录为空”，而不是逐个尺寸显示“缺 1 张” | Must-have |
| R5 | 缺失、额外、尺寸错误、读取失败这些反馈要服务用户决策：哪些只是提示，哪些真正阻止重命名 | Must-have |
| R6 | 已有核心能力继续可用：导入 JSON、创建目录、添加素材、校验、可重命名素材重命名、特殊/手搓命名、历史记录 | Must-have |
| R7 | 设置、历史等低频动作不能作为新按钮塞到应用右上角 | Must-have |
| R8 | 不做需求编辑器、不重写 JSON schema、不重写插件抓取、不扩大到整理/格式处理页 | Out |

## Solution

把日常页拆成三个技术层：第一层是可过期的 `DailyRequirementSession`，负责当天 JSON 上下文恢复；第二层是清晰的尺寸/校验状态模型，负责把需求、目录检测和用户反馈分开；第三层是新的引导式 `DailyWorkspace` 布局，按“需求 -> 目录 -> 素材 -> 校验 -> 重命名”固定推进。

### Element: Daily Requirement Session

**What**: 新增一个日常需求会话快照，保存已解析的 JSON 需求数据和导入时间，供同一天重开应用恢复。
**Where**: `src/renderer/src/appState.ts`, `src/renderer/src/types/electron.d.ts`, `src/renderer/src/App.tsx`; 持久化仍走现有 `window.electronAPI.store` 和主进程 `store:*` IPC。
**Wiring**: `handleChangeJson()` 成功拿到 `dialog.openJson()` 结果后，写入 `dailyRequirementSession`：`importedAt`、`importedDateKey`、`fileName`、`projects`、`sizes`、`producerName`、`department`、`email`、`warnings`。App 启动时在 `store.getAll()` 后校验 freshness；新鲜则恢复 `projectsList/jsonFileName/userInfo`，过期则删除或忽略该 key。
**Affected code**: `src/renderer/src/App.tsx` startup effect and `handleChangeJson`; `src/renderer/src/appState.ts` types; `src/renderer/src/types/electron.d.ts` `AppConfig`.
**Complexity**: Medium.
**Status**: Validated.

#### Place: App Startup And JSON Import

**UI Affordances:**
| Affordance | Type | Wires Out | Returns To |
|------------|------|-----------|------------|
| 导入需求表 | Button | `dialog.openJson()` | creates fresh `DailyRequirementSession` |
| 重新导入 | Button in requirement step | `dialog.openJson()` | replaces current session |
| 过期提示 | Inline status | local time freshness check | asks user to import again |

**Code Affordances:**
| Affordance | Type | Wires Out | Returns To |
|------------|------|-----------|------------|
| `buildDailyRequirementSession()` | Pure helper | parsed JSON result + `Date.now()` | persisted session snapshot |
| `isFreshDailyRequirementSession()` | Pure helper | `importedAt`, `importedDateKey`, current local date/time | boolean freshness |
| `store.set('dailyRequirementSession')` | Existing IPC | writes config JSON | same-day restore |
| `store.delete('dailyRequirementSession')` | Existing IPC | clears expired session | clean next-day startup |

### Element: Local-Time Expiry Rule

**What**: Patch the ambiguous “24 小时/明天” rule into an exact builder rule: a session is fresh only when it is both younger than 24 hours and on the same local calendar date as the current system time.
**Where**: new pure helper near renderer state, e.g. `src/renderer/src/dailyRequirementSession.ts`, imported by `App.tsx`.
**Wiring**: `getLocalDateKey(new Date())` uses local `getFullYear/getMonth/getDate`; no server time and no app-runtime timer. If the machine date has crossed to tomorrow, the session expires even if less than 24 elapsed hours. If the machine stays on the same date but more than 24 hours elapsed, it also expires.
**Affected code**: `src/renderer/src/dailyRequirementSession.ts`, `src/renderer/src/App.tsx`, new `src/renderer/src/dailyRequirementSession.test.ts`.
**Complexity**: Low.
**Status**: Validated.

#### Place: Requirement Session Helper

**Code Affordances:**
| Affordance | Type | Wires Out | Returns To |
|------------|------|-----------|------------|
| `getLocalDateKey(date)` | Function | reads local date parts | `YYYY-MM-DD` key |
| `isFreshDailyRequirementSession(session, now)` | Function | date key + elapsed ms | restore or expire decision |
| `DAILY_REQUIREMENT_TTL_MS` | Constant | `24 * 60 * 60 * 1000` | max retention window |

### Element: Requirement / Folder / Manual Size Separation

**What**: Stop using one `selectedSizes` array for JSON requirements, folder-detected sizes, and manual user choices. Introduce separate state names with separate meanings.
**Where**: `src/renderer/src/App.tsx`, `src/renderer/src/appState.ts`, `src/renderer/src/views/DailyWorkspace.tsx`.
**Wiring**: JSON import populates `projectsList` and derived `requirementSizes`, but does not call `setSelectedSizes([...jsonSizes])`. Adding folders writes `detectedFolderSizes` from `fs.readProjectSizes()` but does not overwrite requirement targets. Manual size selection only applies when no JSON requirement context exists. `getValidationTargetsForFolder()` returns project `requirements` when a matching JSON project exists; otherwise it falls back to manual/detected target sizes.
**Affected code**: `App.tsx` states around `selectedSizes/projectsList`, `getValidationTargetsForFolder()`, `handleChangeJson()`, `addFolders()`, `onToggleSize`; `DailyWorkspaceProps` and size preview rendering.
**Complexity**: Medium.
**Status**: Validated.

#### Place: Size Preview / Requirement Summary

**UI Affordances:**
| Affordance | Type | Wires Out | Returns To |
|------------|------|-----------|------------|
| 需求尺寸列表 | Read-only chips/list | derived from `projectsList.requirements` | shows what JSON asks for |
| 目录尺寸列表 | Read-only chips/list | `fs.readProjectSizes(folderPaths)` | shows what local folders contain |
| 手动目标尺寸 | Secondary control, only without JSON | updates `manualTargetSizes` | validation fallback target |

**Code Affordances:**
| Affordance | Type | Wires Out | Returns To |
|------------|------|-----------|------------|
| `requirementSizes` | Derived state | `projectsList.flatMap(requirements)` | display and project matching |
| `detectedFolderSizes` | State | `fs.readProjectSizes()` | directory status display |
| `manualTargetSizes` | State | user size toggles | no-JSON validation target |
| `getValidationTargetsForFolder()` | Function | project requirements or fallback sizes | `fs.startValidation()` targetSizes |

### Element: Empty Folder Validation Semantics

**What**: Represent “folder contains no media to validate” as one explicit missing-file issue, not as one missing row per target size.
**Where**: `src/main/index.ts` `fs:startValidation`, `src/renderer/src/appState.ts`, `src/renderer/src/types/electron.d.ts`, `src/renderer/src/validationPresentation.ts`, `src/renderer/src/StatusBadge.tsx`, `src/renderer/src/views/DailyWorkspace.tsx`.
**Wiring**: After `collectMediaFiles(folderPath, fileList, true)`, if `fileList.length === 0`, main returns one virtual `ValidationResult` with `status: 'missing'`, `missingKind: 'empty_folder'`, `missingCount` equal to the total required quantity, `actualQuantity: 0`, and error copy like `素材目录内没有可校验文件`. Presentation model counts it separately as `emptyFolderCount`; UI title becomes `缺失文件` and reason becomes `素材目录为空，请添加素材后重验`.
**Affected code**: main `ValidationResult` interface, renderer `ValidationResult` types, `buildValidationPresentation()`, `getValidationRowReason()`, `StatusBadge`, `DailyWorkspace` status copy and detail row title.
**Complexity**: Medium.
**Status**: Validated.

#### Place: Validation Result Pipeline

**Code Affordances:**
| Affordance | Type | Wires Out | Returns To |
|------------|------|-----------|------------|
| `collectMediaFiles()` | Existing function | scans media in size folders | `fileList` |
| empty `fileList` branch | New branch | emits one `missingKind: 'empty_folder'` row | renderer feedback |
| `buildValidationPresentation()` | Existing helper | separates empty-folder missing from quantity shortage | action rows and summary |
| `StatusBadge` | Existing component | reads `missingKind` | `缺失文件` badge |

### Element: Feedback Priority And Rename Gating

**What**: Tighten status hierarchy so feedback reads like decisions: blocking file problems first, then empty folders, then quantity shortage, then extra non-required assets, then passed rows. Missing and extra remain user-facing feedback rather than hard blockers when valid files exist.
**Where**: `src/renderer/src/validationPresentation.ts`, `src/renderer/src/App.tsx`, `src/renderer/src/views/DailyWorkspace.tsx`, `src/renderer/src/validationPresentation.test.ts`.
**Wiring**: Extend presentation summary with `emptyFolderCount`, preserve `canRenamePassedFiles = passedCount > 0 && !hasBlockingIssues`, and update App notifications/status text to prefer `empty_folder` over generic “数量不足”. Extra assets keep existing non-blocking behavior and still do not participate in rename.
**Affected code**: `buildValidationPresentation`, `getRowPriority`, `summarizeRows`, `handleValidate()` notification copy, Daily status card and badges.
**Complexity**: Low.
**Status**: Validated.

#### Place: Validation Feedback Surface

**UI Affordances:**
| Affordance | Type | Wires Out | Returns To |
|------------|------|-----------|------------|
| 系统状态 | Status panel | presentation summary | next action copy |
| 素材详情 badges | Badges | summary counts | quick issue scan |
| 查看详情 | Disclosure button | expands grouped action rows | issue table |
| 执行重命名 | Primary action | `canRenamePassedFiles` | rename valid files only |

**Code Affordances:**
| Affordance | Type | Wires Out | Returns To |
|------------|------|-----------|------------|
| `getValidationRowKind()` | Function | row status + extra detection | row category |
| `summarizeRows()` | Function | grouped rows | `emptyFolderCount`, `missingTotal`, blockers |
| `handleValidate()` | App action | `fs.startValidation` + presentation summary | notification and expanded details |
| `handleRename()` | App action | valid rows only | rename results/history |

### Element: Guided Daily Workspace

**What**: Replace the draggable two-column panel library with a fixed guided flow for the daily page.
**Where**: `src/renderer/src/views/DailyWorkspace.tsx`, `src/renderer/src/App.tsx`, package manifest if drag/drop dependency becomes unused.
**Wiring**: `DailyWorkspace` renders ordered steps: 1) 今日需求, 2) 创建/选择目录, 3) 添加素材, 4) 校验反馈, 5) 重命名/完成. Special naming and manual naming become inline options near the rename step, not a competing card. Settings/history remain reachable from existing left-side app surfaces or a non-top-right secondary area; no new critical button goes into top-right. Existing `dailyLayoutLeft/dailyLayoutRight` config can be ignored or left tolerated for old configs but no longer drives the main daily layout.
**Affected code**: remove `DragDropContext`, `Droppable`, `Draggable`, `layoutLeft/layoutRight` props from `DailyWorkspace`; simplify `App.tsx` state and `handleLayoutChange`; remove `@hello-pangea/dnd` only after `rg` confirms no remaining imports.
**Complexity**: Medium.
**Status**: Validated.

#### Place: Daily Guided Flow

**UI Affordances:**
| Affordance | Type | Wires Out | Returns To |
|------------|------|-----------|------------|
| Step 1: 导入/重新导入需求 | Button + status | `onChangeJson` | requirement context |
| Step 2: 创建今日目录 | Button | `onInitFolders` | output directory notification |
| Step 3: 添加素材 | Dropzone/button | `onDropPaths` / `onAddFolder` | folder list + detected sizes |
| Step 4: 开始校验 | Button | `onValidate` | validation feedback |
| Step 5: 执行重命名 | Button | `onRename` | history + completion state |
| 特殊/手搓命名 | Segmented/toggle controls | `onToggleSpecialEnabled` / `onToggleManualEnabled` | rename mode |

**Code Affordances:**
| Affordance | Type | Wires Out | Returns To |
|------------|------|-----------|------------|
| `DailyWorkspaceProps` | Component contract | receives requirement/session/size/validation state | guided UI |
| removed DnD layout arrays | Deleted contract | no layout-driven rendering | fixed workflow order |
| `@hello-pangea/dnd` pruning | Dependency cleanup | `npm uninstall` after no refs | smaller renderer dependency |

## Fit Check (R × Solution)

| | Daily Requirement Session | Expiry Rule | Size Separation | Empty Folder Semantics | Feedback Priority | Guided Workspace |
|---|---|---|---|---|---|---|
| R0: guided daily flow |  |  | yes |  | yes | yes |
| R1: same-day JSON restore, next-day reimport | yes | yes |  |  |  | yes |
| R2: JSON not size-preview feedback | yes |  | yes |  |  | yes |
| R3: split size semantics |  |  | yes |  | yes | yes |
| R4: empty folder says missing files |  |  |  | yes | yes | yes |
| R5: feedback supports decisions |  |  | yes | yes | yes | yes |
| R6: core flow remains usable | yes | yes | yes | yes | yes | yes |
| R7: no top-right button workaround |  |  |  |  |  | yes |
| R8: out-of-scope boundaries | yes | yes | yes | yes | yes | yes |

Every in-scope requirement has at least one covering element. No gaps.

## Rabbit Holes

- **24 hours versus tomorrow**: Patched. Freshness requires both same local date and age under 24 hours. This honors “只保留24小时” and “明天打开就重新导入”.
- **Stale or moved JSON source file**: Patched by storing a normalized snapshot, not depending on re-reading the file path. Because retention is only same-day, source-change detection is out of scope for this appetite.
- **JSON import still needs validation targets**: Patched by letting validation use `project.requirements` directly. The size preview stops being the source of truth, but JSON remains the requirement source for validation.
- **Manual sizes without JSON**: Patched by keeping a fallback manual target-size path only when no requirement context exists. It should be secondary in the UI.
- **Empty folder could be inferred in renderer**: Patched by emitting explicit `missingKind: 'empty_folder'` from main when `fileList.length === 0`. This avoids guessing from several `missing` rows.
- **Guided layout could become a full redesign**: Cut back. Only `DailyWorkspace` changes. Global sidebar, organizer, format processing, settings, notification center, and existing theme system stay intact.
- **Removing drag/drop layout could break old config**: Patched by ignoring old `dailyLayoutLeft/dailyLayoutRight` keys or leaving them in config untouched. Do not require migration or destructive cleanup.
- **Dependency pruning could overreach**: Patch by removing `@hello-pangea/dnd` only after `rg` shows it is no longer imported anywhere.
- **Existing uncommitted main-process rename changes**: Build should work with them, not revert them. 005 does not depend on that rename change and should keep its edits scoped.

## No-Gos

- **No plugin or JSON schema rewrite**: `parseRequirementJson()` remains the normalization boundary.
- **No long-term JSON memory**: Do not restore yesterday’s or older JSON, even if the file still exists.
- **No requirement editor**: Users can reimport JSON; editing requirement quantities is a separate future problem.
- **No standalone empty-folder hotfix**: Empty-folder behavior ships as part of the broader 005 feedback semantics.
- **No top-right critical controls**: Respect the project UI guideline; do not move settings/history/import/rename controls into the app top-right corner.
- **No organizer/format/settings redesign**: Keep other workspaces out of scope.
- **No destructive config cleanup**: Old daily layout keys may remain in `openflow-config.json`; they simply stop driving the daily page.
- **No change to true blocking rules**: Read failures, unsupported files, and real size mismatches still block rename. Missing quantities and extra non-required assets remain warning-level when valid files exist.

## Technical Validation

**Codebase reviewed**:

- `src/renderer/src/App.tsx`: current source of `projectsList`, `jsonFileName`, `selectedSizes`, startup config restore, JSON import, folder add, validation, rename, and DailyWorkspace props.
- `src/renderer/src/views/DailyWorkspace.tsx`: current draggable panel layout, size preview buttons, status copy, upload area, validation detail rendering, and bottom validate/rename actions.
- `src/renderer/src/validationPresentation.ts`: current row classification, missing/extra/blocking grouping, counts, sorting, and `canRenamePassedFiles` calculation.
- `src/renderer/src/StatusBadge.tsx`: current missing badge text and tooltip behavior.
- `src/renderer/src/appState.ts`: renderer data types for requirement projects, details, settings, and validation rows.
- `src/renderer/src/types/electron.d.ts`: context bridge types and `AppConfig`.
- `src/preload/index.ts`: existing `dialog`, `fs`, and `store` bridge methods.
- `src/main/index.ts`: local JSON store helpers, `dialog:openJson`, `fs:readProjectSizes`, `collectMediaFiles`, `fs:startValidation`, and `store:*` IPC handlers.
- `src/main/requirements.ts`: normalized requirement shapes and missing quantity calculation.
- `src/main/requirements.test.ts` and `src/renderer/src/validationPresentation.test.ts`: existing node-test patterns for pure helpers.
- `docs/decisions/0002-desktop-requirement-normalizer-and-quantity-validation.md`, `0003-quantity-shortages-do-not-block-renaming-valid-assets.md`, and `0004-renderer-validation-presentation-model.md`.

**Approach validated**:

- Same-day JSON restore can use the existing config store; no new main IPC is required.
- JSON parsing already returns normalized projects and requirements, so a session snapshot can store normalized data and avoid re-reading stale files.
- The current `selectedSizes` problem is localized in `App.tsx`: JSON import and folder detection both write into it, and validation targets are filtered through it. Splitting state fixes the ambiguity without touching the parser.
- Empty-folder detection belongs in `fs:startValidation` because `collectMediaFiles()` already knows whether any media file was found before missing rows are generated.
- The renderer already has a presentation model; extending it is safer than embedding more branching directly in `DailyWorkspace`.
- The drag/drop layout dependency is isolated to `DailyWorkspace`; a fixed guided flow can remove it without affecting other workspaces.

**Flagged unknowns resolved**:

- Expiry rule: same local date and under 24 hours.
- Cache payload: normalized snapshot, not raw JSON and not file-path re-read.
- Size preview role: display requirement/folder/manual state, not JSON import feedback.
- Empty folder representation: explicit `missingKind`.
- Rename gating: preserve existing `passedCount > 0 && !hasBlockingIssues` rule.
- Old config: tolerate and ignore; no migration required.

**Test strategy**:

- Add `src/renderer/src/dailyRequirementSession.test.ts` for same-day restore, next-day expiry, and over-24-hour expiry.
- Extend `src/renderer/src/validationPresentation.test.ts` for `missingKind: 'empty_folder'`, feedback priority, and rename allowance with missing/extra rows.
- Extend type coverage by updating `appState.ts` and `types/electron.d.ts`, then running `npm run lint`.
- Keep `src/main/requirements.test.ts` passing to prove JSON normalization and quantity calculation remain intact.
- Run `node --test src/main/requirements.test.ts src/renderer/src/validationPresentation.test.ts src/renderer/src/dailyRequirementSession.test.ts`.
- Manual smoke after build: import JSON, restart same day, verify restored; simulate expired session, verify reimport prompt; add empty folder and validate, verify one missing-file message; add partial valid assets, verify rename remains available when only missing/extra issues exist.

---

## Status: Shipped — 2026-06-11
