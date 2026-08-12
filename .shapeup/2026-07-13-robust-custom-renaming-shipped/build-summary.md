# Build Summary — 稳定且高度可定制的文件重命名

**Feature ID**: 2026-07-13-robust-custom-renaming
**Build sessions**: 01
**Date completed**: 2026-07-14

## What Was Built

- 新增版本化 `openflow.rename.v2` 具名预设模型，兼容迁移旧六模板并保留手搓自定义文本和顺序。
- 设置页新增可搜索模板库，支持新建、复制、重命名、删除、自定义图片/视频规则、字段增删重排、连接符、日期和序号格式。
- 日常页新增自动、常规、特殊、自定义四种互斥模式，展示当前具名模板、真实文件名预检、显式常规降级和失败项重试。
- 主进程新增确定性 planner/executor：完整预检、有限冲突分配、无覆盖、原扩展名保留、路径级执行结果和部分失败恢复。
- 配置运行时收敛到 `workflow.renameSettings`；App 常驻持久化，主进程写入串行、临时文件 fsync 后使用同目录原子 rename 替换，并限制单实例避免多进程破坏配置。
- 统一制作人拼音缩写和横竖变量，使设置样例、日常预览与真实执行一致。
- 最终文件名通过共享渲染器校验 Windows 保留名、首尾点/空格、禁用字符和长度；设置样例与 planner 不再静默产生不同名称。
- 新增统一 `npm test`，完整 73 项测试通过；Electron main/preload/renderer 生产 bundle 构建通过。
- 使用电脑自动化在浅色、深色和窄窗口验证搜索、编辑、模式选择、保存状态和 UI 语义区分；生成 PNG/MP4 真实改名成功。

## What Was Cut (Scope Hammering)

- 模板跨设备导入导出：不影响本机团队可靠使用，需另行定义外部文件契约。
- 拖拽字段排序：使用键盘可操作的前移/后移按钮完成同一能力，避免增加依赖。
- 整批事务回滚：本批次用执行前预检、逐项结果和失败重试控制风险；跨文件系统事务超出 appetite。
- 任意脚本、正则和 AI 命名：保持规则可理解、可预检和可审计。

## Files Changed

- `src/shared/renameTemplates.ts`、`src/shared/renameTemplates.test.ts`
- `src/main/rename.ts`、`src/main/rename.test.ts`、`src/main/renameContext.ts`
- `src/main/configStore.ts`、`src/main/configStore.test.ts`
- `src/main/index.ts`、`src/preload/index.ts`
- `src/renderer/src/App.tsx`、`src/renderer/src/appState.ts`、`src/renderer/src/appState.test.ts`
- `src/renderer/src/views/RenameTemplateSettings.tsx`
- `src/renderer/src/views/SettingsWorkspace.tsx`、`src/renderer/src/views/DailyWorkspace.tsx`
- `src/renderer/src/types/electron.d.ts`
- `electron.vite.config.ts`、`package.json`、`tsconfig.node.json`、`tsconfig.web.json`

## What Surprised Us

- 原“手搓”开关本身已接通；真正失效点是执行前重新读取旧顶层配置，加上设置页卸载会取消最后一次延迟保存。
- 无序号固定模板的冲突循环不仅会命名失败，还可能无限等待，因此必须先计划完整批次并设置有限分配策略。
- 桌面视觉验收发现设置样例的制作人和横竖文本与真实执行不一致，也发现窄窗口自定义文本输入过窄；两项均在 ship 前修正。
- 归档审计进一步复现 `CON` 在设置样例与 planner 中不一致；最终名称校验已收敛到共享渲染器，并补充设置/执行同源回归。
- 两个开发实例同时写同一 JSON 能产生尾部损坏；新增单实例、串行队列和 `node:fs` 原子替换后，跨实例和进程中断不再留下半写文件。
