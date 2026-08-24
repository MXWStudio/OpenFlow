# OpenFlow UI-P2 格式处理页面验收报告

## 1. 结论

**PASS**。工程门禁、隔离视觉/交互、FORMAT 14 项真实文件回归和完整 25 项核心功能回归均为 0 FAIL / 0 BLOCKED。当前结果适合作为 UI-P3 的输入基线。

- 分支：`feature/ui-format-processor`
- BASE_SHA：`06ccd141515601f1ca5099a265d801bb64353532`
- Renderer 提交：`0f10a809572f5645dc17a91c2f814a8e5615e318`
- 禁止混合提交 `7b9f3c965d8b7c98936334b3982ab40d3b581ad4`：不是当前分支祖先
- 隔离证据根：`C:/Users/EDY/AppData/Local/Temp/OpenFlow-QA-UI-P2/20260824-123905`

## 2. 修改范围

Renderer 提交只包含：

- `src/renderer/src/views/FormatProcessor.tsx`
- `src/renderer/src/index.css`
- `src/renderer/src/formatProcessorResponsive.test.ts`

统计为 406 insertions / 74 deletions。新增 8 项页面契约测试。没有修改 `src/main/**`、`src/preload/**`、shared、其它页面业务布局、IPC、Sharp/FFmpeg、业务处理、BrowserWindow、依赖、`package.json` 或 `package-lock.json`。

## 3. 工程门禁

| 门禁 | 结果 | 证据摘要 |
| --- | --- | --- |
| `git diff --check` | PASS | 退出码 0；仅出现工作区 LF 将来可能转 CRLF 的 Git 提示 |
| `npm run lint` | PASS | 退出码 0 |
| `npm test` | PASS | release 27 + source 125 = 152 PASS，0 FAIL；基线为 144，本轮新增 8 |
| `npm run build` | PASS | 退出码 0；Renderer/Main/Preload、Windows NSIS 与扩展包均完成 |
| package lock | PASS | SHA-256 `E80235F04807173AE6F09F367AEFECFF7BD63726AFB117D39D4076FF2256F217`，未变化 |

测试编写过程中，新增 CSS 规则读取辅助函数最初错误匹配联合选择器，造成一次仅限新测试的中间失败；修正测试辅助函数后，定向 8/8 与完整 152/152 均通过，产品代码未为此调整。

已记录的非失败警告：Node `MODULE_TYPELESS_PACKAGE_JSON`、Vite CJS API deprecation、Node `DEP0190` shell 提示以及构建配置中的重复依赖引用。已知依赖漏洞未执行自动修复，依赖文件未变化。

## 4. 视觉与交互门禁

隔离应用使用最终 build、独立 `APPDATA`、`LOCALAPPDATA` 与 Electron `userData`。外窗和客户区实测：

| 场景 | 外窗/窗口边界 | Renderer 客户区 | 布局结果 |
| --- | --- | --- | --- |
| 紧凑 | 760×520 | 744×481 | 单列；body 744/744；唯一纵向滚动，横向零溢出；开始按钮正常滚动可达 |
| 默认 | 1080×640 | 1064×601 | 双栏；主区 612px、设置区 320px；无覆盖/溢出 |
| 最大化 | 1936×1048 边界 | 1920×1009 | 内容 1320px 居中；设置区仍为 320px |

使用 Electron `webContents.setZoomFactor` 进行可靠 Chromium 等效复核：

- 100%：760×520 外窗，viewport 744×481，body `scrollWidth === clientWidth`。
- 125%：viewport 595×385，布局宽 519/519，纵向滚动、无横向溢出。
- 150%：viewport 496×321，布局宽 420/420，纵向滚动、无横向溢出。

浅色、深色、空状态、drag-active、图片、视频、处理中、成功、失败、disabled 与 focus-visible 均可辨认。真实 Tab/Shift+Tab 焦点未被裁切；Enter 激活“日常”，Space 激活“整理”。真实 Electron `File` 拖放通过 CDP `Input.dispatchDragEvent` 完成 dragenter/dragover/drop，没有使用伪路径代替文件对象。

Renderer/主进程日志未出现新增未处理异常或 Promise rejection。日志中的 Sentry CSP/SDK 信息为基线信息；隔离 wrapper 访问其临时 app path 时出现扩展元数据 ENOENT，属于 QA 启动包装路径不含 `.openflow-build` 的隔离环境现象，与 UI-P2 源码和格式处理无关。

## 5. FORMAT-001～014

| ID | 操作与预期 | 实际与证据 | 结果 |
| --- | --- | --- | --- |
| FORMAT-001 | 拖入带空格和中文名 PNG | 真实拖入 `格式测试 长中文 01.png`；完整文件名、图片类型、待处理状态可见 | PASS |
| FORMAT-002 | 拖入短 MP4 | 真实拖入 1 秒 `短视频样本.mp4`，进入视频处理链 | PASS |
| FORMAT-003 | 图片队列拖入 MP4+TXT | 显示类型不匹配提示；队列保持原 1 张图片 | PASS |
| FORMAT-004 | 单独拖入 TXT | `不支持的测试文件.txt` 未进入队列 | PASS |
| FORMAT-005 | 图片/视频 50% 缩放 | 图片 640×360→320×180；短视频 320×240→160×120；8 秒视频 1280×720→640×360 | PASS |
| FORMAT-006 | 图片质量 60、视频质量 70 | 图片 4068 B→171 B；短视频 2292 B→2238 B；8 秒视频 114975 B→119889 B；均可解码 | PASS |
| FORMAT-007 | 保持原格式 | PNG 输出为 PNG；两段视频输出为 H.264 MP4 | PASS |
| FORMAT-008 | PNG 转 JPG | 输出 `格式测试 长中文 01.jpg`，628 B，JPEG 320×180，可解码 | PASS |
| FORMAT-009 | 动作文件夹名 | 输出进入 `format-input/openflow(50%_q60)处理/` | PASS |
| FORMAT-010 | 自定义导出目录 | PNG/JPG/MP4 均进入隔离 `format-output` | PASS |
| FORMAT-011 | 处理状态 | 实际观察待处理→处理中→完成/失败；处理中按钮禁用，结束恢复 | PASS |
| FORMAT-012 | 成功统计 | PNG、JPG、短视频、8 秒视频和动态目录输出均与成功状态一致 | PASS |
| FORMAT-013 | 原路径失效 | 真实拖入后临时改名；页面显示完整“本地文件不存在”失败，0 成功/1 失败，无伪输出；随后恢复输入 | PASS |
| FORMAT-014 | 原文件保护 | 输入数量、大小、SHA-256 均未变化；无覆盖、移动、删除、零字节或不完整文件 | PASS |

### 输入/输出核验

关键输入：

- PNG：4068 B，640×360，SHA-256 `F384F934DC062AFE3BC9461EABDBE9F3B1E7424A3CECF779ECC8371294CD904E`
- 短 MP4：2292 B，320×240，1.000 s，SHA-256 `A8601F98DFA5BC2F4C15BCB3CFDF527C442E206D008D40B5814954FD7CCEAA09`
- 处理状态 MP4：114975 B，H.264 1280×720，8.000 s，SHA-256 `E3A573F48862CA980C4BA6BBF52609AE97E3A397EC7DE9C2E0E371CB3C091579`
- TXT：28 B，SHA-256 `8FE40E4D004E065EBEC62A8E701AC01E17CBBCF452DCD629D6694F153BF550C3`

关键输出：

- PNG：171 B，PNG 320×180，SHA-256 `B4B6E13AEC5736A0B384E5EF80A9B3FC2E7EF941DF942A3FCC395DCD7A1AF46A`
- JPG：628 B，JPEG 320×180，SHA-256 `276018DA8FC4C8D937990B75B8E66D45F3B86C47D8C9580E308F9AD90D13E6C0`
- 短 MP4：2238 B，H.264 160×120，1.000 s，SHA-256 `B5F167061D4316A02CF6ED780424A1C9A1C67E4331935A8F5CFFDA7863053D7F`
- 处理状态 MP4：119889 B，H.264 640×360，8.000 s，SHA-256 `F2AB392C7F3BA013E1ECEE488D07F4CE0CCCD8C12F8854432E613EA723B5D584`

Sharp 对所有图片执行 metadata 与完整 decode；项目自带 `ffprobe-static` 对视频执行 codec/宽高/时长解析。零字节文件 0；失败样本输出 0。

## 6. 完整 25 项核心功能回归

### DAILY：5/5 PASS

- DAILY-003：有效需求表导入 1 个项目与两种尺寸；隔离 `daily` 创建项目尺寸目录、固定目录和 `_Assets`。错误 JSON 显示可理解失败，并保留上一份有效需求。
- DAILY-005：实际加入 `multi-a`、`multi-b` 并重复加入 `multi-b`；页面仅保留两张目录卡。两个目录共 8 个文件，校验通过且 SHA-256 未变化。
- DAILY-007：常规、特殊、自定义三种命名模式及预览均切换成功，最终恢复常规。
- DAILY-008：隔离配置新增并读回 `UI-P2验收模板`，临时取消项不存在；重启后模板和最后选择仍保持。
- DAILY-009：需求尺寸正确；手动 `640×360` 进入品牌蓝选中态，随后恢复默认 `1080×1920`。

### ORG：3/3 PASS

- ORG-004：隔离空目录扫描返回空数组，不误报业务错误。
- ORG-007：2 张 JPG、1 个 MP4 被识别，TXT 未进入队列且留在来源目录。
- ORG-012：图片按分辨率、视频进奇觅目录；预置冲突文件未覆盖，新文件自动加日期后缀；撤销恢复 3 个源文件。最终来源 4 文件，目标只保留 1 个预置冲突样本。

### FORMAT：14/14 PASS

详见上一节。

### SETTINGS：3/3 PASS

- SETTINGS-005：隔离来源/目标路径保存并在重启后由设置页面读回；JPG/MP4 格式保持选中。
- SETTINGS-006：`UI-P2验收模板` 保存并重启读回；临时取消项不存在。
- SETTINGS-007：`CommandOrControl+Alt+F11` 注册成功，实际隐藏/恢复主窗口，重启后仍注册并读回。

合计：**25 PASS / 0 FAIL / 0 BLOCKED**。760×520 下四个一级页面均可进入，导航选中状态正确；设置中心六个入口和“关于”无覆盖；其它三个一级页面没有新增视觉回归。

## 7. 数据安全

- 真实配置 `C:/Users/EDY/AppData/Roaming/openflow-studio/openflow-config.json`：SHA-256 `EA43CAF1D0D08625FED535E421708A1DC10A52B1D9971D742162ECFAF3F8AD41`，时间戳仍为 `2026-08-21 17:07:22`。
- 所有素材写入仅发生在隔离证据根的 working copy、输出目录和动态输出目录。
- FORMAT 输入 SHA-256 不变；ORG 撤销后来源文件 SHA-256 恢复；DAILY 校验没有改写 8 个输入文件。
- 测试目录外没有执行素材移动、删除、重命名或配置写入。

## 8. 视觉证据

最终截图目录：`C:/Users/EDY/AppData/Local/Temp/OpenFlow-QA-UI-P2/20260824-123905/screenshots/final`

- `format-760x520-light-empty.png`
- `format-760x520-dark-empty.png`
- `format-760x520-image-loaded.png`
- `format-760x520-video-loaded.png`
- `format-760x520-processing.png`
- `format-760x520-success.png`
- `format-760x520-failure.png`
- `format-1080x640-light.png`
- `format-1080x640-dark.png`
- `format-maximized-light.png`
- `format-maximized-dark.png`
- `format-760x520-zoom125-light.png`
- `format-760x520-zoom150-light.png`
- `format-drag-active.png`
- `format-focus-visible.png`
- `daily-760x520-smoke.png`
- `organizer-760x520-smoke.png`
- `settings-760x520-about-smoke.png`

修改前证据位于相邻 `screenshots/pre-change`。布局测量、Console 和窗口控制日志位于 `logs/ui-p2-layout.jsonl`、`logs/ui-p2-console.log` 和 `logs/window-control-results.jsonl`。

## 9. 遗留与进入下一阶段判断

- FAIL：0
- BLOCKED：0
- 已知环境记录：Sentry CSP/SDK 基线消息和隔离 wrapper 扩展元数据路径 ENOENT；均未影响页面、格式处理或 25 项功能结果。
- 是否适合进入 UI-P3：**是**。
