# OpenFlow UI-P4 日常处理工作区验收报告

## STATUS

PASS。UI-P4 Renderer 改造、工程门禁、760×520/主题/缩放矩阵、Daily 真实文件回归和全功能风险回归均通过。统计为 25 PASS / 0 FAIL / 0 BLOCKED。

## 分支与基线

- 分支：`feature/ui-daily-workspace`
- 起始基线：`abd1c0ea9100cc278e44b3dbf6b22dc64ca25cb9`
- Renderer 提交：`2e0a07d1300e6a316868148eb9a090388b9d11ce`
- 报告写入前 HEAD：`2e0a07d1300e6a316868148eb9a090388b9d11ce`
- 最终 HEAD：本报告所在的第二个 docs 提交
- 旧混合提交 `7b9f3c965d8b7c98936334b3982ab40d3b581ad4` 不是当前 HEAD 的祖先。

证据根：`C:/Users/EDY/AppData/Local/Temp/OpenFlow-QA-UI-P4/20260824-180904`

## 改造前问题与改造结果

改造前在 760×520 外窗、744×481 客户区中，`.daily-actions` 为 absolute，矩形为 y=405..467；命名卡片从 y=386 开始，操作栏直接覆盖命名内容。页面低宽度规则仅在 720px 生效，744px 客户区仍使用不适合紧凑窗口的布局。状态标题、图标和局部字重偏大，最大化内容横向拉伸。

改造后：

- Daily 主滚动唯一使用 `.daily-scroll`；操作区进入文档流并置于校验区之后。
- 760×520 使用单列，四阶段概览压缩为四列；内容宽 652px，横向滚动为 0。
- 操作区 y=1798..1860，命名卡片 y=342..666，不再相交。
- 桌面保留双栏，最大内容宽度 1280px；最大化后内容居中。
- 页面卡片统一语义表面、1px 描边和无默认大阴影；标题为 16/24/600，状态标题为 20/28/600。
- `canRename=false` 时校验是主操作；`canRename=true` 时重命名是唯一主操作，重新校验降为次操作。
- 目录名和路径提供完整 `title`，删除目录的 aria-label 包含目录名。

## 修改文件与 diff

Renderer 提交仅包含：

- `src/renderer/src/views/DailyWorkspace.tsx`
- `src/renderer/src/index.css`
- `src/renderer/src/dailyResponsive.test.ts`

Renderer diff：473 insertions / 247 deletions。文档提交仅包含本报告和 `docs/design/openflow-ui-p4-daily-workspace.md`。

## 工程门禁

- `git diff --check`：PASS，退出码 0；仅有 Git 预告 LF 下次写入将转换为 CRLF。
- `npm run lint`：PASS，退出码 0。
- `npm test`：PASS，171 tests / 171 pass / 0 fail；新增 Daily 响应式契约 28 项。
- `npm run build`：PASS，最终退出码 0；Electron/Vite/NSIS 和 Chrome 扩展打包完成。
- `package-lock.json`：未修改，SHA-256 为 `E80235F04807173AE6F09F367AEFECFF7BD63726AFB117D39D4076FF2256F217`。

非阻断警告：Vite CJS API deprecated、Node `MODULE_TYPELESS_PACKAGE_JSON`、electron-builder duplicate dependency references 和 Node DEP0190，均为基线既有警告。测试中的 `desktop unavailable` 为扩展队列预期离线分支，检查最终通过。

第一次 build 在清空 `build-dist/win-unpacked/d3dcompiler_47.dll` 时失败。只读检查确认锁定者为本轮基线截图实例 PID 21024 及其子进程；窗口已正常关闭但远程调试进程残留。仅停止该精确 OpenFlow 进程树后重新执行，完整 build 通过。未结束无关 Node/Electron。

## 视觉、主题、缩放与键盘

- 760×520 外窗客户区为 744×481；唯一 Daily 主滚动区为 676×405。
- 浅色和深色空态、需求态、双目录、三种命名、手动尺寸、校验详情、可重命名和完成态均无内容覆盖或横向页面溢出。
- 1080×640 客户区 1064×601；最大化客户区 1920×1009；内容宽受 1280px 上限约束。
- 125% 与 150% 使用 BrowserWindow `webContents.setZoomFactor` 等效缩放，截图 CSS 像素分别为 595×385 和 496×321；仍为单列和唯一主滚动。
- 浅色切换到深色后重启，设置页重新读取“深色”。
- 通过真实键盘 Tab/Shift+Tab 将焦点放到“日常”导航；DOM 读取为 `BUTTON / aria-label=日常 / outline 2px solid`。Space 与 Enter 均能激活日常页面。
- disabled、数量不足、尺寸错误、预检通过、处理完成等状态可辨；未自动连点或重复提交。

## Daily 真实功能 5/5

### DAILY-003 需求和目录

PASS。通过真实 Windows 文件选择器导入 `valid-requirements.json`，识别 1 个项目及 1080×1920、1920×1080。随后导入错误 JSON，UI 显示“读取失败 / 请检查 JSON 文件格式后重试”，Document text 仍为 `valid-requirements`，上一份项目与尺寸保持。

通过真实目录选择器选择 `output/daily-root` 并创建目录。磁盘实际包含 `示例项目/1080x1920/_Assets`、`1920x1080/_Assets`、即梦生成、截屏素材、录屏素材、模糊处理和奇觅生成目录。

### DAILY-005 多目录与去重

PASS。通过真实目录选择器加入 `multi-a`、`multi-b`，再次选择 `multi-b` 后 accessibility tree 仍只有 multi-a 1 项、multi-b 1 项、删除按钮 2 个。重复选择前后磁盘文件数量和 SHA-256 未变化。

### DAILY-007 命名方式

PASS。常规、特殊、自定义均真实切换，预览与当前模板同步。自定义选中 `UI-P4验收模板` 后恢复常规，后续预检和真实重命名使用常规规则。

### DAILY-008 模板

PASS。在隔离配置中新建并重命名 `UI-P4验收模板`；另建临时 `自定义模板 3` 后删除。进程重启后 `UI-P4验收模板` 存在，临时模板不存在。真实用户配置未修改。

### DAILY-009 尺寸

PASS。需求尺寸 1080×1920、1920×1080 可见；真实点击 640×360 后显示蓝色选中态，再次点击恢复需求尺寸。

## 校验、重命名与同名保护

multi-a 和 multi-b 使用真实可解码 JPG/PNG。第一次校验得到 1 项尺寸错误、缺 6 张、通过 2 项；详情真实显示 `手动尺寸-640x360.png`、实际 640×360 和缺失数量。移除 multi-b 页面卡片（磁盘文件未删除）后重新校验，得到缺 3 张、通过 1 项、可先重命名已有素材。

在 multi-a 预置：

- 哨兵 `RSQ-20260824-fixtures-1080x1920-CSZZR-(1).jpg`：42 bytes，SHA-256 `3F19B3EA094C391D57EF0EB503F7DFEEA03A107EA9A9EC01475C4878D8E0BBB5`。
- 原素材：12509 bytes，SHA-256 `03EE19B1274B6BE0C6123EBCC3FE7F52F350ECCFAD462E67E062E88F74249E6D`。

真实执行重命名后：哨兵文件名、42 bytes 和 SHA-256 完全不变；素材生成 `RSQ-20260824-fixtures-1080x1920-CSZZR-(2).jpg`，12509 bytes 和内容 SHA-256 不变。前后均为 2 个文件，总大小和内容哈希集合一致；覆盖、丢失、零字节、异常移动、重复处理和临时残留均为 0。

## 全功能回归 25/25

- DAILY：5/5 PASS。本轮最终 build 完整执行，见上述真实功能与安全验证。
- ORG：3/3 PASS。本轮最终 build 在 760×520 完成页面 smoke；P3 紧邻基线的真实 ORG-004/007/012 证据重新核对，撤销后来源 4、目标同名哨兵 1、零字节 0，五个 SHA-256 与 P3 报告一致。UI-P4 diff 未触及 Organizer、main、preload、shared 或 IPC。
- FORMAT：14/14 PASS。本轮最终 build 在 760×520 完成页面 smoke；重新使用 Sharp/ffprobe 打开 P3 隔离证据中的 8 个真实输入/输出，全部可解码、零字节 0。关键结果仍为 PNG 320×180/171 bytes、JPG 640×360/1649 bytes、MP4 160×120/2270 bytes/1.000s，原 PNG/MP4 仍为 4337/2325 bytes、640×360/320×240/1.000s。UI-P4 diff 未触及 Format 或媒体参数。
- SETTINGS：3/3 PASS。本轮最终 build 在 760×520 实际打开“关于”；隔离配置中新建/编辑/删除模板并完成进程重启读取；深色主题重启持久化通过。UI-P4 diff 未触及 Settings 内部布局或配置契约。

其余 20 项采用“紧邻 P3 真实证据 + 本轮最终 build smoke + 本轮磁盘/媒体重新核验 + 源码零改动”复核，不将仅有自动化门禁伪装成真实功能验证。总计 25 PASS / 0 FAIL / 0 BLOCKED。

## 数据安全

- P4 所有文件操作位于证据根或 P3 隔离证据根；未读取真实工作素材。
- 真实配置前后 SHA-256 均为 `EA43CAF1D0D08625FED535E421708A1DC10A52B1D9971D742162ECFAF3F8AD41`，LastWriteTime 均为 `2026-08-21 17:07:22`。
- P4 哨兵与重命名文件内容集合保持；P3 Organizer/Format 输出重新核验零字节 0。
- 未永久删除真实文件，未修改真实 OpenFlow 工作区，未结束无关进程。

## Console、日志与可恢复失败

最终 build 和 GUI 操作无新增未处理 Renderer 错误或 Promise rejection；状态与通知均符合预期。基线已知 Sentry CSP/SDK 信息不属于 P4 新增错误。

可恢复历史完整记录：第一次 build 被已关闭窗口但仍残留的本轮 OpenFlow 远程调试进程锁文件；精确停止后通过。文件夹选择器在一次重复目录测试中停在 Windows“库/文档”，选择器提示“请选择一个文件夹”；关闭提示并输入隔离 multi-b 路径后继续，未处理或移动任何文件。

## 范围审计

- `git diff -- src/main src/preload src/shared package.json package-lock.json`：空。
- BrowserWindow 默认/最小尺寸未修改；测试继续确认默认 1080×640、最小 760×520。
- 无 main、preload、shared、IPC、配置契约、需求解析、目录算法、素材识别、命名规则、校验、重命名或依赖变化。
- 未 cherry-pick、复制或重放混合提交 `7b9f3c9`；未修改旧混合 worktree。
- 未 Push、未创建 PR、未发布、未运行 npm audit fix。

## 最终截图清单

以下 21 张均来自最终 build、P4 evidence root、隔离 userData，主 PID 为 10884；重启持久化复核 PID 为 24180。截图时间为 Asia/Shanghai。

| 文件 | 像素 | 主题/缩放/状态 | 时间 | SHA-256 |
|---|---:|---|---|---|
| daily-1080x640-dark.png | 1064×601 | 深色/100%/处理完成后空态 | 18:29:13.394 | `143E3117514B30043C59FDB789B9F2E2BF56BC2DC4FB5C3B715158BA2EF95A8F` |
| daily-1080x640-light.png | 1064×601 | 浅色/100%/处理完成后空态 | 18:29:12.093 | `A1F83847C7D6FEA6419B36FF5350A51E1D319415B819451D148D70F7F87A2F91` |
| daily-125pct.png | 595×385 | 浅色/125%/空态 | 18:29:42.421 | `2FDF63E18B512E25507E3508955E78AECB35B30829E9DFA239E6F1EFED40888C` |
| daily-150pct.png | 496×321 | 浅色/150%/空态 | 18:29:43.170 | `CB3FCA92DAFF9F27304E54E1E52C84D5B4A5A17313B2A3F85FB49D1652C2EBA3` |
| daily-760x520-conflict-protection.png | 744×481 | 浅色/100%/哨兵保护后 | 18:28:57.417 | `DF2738F4FF3A324642F828A423682FAE0300C85A4524A3A8B56E808619E3708F` |
| daily-760x520-dark-empty.png | 744×481 | 深色/100%/空态 | 18:21:07.283 | `5C9B43883113FBBBC4F0457C5294CFE1B6C9DFF10B6C2CFAD04FD7295414F850` |
| daily-760x520-light-empty.png | 744×481 | 浅色/100%/空态 | 18:20:59.320 | `CC68F99C519DF2F79A34B616337011BD1F1B9D1EF59F154D18DF66AAC2566728` |
| daily-760x520-manual-size.png | 744×481 | 浅色/100%/640×360 选中 | 18:26:58.126 | `230AEC076634EA8DAAD6ED68D2F05BC3C8774CD066FA06229B14F9AD917A39B0` |
| daily-760x520-naming-custom.png | 744×481 | 浅色/100%/自定义 | 18:26:30.418 | `61A66DD839A8713EE1A282643ACF456AF0306C3C87B37F64AC675DE890ACD488` |
| daily-760x520-naming-regular.png | 744×481 | 浅色/100%/常规 | 18:24:11.298 | `39E645F00A2F09DBD95B61C26AF7721AE88C2A15EF446A107A634EE6052BF3EA` |
| daily-760x520-naming-special.png | 744×481 | 浅色/100%/特殊 | 18:24:26.819 | `047969B257A9820C74628BBEEAF6637EEA903862D49B0B9AC76C9D77392A8255` |
| daily-760x520-rename-ready.png | 744×481 | 浅色/100%/可重命名 | 18:28:20.057 | `096FA95D1CFF9812CEAC4191F639F00F23F7DCF3DB0A6D54279B7B1F655B88D2` |
| daily-760x520-rename-success.png | 744×481 | 浅色/100%/重命名完成 | 18:28:57.127 | `DF2738F4FF3A324642F828A423682FAE0300C85A4524A3A8B56E808619E3708F` |
| daily-760x520-requirements.png | 744×481 | 浅色/100%/有效需求 | 18:21:56.309 | `8FB8B64127F3FB124A5FEE09AAA9B97D9FBC36ED0B68161A8C4F3F4D303985C0` |
| daily-760x520-two-directories.png | 744×481 | 浅色/100%/双目录 | 18:23:18.002 | `941935436733598CD7E324013ECFFD67DBD84344AB31768A49179418A8076E52` |
| daily-760x520-validation-details.png | 744×481 | 浅色/100%/真实错误详情 | 18:27:24.906 | `3C984496AFFFC0BD6D2C186C124019599AD36110339C326ABFB7391192CAE59C` |
| daily-maximized-dark.png | 1920×1009 | 深色/100%/最大化 | 18:29:25.359 | `5EFBE213732EADBC1F1B6B65EE649D08E724C8B95E7C201DC6ABF81907C5B679` |
| daily-maximized-light.png | 1920×1009 | 浅色/100%/最大化 | 18:29:24.029 | `B81423E806E1C9D01D7C81CE3B9048CE579E1F0FFABFE69053EC3251C6BB167B` |
| format-760x520-smoke.png | 744×481 | 浅色/100%/Format smoke | 18:30:15.394 | `505D9ED52E7DEF532100693ABEA41650DA7BDB2846267C1A520C85DCB3E6DD37` |
| organizer-760x520-smoke.png | 744×481 | 浅色/100%/Organizer smoke | 18:30:02.819 | `B972973C873E29A0FEBB01E5400F7B6A2A8EDE0746B0DAD0237E2574F8E501FF` |
| settings-760x520-about-smoke.png | 744×481 | 浅色/100%/设置关于 | 18:30:28.301 | `3E0BD8FCA5302BAB42EC27D1F4B61BD2C027F1C6E9DACB102B535FF570E5E728` |

`final.zip` SHA-256 为 `C7CA5DD25CA3EF5CE91D417E084C63348258FAE158D421C975371FADA98E36F7`，包含 21 项，唯一根为 `final/`；绝对路径、`..`、配置、素材和用户数据异常条目为 0。校验文件为证据根 `final.sha256.txt`。

## Git、进程与发布状态

Renderer 提交已完成。文档提交将在本报告与设计说明暂存审查后创建；目标最终状态为相对基线 Ahead 2 / Behind 0、工作树干净、暂存区为空。

P4 实例只从 `E:/OpenFlow-baseline-24cd96/build-dist/win-unpacked/openflow-studio.exe` 启动；APPDATA、LOCALAPPDATA 和 userData 均位于证据根。结束时将正常关闭 PID 24180，并只在窗口关闭后远程调试进程仍残留时精确停止该进程树。Push、PR、release 均未执行。
