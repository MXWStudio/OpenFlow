# Package: 稳定且高度可定制的文件重命名

**Feature ID**: 2026-07-13-robust-custom-renaming
**Created**: 2026-07-14
**Frame**: [frame.md](./frame.md)
**Status**: Shipped — 2026-07-14

---

## Problem

团队成员在设置中修改“手搓命名”或自定义文本后，回到日常页面启用手搓模式，实际文件仍可能使用旧模板。当前开关、IPC 和主进程模板分支虽然已经接通，但运行时会优先读取另一份可能过期的 `renameTemplates`，设置页最后 500ms 内的修改又可能在离开页面时被取消保存。

特殊模板失败后，用户只能改用常规命名并人工二次处理；固定文本或无序号模板发生重名时还可能使主进程无限循环。设置页同时连续展示六个外观相近的固定模板，团队成员难以快速找到并确认正在编辑、保存和使用的是哪一套规则。

## Appetite

**Big Batch（4–5 个工作会话）**。范围覆盖模板契约与迁移、单一持久化来源、设置页预设管理、日常页模式选择与预检、主进程安全执行、失败恢复和自动化验收。固定时间内优先保证命名正确性与可恢复性，视觉精修排在功能链路之后。

## Requirements (R)

| ID | Requirement | Status |
|----|-------------|--------|
| R0 | 团队在日常页选择自定义命名后，设置中的具名模板必须稳定、准确地作用到实际批量文件，并且预览、保存与执行结果一致。 | Core goal |
| R1 | 用户可以创建、复制、重命名和删除自定义模板；每个模板分别配置图片与视频规则，并可添加、删除和调整字段顺序。 | Must-have |
| R2 | 自定义能力覆盖现有九类字段、自定义文本、连接符、日期格式及序号起点/补零/包裹形式；不要求用户编写脚本。 | Must-have |
| R3 | 日常页必须明确显示当前命名模式和自定义模板名称；自动、强制常规、强制特殊、自定义四种选择互斥且可预检。 | Must-have |
| R4 | 模板配置只有一个运行时可信来源；旧六模板配置升级后不丢失现有自定义文本或字段顺序，最后一次编辑离开设置页后仍可立即用于本次执行。 | Must-have |
| R5 | 空模板、缺失字段、非法名称、目录不识别和重名冲突不能造成静默跳过、覆盖已有文件或无限等待；执行前给出可操作错误。 | Must-have |
| R6 | 自定义模式不可执行时，用户可以明确选择降级到常规模板；文件占用等部分失败保留失败项并允许只重试失败项。 | Must-have |
| R7 | 设置页通过结构、标签和主题语义色区分系统/特殊/自定义及图片/视频规则，并支持按名称查找；关键操作不放在应用右上角。 | Must-have |
| R8 | 验收由自动生成的文件系统夹具覆盖规则渲染、迁移、冲突、失败与真实改名操作，并补充图片/视频应用冒烟验证，不依赖用户素材才能完成。 | Must-have |

## Solution

引入版本化的“命名预设”模型：系统常规、系统特殊和任意数量的具名自定义预设都包含图片、视频两条规则。渲染器只维护一份内存状态并持久化到 `workflow.renameSettings`；日常页把明确的模式选择和当前预设传给主进程，主进程先生成不会互相冲突的完整计划，再按计划逐项执行并返回结构化结果。

模板设置改为左侧可搜索的预设库、右侧当前规则编辑区。日常页在现有“命名方式”区域展示互斥模式、当前自定义预设和真实批次预览；无效自定义规则只提供显式降级入口，不自动改用另一套名称。设计实现可以调整具体组件组合，但必须保留下述数据流、错误边界和远离右上角的操作位置。

### Element: 版本化命名预设与同源渲染器

**What**: 新增共享的 `openflow.rename.v2` 契约和纯函数渲染器。一个 `RenamePreset` 具有稳定 ID、可读名称、`regular | special | custom` 类型，以及图片/视频两条 `RenameRule`。规则保存有稳定 ID 的字段序列、连接符、日期格式和序号设置。

**Where**: 新建 `src/shared/renameTemplates.ts`；`src/renderer/src/appState.ts` 的 `WorkflowSettings` 改为持有 `renameSettings`；`tsconfig.node.json` 与 `tsconfig.web.json` 纳入 `src/shared/**/*`。

**Wiring**:

- `renderRenameRule(rule, variables, sequence)` 同时服务设置预览与主进程真实计划，消除两套拼接逻辑。
- `validateRenamePreset()` 拦截空名称、空规则、空自定义文本、非法连接符/包裹符和超出范围的序号设置。
- `formatRenameDate()` 使用本机日期，支持 `YYYYMMDD`、`YYYY-MM-DD`、`MMDD`。
- `formatRenameSequence()` 支持起点、0–6 位补零及自定义前后包裹；字段仍限定为当前九类。
- 选中的字段代表用户明确要求：实际变量缺失时预检报错，不再填入 `Project`、`Producer` 等伪数据。

**Affected code**: `src/shared/renameTemplates.ts`（新）、`src/renderer/src/appState.ts`、`tsconfig.node.json`、`tsconfig.web.json`。

**Complexity**: Medium

**Status**: ✅ Validated — 当前模板已经是有序 token 数组，共享纯函数可以直接承接既有九类变量；主进程和 renderer 均由 electron-vite 的 bundler 解析相对导入，只需把共享目录加入两个 TypeScript project。

#### Place: 共享命名领域模块

**UI Affordances:**

| Affordance | Type | Wires Out | Returns To |
|------------|------|-----------|------------|
| 具名预设 | 数据模型 | 图片规则 + 视频规则 | 设置预设列表、日常预设选择 |
| 字段序列 | 有序配置 | `renderRenameRule()` | 设置样例名、批次候选名 |
| 规则选项 | 配置 | 日期/序号格式化函数 | 确定性文本片段 |

**Code Affordances:**

| Affordance | Type | Wires Out | Returns To |
|------------|------|-----------|------------|
| `normalizeRenameSettings()` | Pure function | v2 数据或默认值 | 完整合法的 `RenameSettingsV2` |
| `migrateLegacyRenameTemplates()` | Pure function | 六个旧模板数组 | 常规、特殊和“手搓命名”预设 |
| `validateRenamePreset()` | Pure function | 预设及规则 | 字段级错误数组 |
| `renderRenameRule()` | Pure function | 规则、变量、序号 | 最终基础文件名或缺失变量错误 |

### Element: 单一配置来源与向后迁移

**What**: 运行时只读写 `workflow.renameSettings`。旧 `workflow.renameTemplates` 与顶层 `renameTemplates` 只在启动迁移时读取一次；旧顶层键保留在磁盘但停止参与执行。App 持有的 `workflowSettings` 是日常执行的唯一 renderer 来源。

**Where**: `src/renderer/src/App.tsx` 的启动配置恢复、workflow 持久化和 `handleRename()`；`src/renderer/src/views/SettingsWorkspace.tsx` 的保存 effect；`src/main/index.ts` 的轻量配置存储。

**Wiring**:

- 启动时优先规范化 `workflow.renameSettings`；没有 v2 数据时，按 `workflow.renameTemplates`、旧顶层 `renameTemplates`、内置默认值的顺序迁移。
- 旧 `videoRegular/imageRegular` 组成常规预设，`videoSpecial/imageSpecial` 组成特殊预设，`videoManual/imageManual` 组成可重命名的“手搓命名”自定义预设。
- App 完成 hydration 后监听 `workflowSettings` 并写入单一 `workflow` 键；该 effect 位于不随页面切换卸载的 App 层，因此离开设置页不会取消最后一次编辑。
- 日常执行直接使用当前 `workflowSettings.renameSettings`，不再重新读取旧顶层键。
- 主进程把配置 set/delete 串行化，防止通知历史和 workflow 等并发 read-modify-write 互相覆盖。
- 设置页展示 `正在保存 / 已保存 / 保存失败` 状态；保存失败不影响本次内存预览，但执行前会明确提示持久化风险。

**Affected code**: `src/renderer/src/App.tsx`、`src/renderer/src/views/SettingsWorkspace.tsx`、`src/renderer/src/appState.ts`、`src/main/index.ts`、`src/renderer/src/types/electron.d.ts`。

**Complexity**: Medium

**Status**: ✅ Validated — 当前所有配置已经通过 `store:getAll` / `store:set` 的 JSON 路径读写，迁移可以在既有 hydration 边界完成；停止执行前二次读取即可消除已确认的状态分叉。

#### Place: App 配置恢复与保存

**UI Affordances:**

| Affordance | Type | Wires Out | Returns To |
|------------|------|-----------|------------|
| 保存状态 | 状态标签 | workflow 持久化 Promise | 正在保存、已保存或错误说明 |
| 旧配置迁移提示 | 一次性信息 | 迁移结果 | 当前预设库 |

**Code Affordances:**

| Affordance | Type | Wires Out | Returns To |
|------------|------|-----------|------------|
| App hydration | Effect | `store.getAll()` → `normalizeRenameSettings()` | 唯一 `workflowSettings` 状态 |
| Workflow persistence | Effect | `workflowSettings` → `store.set('workflow')` | 保存状态 |
| Serialized store mutation | Main-process queue | `store:set` / `store:delete` | 顺序一致的配置文件 |

### Element: 可搜索的具名模板库与规则编辑器

**What**: 把设置页连续六段模板改为两栏结构：左侧是按“系统模板 / 自定义模板”分组的可搜索列表，右侧编辑选中预设。自定义预设支持新建、复制、命名和删除；系统常规/特殊不能删除，可恢复默认。图片/视频规则使用明确的分段选择。

**Where**: 新建 `src/renderer/src/views/RenameTemplateSettings.tsx`，由 `src/renderer/src/views/SettingsWorkspace.tsx` 的“命名模板”Tab 挂载；复用 Mantine 的 `TextInput`、`Tabs`/`SegmentedControl`、`Badge`、`Select`、`ActionIcon`、`Alert`。

**Wiring**:

- 搜索只过滤显示，不改变模板数据；匹配名称、系统/自定义类型和图片/视频标签。
- 新建或复制产生稳定 UUID，并立即进入编辑区；自定义名称按大小写不敏感规则校验唯一性。
- 字段使用稳定 token ID；向左/向右按钮改变数组顺序，避免重新引入已移除的拖拽依赖，也提供键盘可操作性。
- 自定义文本直接绑定当前 token 的 `value`；共享渲染器同步生成样例名和错误。
- 规则选项包含连接符、日期格式、序号起点、补零位数、前缀和后缀。
- 系统、特殊和自定义同时使用文字/图标/Badge 与主题语义色区分，颜色不是唯一线索；图片和视频编辑区也有明确标签。
- “新建模板”、复制、删除、恢复默认等按钮放在模板列表下方或编辑器底部操作带，不放在应用右上角。

**Affected code**: `src/renderer/src/views/RenameTemplateSettings.tsx`（新）、`src/renderer/src/views/SettingsWorkspace.tsx`、`src/renderer/src/appState.ts`。

**Complexity**: High

**Status**: ✅ Validated — 当前设置页已使用 Mantine 且模板 Tab 是独立区域；两栏预设库可以在不改变全局导航的前提下替换现有 `templateSections.map()`，字段移动按钮不需要新增 UI 依赖。

#### Place: 设置 > 命名模板

**UI Affordances:**

| Affordance | Type | Wires Out | Returns To |
|------------|------|-----------|------------|
| 模板搜索 | Search input | 过滤预设名称/分类 | 左侧预设列表 |
| 系统/自定义分组 | List sections | 选择预设 ID | 右侧编辑器 |
| 新建/复制模板 | Buttons | 创建 `RenamePreset` | 新预设编辑状态 |
| 模板名称 | Text input | 名称唯一性校验 | 列表标题与日常选择器 |
| 图片/视频切换 | Segmented control | 选择规则分支 | 对应字段和选项 |
| 字段类型 | Select | 更新 token type | 样例名与错误 |
| 自定义文本 | Text input | 更新 token value | `renderRenameRule()` |
| 左移/右移/删除 | Action buttons | 重排或删除 token | 有序字段数组 |
| 添加字段 | Button | 追加带 UUID 的 token | 字段编辑区 |
| 连接符/日期/序号设置 | Inputs | 更新 `RenameRule` | 样例名与真实预检 |
| 样例与错误 | Preview/Alert | 共享校验结果 | 用户修正规则 |
| 保存状态 | Badge/Text | App persistence state | 用户确认规则已持久化 |

**Code Affordances:**

| Affordance | Type | Wires Out | Returns To |
|------------|------|-----------|------------|
| `createCustomPreset()` | Helper | 默认图片/视频规则 | 新具名预设 |
| `duplicatePreset()` | Helper | 深复制 + 新 UUID | 可编辑副本 |
| `moveRenameToken()` | Pure helper | token ID + direction | 重排后的规则 |
| `filterRenamePresets()` | Pure helper | 搜索词 + 预设库 | 分组后的列表 |
| `validateRenamePreset()` | Shared function | 编辑中预设 | 行内错误与保存状态 |

### Element: 日常页显式模式、真实预检与降级入口

**What**: 用互斥模式控件替换两个容易产生含糊状态的开关，模式为“自动、常规、特殊、自定义”。自定义模式显示具名预设选择器；完成素材校验后自动请求真实批次预检，展示有效模板、示例结果、冲突后名称和阻断错误。

**Where**: `src/renderer/src/App.tsx` 的模式/预检/批次结果状态，`src/renderer/src/views/DailyWorkspace.tsx` 的现有“命名方式”卡和底部执行区。

**Wiring**:

- `RenameSelection` 替代 `isSpecialEnabled/isManualEnabled`：自动模式保留项目名识别特殊规则；常规/特殊强制对应系统预设；自定义要求选择有效 custom preset ID。
- 验证通过的文件、当前选择、项目名、制作人或模板变化时，App 调用 `fs.previewRename()`；请求序号保证较旧的异步结果不会覆盖较新的选择。
- 预检卡展示当前预设名称、图片/视频各自采用的规则、前几条 `旧名 → 新名` 和错误数量。
- 模板无效或已被删除时，执行按钮禁用，并在命名方式卡内提供“改用常规”按钮；用户确认后重新预检，不静默降级。
- 执行时主进程重新规划，防止预览后目录发生变化；UI 使用执行返回的最终名称更新历史。
- 全部成功后沿用当前清理 workspace 的行为；部分失败时保留文件夹、失败 validation row 和结果面板，提供“仅重试失败项”。

**Affected code**: `src/renderer/src/App.tsx`、`src/renderer/src/views/DailyWorkspace.tsx`、`src/renderer/src/appState.ts`、`src/renderer/src/validationPresentation.ts`（仅在需要区分已重命名/待重试状态时扩展）。

**Complexity**: High

**Status**: ✅ Validated — 当前日常页已集中持有模式、校验结果、执行按钮和通知状态；新增 preview state 与一个窄 IPC 可以在原位置接入，不需要新的页面或路由。

#### Place: 日常 > 命名方式与执行区

**UI Affordances:**

| Affordance | Type | Wires Out | Returns To |
|------------|------|-----------|------------|
| 自动/常规/特殊/自定义 | Segmented control | 更新 `RenameSelection.mode` | 真实预检 |
| 自定义模板选择 | Select | 更新 `customPresetId` | 当前模板名和预检 |
| 当前模板摘要 | Badge/Text | 展示有效 preset/rule | 用户确认实际规则 |
| 改名样例 | Preview list | `fs.previewRename()` | 旧名、新名、警告 |
| 改用常规 | Inline button | 选择 regular | 重新预检 |
| 执行重命名 | Existing bottom action | `fs.executeRename()` | 批次结果/历史 |
| 仅重试失败项 | Inline/bottom action | 失败 file paths | 新批次结果 |

**Code Affordances:**

| Affordance | Type | Wires Out | Returns To |
|------------|------|-----------|------------|
| Preview effect | React effect | 当前文件 + settings + selection → `fs.previewRename` | 最新 `RenamePreview` |
| `handleRename()` | App action | 同一请求 → `fs.executeRename` | `RenameBatchResult` |
| Partial-result reducer | State helper | success/failed paths | 待重试 validation rows |
| History writer | Existing store action | 最终成功项 | success/warning history |

### Element: 确定性改名计划与可恢复执行器

**What**: 把 `applyNewTemplate()`、模板选择、冲突循环和文件执行从宽大的 `src/main/index.ts` 提取到可测试模块。主进程先为每个输入生成结构化计划，所有阻断错误在任何文件变化前返回；执行阶段逐项处理并返回路径级结果。

**Where**: 新建 `src/main/rename.ts`；`src/main/index.ts` 只注册 `fs:previewRename` 与更新后的 `fs:executeRename`；同步更新 `src/preload/index.ts` 和 `src/renderer/src/types/electron.d.ts`。

**Wiring**:

- `selectRenamePreset()` 根据明确模式和当前文件上下文选 preset；自定义 ID 缺失是阻断错误。
- `buildRenamePlan()` 只接收 `status === 'valid'` 的媒体，但每个跳过原因都产生结果，不再静默 `continue`。
- 尺寸目录统一使用需求解析已接受的 `* / x / X / × / -` 形式；不在尺寸目录内的文件返回明确错误。
- 规则渲染后保留原始扩展名；重命名不会把 MOV/AVI 等仅改后缀伪装成 MP4。
- 目录现有名称和本批次保留名称统一做 Unicode NFC + 大小写不敏感比较，优先避免在 Windows/默认 macOS 文件系统上冲突。
- 含 Sequence 的规则通过增加序号重新渲染；不含 Sequence 的固定规则追加确定性冲突后缀。每次候选都必然变化，并以“现有条目数 + 本批次条目数 + 2”为搜索上界，因此不会无限循环。
- 预检拒绝空结果、非法/保留名称、超出常见单文件名 255-byte 上限和已存在目标；实际执行前再次检查目标。
- 执行按计划顺序处理，不覆盖计划外已有文件；每项返回 `oldPath/newPath/status/errorCode/error`。目标在预览后被占用时重新分配安全名称并在结果中标明。
- 文件占用、权限和路径错误只使对应项目失败；其他成功项保留，renderer 可以针对失败路径重试。

**Affected code**: `src/main/rename.ts`（新）、`src/main/index.ts`、`src/main/renameContext.ts`、`src/preload/index.ts`、`src/renderer/src/types/electron.d.ts`。

**Complexity**: High

**Status**: ✅ Validated — 当前 `executeRename` 所需的文件元数据、目录读取、路径上下文和 `fs.rename` 都已经存在；提取 planner 后可在不启动 Electron 的情况下使用临时目录验证真实文件操作。顺序执行牺牲少量吞吐，换取确定性结果和简单恢复。

#### Place: Main-process rename IPC

**UI Affordances:**

| Affordance | Type | Wires Out | Returns To |
|------------|------|-----------|------------|
| 批次预检 | IPC request | 文件、settings、selection、上下文 | `RenamePreview` |
| 批次执行 | IPC request | 同一请求 | `RenameBatchResult` |

**Code Affordances:**

| Affordance | Type | Wires Out | Returns To |
|------------|------|-----------|------------|
| `selectRenamePreset()` | Pure function | mode + file context + settings | effective preset/rule |
| `buildRenameVariables()` | Pure function | validation row + project + producer + date | token variables |
| `allocateUniqueFileName()` | Pure/planning helper | candidate + reserved names | 有界唯一名称 |
| `buildRenamePlan()` | Async planner | request + directory entries | preview items/errors |
| `executeRenamePlan()` | Async executor | fresh plan + `fs.rename` | 路径级结果 |
| `fs:previewRename` | IPC handler | `buildRenamePlan()` | renderer preview |
| `fs:executeRename` | IPC handler | replan → execute | renderer recovery state |

### Element: 自动化验收与真实文件系统夹具

**What**: 使用现有 `node:test` 建立共享规则、迁移、planner 和 executor 的回归套件，并把所有测试纳入统一 `npm test`。夹具在系统临时目录创建空媒体文件与 validation metadata，即可验证真实路径和改名；应用冒烟再生成一张小 PNG 和一个短 MP4 覆盖现有校验入口。

**Where**: 新建 `src/shared/renameTemplates.test.ts`、`src/main/rename.test.ts`；按需新增 renderer 预设筛选/移动 helper 测试；更新 `package.json` 的 test script 与现有静态保留测试。

**Wiring**:

- 共享测试覆盖自定义文本、字段顺序、连接符、三种日期格式、序号样式、缺失变量和非法规则。
- 迁移测试覆盖六个旧模板、顶层旧键、自定义文本保留、缺失分支回退和重复名称/ID 规范化。
- planner/executor 测试在临时目录覆盖图片/视频分支、手搓预设选择、无 Sequence 固定名冲突、已有目标、大小写冲突、多目录独立序号、未识别目录、源文件缺失和部分失败重试。
- 超时断言保护“固定模板冲突永不挂起”的回归场景。
- 现有 51 项测试继续运行；`npm run lint` 与 `npm test` 作为自动验收门槛。
- 手动冒烟覆盖设置命名 → 离开设置 → 日常选择 → 预检 → 执行 → 部分失败重试，并在浅色/深色主题确认模板分区和按钮位置。

**Affected code**: `src/shared/renameTemplates.test.ts`（新）、`src/main/rename.test.ts`（新）、可能的 `src/renderer/src/renameTemplatePresentation.test.ts`（新）、`package.json`。

**Complexity**: Medium

**Status**: ✅ Validated — 项目已直接使用 Node 22 的 `node:test` 执行 TypeScript 测试，当前 51 项测试通过；临时目录中的真实 `fs.rename` 不需要有效媒体内容，图片/视频内容只用于最后的 validation 冒烟。

#### Place: 本地验收入口

**UI Affordances:**

| Affordance | Type | Wires Out | Returns To |
|------------|------|-----------|------------|
| 自动测试命令 | CLI | `npm test` | 统一通过/失败结果 |
| 应用冒烟清单 | Manual flow | 设置 → 日常 → 文件系统 | 可观察验收证据 |

**Code Affordances:**

| Affordance | Type | Wires Out | Returns To |
|------------|------|-----------|------------|
| Shared-domain tests | `node:test` suite | render/migrate/validate | 确定性规则证明 |
| Rename integration tests | `node:test` + temp dir | plan/execute/retry | 真实文件结果 |
| Existing regression suite | Test script | 当前全部 test files | 无既有流程回归 |

## Fit Check (R × Solution)

| | 预设与渲染器 | 单一配置来源 | 设置预设库 | 日常预检 | 计划/执行器 | 验收套件 |
|---|---|---|---|---|---|---|
| R0: 自定义设置准确作用到文件 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| R1: 具名模板与字段管理 | ✅ | | ✅ | ✅ | | ✅ |
| R2: 高度自定义但无需脚本 | ✅ | | ✅ | ✅ | ✅ | ✅ |
| R3: 明确互斥模式和当前模板 | ✅ | | | ✅ | ✅ | ✅ |
| R4: 单一来源与旧配置迁移 | ✅ | ✅ | ✅ | ✅ | | ✅ |
| R5: 不静默、不覆盖、不挂起 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| R6: 显式降级和失败重试 | | | | ✅ | ✅ | ✅ |
| R7: 模板查找与视觉区分 | | | ✅ | ✅ | | ✅ |
| R8: 自主自动化验收 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

每个 Requirement 至少被一个已验证元素覆盖，每个元素也服务至少一个 Requirement；没有覆盖缺口。

## Rabbit Holes

- **“手搓”开关是否完全没接线**：代码审计确认页面开关、App 状态、IPC 参数和主进程 manual 分支已经连通。根因按模板状态分叉和延迟保存处理，不重写无关的页面工作流。
- **旧配置有两份且优先级冲突**：迁移只在启动边界读取旧键，v2 写入后运行时只使用 `workflow.renameSettings`。旧顶层键不删除，避免破坏用户历史数据，但不再影响执行。
- **离开设置页取消最后一次保存**：workflow 持久化上移到不会随路由卸载的 App；执行使用当前内存状态，因此即使磁盘写入仍在进行，本次预检和执行也使用同一版本。
- **并发 store set 丢字段**：主进程配置变更排队串行 read-modify-write。范围不扩展为数据库或多进程同步。
- **无 Sequence 模板导致无限循环**：不含序号时追加必然变化的冲突后缀；候选次数有可证明的有限上界。含序号时由共享渲染器递增序号。
- **预览后目录发生变化**：执行入口重新规划并立即复核目标；返回值以最终计划为准。外部程序在极小时间窗口内同时写入同一目标仍可能使单项失败，但不会使批次卡死，失败项可重试。
- **POSIX `rename` 可能替换目标**：executor 在调用前重新读取并拒绝已存在目标，所有本应用生成目标在 planner 中预留；同一 OpenFlow 实例不会覆盖已有文件。跨进程、对抗性文件系统竞争不作为本批次的事务保证。
- **批次部分成功后当前 UI 清空全部状态**：新结果包含 old/new path 和状态；只有全成功才清空，部分失败保留失败 validation rows 和 workspace。
- **视频被直接改成 `.mp4`**：重命名模块始终保留原扩展名；格式转换仍由独立格式处理功能负责。
- **尺寸目录标准不一致**：`SIZE_FOLDER_REGEX` 与需求 `normalizeResolution()` 对齐，接受 `* / x / X / × / -`，并补充对应测试。
- **非法、空或超长最终名称**：设置校验处理静态规则，真实预检处理动态变量和文件名 byte 长度；不把空值替换为看似有效的英文占位词。
- **系统常规模板也被用户改坏，无法降级**：系统预设不能删除，非法编辑不能形成可执行预检，并提供恢复默认；降级动作只在常规预设有效时出现。
- **自动降级可能批量产生错误名称**：不自动降级。UI 明确展示原因和“改用常规”，由用户确认后重新生成预检。
- **为字段拖拽重新增加依赖**：使用可访问的左移/右移按钮完成排序，避免恢复已移除的拖拽包和额外交互风险。
- **测试是否必须依赖用户真实素材**：文件改名集成测试只需临时文件和 validation metadata；最终 validation 冒烟使用程序生成的小图片/视频，用户素材仅作为可选补充。

## No-Gos

- **不提供任意 JavaScript、正则表达式或条件脚本**：安全与可理解性风险超出 4–5 个会话；本批次用字段、字面文本和格式选项覆盖高频突发规则。
- **不新增 AI 识图或 AI 命名**：相关功能已经退休，也不是本 Frame 的问题。
- **不做云端模板同步、权限或多人实时编辑**：团队共同使用在本批次指每台客户端都能可靠管理预设；中心化协作需要独立基础设施。
- **不做模板包导入/导出**：先保证本地模型、迁移和执行链路稳定，避免同时引入外部文件契约。
- **不按项目/文件夹建立自动模板映射规则**：日常页明确选择和 auto 特殊识别已经覆盖当前问题；通用条件路由会演变成规则引擎。
- **不重命名目录**：只处理已通过校验的媒体文件，保持现有安全边界。
- **不在重命名中转换媒体格式或内容**：原扩展名保留，格式处理继续使用现有独立流程。
- **不提供整批事务回滚或撤销栈**：本批次采用执行前完整预检、逐项结果和失败重试；跨文件系统事务会超出 appetite。
- **不重做整个设置中心或日常页视觉系统**：视觉工作仅覆盖模板查找、分类、规则编辑和当前模式反馈；所有关键按钮避开应用右上角。

## Technical Validation

**Codebase reviewed**:

- `src/renderer/src/App.tsx`：配置 hydration、模式状态、校验结果、重命名调用、历史与 workspace 清理。
- `src/renderer/src/views/SettingsWorkspace.tsx`：500ms 保存、双份模板写入、固定模板列表和样例预览。
- `src/renderer/src/views/DailyWorkspace.tsx`：特殊/手搓开关、命名方式卡、校验与执行按钮。
- `src/renderer/src/appState.ts`：六固定键、九类 token、默认模板和 renderer-only preview。
- `src/main/index.ts`：JSON store、媒体校验、模板选择、冲突循环和并发 `fs.rename`。
- `src/main/renameContext.ts`：尺寸目录上下文与当前分隔符限制。
- `src/main/requirements.ts`：尺寸规范化与路径片段清理。
- `src/preload/index.ts`、`src/renderer/src/types/electron.d.ts`：当前宽松的 rename IPC 契约。
- `tsconfig.node.json`、`tsconfig.web.json`、`electron.vite.config.ts`：main/renderer 项目边界和 bundler 配置。
- 当前 8 个测试文件、架构决策和既有 51 项绿色测试。

**Approach validated**: 当前 UI、App 状态、IPC 和文件 API 已经具备所有连接入口。把模板渲染和文件计划提取为纯模块后，可在 Node 测试中覆盖原本嵌在 Electron main handler 内的风险；v2 迁移能复用现有 JSON store，不需要数据库或新运行依赖。UI 使用现有 Mantine 组件，字段排序不新增拖拽依赖。

**Flagged unknowns resolved**: 模板失效断点、旧配置优先级、离页保存、无序号冲突、部分失败恢复、视频扩展名、尺寸目录差异、测试素材来源和 UI 操作位置均已通过代码核查或明确边界解决。最终 Package 不依赖未决定的技术机制。

**Test strategy**:

1. 先写共享规则与旧配置迁移测试，再实现 v2 模型和 renderer preview。
2. 再写临时目录 planner/executor 测试，复现当前固定模板卡死、手搓自定义文本失效和部分失败场景。
3. 更新 IPC 类型与 App wiring 后运行完整 `npm test` 和 `npm run lint`。
4. 使用程序生成的小 PNG/MP4 完成设置保存、日常选择、预检、真实改名和失败重试冒烟。
5. 在浅色/深色主题检查模板分区、文字/颜色双重识别、窄窗口滚动和所有关键操作均不位于应用右上角。

---

## Status: Shipped — 2026-07-14
