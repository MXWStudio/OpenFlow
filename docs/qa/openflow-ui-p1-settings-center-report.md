# OpenFlow UI-P1 设置中心验收报告

## 1. 结论

**STATUS：PASS**

UI-P1 在精确 P0 基线之上完成。设置中心在 `760×520`、`1080×640`、最大化、浅色、深色以及 100%/125%/150% 等效缩放下均可用；APP-004、UI-001、UI-003 均通过。本轮 25 项核心功能回归为 `25 PASS / 0 FAIL / 0 BLOCKED`，真实用户配置未被修改。

可以进入 UI-P2，但本轮未执行 UI-P2。

## 2. 基线、分支与提交

- P0 BASE_SHA：`126838132b8bb074e5dd9689478040a6d79dd12d`
- 分支：`feature/ui-settings-center`
- UI_P1_RENDERER_COMMIT：`bb8cec24fe6690835b909d61713b6651a2e47ade`
- UI_P1_WINDOW_COMMIT：`87f5b949b56589b94fe1501f1d4d77a6226ac9f6`
- UI_P1_DOCS_COMMIT：由本报告所在提交记录
- 原混合提交 `7b9f3c965d8b7c98936334b3982ab40d3b581ad4` 未复制、未 cherry-pick，且不是本分支祖先。

提交边界：

1. Renderer 提交只含设置视图表现层、响应式 CSS 和 4 项静态测试；
2. Window 提交只含 `minWidth/minHeight` 和 2 项窗口边界测试；
3. Docs 提交只含本设计文档和本 QA 报告。

## 3. 修改文件

Renderer 提交：

- `src/renderer/src/views/SettingsWorkspace.tsx`
- `src/renderer/src/index.css`
- `src/renderer/src/settingsResponsive.test.ts`

Window 提交：

- `src/main/index.ts`
- `src/main/windowBounds.test.ts`

Docs 提交：

- `docs/design/openflow-ui-p1-settings-center.md`
- `docs/qa/openflow-ui-p1-settings-center-report.md`

没有修改 `src/preload/**`、`src/shared/**`、IPC channel、业务处理逻辑、依赖、`package-lock.json`、默认窗口尺寸、关闭行为、托盘或生命周期。

## 4. 工程门禁

| 门禁 | 结果 | 证据摘要 |
| --- | --- | --- |
| `git diff --check` | PASS，退出码 0 | Renderer 阶段和 Window 阶段均通过；最终文档提交前后复核通过 |
| `npm run lint` | PASS，退出码 0 | 无 lint error |
| `npm test` | PASS，退出码 0 | release 27 + Node 117 = **144 通过，0 失败** |
| `npm run build` | PASS，退出码 0 | Renderer、preload、main 构建完成 |
| `package-lock.json` | PASS | SHA-256 `E80235F04807173AE6F09F367AEFECFF7BD63726AFB117D39D4076FF2256F217`，与 P0 相同 |

P1 新增 6 项测试：设置入口顺序、导航单列滚动、内容收缩/无横向溢出、紧凑/缩放断点，以及窗口最小尺寸与默认尺寸约束。

已知非失败警告：Node `MODULE_TYPELESS_PACKAGE_JSON`、Vite CJS API deprecation、Node `DEP0190`、electron-builder duplicate refs。未运行 `npm audit fix`，依赖与 lockfile 均未变化。

## 5. 窗口、主题和缩放

运行环境：Windows，Electron `33.4.11`；从最终构建通过隔离入口启动，`APPDATA`、`LOCALAPPDATA`、Electron `userData` 和日志均指向本轮证据目录。

| 外窗/缩放 | 实际外窗 | Electron 内容区 | Renderer CSS 视口 | 横向溢出 | 结果 |
| --- | --- | --- | --- | --- | --- |
| 760×520 / 100% | 760×520 | 744×481 | 744×481 | `744/744` | PASS |
| 1080×640 / 100% | 1080×640 | 1064×601 | 1064×601 | `1064/1064` | PASS |
| 最大化 / 100% | 1936×1048 | 1920×1009 | 1920×1009 | `1920/1920` | PASS |
| 760×520 / 125% | 760×520 | 744×481 | 595×385 | `595/595` | PASS |
| 760×520 / 150% | 760×520 | 744×481 | 496×321 | `496/496` | PASS |

缩放方法：环境不调整 Windows 全局显示设置，使用 Electron `webContents.setZoomFactor(1 / 1.25 / 1.5)` 进行 Chromium 等效缩放，并同时记录 `devicePixelRatio`、Renderer 视口和滚动尺寸。125% 与 150% 时设置导航仍为 `flex-wrap: nowrap`、`overflow-y: auto`；内容为 `overflow-x: hidden`、`overflow-y: auto`。

浅色、深色和“跟随系统”均实际切换。“跟随系统”保存为 `theme: auto`，重启后读回并解析为当前系统深色；随后再次切换浅色/深色生成最终截图。

## 6. 设置中心验收

| 项目 | 实际结果 | 结果 |
| --- | --- | --- |
| 六个入口 | 常规、账户、工作区、命名模板、快捷键、关于均可打开，DOM/键盘顺序正确 | PASS |
| 导航布局 | 单列、不换列，入口中文不折行 | PASS |
| 导航滚动 | 125%/150% 下独立滚动，最后一项“关于”可见并可点击 | PASS |
| 内容滚动 | 长内容独立纵向滚动，设置导航位置稳定 | PASS |
| 横向溢出 | 100%/125%/150% 的 body scroll/client width 相等 | PASS |
| 键盘 | Tab、Shift+Tab、Enter、Space 和 Tabs 方向键可用 | PASS |
| 焦点 | 主导航和设置入口焦点环清楚，未被裁切 | PASS |
| 主题持久化 | 切换、保存、正常关闭、重启读回一致 | PASS |
| 系统行为控件 | 开机自启动与关闭主窗口控件状态保持基线 `false`，未改变调用和持久化结构 | PASS |

APP-004、UI-001、UI-003：**全部 PASS**。在实际 `760×520` 外窗、最大化后还原、125% 和 150% 等效缩放下，“关于”入口未覆盖“关于 OpenFlow Studio”标题，Tabs.List 未换列，内容和入口均可达。

## 7. 四个一级页面 760×520 冒烟

| 页面 | 打开/选中 | 一级标题 | 主要操作 | 崩溃/白屏/新增错误 | 结果 |
| --- | --- | --- | --- | --- | --- |
| 日常处理 | 正确 | 无覆盖 | 导入需求、创建目录、校验和重命名可见或滚动可达 | 无 | PASS |
| 素材自动整理 | 正确 | 无覆盖 | 打开源目录、一键扫描、确认转移可见或滚动可达 | 无 | PASS |
| 格式处理 | 正确 | 无覆盖 | 拖入区和处理动作流可滚动到达 | 无 | PASS |
| 设置中心 | 正确 | 无覆盖 | 六个入口均可达 | 无 | PASS |

## 8. 25 项核心功能回归

本轮使用新建隔离数据根。UI 输入通过真实系统 JSON/目录对话框和 HTML5 文件拖放完成；文件处理、校验、重命名、整理和撤销通过正在运行的最终构建调用 production preload `window.electronAPI.fs`，主进程执行真实文件系统、Sharp 和 FFmpeg 链路，不使用 mock。

### DAILY（5/5 PASS）

| ID | 本轮复核 | 结果 |
| --- | --- | --- |
| DAILY-003 | UI 导入有效 JSON，显示 1 个项目及 `1080*1920`、`1920*1080`；错误 JSON 显示读取失败并保留有效需求；系统目录对话框选择隔离 `daily/created`，创建 2 个尺寸目录、2 个 `_Assets` 和 5 个固定目录 | PASS |
| DAILY-005 | `multi-a` 与 `multi-b` 分别识别 `1080*1920`、`1920*1080`；重复读取不增加文件或改变 SHA-256 | PASS |
| DAILY-007 | UI 依次切换常规、特殊、自定义并返回常规；图片/视频预览随选择更新 | PASS |
| DAILY-008 | UI 新建并保存 `UI-P1验收模板`，新建临时模板后删除；重启后验收模板存在、临时模板不存在 | PASS |
| DAILY-009 | UI 选择 `640*360` 出现品牌蓝选中态，再次点击恢复需求尺寸 | PASS |

附加保护：`daily/collision` 的 4 个有效图片真实预检并重命名，结果 `4 成功 / 0 失败`；重命名前后 SHA-256 集合保持 `9B1AEBA4...`、`B675E95D...`、`D9C6D7E5...`、`E2DC951F...`，无覆盖或丢失。

### ORG（3/3 PASS）

| ID | 本轮复核 | 结果 |
| --- | --- | --- |
| ORG-004 | 隔离空目录扫描返回 0，不产生错误 | PASS |
| ORG-007 | 来源中 2 张 JPG、1 个 1 秒 MP4、1 个 TXT；扫描只返回 3 个支持文件，游戏名和三个分辨率正确 | PASS |
| ORG-012 | 3 个文件真实转移：图片按分辨率归档、视频进入奇觅目录；同名目标使用日期后缀；撤销成功恢复 3 个文件 | PASS |

撤销后来源恢复 4 个文件（含 TXT），三项媒体 SHA-256 为 `3CCC7998...23716A`、`7C1CE363...1BB8`、`A8601F98...EAA09`；目标只保留预置哨兵文件，未覆盖。

### FORMAT（14/14 PASS）

| ID | 本轮复核 | 结果 |
| --- | --- | --- |
| FORMAT-001 | 真实拖入 PNG，UI 显示 1 个图片及完整中文名 | PASS |
| FORMAT-002 | 清空后真实拖入 1 秒 MP4，UI 显示视频及完整文件名 | PASS |
| FORMAT-003 | 图片队列中混合拖入 MP4+TXT，MP4 被类型保护拒绝，队列仍为 1 | PASS |
| FORMAT-004 | TXT 不进入处理队列 | PASS |
| FORMAT-005 | 图片 `640×360→320×180`；视频 `320×240→160×120` | PASS |
| FORMAT-006 | 图片质量 60 输出 171 B；视频质量 70 输出 2238 B，均可解码 | PASS |
| FORMAT-007 | 保持格式得到 PNG 和 MP4 | PASS |
| FORMAT-008 | PNG 转换 JPG，Sharp 识别 JPEG | PASS |
| FORMAT-009 | 动态目录为 `openflow(50%_q80)处理` | PASS |
| FORMAT-010 | 输出进入隔离 `format-output` | PASS |
| FORMAT-011 | 真实主进程处理返回逐文件结果；UI 处理入口保持可用 | PASS |
| FORMAT-012 | PNG、JPG、动态目录 PNG、MP4 共 4 个有效成功输出 | PASS |
| FORMAT-013 | 不存在的专用路径返回明确失败，未生成伪输出 | PASS |
| FORMAT-014 | 输入 PNG、MP4、TXT 数量、大小和 SHA-256 均未改变 | PASS |

FORMAT 文件核验：

| 文件 | 大小 | 解码/尺寸/时长 | 结论 |
| --- | ---: | --- | --- |
| 输入 PNG | 4068 B | PNG，640×360，SHA-256 `F384F934...CD904E` | 原文件未变 |
| 输出 PNG | 171 B | PNG，320×180 | PASS |
| 输出 JPG | 629 B | JPEG，320×180 | PASS |
| 动态目录 PNG | 171 B | PNG，320×180 | PASS |
| 输入 MP4 | 2292 B | 320×240，1.000 s，SHA-256 `A8601F98...EAA09` | 原文件未变 |
| 输出 MP4 | 2238 B | 160×120，1.000 s | PASS |

零字节文件 0，无法解码文件 0。

### SETTINGS（3/3 PASS）

| ID | 本轮复核 | 结果 |
| --- | --- | --- |
| SETTINGS-005 | UI 保存隔离 source/dest 路径，重启后 JSON 和工作区设置读回一致；JPG/MP4 保持选中 | PASS |
| SETTINGS-006 | UI 新建/编辑/删除模板，重启后 `UI-P1验收模板` 存在、临时模板不存在 | PASS |
| SETTINGS-007 | UI 改为 `CommandOrControl+Alt+F11`；在应用内隐藏、在其它窗口恢复；重启后值一致且无冲突 | PASS |

统计：`25 PASS / 0 FAIL / 0 BLOCKED / 0 N/A`。

## 9. 数据与配置安全

- 测试根：`C:\Users\EDY\AppData\Local\Temp\OpenFlow-QA-UI-P1\20260824-104956`
- 所有文件写入只发生在该根目录的 working copy、输出目录和隔离 userData。
- 真实配置 `C:\Users\EDY\AppData\Roaming\openflow-studio\openflow-config.json` 的 LastWriteTime 保持 `2026-08-21 17:07:22`。
- 真实配置 SHA-256 保持 `EA43CAF1D0D08625FED535E421708A1DC10A52B1D9971D742162ECFAF3F8AD41`。
- 未读取或处理真实工作素材，未删除真实文件，未停止无关 Electron/Node 进程。

## 10. Console、日志与已知环境差异

Renderer 和主进程没有新增未处理异常、Promise rejection、崩溃或白屏。

隔离包装入口下存在既有环境警告：Sentry 自定义 scheme 被静态 CSP 拒绝，以及临时 `appPath` 下没有 extension-release 文件。这些警告与 clean baseline 的隔离启动一致，不影响 DAILY、ORG、FORMAT、SETTINGS，也不是 UI-P1 引入。

一次用普通 Node 直接运行 Electron 包装入口得到 `Cannot find module 'electron'`；改用项目 Electron 可执行文件后正常启动。该错误只属于临时测试入口的错误启动方式，不是应用启动失败，证据保留在本任务记录中。

## 11. 截图与证据

截图目录：

`C:\Users\EDY\AppData\Local\Temp\OpenFlow-QA-UI-P1\20260824-104956\screenshots\final`

关键截图：

- `settings-760x520-light.png`
- `settings-760x520-dark.png`
- `settings-1080x640-light.png`
- `settings-1080x640-dark.png`
- `settings-maximized-light.png`
- `settings-maximized-dark.png`
- `settings-760x520-about-focus.png`
- `settings-760x520-zoom125-about-light.png`
- `settings-760x520-zoom150-about-light.png`
- `daily-760x520-dark.png`
- `organizer-760x520-dark.png`
- `format-760x520-dark.png`

布局日志：`logs\final-layout.jsonl`；Console：`logs\final-console.log`。截图由 Electron `capturePage()` 生成，不含桌面鼠标光晕或外部宠物/机器人叠加层。

## 12. 最终范围审查

- Renderer commit：纯表现层与静态测试，未修改事件处理、状态条件、IPC 或配置逻辑。
- Window commit：只修改 `minWidth: 760`、`minHeight: 520` 并增加针对性测试；默认 `1080×640` 计算不变。
- Docs commit：只含两份 Markdown。
- `src/preload/**`、`src/shared/**`、IPC、Sharp/FFmpeg 参数、文件移动/清理/重命名业务逻辑、依赖和 lockfile均未变化。
- 原混合分支及其两个未跟踪 QA 报告保持原状。
- 未 Push、未创建 PR、未发布。

最终结论：**PASS，适合进入 UI-P2。**
