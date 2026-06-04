# Frame: 次要功能砍范围

**Record ID**: 004  
**Feature ID**: 004-cut-secondary-features  
**Created**: 2026-06-02  
**Status**: Shipped — archived 2026-06-03

---

## Problem

OpenFlow 的主价值已经收敛到日常 AIGC 广告素材生产流程：导入需求数据表/JSON、创建项目目录、添加素材、校验尺寸与数量、批量重命名和整理归档。

但应用里仍然挂着多条偏工具箱式的次要功能线。它们能单独工作，却让产品边界变宽：

- 侧边栏里除了日常和整理，还有 AI 识图、表格、库等入口。
- 截屏/贴图能力不在主导航里，但通过全局快捷键、独立窗口、设置页和 IPC 常驻在应用结构中。
- 表格、AI 识图、库各自带状态、数据库/本地文件、网络配置或命名逻辑，维护成本不小。
- 用户在日常主流程里真正需要的是更稳定、更少步骤、更少异常噪声；低频工具入口会分散注意力，也让后续改主流程时更容易踩到无关代码。

当前 workaround 是用户靠记忆忽略这些入口，只使用日常和整理主流程。但这些功能仍然出现在导航、设置、快捷键、preload API、主进程 IPC、数据库结构和类型定义里，继续增加测试与维护面。

这个 frame 的核心不是“删得越多越好”，而是判断这些次要功能是否应该从 OpenFlow 的当前主线里退出，以便把注意力和工程预算留给更高频的生产流程。

## Affected Segment

主要受影响者是 OpenFlow 的日常使用者，也就是高频处理广告素材生产任务的人：

- 需要快速完成数据表/JSON 导入、素材校验和重命名。
- 希望打开应用后第一眼看到的是当前工作流状态，而不是多个平行工具。
- 在紧急交付时，低频入口、设置项和异常状态会变成认知噪声。

次要受影响者是维护者。当前应用已经跨 renderer、preload、main、SQLite、全局快捷键、独立 BrowserWindow 和本地 asset 协议，这些次要功能会放大每次重构、测试和打包的风险。

## Business Value

如果这个问题值得继续 shaping，并能在可控 appetite 内完成，它应该带来这些价值：

- 降低产品复杂度：让 OpenFlow 更像一个稳定的生产工作台，而不是泛用工具箱。
- 降低维护成本：减少需要持续兼容的导航入口、设置项、IPC、数据库表和独立窗口逻辑。
- 降低误改风险：主流程迭代时，不必同时考虑低频模块的状态联动和类型依赖。
- 提高使用专注度：用户打开应用时更快进入日常/整理流程。
- 为后续主流程改进留预算：把工程注意力集中到校验详情、需求修正、导入稳定性和素材整理体验上。

## Evidence

来自 2026-06-02 的代码检查：

- `src/renderer/src/App.tsx` 的侧边栏导航包含 `AI识图`、`表格`、`库` 三个非主流程入口，并在视图分发中加载 `AiWorkspace`、`BitableWorkspace`、`GameDictionaryWorkspace`。
- `src/main/index.ts` 有独立的截屏与贴图功能：全屏透明 `BrowserWindow`、`desktopCapturer`、剪贴板贴图、保存截图、悬浮贴图窗口等。
- `src/preload/index.ts` 暴露了 `screenshot` API，同时也暴露了数据库与游戏库相关 API。
- `src/renderer/src/views/BitableWorkspace.tsx` 自带 Excel 导入、SQLite 记录、数据表格和 dashboard 字段选择状态。这里的“数据表”指侧边栏表格功能，不是日常主流程的需求数据表/JSON 导入。
- `src/renderer/src/views/AiWorkspace.tsx` 自带图片拖拽、外部视觉模型调用、结果解析和 AI 批量重命名路径。
- `src/renderer/src/views/GameDictionaryWorkspace.tsx` 自带游戏名、别名、图片素材、本地存储、粘贴图片和增删改查。
- `src/main/utils/db.ts` 维护 `game_mappings` 和 `excel_files` 等表结构，说明表格和库不是纯 UI，可见砍范围会涉及数据与存储边界。
- 001 frame 已经把表格、AI 识图、游戏库、截图贴图等低频功能列为第一阶段非目标，说明它们一直被视为主流程之外的功能面。

## Cut Candidates

用户指定的砍功能候选：

1. 截屏：包含截屏、保存、复制、贴图、相关快捷键与设置。
2. 数据表：指侧边栏 `表格` / `BitableWorkspace`，不指日常流程里的需求数据表/JSON 导入。
3. AI 识图：指独立 `AI识图` 工作区与外部视觉模型批量命名，不指未来可能用于主流程错误诊断的 AI 能力。
4. 库：指侧边栏 `库` / 游戏库 / GameDictionary 工作区及其本地图片映射。

这些是 shaping 阶段需要确认的候选边界，不是在 framing 阶段直接承诺具体删除方式。

## Appetite

Medium Batch（2-3 个会话）。

理由：如果只是隐藏几个导航入口，这是 Small Batch；但真正“砍功能”需要梳理 renderer 入口、设置项、preload API、main IPC、数据库表、持久化配置、类型定义和可能的残留用户数据。四条候选功能跨越多个层次，适合用 Medium Batch 做一次清晰、可回滚的减法。

## Work To Clarify During Shaping

后续 shaping 需要回答这些问题：

1. 每个候选功能是直接删除、先隐藏、移到实验入口，还是保留代码但从产品表面退出。
2. 已有本地数据如何处理：保留不读、导出备份、迁移，还是删除相关表。
3. 设置页中哪些截屏、AI、数据表或库配置需要一起移除。
4. preload 暴露的 API、main IPC handler 和类型定义是否能同步收窄。
5. 侧边栏剩余入口如何排序，且不能把按钮放在应用右上角以避免被系统通知遮挡。
6. 是否需要保留一个开发/调试开关，防止误删后无法恢复验证。
7. 哪些测试或 smoke check 能证明主流程没有被误伤。

## Non-Goals For This Frame

- 不砍日常主流程：需求数据表/JSON 导入、创建目录、素材校验、重命名、整理归档。
- 不砍 002 正在推进的校验详情降噪与异常优先。
- 不把“数据表”误解为日常导入的需求数据。
- 不在 framing 阶段决定具体实现方案或直接删除代码。
- 不做全局 UI redesign。
- 不新增替代功能。
- 不处理已废弃的旧桌面端。

## Frame Statement

> If we can shape this into something doable and execute within a Medium Batch,
> it will reduce OpenFlow's product and maintenance surface by retiring low-frequency
> tool-style modules, so the app can stay focused on the daily production workflow
> that actually improves validation, renaming, and organizing efficiency.

---

## Status: Shipped — archived 2026-06-03
