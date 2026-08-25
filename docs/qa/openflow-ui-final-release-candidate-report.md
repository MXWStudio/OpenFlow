# OpenFlow UI-P5 本地发布候选验收报告

## 1. STATUS

- STATUS：PASS
- Mode：A — docs-only
- FAIL：0
- BLOCKED：0
- Fresh functional regression：25 PASS / 0 FAIL / 0 BLOCKED
- Historical evidence counted：0

UI-P5 在同一 P5 evidence root、同一 `build-dist/win-unpacked/openflow-studio.exe` 上重新执行四页完整核心回归。没有发现需要 Renderer 修复的缺陷；本阶段仅生成最终设计与 QA 文档。

## 2. 分支、基线与提交链

- 工作目录：`E:/OpenFlow-baseline-24cd96`
- 分支：`feature/ui-release-candidate`
- 起始 HEAD：`24e97d1044028e3706246c39fc042487cf4254ff`
- 起始分支：`feature/ui-daily-workspace`
- 起始相对 `24e97d10...`：Ahead 0 / Behind 0
- P4 Renderer：`2e0a07d1300e6a316868148eb9a090388b9d11ce`
- P4 Docs / P5 起始 HEAD：`24e97d1044028e3706246c39fc042487cf4254ff`
- 旧混合提交：`7b9f3c965d8b7c98936334b3982ab40d3b581ad4`
- `git merge-base --is-ancestor 7b9f3c9 HEAD`：退出码 1，不是祖先

开始前分支、HEAD、工作树、暂存区、worktree、祖先关系和进程均按文档核对。候选分支从精确起始 HEAD 创建；未 merge、rebase、reset、revert、cherry-pick 或 amend。

## 3. 环境与隔离

- Evidence root：`C:/Users/EDY/AppData/Local/Temp/OpenFlow-QA-UI-P5/20260825-100034`
- Build：`E:/OpenFlow-baseline-24cd96/build-dist/win-unpacked/openflow-studio.exe`
- 初始主 PID：10696
- 重启后主 PID：21924
- 启动目录：`E:/OpenFlow-baseline-24cd96`
- Renderer CDP：9663
- Main inspector：9664
- APPDATA：`<root>/appdata/roaming`
- LOCALAPPDATA：`<root>/appdata/local`
- userData：`<root>/userData`
- 进程证据：`manifests/process-start.json`、`manifests/processes-after-restart.json`

所有需求表、目录、图片、视频、输出、配置和截图均位于 P5 root。未读取或修改真实工作素材；没有把 P3/P4 功能结果计入本轮 PASS。

真实配置验收前后完全一致：

- 路径：`C:/Users/EDY/AppData/Roaming/openflow-studio/openflow-config.json`
- SHA-256：`EA43CAF1D0D08625FED535E421708A1DC10A52B1D9971D742162ECFAF3F8AD41`
- LastWriteTime：`2026-08-21T17:07:22.6240466+08:00`
- 长度：30203 bytes
- 证据：`manifests/real-config-before.json`、`manifests/real-config-after.json`

## 4. 工程门禁

### 初始门禁

| 项目 | 退出码 | 结果 | 证据 |
| --- | ---: | --- | --- |
| `git diff --check` | 0 | PASS | 初始工作树为空 |
| `npm run lint` | 0 | PASS | `OpenFlow-QA-UI-P5-stage2-20260825-095809/npm-lint.log` |
| `npm test` | 0 | PASS | `OpenFlow-QA-UI-P5-stage2-20260825-095809/npm-test.log` |
| `npm run build` | 0 | PASS | `OpenFlow-QA-UI-P5-stage2-20260825-095809/npm-build.log` |

### 最终门禁

| 项目 | 退出码 | 结果 | 证据 |
| --- | ---: | --- | --- |
| `git diff --check` | 0 | PASS | `logs/final-diff-check.log` |
| `npm run lint` | 0 | PASS | `logs/final-lint.log` |
| `npm test` | 0 | PASS | `logs/final-test.log` |
| `npm run build` | 0 | PASS | `logs/final-build.log` |

最终 build 生成 Windows NSIS 安装包和 Chrome extension ZIP，未发布。`package-lock.json` 的初始与最终 SHA-256 均为：

`E80235F04807173AE6F09F367AEFECFF7BD63726AFB117D39D4076FF2256F217`

### 测试统计口径

- Source runner top-level tests：171，26 suites，171 PASS，0 FAIL。
- Release runner：27 tests，27 PASS，0 FAIL。
- Source test files：27。
- `scripts/*.test.mjs` release test files：7。
- 两个 runner glob 合计涉及测试文件：34；extension 的独立脚本检查不伪装成 runner test。
- `dailyResponsive.test.ts`：28 个 top-level `test(...)`，90 次 `assert.*` 调用。
- UI-P5 新增测试文件：0；Mode A 没有源代码缺陷，因此没有制造测试或 Renderer 提交。

这关闭了 NOTE-P4-003：171 是 source runner 的 top-level test 数；28 是 Daily 契约文件中的 top-level test 数；90 是该文件内部断言调用数；以上不互相替代。

### 非阻断警告

- Node `MODULE_TYPELESS_PACKAGE_JSON`；
- Vite CJS API deprecated；
- electron-builder duplicate dependency references；
- Node `DEP0190`；
- extension 离线测试预期输出 `desktop unavailable`，测试随后明确 PASS；
- 已知依赖漏洞仅记录，本轮未执行 `npm audit fix`。

## 5. 全局视觉审计

矩阵：3 窗口 × 3 缩放 × 2 主题 × 4 页面 = 72 组。

- 窗口：760×520、1080×640、最大化；
- 缩放：100%、125%、150%；
- 主题：浅色、深色；
- 页面：Daily、Organizer、Format、Settings。

自动几何摘要：

- 72/72 记录完整；
- document/body 页面级横向溢出：0；
- 浏览器破图：0；
- 三项主导航裁切：0；
- 消息中心/设置中心裁切：0；
- 证据：`logs/visual-audit-initial.jsonl`、`manifests/visual-audit-summary.json`。

人工抽查确认：

- App Shell、导航尺寸、选中态、图标和标签一致；
- 四页标题、说明、卡片 Surface、细描边和内容边距一致；
- 760×520 客户区约 744×481，长内容由一个主要纵向滚动区承载；
- 1080×640 无无意义的页面级双滚动；
- 最大化内容宽度受控；
- 深色文字、描边和 disabled 对比可辨；
- 125%/150% 的 CSS 视口分别为 595×385、496×321，主导航和底部入口仍在视口内；
- Format 最终 processing 图中按钮内白色 Loader 肉眼可见；
- Organizer fallback 无破图；
- Settings About 页面真实选中。

未发现需要进入 Mode B 的纯 Renderer 缺陷。

## 6. 本轮新鲜功能回归 25/25

以下证据路径均相对于 P5 evidence root。

### DAILY 5/5

| ID | 步骤 | 预期 | 实际 | 证据 | 结果 |
| --- | --- | --- | --- | --- | --- |
| DAILY-003 | 通过原生文件选择器导入有效需求，再导入错误 JSON；选择隔离根目录创建今日目录 | 有效需求保留；错误输入不覆盖；项目和固定目录创建 | 需求仍为 1080×1920、1920×1080；通知“读取失败”；项目 `_Assets` 与 6 个固定目录创建 | `logs/daily-requirement-protection.json`、`logs/store-after-daily-directory-create.json`、`output/daily-root` | PASS |
| DAILY-005 | 加入 multi-a、multi-b，再重复加入 multi-b | 两目录各 1 次；重复去重；磁盘不变 | UI 为 multiA=1、multiB=1、删除按钮 2；重复前后哈希差异 0 | `logs/daily-drop-multi-*.json`、`manifests/daily-folders-after-duplicate.json` | PASS |
| DAILY-007 | 常规→特殊→自定义验收模板→恢复常规 | 三种命名可选，最终恢复常规 | 三种状态均真实切换；最终模板为常规命名 | `logs/daily-naming-special.json`、`daily-naming-custom.json`、`daily-naming-regular-restored.json` | PASS |
| DAILY-008 | 在 Settings 创建并命名 UI-P5验收模板；创建、编辑并删除 UI-P5临时模板；进程重启 | 验收模板保留，临时模板删除结果保留 | 重启后验收模板 1、临时模板 0 | `logs/store-after-template-create.json`、`settings-template-after-delete.json`、`settings-after-process-restart.json` | PASS |
| DAILY-009 | 使用需求尺寸，选中手动 640×360，再取消并恢复需求尺寸 | 手动尺寸可切换，最终只保留需求尺寸 | 640×360 选中和取消均有 UI 状态；最终恢复需求尺寸 | `logs/daily-manual-size-selected.json`、`daily-manual-size-restored.json` | PASS |

Daily 附加真实路径：两目录校验得到尺寸异常 1、缺 6、通过 2；移除 multi-b 后通过 1、缺 3、无阻断尺寸错误。重命名前创建同名哨兵，执行后哨兵保持 43 bytes、SHA-256 `EF03F169...F35D`，素材以 `(2)` 后缀生成并保持原内容 SHA-256 `773B3A36...14178`。证据：`logs/daily-validation-result.json`、`daily-rename-result.json`、`manifests/daily-before-rename.json`、`daily-after-rename.json`。

### ORG 3/3

| ID | 步骤 | 预期 | 实际 | 证据 | 结果 |
| --- | --- | --- | --- | --- | --- |
| ORG-004 | 将来源设为空隔离目录并真实扫描 | 空结果且无错误移动 | 通知“扫描为空”，待整理 0 | `logs/organizer-empty-scan.json`、`organizer-empty-audit.json` | PASS |
| ORG-007 | 来源放入 2 图、1 秒视频、1 TXT；支持 jpg/png/mp4；真实扫描 | 只识别 3 个支持文件 | 扫描结果 3，TXT 未进入队列；扫描按钮出现 Loader | `logs/organizer-scan-clickprobe.json`、`organizer-scan-results.json` | PASS |
| ORG-012 | 目标建立同名哨兵；启用奇觅；真实转移并撤销 | 分辨率/奇觅目录正确；冲突不覆盖；撤销恢复 | 冲突 JPG 使用日期后缀，PNG 进入分辨率目录，MP4 进入奇觅目录；撤销成功恢复 3，来源最终 4、目标哨兵 1 | `logs/organizer-transfer-qimi.json`、`organizer-qimi-undo.json`、`manifests/organizer-qimi-after-transfer.json`、`organizer-final-after-undo.json` | PASS |

Organizer 最终来源 4 个输入的 SHA-256 与初始清单一致；目标哨兵 225 bytes、SHA-256 `238DE8F5...ECC61` 保持不变；零字节、覆盖、丢失和异常移动均为 0。

### FORMAT 14/14

| ID | 步骤 | 预期 | 实际 | 证据 | 结果 |
| --- | --- | --- | --- | --- | --- |
| FORMAT-001 | 拖入 640×360 PNG | 图片进入队列 | 1 个 PNG 显示 | `logs/format-image-drop.json` | PASS |
| FORMAT-002 | 拖入 1 秒 320×240 MP4 | 视频进入队列 | 1 个 MP4 显示并可处理 | `logs/format-video-drop.json` | PASS |
| FORMAT-003 | PNG 队列中同时拖入 MP4+TXT | 混合类型被拒绝，不污染队列 | 队列仍只有 PNG，通知“类型不匹配” | `logs/format-mixed-unsupported-drop.json` | PASS |
| FORMAT-004 | 拖入 TXT | 不支持类型不进入队列 | TXT 未加入，现有 PNG 保留 | `logs/store-after-format-mixed.json` | PASS |
| FORMAT-005 | 启用 50% 分辨率 | 输出宽高减半 | PNG/JPG 为 320×180；动态 JPG 为 400×300；首个视频输出为 160×120 | `manifests/format-media-verification-final.json` | PASS |
| FORMAT-006 | 图片质量设为 60 | 质量参数被实际提交，输出非零可解码 | 自定义目录 PNG/JPG 均生成并可打开 | `logs/format-png-success.json`、`format-jpg-conversion.json` | PASS |
| FORMAT-007 | 选择保持原格式并处理 PNG | 扩展名仍为 PNG | 输出 `格式测试 长中文 01.png`，171 bytes、320×180 | `manifests/format-media-verification-final.json` | PASS |
| FORMAT-008 | PNG→JPG | 生成可解码 JPG | 输出 629 bytes、320×180、format=jpeg | `logs/format-jpg-conversion.json`、媒体核验清单 | PASS |
| FORMAT-009 | 启用动作拼接文件夹名 | 生成含动作参数的目录 | `openflow(50%_q80)处理/格式测试 长中文 02.jpg` | `logs/format-dynamic-folder.json` | PASS |
| FORMAT-010 | 通过原生目录选择器设置自定义输出 | 输出只写入指定隔离目录 | PNG/JPG 写入 `<root>/output/format` | `logs/format-png-success.json`、`output/format` | PASS |
| FORMAT-011 | 点击开始处理 | 操作真正启动，按钮阻止重复提交 | 3 秒视频处理时按钮 disabled，DOM Loader=1，截图中 Loader 可见 | `logs/format-processing-large-capture.json`、`screenshots/final/format-760x520-processing.png` | PASS |
| FORMAT-012 | 等待完成 | 显示成功并产生可打开输出 | 成功通知；最终 7 个媒体输出全部可解码 | `logs/format-video-success.json`、`format-processing-large-after.json`、媒体核验清单 | PASS |
| FORMAT-013 | 加入安全失败 PNG，随后仅在 evidence root 内临时改名使源缺失 | 成功 0、失败 1，无伪输出；恢复原文件 | 通知“成功处理 0 个文件，失败 1 个”；样本恢复且哈希相同 | `logs/format-failure-store.json`、`format-failure-audit.json`、`screenshots/final/format-760x520-failure.png` | PASS |
| FORMAT-014 | 对比处理前后原文件 SHA-256、数量和零字节 | 不覆盖、不删除原文件 | 初始 15 个 fixture 中 14 原路径哈希不变，Daily 指定素材 1 个仅按预期改名且哈希保留；额外 processing 视频源哈希不变；零字节 0 | `manifests/data-safety-final.json` | PASS |

最终媒体核验共 7 个输出：3 个图片、4 个视频；Sharp/ffprobe 打开失败 0，零字节 0。重复处理短视频产生的两个 `_1/_2` 输出内容相同，属于同输入同参数的预期确定性结果，不是截图复用。

### SETTINGS 3/3

| ID | 步骤 | 预期 | 实际 | 证据 | 结果 |
| --- | --- | --- | --- | --- | --- |
| SETTINGS-001 | 在 UI 保存 Organizer source/target 与 PNG 支持，读取、reload、正常退出并重启 | 路径和格式持久化 | 重启后 source/target 精确指向 P5 root，formats=jpg/mp4/png | `logs/settings-before-restart.json`、`settings-after-process-restart.json` | PASS |
| SETTINGS-002 | 创建/编辑 UI-P5验收模板；创建并删除临时模板；重启 | 验收模板保留、临时模板不复活 | 重启后验收模板 1、临时模板 0 | `logs/store-after-template-create.json`、`settings-template-after-delete.json`、`settings-after-process-restart.json` | PASS |
| SETTINGS-003 | 浅/深/跟随系统切换和 reload；将隔离快捷键设为 Ctrl+Alt+O；真实隐藏、跨应用唤醒；重启 | 主题与快捷键保存，快捷键实际可用 | 浅深截图正常；auto 重启读取；隐藏/唤醒均成功；重启后 globalShortcut 仍 registered | `logs/settings-after-theme-auto.json`、`shortcut-simple-final-store.json`、`shortcut-after-process-restart.json`、`screenshots/final/settings-shortcut-ctrl-alt-o.png` | PASS |

合计：DAILY 5/5 + ORG 3/3 + FORMAT 14/14 + SETTINGS 3/3 = 25/25 PASS。

## 7. 生命周期、重复提交与消息中心

- 连续切换 Daily→Organizer→Format→Settings→Daily，无重启；当前项与页面标题逐步一致，破图 0，最终回到 Daily。证据：`logs/cross-page-lifecycle.json`。
- Daily 校验：按钮出现 Loader；Daily 重命名：disabled=true、Loader=1。
- Organizer 扫描：Loader=1；转移通过真实结果清单证明只执行一次。
- Format 最终 3 秒视频：disabled=true、Loader=1，按钮内白色 Loader 肉眼可见。
- Tab 从正文到“日常”导航，2px 品牌蓝轮廓；Enter 激活“整理”；Space 激活“格式处理”。证据：`logs/keyboard-navigation.json`、`screenshots/final/focus-navigation.png`。
- 消息中心打开成功，最近 100 条历史中包含有效需求、错误需求、转移/撤销、格式成功和失败。证据：`screenshots/final/message-center.png`。
- 当前 `closeToTray=true` 基线下调用窗口 close 后 visible=false、destroyed=false；随后恢复。证据：`logs/close-to-tray-close.json`、`close-to-tray-hidden.json`、`close-to-tray-restored.json`。
- 应用正常退出并重启一次，设置持久化通过；最终再次正常退出，本 worktree OpenFlow 残留为 0。

## 8. 数据安全

- 初始 fixture：15。
- 初始路径原样且 SHA-256 不变：14。
- Daily 按预期改名、内容 SHA-256 保留：1。
- 失败样本恢复后 SHA-256：`C1496381...04F0`，前后相同。
- Organizer 撤销后：来源 4、目标哨兵 1。
- Format 最终输出：7，Sharp/ffprobe 可打开 7，失败 0，零字节 0。
- fixtures + output 零字节：0。
- 覆盖、删除、丢失、异常移动：0。
- 真实配置哈希和时间戳未变化。
- 证据：`manifests/data-safety-final.json`、`format-media-verification-final.json`、Daily/Organizer before/after manifests。

## 9. P4 备注关闭

- NOTE-P4-001：CLOSED。25 项全部在 P5 root、本轮 final build 上重新真实执行；历史结果计数为 0。
- NOTE-P4-002：CLOSED。只保留 `daily-rename-success-with-conflict-protection.png` 作为 UI 状态；冲突保护另用 `daily-before-rename.json`、`daily-after-rename.json` 和哨兵 SHA-256 证明。最终 PNG 重复哈希组为 0。
- NOTE-P4-003：CLOSED。分别报告 source runner 171、release runner 27、测试文件 27+7、Daily 契约 28 top-level tests / 90 assert calls、P5 新测试文件 0。

## 10. 最终证据清单

- Required PNG：27/27。
- Extra PNG：1（`settings-shortcut-ctrl-alt-o.png`，用户要求的简单快捷键实测证据）。
- Final PNG total：28。
- `final.sha256.txt`：1。
- PNG 重复 SHA-256 组：0。
- PNG 零字节：0。
- 尺寸：744×481 共 18；1064×601 共 4；1920×1009 共 4；595×385 共 1；496×321 共 1。
- 截图清单：`manifests/final-screenshot-manifest.json`。
- Evidence archive：`C:/Users/EDY/AppData/Local/Temp/OpenFlow-QA-UI-P5/20260825-100034/final.zip`
- ZIP SHA-256：`9408A3D364FB644957DD716492AD8E69AE7F630052D0AC9CFCB8B1EB6C3469CB`
- ZIP entries：29（28 PNG + 1 manifest）。
- ZIP 唯一根：`final/`。
- 绝对路径、`..`、配置、素材、userData 或异常路径：0。
- ZIP 证据：`manifests/final-zip-verification.json`。

## 11. 范围审计

Mode A 不修改 Renderer。Docs 提交前预期只新增：

- `docs/design/openflow-ui-final-consistency.md`
- `docs/qa/openflow-ui-final-release-candidate-report.md`

确认未修改：

- `src/main/**`、`src/preload/**`、`src/shared/**`；
- IPC、业务、文件、配置结构和持久化逻辑；
- BrowserWindow 尺寸；
- Sharp/FFmpeg 参数；
- package 依赖和 `package-lock.json`。

没有从 `7b9f3c9` 复制或重放业务功能。旧混合 worktree 的分支、HEAD 和两个未跟踪 QA 报告保持不变。

## 12. 日志与可恢复失败

应用日志没有新增未处理异常。初始 `app-stderr.log` 唯一产品错误是故意导入无效 JSON 触发的预期 `SyntaxError`，UI 随后显示“读取失败”并保护有效需求；重启后的 stderr 错误匹配为 0。

本轮记录的可恢复测试工具问题：

1. 两次辅助 Playwright 查询因不精确角色/标签等待，停止的仅是明确 QA helper Node 进程，未停止应用或无关进程。
2. Organizer 首次探索时奇觅勾选状态与预想相反；立即执行真实撤销并核对全部来源哈希，再以明确 `checked=true` 完成本次计分转移/撤销。探索循环不计入 ORG-012 PASS。
3. 第一次 `app.quit()` 未先设置应用已有的 `isQuitting` 生命周期标记，因此被 close-to-tray 保护转为隐藏；未强杀进程。调整临时 QA helper 后应用正常退出并完成重启持久化。
4. 快捷键唤醒首次以 Chrome 为焦点时，桌面控制因无法可靠识别浏览器 URL 安全终止；没有绕过限制。随后按用户要求改为 `Ctrl+Alt+O`，以文件资源管理器为焦点真实完成隐藏/唤醒。
5. Format 最初两张 processing 候选图分别捕获到空白 loading 按钮和已完成状态，均移至 `screenshots/auxiliary`，不进入 final.zip。最终使用本轮新生成的 3 秒 1280×720 小视频捕获肉眼可见 Loader。
6. Cross-page helper 最初用主导航选择器查找 Settings，产生一个 0-byte 中间日志；修正为设置入口的真实可访问名称后重新执行并通过。中间日志不计入证据结论。

这些问题均限定在 P5 evidence root 的测试工具或探索路径，没有修改源代码、真实配置或真实素材。

## 13. 最终结论

OpenFlow UI-P5 满足本地发布候选要求：四页全局一致、72 组视觉矩阵通过、25/25 新鲜功能回归通过、文件和配置安全、初始与最终工程门禁通过、提交链可保持 docs-only。

本结论只授权等待上级最终人工视觉门禁。未 Push、未创建 PR、未 merge、未 tag、未 release、未发布，也未生成或执行远端交付动作。
