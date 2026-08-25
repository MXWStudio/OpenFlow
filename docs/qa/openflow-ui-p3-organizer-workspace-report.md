# OpenFlow UI-P3 素材自动整理工作区 QA 报告

## STATUS

PASS。UI-P3 Renderer 表现层、工程门禁、视觉矩阵、Organizer 真实文件回归和 25 项全功能回归均通过。最终统计为 25 PASS / 0 FAIL / 0 BLOCKED。

## BRANCH / HEAD / 基线

- 分支：`feature/ui-organizer-workspace`
- 起始基线：`65c928b8be14c4c67f67752439ba1c2c8bf65908`
- 起始分支：`feature/ui-format-processor`
- 旧混合提交 `7b9f3c965d8b7c98936334b3982ab40d3b581ad4` 不是本分支祖先。
- Renderer 提交：`64e78596ea95894526137bd072c126ec7d571488`，`feat(renderer): redesign organizer workspace`。
- 本报告将作为其后的 Docs 提交内容；最终 Docs SHA 在提交后由最终审计记录。
- 未 merge、rebase、reset、revert、cherry-pick、amend、Push、创建 PR 或发布。

## 改造前问题与改造后结果

改造前 760×520 的 `.organizer-floating-actions` 为绝对定位，尺寸约 306×62px，覆盖底部内容；页面以大圆角、深色 Surface 和橙色大按钮组织，最大化时内容宽度随 1852px 客户区继续拉伸。改造后：

- 复用既有 `PageHeader`，页面明确分为状态/快捷操作区和待整理素材工作区。
- 1080×640 及更宽使用稳定双栏；820px 以下为单列。
- `organizer-scroll` 是 Organizer 唯一纵向主滚动容器；操作栏为 `position: static` 并处于正常文档流。
- 内容最大宽度 1280px，宽屏居中；关键 Grid/Flex 子项具有 `min-width: 0`。
- 视频转移选项由橙色主按钮改为 Checkbox，仍复用原状态、事件和业务含义。
- 长目录、长文件名和目标路径使用收缩、截断和 `title`，未发现横向溢出。
- Surface、描边、文本、成功/警告/失败颜色均使用现有语义变量；浅色无硬编码深色大卡片，深色无纯白面板。
- 扫描、识别、转移、同名保护、奇觅路径、撤销、IPC 参数和通知处理未改变。

## 修改文件

- `src/renderer/src/views/OrganizerWorkspace.tsx`
- `src/renderer/src/index.css`
- `src/renderer/src/organizerResponsive.test.ts`
- `docs/design/openflow-ui-p3-organizer-workspace.md`
- `docs/qa/openflow-ui-p3-organizer-workspace-report.md`

## 工程门禁

- `git diff --check`：PASS，退出码 0。仅出现 Git 的 LF/CRLF 工作区提示，无空白错误。
- `npm run lint`：PASS，退出码 0。
- `npm test`：PASS。release 测试 27，source 测试 138，合计 165 PASS / 0 FAIL；新增 Organizer 针对性测试 12 项。
- `npm run build`：首次因本 worktree 已识别 OpenFlow 实例锁定 `build-dist/win-unpacked/d3dcompiler_47.dll` 而失败；正常关闭该精确实例后重跑 PASS，完整 Vite/Electron/NSIS/extension build 成功。未结束无关进程。
- `package-lock.json` SHA-256：`E80235F04807173AE6F09F367AEFECFF7BD63726AFB117D39D4076FF2256F217`，未变化。
- 已知非阻断警告：`MODULE_TYPELESS_PACKAGE_JSON`、Vite CJS API 弃用、`DEP0190`、重复依赖引用和隔离环境 extension desktop unavailable 信息。未执行 `npm audit fix`。

新增 12 项测试覆盖：原入口和 IPC 调用保留、原 handler/条件保留、唯一主滚动、无覆盖式定位、最大宽度与 `min-width: 0`、紧凑单列、长路径/文件名、语义 Surface、奇觅选项层级、键盘顺序、横向溢出契约和 BrowserWindow 760×520/1080×640 契约。

## 视觉与交互矩阵

- 760×520 外窗：客户区 744×481；浅色、深色、就绪、结果、转移前、转移完成、撤销完成均通过。
- 1080×640 外窗：客户区 1064×601；浅色/深色结果态通过。
- 最大化：客户区 1920×1009；内容列为 1280px 并居中，未无限拉伸。
- 125% 等效缩放：客户区等效 595×385；document 和 Organizer scroll 均无横向溢出。
- 150% 等效缩放：客户区等效 496×321；document 和 Organizer scroll 均无横向溢出。
- 760 结果态：2 张图片 + 1 个视频全部可滚动到达，TXT 未进入列表；操作栏在滚动底部仍处于文档流且不覆盖最后内容。
- `documentElement.scrollWidth <= clientWidth`，Organizer viewport `scrollWidth <= clientWidth`；横向溢出、覆盖、裁切和内容穿透均为 0。
- Tab 从主导航开始，焦点环可见；Enter 激活日常入口，Space 激活整理入口；目录、选项、扫描、转移和撤销沿 DOM/视觉顺序可达。
- 设置“关于”、日常和格式处理均从真实入口打开并保存 smoke 截图。

扫描/转移持续时间很短，未能稳定保存独立“扫描中/转移中”静态截图；真实 loading/disabled 条件由源码边界测试保留，最终证据包含转移前可执行和转移完成真实状态，不使用假状态。

## Organizer 真实文件回归 3/3

### ORG-004 空目录

将隔离来源切到空目录并执行真实 UI 扫描。实际显示“扫描为空”“没有需要整理的文件”和“未找到符合格式要求的素材文件”，未误报系统错误；随后恢复隔离 `organizer-source`。PASS。

### ORG-007 识别与不支持文件

来源包含 2 张 JPG、1 个 1 秒 MP4 和 `无法识别样本.txt`。真实 UI 扫描只列出 3 个支持文件，游戏名为“示例游戏”，分辨率为 1080-1920 / 1920-1080；TXT 未进入队列并保留在来源。PASS。

### ORG-012 转移、同名保护与撤销

目标预置同名但不同内容的 JPG 哨兵，SHA-256 为 `453A2B4F54A45F4F71EC204D19EE7B620EE32AF84E9B0784B33E2C46EA5505B8`。启用“视频转移-奇觅生成”后真实转移 3 个支持文件：

- 1080×1920 图片进入 `示例游戏/1080-1920/示例游戏-1080x1920-20260824-01-20260824.jpg`，SHA-256 `03EE19B1274B6BE0C6123EBCC3FE7F52F350ECCFAD462E67E062E88F74249E6D`。
- 1920×1080 图片进入 `示例游戏/1920-1080/示例游戏-1920x1080-20260824-02.jpg`，SHA-256 `857CE75E0DBDF7E40E0ED265B01F4CECBB3898546AA4CB7C611ED1B2A3A62278`。
- 视频进入 `示例游戏/示例游戏-奇觅生成/示例游戏-1920x1080-20260824-03.mp4`，SHA-256 `62A2AC7FF41EEAF3F3B6A99158AA05AC6F6BD1728E00B17AC7DF849301E76439`。
- 来源在转移后只剩 TXT；哨兵内容和哈希未改变。
- 真实撤销后来源恢复 4 个文件，目标只剩 1 个哨兵；目标新增文件、重复文件、零字节、遗留临时文件和异常移动均为 0。

首次使用不含日期的隔离目标目录时，原业务日期确认保护按预期阻止转移；未移动或损坏文件。改用同一证据根下含 `20260824` 的隔离目标目录后通过。为补齐可见的 760×520 完成态证据，后续重复执行并撤销了同一可恢复转移；每轮撤销后均恢复为来源 4、目标哨兵 1、零字节 0。

## 全功能回归 25/25

### DAILY 5/5

1. 通过系统文件选择器导入有效需求表，识别 1 个项目和 1080×1920、1920×1080 两个目标。
2. 导入错误 JSON 时显示读取失败，已导入尺寸和会话保持，不覆盖有效状态。
3. 通过系统目录选择器在隔离 `output/daily` 创建项目、尺寸 `_Assets` 和五类固定目录。
4. 加入隔离项目目录并真实校验：2 个真实 JPG 均解码/尺寸有效，正确报告 1080×1920 仍缺 2 张并提供详情。
5. 在数量不足的允许路径执行已有素材重命名：2 个文件成功，大小 12509/12508 字节，内容 SHA-256 分别仍为 `03EE...49E6D`、`857C...62278`；无覆盖、丢失或零字节。

### ORG 3/3

ORG-004、ORG-007、ORG-012 均 PASS，详见上一节。

### FORMAT 14/14

1. 原生 Electron 文件路径拖入 PNG 成功；2. 拖入 1 秒 MP4 成功；3. 图片队列再拖入视频显示类型不匹配且不混入；4. TXT 被忽略；5. PNG 50% 输出 320×180；6. 质量 60 生效并输出可解码；7. PNG 保持原格式；8. PNG 转 JPG 为 640×360 可解码；9. 动作名生成 `openflow(50%_q60)处理`；10. 自定义导出目录生效；11. 图片、视频真实开始处理；12. 成功结果路径存在；13. 缺失文件和 TXT 返回明确失败且其它任务不受影响；14. 原 PNG/MP4 仍为 4337/2325 字节、640×360/320×240、视频 1.000 秒，未被覆盖或删除。

输出核验：自定义 PNG 171 字节 320×180；JPG 1649 字节 640×360；MP4 2270 字节 160×120、1.000 秒；动态目录 PNG 171 字节 320×180。所有输出数量、名称、目录、扩展名符合配置，Sharp/ffprobe 可完整读取，零字节和不完整文件为 0。

初次用 Playwright 上传语义注入 File 时 Electron `webUtils.getPathForFile` 返回空并触发一次受控“文件路径解析失败”；改用本机 CDP `DOM.setFileInputFiles` 后取得真实路径并完成全部拖入回归。该工具尝试未处理文件，也未改变产品代码。

### SETTINGS 3/3

1. 隔离工作区源/目标路径和 `jpg/mp4` 整理格式保存、读取与重启读取一致。
2. 新增隔离模板 `UI-P3验收模板`，规则复制自既有自定义模板；保存、reload 和进程重启后均可读取。
3. 深色切换、reload、浅色恢复和进程重启持久化通过；`CommandOrControl+Alt+F11` 注册、隐藏、跨窗口唤醒和重启注册均通过。

## 数据安全检查

- Organizer 撤销后：来源 4，目标哨兵 1，零字节 0。
- Daily 重命名后：2 个输出内容哈希与输入副本一致，无覆盖和丢失。
- Format：4 条成功输出均可解码，2 条安全失败均未生成损坏文件；原图片/视频未修改。
- 永久删除、真实工作素材读取、真实工作区修改、异常移动、重复输出和遗留临时文件均为 0。
- 所有文件操作仅发生在 `C:/Users/EDY/AppData/Local/Temp/OpenFlow-QA-UI-P3/20260824-160730` 的隔离副本。

## Console、日志和已知差异

Renderer reload 仅出现 UI-P0/P1/P2 已记录的 Sentry `sentry-ipc` CSP/SDK 基线信息，没有新增未处理异常或 Promise rejection。主进程日志包含故意导入错误 JSON 的预期 `SyntaxError`，UI 正确显示读取失败并保持会话。没有 Organizer、Daily、Format 或 Settings 新增业务错误。

工程日志位于证据根的 `logs`；真实文件清单位于 `logs/regression`。工程第一次 build 锁文件失败、正常关闭精确实例后的成功重跑，以及上述可恢复的验收工具/路径重试均原样保留，没有改写为“从未发生”。

## 范围审计

- Renderer 范围只有 Organizer JSX、Organizer 页面专用 CSS 和针对性测试。
- 文档范围只有 UI-P3 设计说明和本 QA 报告。
- `src/main/**`、`src/preload/**`、`src/shared/**`、IPC、业务逻辑、BrowserWindow、`package.json`、`package-lock.json` 和依赖无变化。
- 未复制或重放 `7b9f3c9` 的业务功能；旧混合 worktree 保持 `codex/compact-workspace-ui` / `7b9f3c965d8b7c98936334b3982ab40d3b581ad4`，既有 `?? docs/qa/` 未移动、删除或提交。

## 截图和证据包

证据根：`C:/Users/EDY/AppData/Local/Temp/OpenFlow-QA-UI-P3/20260824-160730`

| 截图 | 像素 | 主题/缩放/状态 | 来源主 PID | SHA-256 |
|---|---:|---|---:|---|
| daily-760x520-smoke.png | 744×481 | 浅色/100%/日常 smoke | 30636 | `20986CA9...6BAD2` |
| format-760x520-smoke.png | 744×481 | 浅色/100%/格式 smoke | 30636 | `436452A6...4C154` |
| organizer-1080x640-dark-results.png | 1064×601 | 深色/100%/3 结果 | 30636 | `D3BA2932...831F2` |
| organizer-1080x640-light-results.png | 1064×601 | 浅色/100%/3 结果 | 30636 | `0FDD771B...CA40` |
| organizer-125pct.png | 595×385 | 浅色/125%/结果 | 30636 | `7D8F138A...F0636` |
| organizer-150pct.png | 496×321 | 浅色/150%/结果 | 30636 | `0A492F14...AFE9` |
| organizer-760x520-dark-ready.png | 744×481 | 深色/100%/就绪 | 30636 | `549E7BEB...D962` |
| organizer-760x520-light-ready.png | 744×481 | 浅色/100%/就绪 | 30636 | `935E05D9...7239` |
| organizer-760x520-light-results.png | 744×481 | 浅色/100%/3 结果 | 30636 | `4CAAB848...670B` |
| organizer-760x520-transfer-complete.png | 744×481 | 浅色/100%/转移成功+撤销入口 | 28964 | `692A1329...D3A` |
| organizer-760x520-transfer-ready.png | 744×481 | 浅色/100%/可转移 | 30636 | `4A39BC57...EAB` |
| organizer-760x520-undo-complete.png | 744×481 | 浅色/100%/撤销完成 | 30636 | `049999E5...21B` |
| organizer-maximized-dark.png | 1920×1009 | 深色/100%/最大化 | 30636 | `4A740DD2...9C3B` |
| organizer-maximized-light.png | 1920×1009 | 浅色/100%/最大化 | 30636 | `CE25F4DB...0A88` |
| settings-760x520-about-smoke.png | 744×481 | 浅色/100%/设置-关于 | 30636 | `D650CBFD...68FD` |

完整截图哈希和尺寸见 `final.sha256.txt`。

- `final.zip` SHA-256：`E9AFBA6D453E919C0F93A294F2E78CEE94B9936BC2A4A1490044ABD63686DA4B`
- ZIP 文件数：15。
- ZIP 路径检查：0 个异常；全部以 `final/` 为根，无绝对路径、`..`、配置、素材或用户数据。

## 真实配置与进程清理

- 真实配置：`C:/Users/EDY/AppData/Roaming/openflow-studio/openflow-config.json`
- 验收前后 SHA-256 均为 `EA43CAF1D0D08625FED535E421708A1DC10A52B1D9971D742162ECFAF3F8AD41`。
- 验收前后 LastWriteTime 均为 `2026-08-21 17:07:22`。
- 最终 build 仅从 `E:/OpenFlow-baseline-24cd96` 启动，APPDATA、LOCALAPPDATA 和 userData 均指向证据根。
- 验收使用过主 PID 30636 和重启持久化主 PID 28964；均通过应用正常关闭路径退出。
- 报告生成前精确匹配本 worktree 的 OpenFlow 进程数为 0；未结束无关 Node/Electron 进程。

## 最终结论

UI-P3 本地工程、视觉、真实文件、安全和功能门禁均为 PASS，适合提交上级进行 UI-P3 人工视觉门禁。人工确认前不进入 UI-P4。

---

## 2026-08-24 上级视觉 FAIL 与纠正复验

### 上级人工结论

原 `final.zip` 的完整性和路径安全通过，但上级人工视觉门禁判定 `FAIL — 不可进入 UI-P4`。失败项为：`P3-VIS-001` 两张 JPG 暴露浏览器破图图标；`P3-EVD-002` 原完成态截图未显示可达的撤销入口；`P3-EVD-003` 原撤销截图没有明确完成反馈。本节按时间顺序追加纠正过程，不修改前文原本地 PASS 和原证据历史。

### 根因

- 图片预览：Renderer 使用裸 Windows 路径构造 `asset://${file.filePath}`，并把 React `ImageIcon` 元素传给 Mantine `fallbackSrc`。失败后该元素被字符串化为 `[object Object]`，最终形成 `file:///.../[object%20Object]` 的破图。磁盘上的两张 JPG 均存在、可由 Sharp 解码为 1080×1920 和 1920×1080，不是素材损坏或转移后旧地址问题。
- 完成态证据：撤销入口一直存在于原快捷操作区，但 760×520 的顶部完成卡片和下方入口不能同时进入一个视口；原截图取景不足，不是入口丢失或状态机错误。
- 撤销证据：原截图只证明列表恢复，没有把短时通知纳入画面。真实撤销会先记录“撤销成功”，随后立即刷新扫描；顶部临时通知可能显示最新“扫描完成”。纠正证据改用同一隔离实例消息中心中带时间戳的“撤销成功”持久记录，并同时保留恢复列表和磁盘哈希。

### 最小 Renderer 修复

修复提交：`957c46de66356c9ae763303cd54d4743812b96b0`，`fix(renderer): prevent broken organizer previews`。

- 图片仍优先尝试既有 `asset` 协议，路径使用 `encodeURIComponent`；加载失败后卸载 `img` 并显示固定尺寸图片类型占位。
- 图片 fallback、成功图片和视频占位分别标记为 `fallback`、`image`、`video`，图片/视频图标可区分；装饰图标 `aria-hidden`，外层提供唯一可识别名称。
- 没有改动扫描、识别、转移、同名保护、奇觅路径、撤销 handler、IPC、disabled 条件、main、preload、shared、窗口或依赖。

### 工程门禁

- `git diff --check`：PASS，退出码 0；仅有 Git LF/CRLF 工作区提示。
- `npm run lint`：PASS，退出码 0。
- `npm test`：PASS；release 27、source 143，合计 170 PASS / 0 FAIL。新增 5 项预览测试，原 12 项 Organizer 响应式测试继续通过。
- `npm run build`：PASS；Vite、Electron、NSIS 和 Chrome extension 完整构建完成。
- 非阻断警告：`DEP0190`、重复依赖引用、既有 Sentry/构建提示；未执行 `npm audit fix`。
- `package-lock.json` SHA-256：`E80235F04807173AE6F09F367AEFECFF7BD63726AFB117D39D4076FF2256F217`，未变化。

### 视觉纠正结果

- 760×520 浅色/深色、1080×640 浅色/深色、最大化浅色/深色、125%/150% 等效缩放均使用修复后的最终 build、同一 evidence root 和同一隔离 userData。
- 两张 JPG 在当前安全协议不能解码到 Renderer 时稳定显示图片类型 fallback；视频保持视频图标。所有状态的浏览器破图元素计数为 0。
- 文件名、类型、分辨率、大小和目标路径仍可见；document 横向溢出为 false，未发现覆盖、布局跳动或无法滚动到操作区。

### 转移与撤销闭环

- 主 PID：`31732`；外窗 760×520，客户区 744×481，浅色 100%，隔离来源、目标、APPDATA、LOCALAPPDATA 和 userData 一致。
- `organizer-760x520-transfer-complete-top.png` 与 `organizer-760x520-transfer-complete-undo-control.png` 分别在 17:43:11.531 和 17:43:11.610 连续拍摄：前者显示“整理完成”，后者在同一完成状态滚动后显示“撤销转移”。
- 真实撤销后，消息中心 17:43:11 的记录明确显示“撤销成功 / 撤销完成。成功恢复 3 个文件，失败/未找到 0 个”，保存为 `organizer-760x520-undo-feedback.png`；通知关闭后列表恢复截图为 `organizer-760x520-undo-restored.png`。
- 撤销后来源 4 个文件、目标 1 个原同名哨兵、零字节 0。三项支持文件 SHA-256 恢复为 `03EE19...49E6D`、`857CE7...62278`、`62A2AC...76439`；TXT 为 `030374...0659`；目标哨兵仍为 `453A2B...505B8`。覆盖、丢失、异常移动和遗留新增文件均为 0。
- 隔离副本中的安全重复撤销返回“撤销失败 / 没有可以撤销的转移记录”，未再次移动或损坏文件，因此不构成危险重复撤销业务缺陷。

### 功能回归复核 25/25

- ORG：3/3 PASS。空目录、支持/不支持识别、真实转移、同名保护、奇觅目录和真实撤销均复核；本轮再次完整执行 ORG-012。
- DAILY：5/5 PASS。有效/错误需求会话仍在隔离配置中，日常 smoke 正常；两份重命名输出仍为 12509/12508 字节，SHA-256 为 `03EE19...49E6D`、`857CE7...62278`，无覆盖、丢失或零字节。
- FORMAT：14/14 PASS。格式 smoke 正常；原 PNG/MP4 分别为 4337/2325 字节、640×360/320×240、视频 1.000 秒；四条既有真实输出重新由 Sharp/ffprobe 打开，分别为 PNG 320×180/171 字节、JPG 640×360/1649 字节、MP4 160×120/2270 字节和动态目录 PNG 320×180/171 字节，零字节 0。
- SETTINGS：3/3 PASS。隔离 workspaceSettings、`UI-P3验收模板`、`CommandOrControl+Alt+F11` 和主题均从同一 userData 重新读取；浅/深切换与 reload 已在本轮视觉矩阵再次验证。
- 总计：25 PASS / 0 FAIL / 0 BLOCKED。当前修复只影响 Organizer 预览表现层；原真实功能证据和本轮磁盘/媒体重新核验一致。

### 纠正截图清单

全部截图来源主 PID 均为 `31732`，路径为 `C:/Users/EDY/AppData/Local/Temp/OpenFlow-QA-UI-P3/20260824-160730/final-corrected/`。

| 文件 | 像素 | 主题/缩放/状态 | 时间 | SHA-256 |
|---|---:|---|---|---|
| daily-760x520-smoke.png | 744×481 | 浅色/100%/日常 smoke | 17:40:01.477 | `13B9EF...C374B` |
| format-760x520-smoke.png | 744×481 | 浅色/100%/格式 smoke | 17:40:03.007 | `505D9E...6DD37` |
| organizer-1080x640-dark-results.png | 1064×601 | 深色/100%/结果 | 17:39:31.763 | `34292C...D5D7E2` |
| organizer-1080x640-light-results.png | 1064×601 | 浅色/100%/结果 | 17:39:29.265 | `C906C4...AB54` |
| organizer-125pct.png | 595×385 | 浅色/125%/结果 | 17:39:49.293 | `4F7A25...C650` |
| organizer-150pct.png | 496×321 | 浅色/150%/结果 | 17:39:50.155 | `13535A...BCE6C` |
| organizer-760x520-dark-results.png | 744×481 | 深色/100%/结果 | 17:39:26.387 | `A6E4C2...AFF3E` |
| organizer-760x520-light-results.png | 744×481 | 浅色/100%/结果 | 17:39:03.307 | `5871E0...A1CF3` |
| organizer-760x520-transfer-complete-top.png | 744×481 | 浅色/100%/完成顶部 | 17:43:11.531 | `06E57E...19509` |
| organizer-760x520-transfer-complete-undo-control.png | 744×481 | 浅色/100%/同一完成态撤销入口 | 17:43:11.610 | `7D7193...ECAF5` |
| organizer-760x520-transfer-ready.png | 744×481 | 浅色/100%/转移就绪 | 17:39:03.938 | `42B95F...9D26E` |
| organizer-760x520-undo-feedback.png | 744×481 | 浅色/100%/消息中心撤销成功 | 17:43:46.653 | `668748...5E823` |
| organizer-760x520-undo-restored.png | 744×481 | 浅色/100%/来源恢复 | 17:43:58.737 | `66A007...144F` |
| organizer-maximized-dark.png | 1920×1009 | 深色/100%/最大化 | 17:39:46.421 | `07D913...BC155` |
| organizer-maximized-light.png | 1920×1009 | 浅色/100%/最大化 | 17:39:43.880 | `E851F1...57B90` |
| settings-760x520-about-smoke.png | 744×481 | 浅色/100%/设置关于 | 17:40:04.813 | `3E0BD8...E728` |

### 新证据包与安全边界

- 纠正目录：`C:/Users/EDY/AppData/Local/Temp/OpenFlow-QA-UI-P3/20260824-160730/correction-20260824-172421`。
- 视觉副本：`screenshots/visual-correction-20260824-172421/`，16 个 PNG，与 `final-corrected/` 哈希一致。
- 新包：`final-corrected.zip`，SHA-256 `873E82DB5AA7A8E92E7226A0B594C3B199FA9F0D0B8FB43A69F7BB9B87B8FE7A`，16 个文件，唯一根 `final-corrected/`，异常路径、绝对路径、`..`、配置、素材和用户数据均为 0。
- 原 `final.zip` 保留，SHA-256 仍为 `E9AFBA6D453E919C0F93A294F2E78CEE94B9936BC2A4A1490044ABD63686DA4B`。
- 真实配置 `C:/Users/EDY/AppData/Roaming/openflow-studio/openflow-config.json` 复核 SHA-256 仍为 `EA43CAF1D0D08625FED535E421708A1DC10A52B1D9971D742162ECFAF3F8AD41`，LastWriteTime 仍为 `2026-08-21 17:07:22`。

### 纠正结论

P3-VIS-001、P3-EVD-002 和 P3-EVD-003 均已修复或以连续真实证据闭环。纠正复验为 PASS：0 FAIL / 0 BLOCKED，适合重新提交上级人工视觉门禁；上级确认前仍不可进入 UI-P4。
