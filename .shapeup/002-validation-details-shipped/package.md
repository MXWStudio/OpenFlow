# Package: 校验详情降噪与异常优先

**Feature ID**: 002-validation-details  
**Created**: 2026-06-01  
**Frame**: [frame.md](./frame.md)  
**Appetite**: Small Batch (1 session)  
**Status**: Shipped — 2026-06-02

---

## Problem

OpenFlow 的校验结果已经能识别尺寸错误、读取失败和数量不足，但“素材详情”目前仍按文件逐行展示所有结果。真实项目里通过项通常最多，异常项反而被淹没，用户需要自己扫表才能判断现在能不能重命名、缺几张、哪些素材阻断流程。

这个 package 的目标是把校验详情从“完整流水账”改成“下一步行动面板”：先告诉用户是否能继续，再列出真正需要处理的异常，最后把已通过素材弱化为统计或折叠明细。

## Requirements

- **R0**: 校验详情默认突出“现在该处理什么”，而不是默认展示完整文件列表。
- **R1**: 读取失败、格式错误、尺寸不符等会阻断重命名的问题必须排在最前，并且比缺数量更强。
- **R2**: 数量不足必须显示目标尺寸、需要数量、已有数量、缺少数量，并说明不阻断“先重命名已有素材”。
- **R3**: 已通过素材默认弱化，只展示数量汇总；需要排查时仍能展开查看。
- **R4**: 每个项目/文件夹分组要有简洁摘要，让用户不用展开就能看到阻断数、缺口数、通过数。
- **R5**: 不改校验算法、不改插件抓取、不改 IPC 数据格式；只利用现有 `ValidationResult` 做展示层整理。

## Solution

保留 001 已建立的校验数据模型和重命名规则，在 renderer 里增加一个纯展示层的 presentation model。`DailyWorkspace` 不再直接按 `validationResults` 原始顺序渲染表格，而是先把结果归类、计数、排序，再渲染为“需要处理”和“已通过”两个层级。

### Element: Validation Presentation Model

**What**: 新增一个纯函数，把 `ValidationResult[]` 转成按项目分组的展示模型，包含阻断项、缺数量项、通过项、各类计数和排序后的行。  
**Where**: 新建 `src/renderer/src/validationPresentation.ts`，避免继续把 `DailyWorkspace.tsx` 变大。  
**Wiring**: `DailyWorkspace` 调用 `buildValidationPresentation(validationResults)`，用返回的 groups 渲染摘要、Accordion 和表格。  
**Affected code**: `src/renderer/src/views/DailyWorkspace.tsx`, `src/renderer/src/appState.ts`, `src/renderer/src/validationPresentation.ts`.  
**Complexity**: Low.  
**Status**: Validated.

### Element: Priority-First Detail View

**What**: 每个分组内部按优先级排序：读取失败/格式错误 -> 尺寸不符 -> 数量不足 -> 已通过。默认展开有阻断或缺口的分组。  
**Where**: `src/renderer/src/views/DailyWorkspace.tsx` 的 `groupedPreviewRows`、`accordionValue` 和 table 渲染区域。  
**Wiring**: 使用 presentation model 中的 `blockingRows`、`missingRows`、`validRows`。表格优先渲染 `blockingRows + missingRows`，通过项放进单独折叠区。  
**Affected code**: `src/renderer/src/views/DailyWorkspace.tsx`.  
**Complexity**: Medium.  
**Status**: Validated.

### Element: Summary Counts And Rename State

**What**: 素材详情顶部和每个项目 header 显示关键数字：阻断项数量、缺少张数、已通过数量，以及当前是否可以“先重命名已有素材”。  
**Where**: `DailyWorkspace` 的素材详情 card 顶部、Accordion.Control、现有系统状态文案附近。  
**Wiring**: `canRename` 继续由 `App.tsx` 传入；展示层只根据结果计数调整文案，不改变按钮可用逻辑。  
**Affected code**: `src/renderer/src/views/DailyWorkspace.tsx`, `src/renderer/src/App.tsx`.  
**Complexity**: Low.  
**Status**: Validated.

### Element: Weakened Passed Rows

**What**: 已通过素材不再和异常同级铺满详情表。默认显示“已通过 N 项”，用户需要时展开查看文件明细。通过项 badge 用更轻的呈现，避免视觉上和异常抢重点。  
**Where**: `DailyWorkspace` table body 和 `StatusBadge`。  
**Wiring**: `StatusBadge` 保留现有 `valid` 状态能力；`DailyWorkspace` 决定通过项是否渲染为折叠明细。  
**Affected code**: `src/renderer/src/views/DailyWorkspace.tsx`, `src/renderer/src/StatusBadge.tsx`.  
**Complexity**: Low.  
**Status**: Validated.

### Changes

| File / Module | Change | Serves |
|---------------|--------|--------|
| `src/renderer/src/validationPresentation.ts` | 新增展示层归类/计数/排序 helper：按项目分组，计算 `blockingCount`、`missingTotal`、`validCount`，并产出优先级排序后的行。 | R0, R1, R2, R4, R5 |
| `src/renderer/src/validationPresentation.test.ts` | 用 Node test 覆盖排序、计数、缺口汇总、通过项折叠条件。 | R1, R2, R3, R4 |
| `src/renderer/src/views/DailyWorkspace.tsx` | 使用 presentation model 替代当前 `groupedPreviewRows`；默认只展开异常分组；表格先显示需处理项；通过项折叠在“已通过 N 项”下。 | R0, R1, R2, R3, R4 |
| `src/renderer/src/views/DailyWorkspace.tsx` | 修正详情开关文案：展开时显示“收起详情”，折叠时显示“查看详情”；素材详情顶部增加总摘要。 | R0, R4 |
| `src/renderer/src/StatusBadge.tsx` | 保留现有状态语义，弱化 `valid` 在通过明细里的视觉权重；异常和缺口状态保持醒目。 | R1, R2, R3 |
| `src/renderer/src/App.tsx` | 不改 `canRename` 计算规则；如需要，只传递已有 `canRename/hasIssues` 给详情文案使用。 | R2, R5 |

**Fit check**: Every R above maps to at least one change. No gaps.

## Rabbit Holes

- **把校验算法也一起改掉**: Declared out of bounds. 001 已经完成数量校验，002 只整理展示层，避免把用户反馈里的“看不清”扩成主进程重写。
- **做完整需求编辑器**: Declared out of bounds. 用户发现插件抓多/抓少时，002 只把缺口和阻断原因提前说清楚；手动修正需求数量可以后续单独 frame。
- **新增顶部右上角操作按钮**: Declared out of bounds. 遵守 `AGENTS.md`，关键按钮继续避开应用 top-right 区域。
- **把素材详情改成全新复杂表格组件**: Cut back. 沿用现有 Mantine `Accordion` 和 `Table`，只改信息架构、排序和折叠策略。
- **隐藏所有通过项**: Patched. 默认弱化和折叠，但保留展开查看，方便用户追查命名来源或某个文件为什么被算作通过。

## No-Gos

- **不改 `fs:startValidation` 返回结构**: 现有 `ValidationResult` 已有 `status`、`requiredQuantity`、`actualQuantity`、`missingCount`、`workspaceProjectName`，足够支撑本次展示。
- **不改重命名放行规则**: `missing` 仍不阻断重命名；`mismatch/error/format_error` 仍阻断重命名。
- **不改插件 JSON schema**: 002 不处理抓取准确性，只把桌面端校验结果讲清楚。
- **不做全局 UI 重排**: 只动“素材详情”和必要的状态摘要，不碰其他低频模块入口。

## Technical Validation

**Key files reviewed**:

- `src/renderer/src/views/DailyWorkspace.tsx`: 当前素材详情直接用 `groupedPreviewRows` 渲染所有行，异常分组会展开，但组内仍按原始结果顺序混排。
- `src/renderer/src/StatusBadge.tsx`: 状态标签已经能区分 `valid`、`mismatch`、`missing`、读取失败，并能显示 `缺 N 张`。
- `src/renderer/src/appState.ts`: `ValidationResult` 已包含本次所需的展示字段。
- `src/renderer/src/App.tsx`: `canRename` 已经允许 missing-only 场景先重命名已有素材，阻断逻辑不需要重做。
- `src/main/index.ts`: `fs:startValidation` 已经生成 `missing` 行和 exact counts，002 不需要改主进程。

**Approach validated**: 002 需要的信息都已经在 renderer 收到的 `validationResults` 中。最小技术路径是在 renderer 新增纯 presentation helper，让 UI 从“原始结果表”切换为“决策摘要 + 优先级明细 + 折叠通过项”。这不会影响插件、IPC、主进程扫描或重命名执行。

**Flagged unknowns resolved**:

- 阻断与缺口可区分：`status !== 'valid' && status !== 'missing'` 已经是现有阻断定义。
- 缺口张数可计算：`missingCount` 表示缺少数量，`requiredQuantity`/`actualQuantity` 可直接展示。
- 通过项可折叠：通过项不参与阻断判断，只影响可重命名文件数量和明细追溯。
- 分组名可复用：renderer 已在校验后补 `workspaceProjectName`，展示层可优先使用它。

**Test strategy**:

- 先为 `buildValidationPresentation()` 写单元测试，覆盖排序、分组、计数和 missing-only 场景。
- 再改 `DailyWorkspace` 使用 helper，避免边改 UI 边改业务判断。
- 运行 `node --test src/renderer/src/validationPresentation.test.ts src/renderer/src/utils.test.ts`。
- 运行 `npm run lint`。
- 手工验证三个场景：全部通过、missing-only 可继续重命名、尺寸/读取异常阻断重命名。

---

## Status: Shipped — 2026-06-02
