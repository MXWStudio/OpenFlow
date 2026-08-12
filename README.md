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
4. 选择本仓库的 `extensions/chrome` 目录。

扩展的详细权限和使用说明见 [`extensions/chrome/README.md`](extensions/chrome/README.md)。

## 验证与构建

```powershell
npm run check:extension
npm test
npm run lint
npx electron-vite build
```

`npm run build` 会生成 Windows 安装包，并把扩展复制到安装目录的 `resources/chrome-extension`，便于作为“已解压扩展”加载。安装包不会自动修改 Chrome，也不会自动启用扩展。

## 单仓库维护

Electron 桌面端和 Chrome 扩展均在本仓库维护，`extensions/chrome` 是扩展的唯一源码入口。扩展不是 Git 子模块，也不依赖其他源码仓库；已废弃的第一代 Python 桌面端原型不属于当前产品，也不随主工程构建。
