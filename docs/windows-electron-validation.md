# Mac → Windows Electron 验证通道

本通道以 Mac 当前 Git 工作树为唯一源码来源。它会传输当前 `HEAD`、tracked 修改（含二进制 diff）和 untracked 文件；不要求先 commit 或 push。

## 固定边界

| 环境 | 应用名 | App ID | userData | 固定目录 | 更新通道 |
| --- | --- | --- | --- | --- | --- |
| Dev | OpenFlow Studio Dev | `com.openflow.studio.dev` | `openflow-studio-dev` | `D:\OpenFlow\Dev` | 禁用 |
| Candidate | OpenFlow Studio Candidate | `com.openflow.studio.candidate` | `openflow-studio-candidate` | `D:\OpenFlow\Candidate` | 禁用 |
| Stable | OpenFlow Studio | `com.openflow.studio` | `openflow-studio` | `D:\OpenFlow\Stable`（仅保留，未经批准不安装） | stable |

Windows 固定 SSH 别名为 `edy-main`，隔离验证根目录为 `D:\OpenFlow\Validation`。每批源码还原到唯一的 `runs\<批次>\source`，不会覆盖 Windows 现有工作树。

## Dev 验证与同步

在 Mac 仓库根目录执行：

```bash
npm run verify:windows:remote
```

Windows 依次执行 `npm ci`、typecheck、lint、单元测试、Electron E2E、生产构建。任一步失败立即停止。全部 PASS 后才生成 Dev unpacked 包，并通过 staging → 校验 → 原子交换更新 `D:\OpenFlow\Dev`；异常时恢复上一版。

成功安装后界面左下角显示 `DEV · MM-DD HH:mm:ss`。该批次标记在原子交换前写入 staging，因此失败不会推进。

## Candidate 构建与验收

在 Dev 通道通过后显式执行：

```bash
npm run verify:windows:candidate
```

Candidate 在 Windows 本机构建，并记录 commit、工作树快照 SHA-256、版本与 UTC 构建时间。自动验收覆盖全新安装、从隔离的 2.5.2 Candidate 覆盖升级、Electron 启动和主流程、本地数据读写、重启恢复、卸载、安装包与运行身份、更新通道隔离，以及已配置签名时的 Authenticode。

Candidate PASS 只表示“可发布候选”。它不会 commit、push、tag、创建 GitHub Release、上传更新服务器、修改正式更新通道或覆盖 Stable。真正发布必须再次获得用户对具体版本和目标的明确批准。

## 现场验收

自动验证后，由 Windows 登录用户完成：

1. 从 Chrome 扩展执行真实发送，确认 Dev/Candidate Electron 收到并完成主流程。
2. 关闭并重启应用，确认本地数据、设置和最近任务恢复。
3. 核对 Dev 批次或 Candidate 身份、版本、路径，确认未打开 Stable。
4. 候选验收结论单独记录为“可发布候选”，不得写成“已发布”。
