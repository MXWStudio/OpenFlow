# 自动更新首次配置

这套线路只需要配置一次。以后创建新的 GitHub 版本时，会先把文件放到腾讯云，GitHub 版本公开后再把腾讯云“最新版”指向新版本；中途任何检查失败，现有用户仍会留在旧版本。

## 1. 准备腾讯云 COS

1. 选定一个 COS 存储桶和地域。
2. 给下载地址配置 HTTPS，并允许用户直接读取 `openflow/` 目录下的发布文件。
3. 创建一组只允许向该存储桶 `openflow/` 目录上传、分块上传和检查文件的腾讯云凭证，不要使用账号的永久全权限凭证。用户下载和发布后的回读校验走公开 HTTPS 地址，专用子账号不需要删除文件、列出全部文件或下载文件的权限。
4. 如果使用 CDN，自定义下载根地址应指向同一个 COS 内容源。

## 2. 生成发布签名

在可信电脑的仓库根目录运行：

```powershell
npm run release:generate-keys
```

命令会在被 Git 忽略的 `.openflow-private` 目录生成两个文件：

- `openflow-release-private.pem`：只能放入 GitHub 的机密配置，不得提交、分享或放进安装包。
- `openflow-release-public-spki.txt`：放入 GitHub 的普通配置，会随安装包分发，用于识别可信发布。

## 3. 配置 GitHub

在仓库的 Actions 配置中增加以下普通配置：

- `TENCENT_COS_BUCKET`：完整存储桶名称。
- `TENCENT_COS_REGION`：存储桶地域。
- `OPENFLOW_COS_PUBLIC_BASE_URL`：用户实际下载文件的 HTTPS 根地址，末尾不需要 `/`。
- `OPENFLOW_COS_PREFIX`：建议填写 `openflow`。
- `OPENFLOW_UPDATE_CHANNEL_URL`：填写 `<下载根地址>/<目录>/stable/release.json`。
- `OPENFLOW_UPDATE_PUBLIC_KEY`：粘贴公钥文本文件的整行内容。
- `OPENFLOW_SENTRY_DSN`：OpenFlow 专用 Sentry 项目的客户端 DSN。DSN 会进入安装包，只能使用项目提供的公开客户端 DSN，不能填 Auth Token。
- `OPENFLOW_DIAGNOSTICS_UPLOAD_INTERVAL_MINUTES`：收集后批量回传的时间间隔，允许 5–1440 分钟，建议使用默认值 `30`。
- `SENTRY_ORG`：Sentry 组织标识，用于构建时上传 Source Map。
- `SENTRY_PROJECT`：OpenFlow 的 Sentry 项目标识，用于构建时上传 Source Map。

再增加以下机密配置：

- `TENCENT_COS_SECRET_ID`
- `TENCENT_COS_SECRET_KEY`
- `TENCENT_COS_SESSION_TOKEN`：仅使用临时凭证时填写。
- `OPENFLOW_RELEASE_PRIVATE_KEY`：粘贴私钥 PEM 的完整内容。
- `SENTRY_AUTH_TOKEN`：仅供 GitHub Actions 上传 Source Map，授予对应组织/项目所需的最小权限；不会写入安装包。

## 4. 发布顺序

1. 按现有规则提升桌面版本号；如扩展有变化，同时提升 `extensions/chrome/manifest.json` 中的扩展版本。
2. 运行测试、类型检查和本地构建。
3. 创建并推送与桌面版本完全一致的标签。
4. GitHub 自动完成：构建 → 核对文件 → 暂存到 COS → 创建并核对 GitHub Release → 公开 Release → 切换 COS 最新版。

如果 GitHub Release 已公开但最后一次腾讯云切换因临时网络问题失败，可在 Actions 手动运行“Repair Tencent COS Stable Channel”，填写已经公开的版本标签。该入口只会重新切换腾讯云最新版，不会重建或覆盖 GitHub Release。

软件启动约 30 秒后会首次检查，以后每 4 小时检查一次；用户也可在“设置中心 → 关于”中手动检查。下载完成后，用户可以立即重启安装，也可以退出软件时自动安装。

桌面程序安装完成并重新启动后，会把随安装包附带的扩展放入固定目录。Chrome 扩展确认当前没有执行提取任务后，自行重载并只刷新它实际使用过的网页；确认失败时，桌面程序恢复上一个扩展版本。

## 5. COS SDK 发布保护

每次 GitHub 发布会自动完成以下检查，不需要人工逐个核对：

1. 大文件采用不需要列出存储桶任务的直接分块上传，单个分块临时失败会自动重试；整个上传或检查请求遇到短暂网络故障也会再次尝试。
2. 上传时检查传输内容，并记录本地算出的 SHA-256；上传后再核对 COS 中的文件大小、SHA-256、文件类型和缓存规则。
3. 从用户实际使用的公开 HTTPS 地址重新下载并流式计算 SHA-256。安装包再大也不会一次性全部读入内存。
4. 同一版本重复执行时，内容完全一致会直接核验通过；如果同一版本号下的文件不同，会拒绝覆盖，避免已经发布的版本被悄悄替换。
5. `stable/release.json` 只有在 GitHub Release 已公开、版本目录中的签名文件也通过公开下载校验后才会切换。切换失败可安全重跑修复工作流。

默认参数已经适合当前线路。网络环境特殊时，可在 GitHub 的普通配置中按需增加：

- `OPENFLOW_COS_CHUNK_SIZE_MB`：每个分块大小，默认 8。
- `OPENFLOW_COS_CHUNK_PARALLEL`：同一文件同时上传的分块数，默认 3。
- `OPENFLOW_COS_CHUNK_RETRIES`：单个分块失败后的重试次数，默认 4。
- `OPENFLOW_COS_OPERATION_ATTEMPTS`：完整上传或校验请求最多尝试次数，默认 3。
- `OPENFLOW_COS_REQUEST_TIMEOUT_MS`：单次请求超时时间，默认 120000 毫秒。
- `OPENFLOW_COS_FULL_READBACK`：是否把全部发布文件从公开地址重新下载核验，默认开启。只有明确接受较弱校验时才关闭。
- `OPENFLOW_COS_USE_ACCELERATE`：是否使用腾讯云全球加速，默认关闭；仅在存储桶已开通该能力后开启。

GitHub 配置完成后，可在 Actions 手动运行“Verify Tencent COS Configuration”。它只会覆盖 `openflow/verification/configuration.json` 这一份小文件，用来确认上传密钥、最小权限、文件信息和公开下载回读是否同时可用；不会创建版本、切换最新版或触发客户端更新。

## 6. 自动诊断回传

桌面端和 Chrome 扩展会自动记录以下事件：

- 抓取匹配数、成功数、失败数不闭合；
- 详情校验失败、重复任务 ID 和抓取异常；
- 桌面界面未处理异常、渲染进程退出；
- 桌面端或扩展自动更新失败及回滚。

扩展先把事件保存到自己的本地队列，再通过带随机令牌的 `127.0.0.1` 桥接交给桌面端。桌面端将脱敏事件原子写入用户数据目录的 `diagnostics/pending`，默认每 30 分钟批量发送到 Sentry。桌面程序或 Sentry 暂时不可用时不会影响抓取和更新，队列会保留并按退避时间自动重试。单机最多保留 500 条，扩展侧最多保留 100 条。

自动事件不包含完整网页、素材、浏览器资料、Cookie、更新桥接令牌、账号密码或完整本地路径。网址只保留来源站点，邮箱、本地路径和敏感字段会在写入前脱敏；单条事件与单批请求都有大小上限。

Electron 主进程、渲染进程未处理异常、无响应和原生崩溃由 Sentry SDK 自动捕获，并使用 SDK 自带离线缓存。扩展抓取遗漏、更新失败和恢复状态仍经过 OpenFlow 的定时队列，只有警告、错误及恢复事件进入 Sentry；正常成功摘要仅留在本地，避免产生噪声。

所有事件关闭用户信息、请求内容、Cookie、Breadcrumb、截图、性能追踪、栈变量和源码上下文。生产构建生成隐藏 Source Map，上传成功后会在打包前从本地构建输出删除；安装包中不会包含 `.map` 文件或 `SENTRY_AUTH_TOKEN`。

未配置 `OPENFLOW_SENTRY_DSN` 时，自动收集仍然生效，但状态显示为“本机留存”，不会声称已经发送。配置 OpenFlow 专用 DSN 并发布新安装包后，已有本地队列会自动补传。开发人员在 Sentry 的 Issues 中按 `diagnostic_type`、`desktop_version`、`extension_version` 查看和筛选问题。
