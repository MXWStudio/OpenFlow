# OpenFlow UI-P0 Foundation 验收报告

## 1. 基线、分支与保护状态

- 实施验收日期：2026-08-21（Asia/Shanghai）
- 封存日期：2026-08-24（Asia/Shanghai）
- Worktree：`E:/OpenFlow-baseline-24cd96`
- 分支：`feature/ui-design-system-foundation`
- BASE_SHA：`24cd96b676b17b40837c313ce2012bf03fac2051`
- BASELINE_REPORT_COMMIT：`fa42808ef3348fcb2efe82120d3ec7b96b874be1`
- UI_P0_SOURCE_COMMIT：`73572c74280ac84ccc5f3840209289e7e133686a`
- 当前 HEAD 不再等于 BASE_SHA；封存结束后的 HEAD 为承载本报告的 `UI_P0_DOCS_COMMIT`，以最终只读验收记录为准。
- 原混合分支：`codex/compact-workspace-ui`，未切换、未修改
- 原混合提交：`7b9f3c965d8b7c98936334b3982ab40d3b581ad4`，不是当前 HEAD 的祖先
- 开始前未跟踪内容只有已知报告：`docs/qa/openflow-functional-baseline-24cd96.md`
- 本轮按操作指南创建三个本地封存提交；没有 push、PR、发布、cherry-pick、rebase、reset 或 revert。

## 2. 修改文件

### 设计系统与 App Shell

- `src/renderer/src/theme.ts`：Token、OpenFlow 蓝色板、Mantine Theme 和组件默认值
- `src/renderer/src/main.tsx`：接入统一 `openFlowTheme`
- `src/renderer/src/index.css`：浅/深语义变量、全局字体/背景、控件、App Shell、键盘焦点与一级页面外壳
- `src/renderer/src/App.tsx`：68px 主导航、完整选中区、稳定底部工具入口和无业务含义装饰移除
- `src/renderer/src/components/PageHeader.tsx`：可复用一级页面标题组件
- `src/renderer/src/theme.test.ts`：新增 4 项 Foundation 测试

### 必要的纯表现层页面接入

- `src/renderer/src/views/DailyWorkspace.tsx`
- `src/renderer/src/views/OrganizerWorkspace.tsx`
- `src/renderer/src/views/FormatProcessor.tsx`
- `src/renderer/src/views/SettingsWorkspace.tsx`

以上四个页面只用 `PageHeader` 替换原有标题容器，并调整标题外壳边距；事件、状态、IPC、业务判断与页面内部布局未改。

### 文档

- `docs/design/openflow-ui-foundation.md`
- `docs/qa/openflow-ui-p0-foundation-report.md`

## 3. 新增设计变量

- 4px 间距网格：4 / 8 / 12 / 16 / 24 / 32px
- 字体层级：页面 20/28/600，分区 16/24/600，正文 14/20/400，控件 14/20/600，辅助 12/18/400
- 圆角：6 / 8 / 12px；999px 仅保留给胶囊/圆形语义
- 控件高度：普通 32px，主要操作 36px
- App Shell：侧栏 68px，一级标题 76px，页面边距 24px
- 浅/深模式分别定义 Canvas、Surface、Subtle、Border、Strong Border、Text、Muted Text
- 普通卡片阴影设为 none，浮动层统一使用有限阴影
- OpenFlow 品牌蓝注册为 Mantine 10 级色板

## 4. App Shell 变化

- 主导航从 92px 收敛为 68px，导航按钮为 52×56px。
- 中文标签使用 12px 单行文本；“格式处理”在 1080×640 下不换行。
- 当前项使用完整蓝色浅底、同色文字和细描边；删除头像下方多色渐变条与左侧彩色装饰条。
- 导航主体可独立纵向滚动；通知和设置入口固定在底部且不覆盖内容区。
- 导航滚动容器保留 2px 焦点缓冲，`focus-visible` 外框不会被裁剪。
- 四个一级页面统一 76px 标题、32px 图标容器、标题/说明对齐和 24px 页面边距。
- 路由、选中条件和所有页面入口保持不变。

## 5. 工程验证

| 门禁 | 结果 | 退出码 | 记录 |
| --- | --- | ---: | --- |
| `git diff --check` | PASS | 0 | 无空白错误；仅 Git 提示未来可能将 LF 转为 CRLF |
| `npm run lint` | PASS | 0 | `tsc --noEmit` 通过 |
| `npm test` | PASS | 0 | Release 27 + Node 111 = 138 项通过，0 fail；比基线新增 Theme 4 项 |
| `npm run build` | PASS | 0 | Renderer/Main/Preload 构建、NSIS、blockmap、Chrome 扩展打包完成 |

完整测试中的 `desktop unavailable` 是 Chrome 扩展队列故障模拟，随后用例明确通过。已记录但未处理的警告：

- Node 对 `.ts` 测试的 `MODULE_TYPELESS_PACKAGE_JSON` 警告；
- Vite CJS Node API 弃用提示；
- Node `DEP0190` 子进程 shell 参数弃用提示；
- electron-builder 重复依赖引用提示；
- Git 工作副本 LF/CRLF 提示。

依赖审计现状：23 项（low 1 / moderate 2 / high 19 / critical 1）。未执行 `npm audit fix`。

`package-lock.json` 开始前和结束时 SHA-256 均为 `E80235F04807173AE6F09F367AEFECFF7BD63726AFB117D39D4076FF2256F217`，没有变化。

## 6. 功能冒烟结果

| # | 用例 | 结果 | 实际 |
| ---: | --- | --- | --- |
| 1 | 应用正常启动 | PASS | 最终构建从隔离 wrapper 启动成功 |
| 2 | 日常、整理、格式、设置可进入 | PASS | 四页均实际打开，可访问性树与截图一致 |
| 3 | 当前导航选中正确 | PASS | 每页完整蓝色选中区与 `aria-current=page` 正确 |
| 4 | 通知与设置入口可用 | PASS | 消息中心实际打开/关闭；设置中心实际进入 |
| 5 | 原有按钮和入口仍存在 | PASS | 四页可访问性树核对，无入口删除 |
| 6 | 浅色显示 | PASS | 四页均实测并保存证据 |
| 7 | 深色显示 | PASS | 四页均实测并保存证据 |
| 8 | 跟随系统保持 | PASS | 初始 `跟随系统` 与当前系统深色一致 |
| 9 | 主题保存与重启读取 | PASS | 切换深色后正常退出，重启自动读取深色 |
| 10 | Console/主进程无新增 UI 错误 | PASS（有环境警告） | 无 `renderer.unhandled_error/rejection`；见第 8 节 |
| 11 | 1080×640 无导航/标题覆盖 | PASS | 外窗设置为 1080×640；截图客户区为 1066×633 |
| 12 | 最大化、还原正常 | PASS | 1920×1032 客户区与 1080×640 外窗均实际检查 |
| 13 | Tab 可到达主导航且焦点可见 | PASS | 最终版本完整 2px 蓝色外框可见，无裁剪 |
| 14 | Enter / Space 激活导航 | PASS | Enter 打开整理，Space 返回日常 |

统计：PASS 14 / FAIL 0 / BLOCKED 0 / N/A 0。

## 7. 视觉证据

证据根目录：`C:/Users/EDY/AppData/Local/Temp/OpenFlow-QA-UI-P0/20260821-182823/screenshots`

### 浅色

- `light/daily-1080x640.png`
- `light/organizer-1080x640.png`
- `light/format-1080x640.png`
- `light/settings-1080x640.png`
- `light/daily-windowed.png`
- `light/organizer-windowed.png`
- `light/format-windowed.png`
- `light/settings-windowed.png`
- `light/settings-maximized.png`

### 深色

- `dark/daily-1080x640.png`
- `dark/organizer-1080x640.png`
- `dark/format-1080x640.png`
- `dark/settings-1080x640.png`
- `dark/format-maximized.png`
- `dark/daily-final-focus-1080x640.png`（最终构建、完整键盘焦点外框）

部分证据截图中可见外部机器人挂件和鼠标绿色光晕，属于截图环境干扰，不是 OpenFlow 缺陷。

## 8. Console、诊断和隔离配置

- 隔离根：`C:/Users/EDY/AppData/Local/Temp/OpenFlow-QA-UI-P0/20260821-182823`
- `APPDATA`、`LOCALAPPDATA` 和 Electron `userData` 均指向该根目录。
- 真实配置 `C:/Users/EDY/AppData/Roaming/openflow-studio/openflow-config.json` 最后修改时间保持为 `2026-08-21 17:07:22`，本轮未修改。
- 隔离 diagnostics 没有 Renderer 未处理错误或 Promise rejection。
- 两次启动各记录 1 条 `extension.update_error`：开发 wrapper 直接加载 `out/main/index.js` 时找不到打包后的 Chrome 扩展文件。该环境警告与基线开发包装方式有关，不影响 Renderer UI、路由或主题；完整 `npm run build` 已确认扩展包正常生成。

## 9. 范围审查

- 修改范围仅为 Renderer 表现层、Theme 测试和文档。
- 没有 `src/main/**`、`src/preload/**` 或 shared 业务契约修改。
- 没有 IPC channel、参数、返回值、状态条件或事件处理修改。
- 没有文件扫描、识别、校验、命名、移动、撤销、清理、Sharp 或 FFmpeg 修改。
- 没有 package 依赖、Electron 版本或 `package-lock.json` 修改。
- 没有 BrowserWindow 默认尺寸、最小尺寸或任何主进程窗口代码修改。
- 没有复制、cherry-pick 或重放 `7b9f3c9` 的业务功能。
- 基线功能报告保持原位，已通过独立的 `BASELINE_REPORT_COMMIT` 封存；未移动或删除。

## 10. 与基线的已知差异

- 视觉差异仅限统一 Token、Mantine 默认值、全局背景/字体、68px 侧栏、通用标题和控件基础。
- 页面内部仍保留基线的大型业务卡片、浮动操作栏和各自响应式布局；这些是后续页面专项阶段的边界，不在 UI-P0 重设计。
- BrowserWindow 最小尺寸仍为基线 1080×640；产品目标 760×520 未实施。
- 隔离配置当前为深色，并为便于正常重启验收将“关闭到托盘”设为 false；不影响真实用户配置。
- 深色模式辅助文字和边框略暗，作为非阻断视觉遗留记录。
- 设置中心最大化后右侧留白较大，归入 UI-P1。
- 格式处理最大化后拖放区过大，归入 UI-P2。
- 素材整理存在卡片嵌套及操作层级问题，归入 UI-P3。
- 日常处理在 1080×640 下较拥挤，并存在底部操作条覆盖风险，归入 UI-P4。
- 760×520 不属于 UI-P0；必须在 UI-P1 响应式完成后单独降低窗口约束。

## 11. 结论

UI-P0 结论：**PASS**。

人工视觉门禁：**PASS WITH NOTES**。上述视觉遗留均不阻断 UI-P0 Foundation 封存，但必须在对应后续阶段重新验收。

设计系统与 App Shell Foundation 已具备统一 Token、浅/深 Theme、稳定主导航、通用一级标题、控件基线和键盘焦点规范。工程门禁和 14 项冒烟全部通过，范围未越过 Renderer 表现层。

适合进入 UI-P1 设置中心改造：**YES**。UI-P1 应先完成设置导航在 760×520 的响应式，再以独立提交降低 BrowserWindow 最小尺寸；本轮不得提前修改窗口约束。

## 12. 人工查看实例停止记录

- PID：`33688`
- 进程：`E:/OpenFlow-baseline-24cd96/node_modules/electron/dist/electron.exe`
- 启动目录：`E:/OpenFlow-baseline-24cd96`
- 启动入口：`C:/Users/EDY/AppData/Local/Temp/OpenFlow-QA-UI-P0/20260821-182823/isolated-appdata/ui-p0-entry.cjs`
- userData：`C:/Users/EDY/AppData/Local/Temp/OpenFlow-QA-UI-P0/20260821-182823/isolated-appdata/roaming/openflow-studio`
- 停止前身份核对：映像路径与命令行均精确匹配上述隔离实例。
- 当前状态：2026-08-24 已通过主窗口关闭请求正常退出；未停止任何无关 Electron/Node 进程。
