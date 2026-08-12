# Package: 次要功能砍范围

**Feature ID**: 004-cut-secondary-features
**Created**: 2026-06-02
**Frame**: [frame.md](./frame.md)
**Status**: Shipped — archived 2026-06-03

---

## Problem

OpenFlow 的主价值已经收敛到日常 AIGC 广告素材生产流程：导入需求数据表/JSON、创建项目目录、添加素材、校验尺寸与数量、批量重命名和整理归档。

但应用里仍然挂着截屏/贴图、侧边栏数据表、AI 识图、库/游戏库等偏工具箱功能。它们在导航、设置、preload API、主进程 IPC、SQLite 表、本地图片存储和依赖包里都有痕迹。用户可以靠记忆忽略它们，但维护面和认知噪声仍然存在。

## Appetite

Medium Batch（2-3 个会话）。

这不是单纯隐藏几个按钮。真正完成砍功能需要收窄 renderer 入口、设置状态、主进程能力、preload 类型、数据库/Excel 边界和 package 依赖，同时保证日常主流程不被误伤。

## Requirements (R)

| ID | Requirement | Status |
|----|-------------|--------|
| R0 | 从当前产品表面退出四条低频工具线：截屏、侧边栏数据表、AI 识图、库/游戏库 | Core goal |
| R1 | 日常主流程必须继续可用：需求 JSON 导入、目录创建、素材目录加入、尺寸/数量校验、重命名、整理归档 | Must-have |
| R2 | 侧边栏和设置页不能再暴露被砍功能的入口、配置项或帮助说明 | Must-have |
| R3 | 被砍功能不能继续注册全局快捷键、托盘菜单、独立窗口、IPC handler 或 preload API | Must-have |
| R4 | 整理页不能再通过“添加到游戏库”继续写入库数据 | Must-have |
| R5 | 存量用户数据不主动删除：旧 SQLite 文件、Excel 备份、游戏库图片、旧配置键只是不再读取和写入 | Must-have |
| R6 | 类型、默认状态和依赖包要跟随收窄，避免删除 UI 后仍背着无用模块 | Must-have |
| R7 | 格式处理、日常需求数据表/JSON 导入、002 校验详情改进不属于本次砍范围 | Out |
| R8 | 基础功能必须有明确保护清单和验证门槛；任何砍功能改动如果破坏基础功能，就不能合入 | Must-have |

## Solution

采用“产品表面退出 + 运行时能力下线 + 状态与依赖收窄”的减法路线。先让用户再也无法从 UI、快捷键或托盘进入四条次要功能线，再移除对应 IPC/preload/类型/依赖。旧数据留在磁盘上，不在这个 appetite 内做删除、导出或迁移。

基础功能保护优先于砍功能本身。Build 阶段应先列出并保护核心 IPC、核心视图和核心状态，再做删除；每完成一个删除面，都要重新跑类型检查和 retired-surface 搜索，确认主流程仍然可达。

### Element: Renderer Navigation Retirement

**What**: 收窄主界面的可达页面，只保留日常、整理、格式处理、设置和消息中心。
**Where**: `src/renderer/src/App.tsx`。
**Wiring**: `ViewKey` 不再包含 `ai`、`bitable`、`dictionary`；`navItems` 不再生成 AI 识图、表格、库按钮；视图分发不再渲染 `AiWorkspace`、`BitableWorkspace`、`GameDictionaryWorkspace`。
**Affected code**: `src/renderer/src/App.tsx` imports、`ViewKey`、`navItems`、conditional render branch。
**Complexity**: Low。
**Status**: Validated.

#### Place: Main App Shell

**UI Affordances:**
| Affordance | Type | Wires Out | Returns To |
|------------|------|-----------|------------|
| 日常 nav button | Side nav button | `setActiveView('daily')` | `DailyWorkspace` |
| 整理 nav button | Side nav button | `setActiveView('organizer')` | `OrganizerWorkspace` |
| 格式处理 nav button | Side nav button | `setActiveView('format')` | `FormatProcessor` |
| 设置 icon | Side nav icon | `setActiveView('settings')` | `SettingsWorkspace` |

**Code Affordances:**
| Affordance | Type | Wires Out | Returns To |
|------------|------|-----------|------------|
| `ViewKey` | Type union | constrains `activeView` | compile-time route coverage |
| `navItems` | Local array | maps allowed views to left nav buttons | rendered side nav |
| conditional view render | JSX branch | selects workspace by `activeView` | selected workspace |

### Element: Settings And App State Cleanup

**What**: 移除被砍功能的配置表面，并让 App state 不再加载、保存或传递相关设置。
**Where**: `src/renderer/src/views/SettingsWorkspace.tsx`, `src/renderer/src/appState.ts`, `src/renderer/src/App.tsx`。
**Wiring**: 设置页保留常规、账户、工作区、命名模板、快捷键、处理引擎、关于；移除截图控制/输出/贴图、AI 集成、数据看板；快捷键只保留唤醒/隐藏主面板；命名模板不再展示 AI 识别命名模板。`App` 不再持有 `apiKeys`、`dataStatsSettings`、`screenshotSettings` 状态，也不再读取/保存这些旧配置键。
**Affected code**: `SettingsWorkspace` props、autosave effect、tabs、template sections；`appState` 的 `ApiKeys`、`ScreenshotSettings`、`DataStatsSettings`、截图相关 shortcut/processing fields、`aiImage` template and AI tokens；`App` state and props。
**Complexity**: Medium。
**Status**: Validated.

#### Place: Settings Workspace

**UI Affordances:**
| Affordance | Type | Wires Out | Returns To |
|------------|------|-----------|------------|
| 常规 tab | Settings tab | edits `systemSettings` | persisted via `store.set` |
| 账户 tab | Settings tab | edits `userInfo` | persisted via `store.set` |
| 工作区 tab | Settings tab | edits `workspaceSettings` | persisted via `store.set` |
| 命名模板 tab | Settings tab | edits non-AI rename templates | persisted via `workflow.renameTemplates` |
| 快捷键 tab | Settings tab | edits `shortcutSettings.togglePanel` | `shortcut:update` |
| 处理引擎 tab | Settings tab | edits image/video processing settings | persisted via `store.set` |

**Code Affordances:**
| Affordance | Type | Wires Out | Returns To |
|------------|------|-----------|------------|
| `SettingsWorkspaceProps` | Props interface | receives only retained settings | typed component boundary |
| autosave effect | React effect | `store.set` retained config keys | local config JSON |
| `ShortcutSettings` | State type | only `togglePanel` remains | renderer and main shortcut API |
| `TemplateKey` | State type | excludes `aiImage` | rename template editor and main rename calls |

### Element: Screenshot And Pin Runtime Retirement

**What**: Remove screenshot, copy/save screenshot, pin image, screenshot dev menu, and related renderer entries from runtime.
**Where**: `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/src/types/electron.d.ts`, `electron.vite.config.ts`, screenshot/pin renderer files.
**Wiring**: Main process no longer imports `desktopCapturer`, `screen`, or `clipboard`; no longer creates screenshot/pin BrowserWindows; no longer registers `screenshot:*` or `pin:*` channels; tray menu keeps open and exit only; global shortcut registration is narrowed to `togglePanel`. Preload no longer exposes `screenshot` or `pin`; Vite no longer builds `screenshot.html` and `pin.html`; screenshot/pin entry HTML, entry TSX, view components, and `screenshotUtils.ts` can be deleted after imports are removed.
**Affected code**: `startScreenshot`, `closeScreenshot`, `createPinWindow`, `pinFromClipboard`, screenshot/pin IPC handlers, tray menu items, `shortcut:update`, rollup input, `src/renderer/screenshot.html`, `src/renderer/pin.html`, `src/renderer/src/screenshot.tsx`, `src/renderer/src/pin.tsx`, `src/renderer/src/views/ScreenshotApp.tsx`, `src/renderer/src/views/PinApp.tsx`, `src/renderer/src/screenshotUtils.ts`.
**Complexity**: Medium。
**Status**: Validated.

#### Place: Main Process Runtime

**UI Affordances:**
| Affordance | Type | Wires Out | Returns To |
|------------|------|-----------|------------|
| 打开主面板 tray item | Tray menu item | focuses or creates main window | main app window |
| 退出 tray item | Tray menu item | sets quitting flag and quits app | app shutdown |
| 唤醒/隐藏主面板 shortcut | Global shortcut | toggles `mainWindow` visibility | main app window |

**Code Affordances:**
| Affordance | Type | Wires Out | Returns To |
|------------|------|-----------|------------|
| `createWindow()` | Function | loads main renderer only | `index.html` |
| `shortcut:update` | IPC handler | registers `togglePanel` only | boolean success |
| `app.on('will-quit')` | Lifecycle hook | unregisters shortcuts | clean shutdown |

### Element: Data Table And Library Storage Retirement

**What**: Remove the side data table and library storage flows, including their write paths from organizer.
**Where**: `src/main/index.ts`, `src/main/utils/db.ts`, `src/preload/index.ts`, `src/renderer/src/types/electron.d.ts`, `src/renderer/src/views/BitableWorkspace.tsx`, `src/renderer/src/views/GameDictionaryWorkspace.tsx`, `src/renderer/src/views/OrganizerWorkspace.tsx`。
**Wiring**: Delete Bitable and GameDictionary workspaces after App no longer imports them. Remove Excel import IPC and cleanup handlers. Remove SQLite db handlers and db module import. Remove game image local-save handler. Remove organizer card action that calls `fs.saveImageToLocal` and `db.insertGameMapping`. Existing `productivity.db`, imported Excel backups, and `game_dictionary_images` remain on disk but no runtime path reads or writes them.
**Affected code**: `dialog:importExcel`, `db:*ImportedData`, `db:*ExcelFile`, `db:*GameMapping`, `fs:cleanupOldExcels`, `fs:saveImageToLocal`, `BitableWorkspace`, `GameDictionaryWorkspace`, organizer `BookPlus` action, `src/main/utils/db.ts`.
**Complexity**: Medium。
**Status**: Validated.

#### Place: Organizer Workspace

**UI Affordances:**
| Affordance | Type | Wires Out | Returns To |
|------------|------|-----------|------------|
| file selection checkbox | Checkbox | toggles selected organizer item | organizer list state |
| organize action | Button | `fs:executeOrganize` | organize results |
| undo organize action | Button | `fs:undoOrganize` | restored files message |

**Code Affordances:**
| Affordance | Type | Wires Out | Returns To |
|------------|------|-----------|------------|
| `fs:scanOrganizerFolder` | IPC handler | scans source dir by allowed formats | organizer preview rows |
| `fs:executeOrganize` | IPC handler | moves selected files to destination | results and missing folders |
| removed library action | Deleted UI path | no `saveImageToLocal` or `insertGameMapping` call | no library write side effect |

### Element: Dependency And Type Surface Pruning

**What**: Remove packages and type declarations that only served retired modules.
**Where**: `package.json`, `package-lock.json`, `src/preload/index.ts`, `src/renderer/src/types/electron.d.ts`, `src/renderer/src/appState.ts`。
**Wiring**: After deleting module imports, run `rg` to confirm no references remain before pruning dependencies. Candidate removals are `@tanstack/react-table`, `recharts`, `konva`, `react-konva`, `use-image`, `xlsx`, `sqlite3`, `@types/sqlite3`, and `@google/genai` if still unused. Keep `pinyin-pro` because normal rename still uses producer abbreviation in `src/main/index.ts`. Keep image/video processing dependencies used by validation and format handling.
**Affected code**: package manifests, preload exposed API, ElectronAPI declarations, app state defaults.
**Complexity**: Low。
**Status**: Validated.

#### Place: Build And Type Boundary

**UI Affordances:**
| Affordance | Type | Wires Out | Returns To |
|------------|------|-----------|------------|
| none | Build surface | dependency pruning is invisible to users | smaller app surface |

**Code Affordances:**
| Affordance | Type | Wires Out | Returns To |
|------------|------|-----------|------------|
| `npm run lint` | Type check script | `tsc --noEmit` | compile success/failure |
| `rg` reference checks | Static search | verifies deleted surfaces are absent | cleanup confidence |
| package manifest update | Dependency change | removes unused packages | lockfile and install graph |

### Element: Core Workflow Safety Gates

**What**: 给 build 阶段设置不可绕过的基础功能保护清单。
**Where**: `src/renderer/src/App.tsx`, `src/renderer/src/views/DailyWorkspace.tsx`, `src/renderer/src/views/OrganizerWorkspace.tsx`, `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/src/types/electron.d.ts`。
**Wiring**: Retained flows must keep their renderer props, preload methods, ElectronAPI types, and main IPC handlers aligned. Any deletion that touches shared imports or state must be checked against this retained list before continuing.
**Affected code**: `dialog:openJson`, `dialog:selectFolder`, `fs:initFolders`, `fs:readProjectSizes`, `fs:startValidation`, `fs:trashFile`, `fs:executeRename`, `fs:scanOrganizerFolder`, `fs:executeOrganize`, `fs:undoOrganize`, `fs:processFormat`, `store:*`, `shell:openPath`, `window:*`, `shortcut:update` for main-panel toggle only.
**Complexity**: Medium。
**Status**: Validated.

#### Place: Retained Core Workflow

**UI Affordances:**
| Affordance | Type | Wires Out | Returns To |
|------------|------|-----------|------------|
| 导入需求表 | Button | `dialog.openJson` | `projectsList`, `selectedSizes`, user info |
| 创建目录 | Button | `fs.initFolders` | output directory notification |
| 添加素材目录 | Button/drop | `dialog.selectFolder`, `fs.readProjectSizes` | `folderPaths`, `selectedSizes` |
| 开始校验 | Button | `fs.startValidation` | `validationResults`, validation presentation |
| 执行重命名 | Button | `fs.executeRename` | rename history and reset state |
| 整理扫描/转移/撤销 | Buttons | organizer IPC handlers | organizer preview/results |
| 格式处理 | Workspace | `fs.processFormat` | processed file results |

**Code Affordances:**
| Affordance | Type | Wires Out | Returns To |
|------------|------|-----------|------------|
| `DailyWorkspace` props | Component contract | receives app state callbacks | daily production UI |
| retained preload APIs | Context bridge | invokes retained IPC channels | renderer-safe backend access |
| retained ElectronAPI types | Type contract | mirrors preload methods | compile-time protection |
| retained main IPC handlers | Main process API | filesystem/media/store operations | app workflow results |

## Fit Check (R × Solution)

| | Renderer Navigation | Settings/App State | Screenshot/Pin Runtime | Data/Library Storage | Dependency/Type Pruning | Core Safety Gates |
|---|---|---|---|---|---|---|
| R0: retire four tool lines | yes | yes | yes | yes | yes |  |
| R1: keep daily core flow | yes | yes | yes | yes | yes | yes |
| R2: remove visible entries/settings | yes | yes | yes | yes |  |  |
| R3: remove runtime shortcuts/windows/API |  | yes | yes | yes | yes | yes |
| R4: remove organizer library write path |  |  |  | yes | yes | yes |
| R5: preserve old user data |  | yes | yes | yes |  | yes |
| R6: clean types/defaults/deps |  | yes | yes | yes | yes | yes |
| R7: format processing and daily JSON are out | yes | yes | yes | yes | yes | yes |
| R8: protect basic functions with gates |  | yes | yes | yes | yes | yes |

Every in-scope requirement has at least one covering element. No gaps.

## Basic Function Protection Gates

Build cannot be considered complete unless all of these remain true:

- **Daily intake remains intact**: `dialog.openJson` still reads and normalizes requirement JSON; imported project names, sizes, quantities, producer, department, and email still populate the daily workspace.
- **Folder workflow remains intact**: `fs.initFolders`, `dialog.selectFolder`, and `fs.readProjectSizes` still support creating folders and adding素材目录 to the daily workspace.
- **Validation remains intact**: `fs.startValidation` still returns valid, mismatch, missing, error, and format error rows with required quantity fields preserved.
- **Rename remains intact**: `fs.executeRename` still receives retained templates and can rename validated image/video files; regular, special, and manual template modes remain.
- **Organizer remains intact except library write**: `fs.scanOrganizerFolder`, `fs.executeOrganize`, and `fs.undoOrganize` still work; only the “添加到游戏库” action is removed.
- **Format processing remains intact**: `FormatProcessor` and `fs.processFormat` are retained.
- **Settings remain usable**: retained settings still persist through `store.set` and reload through `store.getAll`; removed settings are ignored, not required for startup.
- **No startup crash from old config**: existing old keys such as `apiKeys`, `screenshotSettings`, `dataStatsSettings`, `screenshotShortcut`, and `aiImage` templates may exist in config but must not crash app boot.
- **No destructive cleanup**: old SQLite files, Excel backups, game dictionary images, and old config keys are not deleted in this build.

## Rabbit Holes

- **Hide versus delete**: Patch the hole by choosing product-surface and runtime deletion, not just hiding nav buttons. Old user data stays on disk, but code no longer reads or writes it.
- **Shortcut cleanup could break main-panel toggle**: Patch the hole by replacing screenshot/pin shortcut registration with a single retained toggle-panel shortcut path. `shortcut:update` should no longer unregister and rebuild removed accelerators.
- **AI template tokens may exist in old config**: Patch the hole by removing AI template UI/defaults while tolerating extra persisted keys. Runtime rename only passes regular/manual/special image/video templates, so old `aiImage` data can be ignored.
- **SQLite data removal risk**: Declare destructive cleanup out of bounds. The build should remove imports, handlers, and dependencies, but should not delete `productivity.db`, Excel backups, or `game_dictionary_images`.
- **Organizer can still write library data**: Patch the hole by removing the card-level “add to game library” action and its API calls, while leaving scan/organize behavior intact.
- **Dependency pruning can overreach**: Patch the hole by pruning only after static reference checks. `pinyin-pro`, `sharp`, `image-size`, ffmpeg packages, and Mantine/lucide stay because retained flows use them.
- **Shared preload/type cleanup can break basic functions**: Patch the hole by editing preload, ElectronAPI types, and main IPC as one contract. A retained IPC method cannot be removed from one layer unless it is removed from all layers by an explicit no-go decision, which this package does not make.

## No-Gos

- **No deletion of user data**: Do not remove existing SQLite files, Excel backups, stored config keys, or game dictionary images.
- **No daily workflow regression**: Do not change `dialog:openJson`, requirement normalization, folder creation, validation, rename, trash, or organize IPC behavior except where the organizer library side action is removed.
- **No removal of FormatProcessor**: Format processing is not one of the four requested cuts.
- **No broad dependency cleanup without proof**: Do not remove a dependency just because it looks related to a retired feature; remove it only after `rg` confirms no retained code imports it.
- **No new replacement feature**: Do not add an archive viewer, data migration panel, or experimental hidden tools page in this appetite.
- **No top-right button relocation**: Do not move removed actions into the app's top-right corner; keep remaining controls in the existing left nav/settings structure.
- **No old desktop work**: Ignore deprecated old desktop code paths outside the current Electron app.

## Technical Validation

**Codebase reviewed**:

- `src/renderer/src/App.tsx`
- `src/renderer/src/appState.ts`
- `src/renderer/src/views/SettingsWorkspace.tsx`
- `src/renderer/src/views/OrganizerWorkspace.tsx`
- `src/renderer/src/views/BitableWorkspace.tsx`
- `src/renderer/src/views/AiWorkspace.tsx`
- `src/renderer/src/views/GameDictionaryWorkspace.tsx`
- `src/renderer/src/views/ScreenshotApp.tsx`
- `src/renderer/src/views/PinApp.tsx`
- `src/renderer/src/screenshotUtils.ts`
- `src/preload/index.ts`
- `src/renderer/src/types/electron.d.ts`
- `src/main/index.ts`
- `src/main/utils/db.ts`
- `electron.vite.config.ts`
- `package.json`

**Approach validated**:

- The side nav and view routing for AI/data table/library are centralized in `App.tsx`, so removing their product entry points is local.
- Screenshot/pin runtime is isolated behind named functions and channels in `src/main/index.ts` plus `screenshot`/`pin` preload namespaces and Vite secondary entry points.
- Data table and game library share the SQLite module and clearly named IPC handlers; organizer has one explicit write-through side action to the library.
- Daily JSON import, validation, rename, format processing, and organizer scan/move flows use separate IPC paths that can remain.

**Flagged unknowns resolved**:

- All feature entry points have concrete files and handlers.
- The data preservation decision is explicit: old data is left in place and ignored.
- The shortcut behavior is decided: retain only main-panel toggle.
- The organizer side-write is explicitly included in scope.

**Test strategy**:

- Run `npm run lint` after implementation.
- Run `rg` checks for retired surfaces: `AiWorkspace`, `BitableWorkspace`, `GameDictionaryWorkspace`, `screenshot:`, `pin:`, `dialog:importExcel`, `fs:saveImageToLocal`, `db:getGameMappings`, `db:getExcelFiles`, and `fs:renameAiBatch`.
- Smoke the retained app shell: daily view opens, settings opens, organizer opens, format processing opens, and no retired nav items appear.
- Smoke the retained main flow enough to cover IPC boundaries: open JSON, add folder, validate, and ensure rename button state still derives from validation presentation.
- Use the Basic Function Protection Gates above as the final acceptance checklist before Shape Up build completion.

---

## Status: Shipped — archived 2026-06-03
