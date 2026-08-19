# OpenFlow Studio

OpenFlow 是一套面向素材生产流程的 Windows 桌面工具，仓库同时维护配套的 Chrome 扩展。

## 工作流

1. Chrome 扩展从当前工单页面提取项目、尺寸和数量要求。
2. 扩展导出 `openflow.requirements.v1` JSON 文件。
3. OpenFlow Studio 导入 JSON，创建项目目录、校验素材并按规则重命名。

扩展与桌面端共享同一份 JSON 契约，但职责保持分离：扩展只读取用户主动打开的当前页面，桌面端负责本地文件操作。

## 目录

- `src/`：Electron 桌面端源码
- `extensions/chrome/`：可直接加载的 Chrome Manifest V3 扩展
- `scripts/check-chrome-extension.mjs`：扩展清单、权限、资源和脚本检查
- `docs/`：架构说明和决策记录

## 本地运行

要求 Node.js 22 或更高版本。

```powershell
npm install
npm test
npm run lint
npm run dev
```

## 加载 Chrome 扩展

1. 打开 `chrome://extensions/`。
2. 开启“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 开发时选择本仓库的 `extensions/chrome` 目录；正式安装后，在桌面程序“设置中心 → 关于”中打开扩展文件夹并选择它。

扩展的详细权限和使用说明见 [`extensions/chrome/README.md`](extensions/chrome/README.md)。

## 验证与构建

```powershell
npm run check:extension
npm test
npm run lint
npx electron-vite build
```

`npm run build` 会生成 Windows 安装包、扩展压缩包和逐文件完整性清单。正式安装后，桌面程序会把配套扩展同步到固定的用户目录；用户第一次仍需在 Chrome 手动“加载已解压的扩展程序”，以后版本由桌面程序准备，扩展在空闲时自行重载。

腾讯云 COS 与 GitHub 发布线路的首次配置见 [`docs/auto-update-setup.md`](docs/auto-update-setup.md)。

桌面端和扩展会自动把抓取数量不闭合、运行异常与更新失败写入脱敏的本地诊断队列，并按发布配置的时间间隔批量发送到 OpenFlow 的 Sentry 项目；未配置 DSN 或网络暂时不可用时只在本机保留并自动重试，不影响正常工作。Sentry 与隐私配置见 [`docs/auto-update-setup.md`](docs/auto-update-setup.md#6-自动诊断回传)。

## 单仓库维护

Electron 桌面端和 Chrome 扩展均在本仓库维护，`extensions/chrome` 是扩展的唯一源码入口。扩展不是 Git 子模块，也不依赖其他源码仓库；已废弃的第一代 Python 桌面端原型不属于当前产品，也不随主工程构建。
