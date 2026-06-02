# Package: 插件到桌面端核心流程稳定化

**Feature ID**: 001-core-workflow  
**Created**: 2026-05-30  
**Frame**: [frame.md](./frame.md)  
**Appetite**: Medium Batch (2-3 sessions)  
**Status**: Shipped — 2026-06-01

---

## Problem

OpenFlow 的高频主流程已经能跑通，但插件和桌面端之间靠下载 JSON 再手动导入，字段结构主要依赖中文 key 和 fallback 互相猜。当前最容易造成实际交付错误的地方集中在四个断点：插件抓取可能抓空或抓错、JSON 没有明确版本与核心字段、桌面端只按尺寸存在性校验而不校验数量、项目名和文件名没有统一清洗。

这次 package 不追求大改界面，也不追求直接打通插件和桌面端通信。目标是把现有文件交接流程做稳、做短，让“提取需求 -> 导出 JSON -> 桌面端导入 -> 创建并校验 -> 重命名”这条主线更可靠。

## Requirements (R)

| ID | Requirement | Status |
|----|-------------|--------|
| R0 | 插件导出的需求数据能被桌面端稳定理解，并驱动创建目录、校验、重命名主流程 | Core goal |
| R1 | 插件 JSON 导出必须带明确 schema version、来源信息、提取时间、项目列表和尺寸数量需求 | Must-have |
| R2 | 桌面端导入必须同时兼容新 schema 与现有旧 JSON，失败时给出可读错误，不静默吞掉字段 | Must-have |
| R3 | 校验必须从“尺寸是否存在”升级为“每个尺寸的素材数量是否满足需求” | Must-have |
| R4 | 项目目录名、下载文件名、重命名变量必须经过统一安全清洗，避免中文、特殊符号、路径字符导致失败 | Must-have |
| R5 | 插件抓取和缓存要减少旧数据误用，导出前能提示空数据、缺尺寸、缺数量等明显异常 | Must-have |
| R6 | 桌面端导入 JSON 后应减少重复选择和点击，目录创建成功后能直接把创建出的项目加入工作区 | Nice-to-have, cut after testing |
| R7 | 保留 Excel 导出、AI、截图、整理、表格等既有功能，不在本 package 内砍功能 | Out |

## Solution

采用“稳定文件交接，不做直接通信”的方案：插件继续下载 JSON，桌面端继续通过文件选择导入，但两端共同围绕 `openflow.requirements.v1` 需求结构工作。桌面端新增规范化解析层，把新旧 JSON 都转成同一种内部 `RequirementProject`，后续创建目录、校验数量、重命名都只读这个内部结构。插件侧只增强抓取结果质量、导出结构和缓存提示，不重写整个 DOM 抓取器。

### Element: Requirement Contract

**What**: 定义桌面端内部需求模型，并约定插件 JSON v1 结构。核心字段包括 `schemaVersion`、`source`、`extractedAt`、`projects[]`、`projectName`、`fullName`、`producerName`、`materialType`、`requirements[]`、`resolution`、`requiredQuantity`、`positionType`、`sizeLimit`、`raw`。  
**Where**: 桌面端放在 `src/renderer/src/appState.ts` 或新增 `src/shared/requirements.ts`；插件在 `OpenFlow-Plugin/popup.js` 的 JSON 导出逻辑中生成同构对象。  
**Wiring**: `OpenFlow-Plugin/content.js` 返回原始抓取结果 -> `OpenFlow-Plugin/popup.js` 规范化为 v1 JSON -> `src/main/index.ts` 的 `dialog:openJson` 解析为内部 `RequirementProject[]` -> `src/renderer/src/App.tsx` 保存到 `projectsList` 和选中尺寸。  
**Affected code**: `/Users/neo/Documents/Projects/OpenFlow-Plugin/popup.js:364`, `/Users/neo/Documents/Projects/OpenFlow/src/main/index.ts:920`, `/Users/neo/Documents/Projects/OpenFlow/src/renderer/src/appState.ts:151`, `/Users/neo/Documents/Projects/OpenFlow/src/preload/index.ts:59`.  
**Status**: ✅ Validated

#### Place: Plugin JSON Export

**UI Affordances:**
| Affordance | Type | Wires Out | Returns To |
|------------|------|-----------|------------|
| `导出 JSON` button | Button | `exportJsonBtn` click builds v1 JSON | Browser download |
| Preview list | List | Shows task count and per-task dimension count | User decides whether to export |
| Warning summary | Inline status | Checks missing project, missing dimensions, missing requiredQuantity | Export remains available with clear warning |

**Code Affordances:**
| Affordance | Type | Wires Out | Returns To |
|------------|------|-----------|------------|
| `splitProjectName()` | Function | Parses raw task names | `projectName` and `fullName` |
| `formatDate()` | Function | Creates export date strings | file name and metadata |
| v1 JSON builder | Function block | Maps `task.details[]` into `requirements[]` and legacy `尺寸要求明细` during transition | `JSON.stringify()` download |

### Element: Desktop Import Normalizer

**What**: 从 `dialog:openJson` 中拆出纯解析/规范化函数，兼容 v1 JSON、当前数组格式、旧 `{ projectName, sizes }` 对象格式，并保留原始 `rawData`。解析失败要带错误上下文返回给 renderer。  
**Where**: `src/main/index.ts` 当前 `dialog:openJson` 逻辑在 920-1032 行，适合先局部提取函数；若文件继续膨胀，再移到 `src/main/requirements.ts`。  
**Wiring**: `dialog.openJson()` -> `parseRequirementJson(rawData, fileName)` -> 返回 `{ projects, projectName, producerName, department, email, sizes, rawData, fileName, warnings }`。renderer 继续使用现有 `handleChangeJson()`，但将 `projects` 从 `{ projectName, sizes }` 扩展为带数量的结构。  
**Affected code**: `/Users/neo/Documents/Projects/OpenFlow/src/main/index.ts:920`, `/Users/neo/Documents/Projects/OpenFlow/src/renderer/src/App.tsx:240`, `/Users/neo/Documents/Projects/OpenFlow/src/renderer/src/types/electron.d.ts:121`.  
**Status**: ✅ Validated

#### Place: Desktop Import

**UI Affordances:**
| Affordance | Type | Wires Out | Returns To |
|------------|------|-----------|------------|
| `更换需求表` action | Button | `window.electronAPI.dialog.openJson()` | Updates project list, producer, selected sizes |
| Import warning notice | Notification | Shows parser warnings from main process | User can fix export or continue |

**Code Affordances:**
| Affordance | Type | Wires Out | Returns To |
|------------|------|-----------|------------|
| `dialog:openJson` | IPC handler | Reads selected `.json` | Normalized import result |
| `parseRequirementJson()` | Function | Detects schema and legacy shapes | `RequirementProject[]` |
| `normalizeResolution()` | Function | Normalizes `1080x1920`, `1080*1920`, `1080×1920` | Consistent size keys |
| `parseRequiredQuantity()` | Function | Extracts numbers from strings like `所需数量：3` | integer quantity |

### Element: Quantity-Aware Validation

**What**: 校验结果不仅判断素材真实尺寸是否在目标尺寸集合内，还要按项目和尺寸统计实际可用数量，对不足数量输出 `missing` 结果。  
**Where**: `src/main/index.ts` 的 `fs:startValidation` 当前在 1353-1464 行；`ValidationResult` 类型在 `src/renderer/src/appState.ts:151`；调用点在 `src/renderer/src/App.tsx:309`。  
**Wiring**: renderer 根据当前 workspace folder 名匹配 `projectsList` 中对应项目，调用 `fs.startValidation(folderPath, targetRequirements)`；main 扫描媒体并统计 `{ normalizedSize -> validCount }`；对每个 required size 比较 `requiredQuantity` 和 `validCount`，缺多少补多少条 `missing` 或补一条带 `missingCount` 的结果。旧数据没有数量时保持现在的“至少一个匹配”行为。  
**Affected code**: `/Users/neo/Documents/Projects/OpenFlow/src/preload/index.ts:67`, `/Users/neo/Documents/Projects/OpenFlow/src/main/index.ts:1353`, `/Users/neo/Documents/Projects/OpenFlow/src/renderer/src/App.tsx:317`, `/Users/neo/Documents/Projects/OpenFlow/src/renderer/src/views/DailyWorkspace.tsx:193`.  
**Status**: ✅ Validated

#### Place: Validation Workflow

**UI Affordances:**
| Affordance | Type | Wires Out | Returns To |
|------------|------|-----------|------------|
| `开始校验` action | Button | `onValidate()` | Validation table and notification |
| Validation table groups | Accordion/table | Displays `valid`, `mismatch`, `missing`, `error` | User fixes files before rename |

**Code Affordances:**
| Affordance | Type | Wires Out | Returns To |
|------------|------|-----------|------------|
| `collectMediaFiles()` | Function | Reads only size folders and media files | file list |
| `fs:startValidation` | IPC handler | Reads media dimensions via `image-size`/ffprobe | `ValidationResult[]` |
| quantity counter | Function block | Counts valid files per normalized resolution | missing quantity results |

### Element: Safe Names

**What**: 增加一个统一的文件/目录段清洗函数，先覆盖最容易出事的入口：插件下载文件名、桌面端项目目录名、重命名模板变量。清洗规则不改变中文和常见短横线，只替换路径分隔符、控制字符、Windows 禁用字符、首尾空格和空名称。  
**Where**: 桌面端可放 `src/main/index.ts` 附近或新增 `src/main/safeNames.ts`；插件可在 `popup.js` 增加同名轻量函数。  
**Wiring**: `fs:initFolders` 用清洗后的 `project.projectName` 创建目录；`fs:executeRename` 对 `ProjectName`、`CleanProjectName`、`Producer`、`OriginalName` 进入最终文件名前清洗；插件 `chrome.downloads.download()` 的 `filename` 使用清洗后的制作人。  
**Affected code**: `/Users/neo/Documents/Projects/OpenFlow/src/main/index.ts:1214`, `/Users/neo/Documents/Projects/OpenFlow/src/main/index.ts:1646`, `/Users/neo/Documents/Projects/OpenFlow-Plugin/popup.js:473`.  
**Status**: ✅ Validated

### Element: Plugin Extraction Guardrails

**What**: 不重写目标网页 DOM 抓取，只给现有抓取增加质量门槛和缓存保护。提取结果要记录页面 URL、提取时间、任务数；如果结果为空、所有任务都无尺寸、数量字段全空、或恢复的是旧缓存，popup 需要明确提示。  
**Where**: `OpenFlow-Plugin/content.js` 的抓取入口和 `OpenFlow-Plugin/popup.js` 的缓存/预览/导出逻辑。  
**Wiring**: `EXTRACT_BULK_DOM` 返回 `{ success, data, warnings, sourceUrl, extractedAt }`；popup 保存缓存时也保存 metadata；打开 popup 恢复缓存时显示“上次提取”状态，用户重新提取后覆盖。  
**Affected code**: `/Users/neo/Documents/Projects/OpenFlow-Plugin/content.js:182`, `/Users/neo/Documents/Projects/OpenFlow-Plugin/content.js:386`, `/Users/neo/Documents/Projects/OpenFlow-Plugin/popup.js:59`, `/Users/neo/Documents/Projects/OpenFlow-Plugin/popup.js:120`, `/Users/neo/Documents/Projects/OpenFlow-Plugin/popup.js:193`, `/Users/neo/Documents/Projects/OpenFlow-Plugin/popup.js:249`.  
**Status**: ✅ Validated

### Element: Shorter Desktop Handoff

**What**: 创建目录后把创建出的项目路径返回给 renderer。最初计划自动加入工作区以减少“创建目录后再手动选择/拖入目录”的重复步骤；实测后发现这会把输出目录加入上传素材列表，增加清理负担，因此最终 shipped 行为是不自动加入。  
**Where**: `fs:initFolders` 当前只返回 `{ success, destPath }`，调用点在 `handleInitFolders()`。  
**Wiring**: `fs:initFolders(projectsList)` 返回 `{ success, destPath, createdPaths }`，保留给后续更明确的 handoff 使用；`handleInitFolders()` 成功后只通知目录创建完成，不把输出目录塞进素材列表。  
**Affected code**: `/Users/neo/Documents/Projects/OpenFlow/src/main/index.ts:1195`, `/Users/neo/Documents/Projects/OpenFlow/src/renderer/src/App.tsx:295`, `/Users/neo/Documents/Projects/OpenFlow/src/preload/index.ts:59`.  
**Status**: ~ Cut back after validation

## Fit Check (R x Solution)

| | Requirement Contract | Import Normalizer | Quantity Validation | Safe Names | Extraction Guardrails | Shorter Handoff |
|---|---|---|---|---|---|---|
| R0: 稳定驱动主流程 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| R1: JSON v1 元数据与需求 | ✅ | | | | ✅ | |
| R2: 新旧 JSON 兼容与可读错误 | | ✅ | | | | |
| R3: 尺寸数量校验 | ✅ | ✅ | ✅ | | | |
| R4: 文件名/目录名安全清洗 | | | | ✅ | | |
| R5: 抓取与缓存误用保护 | ✅ | | | | ✅ | |
| R6: 减少重复选择和点击 | | | | | | ~ |
| R7: 保留低频功能、不砍功能 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

Every in-scope requirement maps to at least one validated element. No gaps.

## Rabbit Holes

- **直接打通插件和桌面端通信**: Declared out of bounds. Chrome native messaging 或自定义协议会引入安装、权限、跨平台和调试成本，不适合这次稳定主线的 appetite。本次保留下载 JSON + 桌面导入。
- **创建目录后自动进入上传素材列表**: Cut back after real testing. 输出目录不是素材源目录，自动加入会制造一堆噪声项，用户还得手动清空。
- **完全重写网页抓取器**: Cut back. 当前 `content.js` 依赖目标页面 class 和文本结构，重写成通用解析器容易变成大工程。本次只做 warnings、metadata、缓存保护和导出前异常提示。
- **同时整理所有低频功能入口**: Declared out of bounds. AI、截图、整理、表格、游戏库暂不砍不藏，避免把稳定主流程和产品减法混在同一个 build。
- **跨 repo 共享 TypeScript 包**: Cut back. 插件是普通 MV3 JS 项目，桌面端是 Electron/TS。先用 schema 文档和两端小型 normalizer 保持一致，后续再考虑抽共享包。
- **把所有 `src/main/index.ts` IPC 拆文件**: Cut back. 主进程文件确实过大，但本次只提取需求解析/安全命名的纯函数，避免大范围重构。
- **严格阻止所有异常导出**: Patched. 插件应阻止空数据导出；缺尺寸或缺数量给强提示但仍允许导出，避免真实页面字段临时变化时完全卡死工作。

## No-Gos

- **不删除 `OpenFlow-Plugin/openflow-desktop`**: 用户已确认它是第一代废弃版本，但删除旧目录不属于本 package。
- **不做新弹窗式沟通流程**: 插件和桌面端继续使用现有入口，不新增需要用户额外配置的大型对话框。
- **不改变 Excel 报表主逻辑**: Excel 导出只允许复用同一套规范化结果，不能在本次里重新设计报表模板系统。
- **不把按钮放在应用右上角**: 遵守项目 `AGENTS.md`，新增或调整的关键按钮避开 top-right 区域。
- **不要求用户迁移历史 JSON**: 旧格式继续能导入，新 schema 是向前增强。

## Technical Validation

**Codebase reviewed**:

- `/Users/neo/Documents/Projects/OpenFlow-Plugin/manifest.json:1` confirms MV3 extension with `activeTab`, `scripting`, `downloads`, `storage`.
- `/Users/neo/Documents/Projects/OpenFlow-Plugin/content.js:182` contains async bulk extraction over `.ant-tag.ant-tag-yellow` and `.p-4.cursor-pointer`.
- `/Users/neo/Documents/Projects/OpenFlow-Plugin/content.js:265` extracts size cards and `requiredQuantity`.
- `/Users/neo/Documents/Projects/OpenFlow-Plugin/popup.js:59` stores extracted data in Chrome local storage.
- `/Users/neo/Documents/Projects/OpenFlow-Plugin/popup.js:364` builds JSON export from `extractedBulkData`.
- `/Users/neo/Documents/Projects/OpenFlow-Plugin/popup.js:481` builds Excel export separately, so JSON changes must not assume Excel gets updated automatically.
- `/Users/neo/Documents/Projects/OpenFlow/src/main/index.ts:920` parses JSON import and currently drops quantity.
- `/Users/neo/Documents/Projects/OpenFlow/src/main/index.ts:1195` creates project/size folders.
- `/Users/neo/Documents/Projects/OpenFlow/src/main/index.ts:1353` validates actual media dimensions and currently only adds one missing row per size.
- `/Users/neo/Documents/Projects/OpenFlow/src/main/index.ts:1470` executes rename and constructs final names.
- `/Users/neo/Documents/Projects/OpenFlow/src/preload/index.ts:59` exposes the folder and validation IPC signatures.
- `/Users/neo/Documents/Projects/OpenFlow/src/renderer/src/App.tsx:240` imports JSON into UI state.
- `/Users/neo/Documents/Projects/OpenFlow/src/renderer/src/App.tsx:295` creates folders.
- `/Users/neo/Documents/Projects/OpenFlow/src/renderer/src/App.tsx:309` runs validation.
- `/Users/neo/Documents/Projects/OpenFlow/src/renderer/src/appState.ts:151` defines `ValidationResult`.

**Approach validated**: The existing flow already has the necessary hooks: plugin can add fields before download, desktop can normalize on import, renderer already stores `projectsList`, main validation already scans files and returns `ValidationResult[]`, and folder creation already knows every project and size. The solution fits by extending these existing seams rather than introducing a new transport or app-wide refactor.

**Flagged unknowns resolved**:

- The desktop can keep backward compatibility because `dialog:openJson` already supports arrays and objects with fallback keys.
- Quantity validation is feasible because plugin already extracts `requiredQuantity` and main validation already computes real dimensions for every media file.
- The shorter handoff is feasible because `fs:initFolders` already knows `rootPath`, `project.projectName`, and size folders; it can return created project roots to existing `addFolders()`.
- Safe name handling is local and does not require OS-specific filesystem APIs beyond replacing invalid path characters before `join()`.

**Test strategy**:

- Add pure unit coverage for `normalizeResolution()`, `parseRequiredQuantity()`, `parseRequirementJson()`, and `sanitizePathSegment()` using Node's built-in `node:test`, matching the existing `src/renderer/src/utils.test.ts` pattern.
- Add parser fixtures for v1 JSON, current plugin JSON array, old `{ projectName, sizes }`, missing quantity, malformed resolution, and empty list.
- Add a focused validation test around quantity counting by extracting the counter into a pure function, instead of requiring real image/video files for every case.
- Run `npm run lint` after implementation.
- Manually load the extension, extract a known page, export JSON, import it in desktop, create folders, validate a small fixture folder, and confirm missing quantity rows appear before rename is allowed.

---

## Status: Shipped — 2026-06-01
