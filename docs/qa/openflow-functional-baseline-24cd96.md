# OpenFlow 功能基线验收报告（24cd96b）

## 结论

**结论：`24cd96b676b17b40837c313ce2012bf03fac2051` 适合作为后续 UI-only 分支的干净、完整功能基线。**

- 四项工程门禁全部通过。
- 分流报告要求在继续 UI 改造前解除的 25 项 BLOCKED 已全部实际执行并转为 PASS。
- FORMAT 核心链路已真实处理图片和短视频；输出可解码、尺寸/时长正确、无零字节文件，输入 SHA-256 未变化。
- ORG 转移、重复文件保护、奇觅视频目录和撤销均通过；DAILY 重命名和同名保护无覆盖或丢失。
- SETTINGS 仅在隔离配置确认生效后执行，并完成一次重启读回。
- `746×513` 在本基线不可达：基线最小窗口为 `1080×640`（截图捕获区约 `1066×633`），在该最小支持尺寸未复现“关于”覆盖标题。该回归由 `7b9f3c9` 将最小窗口降至 `760×520` 后暴露。

本报告只证明精确基线 SHA 的功能状态，不证明 `7b9f3c9` 无回归，也未拆分或修改该提交。

## 1. 基线、隔离范围和环境

| 项目 | 实际值 |
| --- | --- |
| 基线 SHA | `24cd96b676b17b40837c313ce2012bf03fac2051` |
| 工作树 | `E:\OpenFlow-baseline-24cd96` |
| Git 状态 | detached HEAD；报告创建前工作树干净 |
| 混合提交包含性 | `24cd96b` 不包含 `7b9f3c9` |
| 原仓库 | `E:\OpenFlow-Windows-Codex-Test-20260714\OpenFlow` |
| 原分支 / HEAD | `codex/compact-workspace-ui` / `7b9f3c965d8b7c98936334b3982ab40d3b581ad4`，未改变 |
| 测试根目录 | `C:\Users\EDY\AppData\Local\Temp\OpenFlow-QA-Baseline\20260821-170359` |
| 隔离用户配置 | `...\isolated-appdata\roaming\openflow-studio\openflow-config.json` |
| 系统 | Windows 11 家庭版 `10.0.22631` |
| Node / npm | `v24.18.0` / `11.16.0` |

测试根目录包含要求的 `input-original`、`input-working-copy`、`daily`、`organizer-source`、`organizer-target`、`format-input`、`format-output`、`isolated-appdata/roaming`、`isolated-appdata/local`、`screenshots`、`logs`。

启动隔离说明：仅设置 `APPDATA`/`LOCALAPPDATA` 和传递 `--user-data-dir` 的初次尝试不能隔离 Electron `userData`，真实 `%APPDATA%\openflow-studio` 的目录/配置时间因此曾更新到 17:07:51/17:07:22。发现后未执行任何 SETTINGS 修改用例；改用测试根目录内的临时入口，在加载主进程前执行 `app.setPath('userData', isolatedPath)`。从 17:08:46 起所有功能和设置用例均使用隔离配置，真实配置时间未再变化。

临时入口令 `app.getAppPath()` 指向隔离目录，因此扩展更新管理器报告找不到 `.openflow-build\chrome-extension\extension-release.json`。此问题只影响本轮临时启动包装下的扩展更新检查，不影响 DAILY、ORG、FORMAT 或 SETTINGS 核心流程，记为环境风险而非基线功能失败。

## 2. 四项工程门禁

| 门禁 | 退出码 | 结果 | 数量 / 说明 |
| --- | ---: | --- | --- |
| `npm ci` | 0 | PASS | 安装 579 个包、审计 580 个包；报告 23 个依赖漏洞（1 low、2 moderate、19 high、1 critical）和 5 条 allow-scripts 提示，未阻断安装。 |
| `npm run lint` | 0 | PASS | `tsc --noEmit` 无错误。 |
| `npm test` | 0 | PASS | 扩展检查通过；release 27/27；源代码 Node 测试 107/107；共 134 项 Node 测试通过。仅有 typeless package 警告。 |
| `npm run build` | 0 | PASS | main、preload、renderer 构建成功；Windows 打包、签名、NSIS、blockmap 和扩展 ZIP 生成成功。仅有 Vite CJS、shell、重复依赖等警告。 |

工程门禁通过不代替下列运行时功能验收。

## 3. 继续 UI 改造前的 25 项 BLOCKED

### 3.1 DAILY（5/5 PASS）

| ID | 步骤 | 预期 | 实际与证据 | 结果 |
| --- | --- | --- | --- | --- |
| DAILY-003 | 导入有效需求表，再手动选择 `daily` 作为目标根目录并创建今日目录。 | 需求/目录信息正确更新。 | 有效表显示 1 个项目、`1080×1920` 和 `1920×1080`；在隔离 `daily` 下创建项目尺寸目录、7 个固定目录和 `_Assets`。错误 JSON 另行验证为可理解失败且保留上一份有效需求。 | PASS |
| DAILY-005 | 加入 `daily\multi-a`、`daily\multi-b`，再重复加入 `multi-b`。 | 多目录不丢失、不重复、不覆盖。 | 页面保持 2 张目录卡；识别两个需求尺寸；重复加入未生成第三张卡。磁盘文件数量和 SHA-256 未变化。 | PASS |
| DAILY-007 | 依次选择常规命名、特殊版块、手搓命名，再恢复常规命名。 | 选择结果正确保存并用于预览。 | 三种命名方式均可进入，预览随选择更新，恢复常规后校验/重命名按常规规则执行。 | PASS |
| DAILY-008 | 新建并编辑 `基线验收模板`；新建临时模板后取消/删除；执行重启读回。 | 新增、编辑、取消和保存正确。 | 隔离配置最终保留系统模板、`手搓命名` 和 `基线验收模板`，临时模板不存在；重启后模板仍显示。证据：`screenshots\settings-template-restart.jpg`。 | PASS |
| DAILY-009 | 核对需求尺寸，并手动选择 `640×360` 后恢复需求尺寸。 | 手动项和需求项正确显示/切换。 | 需求尺寸显示正确；`640×360` 可手动选中并出现选中态，随后恢复需求尺寸。 | PASS |

附加保护验证（用于支撑上述基线）：完整素材目录校验为 `4 通过`，详情列出 4 个真实文件名和目标名；重命名后数量仍为 4、SHA-256 集合不变。同名哨兵文件已预置，SHA-256 `9B1AEBA4...A169FE6AE` 未变化，其余文件顺延编号，总计 5 个文件，无覆盖或丢失。

### 3.2 ORG（3/3 PASS）

| ID | 步骤 | 预期 | 实际与证据 | 结果 |
| --- | --- | --- | --- | --- |
| ORG-004 | 将来源改为隔离空目录并执行独立扫描；随后恢复 `organizer-source`。 | 显示空状态，不误报错误。 | 页面显示“扫描为空 / 没有需要整理的文件”，通知为未找到符合格式的素材。证据：`screenshots\org-empty-scan.jpg`。 | PASS |
| ORG-007 | 来源中放入 2 张测试图、1 个短视频和 `无法识别样本.txt` 后扫描。 | 不支持文件不被误归类，识别结果明确。 | 扫描发现且列出 3 个受支持文件；TXT 未进入待整理队列、仍留在来源目录。图片/视频游戏名与三组分辨率均正确。 | PASS |
| ORG-012 | 启用“视频转移-奇觅生成”，转移 3 个文件并撤销。 | 视频进入奇觅目录，图片按分辨率归档；撤销无重复/丢失。 | 视频进入 `示例游戏\示例游戏-奇觅生成`；图片进入 `1080-1920`、`1920-1080`。预置同名图片未覆盖，新文件加 `-20260821` 后缀。撤销后 3 个源文件和 SHA-256 全部恢复，目标只保留预置文件。证据：`screenshots\org-transfer-complete.jpg`。 | PASS |

转移期间来源只剩 TXT；目标共 4 个文件（1 个预置 + 3 个本轮文件）。撤销后来源共 4 个文件（3 个受支持 + TXT），目标只剩预置图片；三个受支持文件 SHA-256 分别为 `3CCC7998...23716A`、`7C1CE363...1BB8`、`A8601F98...EAA09`。

### 3.3 FORMAT（14/14 PASS）

本轮通过隔离本地文件对象触发实际 HTML5 `dragenter` / `dragover` / `drop`，Electron `webUtils.getPathForFile()` 读回的是测试根目录中的真实绝对路径，不是伪造字符串。页面没有文件选择按钮，因此这是对同一拖放处理器的真实文件输入验证。

| ID | 步骤 | 预期 | 实际与证据 | 结果 |
| --- | --- | --- | --- | --- |
| FORMAT-001 | 拖入 `格式测试 长中文 01.png`。 | 正确识别并显示图片。 | 显示“已添加 1 个文件”、类型“图片”和完整中文名。证据：`screenshots\format-image-added.jpg`。 | PASS |
| FORMAT-002 | 清空后拖入 1 秒 `短视频样本.mp4`。 | 正确识别并显示视频。 | 显示“已添加 1 个文件”、类型“视频”，处理链路成功。 | PASS |
| FORMAT-003 | 图片在队列中时同时拖入 MP4 和 TXT。 | 遵守一次仅同一类型。 | 提示“类型不匹配”，MP4 被忽略，队列仍为原 1 张图片。 | PASS |
| FORMAT-004 | 单独拖入 TXT。 | 不支持文件不进入处理队列。 | 队列数量保持 1，TXT 未进入队列。 | PASS |
| FORMAT-005 | 图片、视频均启用 50% 按比例缩放。 | 输出尺寸符合设置。 | 图片 `640×360 → 320×180`；视频 `320×240 → 160×120`。 | PASS |
| FORMAT-006 | 图片质量 60、视频质量 70。 | 输出可打开，质量参数生效。 | 图片从 4068 B 降为 171 B；视频从 2292 B 降为 2238 B；Sharp/ffprobe 均可解码。 | PASS |
| FORMAT-007 | 图片和视频均选择保持原格式。 | 扩展名和编码符合规则。 | 得到 PNG 和 MP4；PNG 由 Sharp 识别为 `image/png`，MP4 由 ffprobe 识别为视频且时长 1.000 s。 | PASS |
| FORMAT-008 | 将 PNG 转换为 JPG。 | 输出格式正确且可打开。 | 输出 `格式测试 长中文 01.jpg`，628 B，Sharp 识别为 JPEG、`320×180`。 | PASS |
| FORMAT-009 | 启用动态动作文件夹名后处理图片。 | 输出目录名符合动作设置。 | 输出进入 `format-input\openflow(50%_q80)处理\格式测试 长中文 01.png`。 | PASS |
| FORMAT-010 | 选择隔离 `format-output`。 | 输出进入指定目录。 | PNG、JPG、MP4 均写入指定隔离输出目录。 | PASS |
| FORMAT-011 | 点击开始处理并观察状态。 | 按钮/处理中状态正确变化。 | 开始按钮触发处理，文件状态从待处理到处理中再到完成/失败，处理结束后按钮恢复。 | PASS |
| FORMAT-012 | 完成图片、JPG 转换和视频处理。 | 成功数量与输出一致。 | 四次成功处理均显示“成功处理 1 个文件”；共生成 4 个有效输出（含动态目录输出）。 | PASS |
| FORMAT-013 | 拖入专用失败样本后临时改名使原路径失效，再开始处理，随后恢复文件名。 | 明确失败，不生成伪成功。 | 文件状态显示“失败”，通知“成功处理 0 个文件，失败 1 个”；没有生成对应输出；测试输入已恢复原名和原 SHA-256。 | PASS |
| FORMAT-014 | 比较输入前后数量、大小和 SHA-256。 | 原输入不被覆盖、移动或删除。 | 原 PNG `F384F934...CD904E`、原 MP4 `A8601F98...EAA09`、TXT `8FE40E4D...550C3` 均保持；没有零字节/不完整输入。 | PASS |

#### FORMAT 输入输出核验

| 文件 | 目录/扩展名 | 大小 | 可打开 | 宽高 | 时长 | 结论 |
| --- | --- | ---: | --- | --- | --- | --- |
| 输入 PNG | `format-input\格式测试 长中文 01.png` | 4068 B | Sharp 可解码 | 640×360 | - | 原文件保留，SHA-256 未变 |
| 保持格式 PNG | `format-output\格式测试 长中文 01.png` | 171 B | Sharp 可解码 | 320×180 | - | PASS |
| JPG 转换 | `format-output\格式测试 长中文 01.jpg` | 628 B | Sharp 可解码 | 320×180 | - | PASS |
| 动态目录 PNG | `format-input\openflow(50%_q80)处理\格式测试 长中文 01.png` | 171 B | Sharp 可解码 | 320×180 | - | PASS |
| 输入 MP4 | `format-input\短视频样本.mp4` | 2292 B | ffprobe 可解析 | 320×240 | 1.000 s | 原文件保留，SHA-256 未变 |
| 输出 MP4 | `format-output\短视频样本.mp4` | 2238 B | ffprobe 可解析 | 160×120 | 1.000 s | PASS |

输出文件数为 4，名称、目录、扩展名、文件大小、图像/视频尺寸和视频时长均符合对应动作；零字节文件为 0，无法解码文件为 0。

### 3.4 SETTINGS（3/3 PASS）

| ID | 步骤 | 预期 | 实际与证据 | 结果 |
| --- | --- | --- | --- | --- |
| SETTINGS-005 | 在确认 `userData` 隔离后，把来源设为 `organizer-source`、目标设为 `organizer-target\20260821`，保存并重启。 | 路径可保存并重新读取。 | 隔离 JSON 和重启后的工作区页均显示相同路径；JPG、MP4 扫描格式仍选中。证据：`screenshots\settings-workspace-restart.jpg`。 | PASS |
| SETTINGS-006 | 新增/编辑 `基线验收模板`，新增临时模板后取消/删除，重启。 | 新增、编辑、取消、保存正确。 | 重启后 `基线验收模板` 存在，临时模板不存在；规则和名称与隔离 JSON 一致。证据：`screenshots\settings-template-restart.jpg`。 | PASS |
| SETTINGS-007 | 将快捷键改为 `CommandOrControl+Alt+F11`，在应用内及其它窗口触发隐藏/恢复，再重启。 | 保存且实际触发一致。 | 两次触发均切换主窗口可见性；重启日志显示快捷键注册成功，设置页读回同一值。证据：`screenshots\settings-shortcut-restart.jpg`。 | PASS |

## 4. 紧凑窗口复核（APP-004 / UI-001 / UI-003）

### 明确结论

- **基线已存在：NO。**
- **是否由 `7b9f3c9` 引入：YES（更准确地说，是该提交降低最小窗口后把原本不可达的布局状态暴露为可复现缺陷）。**
- **截图证据：**`C:\Users\EDY\AppData\Local\Temp\OpenFlow-QA-Baseline\20260821-170359\screenshots\compact-about-baseline-min-1066x633-capture.jpg`。

实际操作：从非最大化窗口尝试缩至约 `746×513`。基线主进程强制 `minWidth: 1080`、`minHeight: 640`，最终截图捕获区约 `1066×633`；再缩小被系统拒绝。在该最小支持尺寸，“关于”仍在左侧导航末项，没有换列或覆盖“关于 OpenFlow Studio”标题。

源码位置：

- `src/main/index.ts:395-402`：默认窗口计算及 `minWidth: 1080`、`minHeight: 640`。
- `src/renderer/src/views/SettingsWorkspace.tsx:235-269`：垂直设置 Tabs、分组标题和“关于”Tab。
- `src/renderer/src/views/SettingsWorkspace.tsx:435-438`：关于面板标题。
- `src/renderer/src/index.css:174-179`、`:257-269`：设置列表和面板的响应式宽度/间距。

对比 `7b9f3c9`：该提交将默认窗口改为约 `820～960 × 560～680`，并将最小窗口改为 `760×520`。验收截图的捕获区 `746×513` 正好对应这一新下限；在此高度，垂直 Tabs 的分组标题和 6 个 Tab 空间不足，列表换列，“关于”覆盖内容标题。APP-004、UI-001、UI-003 是同一根因，UI-003 只是“最大化后还原”的另一条进入路径。

本轮不修复。若后续 UI-only 分支保留小窗口下限，最小修复范围应只涉及 `.settings-tabs .mantine-Tabs-list` 的不换列/滚动约束及必要高度计算，并复测 `746×513`、最大化、还原和键盘访问。

## 5. 统计

### 本轮要求解除的 25 项

| PASS | FAIL | BLOCKED | N/A | 总计 |
| ---: | ---: | ---: | ---: | ---: |
| 25 | 0 | 0 | 0 | 25 |

分组：DAILY 5/5、ORG 3/3、FORMAT 14/14、SETTINGS 3/3。

### 紧凑窗口三项

`APP-004`、`UI-001`、`UI-003` 在约 `746×513` 对本基线为 **N/A（尺寸不可达）**，在基线最小支持尺寸均未复现。它们不计入 25 项功能统计，也没有被伪装为 PASS。

### 尚未在本轮解除的原分流项目

本轮目标只要求解除“继续 UI 改造前必须解除”的 25 项。分流报告中另有 8 项“最终验收前必须解除”和 3 项“环境限制可保留 BLOCKED”，本轮未宣称其已完成；它们不影响选择代码基线，但仍是最终 UI 验收范围。

## 6. 数据安全检查

- 所有测试输入均为可重新生成的测试文件；未使用真实工作图片或视频。
- 文件处理只发生在测试根目录的 working copy。`input-original` 保持不变。
- DAILY 重命名、冲突保护，ORG 转移/撤销，FORMAT 成功/失败路径均进行了前后数量和 SHA-256 核对。
- 未发现真实素材丢失、覆盖、错误移动；测试输出零字节文件为 0。
- 原仓库分支、HEAD、混合提交和两份未跟踪 QA 报告未移动、未删除、未暂存、未提交。
- 未执行 reset、rebase、revert、cherry-pick、分支操作、暂存、Commit、Push、PR 或发布。
- 初次隔离尝试导致真实 OpenFlow 配置时间变化，已在第 1 节如实记录；确认包装隔离生效后真实配置时间不再变化，所有设置写入均位于隔离目录。

## 7. 基线判定和后续使用约束

推荐干净基线为：

`24cd96b676b17b40837c313ce2012bf03fac2051`

该 SHA 的既有 DAILY、ORG、FORMAT、SETTINGS 核心功能在隔离数据上通过，适合从其建立后续 UI-only 分支。后续 UI 改造应只搬运 UI/样式和必要组件重构，不应直接承接 `7b9f3c9` 中的主进程、preload/IPC、配置持久化、工作区自动化或文件清理改动；FORMAT 必须用本报告同一数据和输出断言做前后对照。

本轮不执行提交拆分、UI 修复或创建新分支。
