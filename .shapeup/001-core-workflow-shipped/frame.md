# Frame: 插件到桌面端核心流程稳定化

**Record ID**: 001  
**Feature ID**: 001-core-workflow  
**Created**: 2026-05-29  
**Status**: Shipped — 2026-06-01

---

## Problem

OpenFlow 已经是长期使用的个人生产力工具，但当前从浏览器插件到桌面端的主流程仍然依赖多个手动步骤和隐式约定：插件从工单页面抓数据并下载 JSON/Excel，桌面端再由用户手动选择 JSON、创建目录、添加素材目录、校验尺寸、执行重命名和整理。

这个流程的核心痛点不是“缺少更多功能”，而是高频主流程里存在几个容易出错的断点：

- 插件导出的 JSON 与桌面端导入逻辑没有统一 schema，字段主要靠中文 key 和 fallback 互相猜。
- 桌面端目前更像在校验“有没有某个尺寸”，没有可靠地校验“每个尺寸需要多少个素材”。
- 网页抓取依赖页面 class 和文本结构，页面结构变化时容易抓空、抓错或生成看似正常但内容错误的数据。
- 项目名、网页字段、AI 返回内容、用户输入等进入文件名/目录名时缺少统一的安全清洗。
- 导入、创建目录、添加工作区、校验、重命名之间仍然需要多次重复选择和点击。

用户目前的 workaround 是在插件和桌面端之间通过下载文件手动流转，并依赖人工核对导出结果和校验结果。这能工作，但每次页面结构变化、字段缺失、数量不一致或文件名异常时，问题往往要到后续处理或交付前才暴露。

## Affected Segment

主要受影响者是 OpenFlow 的日常使用者，也就是需要处理 AIGC 广告素材生产流程的人。当前已知这是用户自己长期使用的工具，主场景包括：

- 从网页创意工单/资产管理页面提取任务信息。
- 生成 JSON/Excel 报表。
- 将需求导入桌面端。
- 创建项目目录和尺寸目录。
- 校验本地图片/视频素材尺寸与数量。
- 按命名规则批量重命名。
- 将素材整理归档到目标目录。

次要受影响者是未来维护这个工具的人。当前插件和桌面端各自维护字段映射、文件处理和错误处理逻辑，如果不先稳定主流程，后续新增或砍功能都会比较冒险。

## Business Value

如果这个问题值得继续 shaping，并能在可控 appetite 内完成，它应该带来这些价值：

- 降低日常交付错误：减少 JSON 字段错位、尺寸数量漏检、项目目录命名失败等问题。
- 减少操作步骤：让“插件提取 -> 桌面处理”的主流程更短、更顺手。
- 提高两端配合稳定性：插件和桌面端围绕同一份需求数据理解工作，避免靠 fallback 猜测。
- 支持后续减法：先把主流程稳定下来，再隐藏、合并或移除低频功能，风险更低。
- 降低维护成本：明确哪些代码属于主线，哪些是实验、旧功能或工具箱功能。

## Evidence

来自本轮只读检查的证据：

- 浏览器插件入口在 `OpenFlow-Plugin/manifest.json`，核心抓取逻辑在 `OpenFlow-Plugin/content.js`，导出逻辑在 `OpenFlow-Plugin/popup.js`。
- 插件抓取依赖页面结构和样式选择器，例如 `.ant-tag.ant-tag-yellow`、`.p-4.cursor-pointer`、`.truncate`、`section.bg-white.p-4.shadow-md`。这些选择器说明页面结构变化时抓取稳定性存在风险。
- 插件 JSON 导出在 `popup.js` 中重建中文字段对象，包括 `项目名称`、`尺寸要求明细`、`其他信息` 等。
- 桌面端 JSON 导入在 `src/main/index.ts` 的 `dialog:openJson` 中解析，兼容 `项目名称/projectName/name` 和 `尺寸要求明细/sizes` 等多种格式，但没有统一 schema 或 schema version。
- 桌面端校验在 `src/main/index.ts` 的 `fs:startValidation` 中按尺寸集合判断是否匹配，并补充 missing；目前没有把插件导出的 `所需数量` 作为一等校验条件。
- 桌面端主流程聚合在 `src/renderer/src/App.tsx` 和 `src/renderer/src/views/DailyWorkspace.tsx`，主进程 IPC 大量集中在 `src/main/index.ts`。
- 当前桌面端有多个低频或边缘功能入口：表格、AI 识图、游戏库、格式处理、截图贴图等。它们可能有价值，但会分散主流程注意力。
- `OpenFlow-Plugin/openflow-desktop` 是第一代旧桌面端，用户已确认废弃，后续不应作为主线依据。

## Appetite

Medium Batch（2-3 个会话）。

理由：这不是一次大重构，也不应该先做大规模删功能。这个 frame 应先覆盖主流程中最容易造成实际错误的稳定性和流程卡点。范围过小会只能修表面问题，范围过大又容易滑向重构和功能清理。

## Work To Clarify During Shaping

以下不是解决方案承诺，而是后续 shaping 必须回答和圈定的工作面：

1. 插件和桌面端需要共同承认哪些核心字段。
2. JSON 是否需要 `schemaVersion`、来源页面、提取时间、原始字段备份。
3. 桌面端如何判断每个尺寸的 required quantity 与 actual count。
4. 文件名和目录名需要在哪些入口统一清洗。
5. 插件抓取失败时，用户应该看到哪些可行动的提示。
6. 插件缓存、重复导出、旧页面数据误用如何避免。
7. 桌面端导入 JSON 后，哪些步骤可以自动串联，哪些仍需要用户确认。
8. 哪些低频功能先隐藏或降级，不进入第一阶段修改范围。

## Non-Goals For This Frame

- 不做 UI 大重构。
- 不新增大量新功能。
- 不删除已有功能。
- 不处理已废弃的 `OpenFlow-Plugin/openflow-desktop` 第一代桌面端。
- 不把表格、AI 识图、游戏库、截图贴图等低频功能作为第一阶段主任务。
- 不在 framing 阶段决定具体实现方案。

## Frame Statement

> If we can shape this into something doable and execute within a Medium Batch,
> it will make the plugin-to-desktop production workflow more reliable and shorter,
> reducing daily delivery mistakes while preserving the high-frequency OpenFlow core.

---

## Status: Shipped — 2026-06-01
