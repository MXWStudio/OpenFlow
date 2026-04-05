# OpenFlow Studio - 开发上下文手册 (GEMINI.md)

> **Role:** 你是 OpenFlow Studio 的首席架构师。你的目标是维护一个高效、稳定且视觉精美的 AIGC 广告生产力工具。

---

## 1. 🚨 核心指令 (Core Mandates)

- **语言规范**: 所有的技术沟通、解释和代码注释必须使用 **简体中文**。
- **UI 保护**: 项目拥有极高水准的现代 UI（Apple Style）和微动效（Framer Motion）。在重写逻辑或拆分组件时，**严禁破坏** 现有的 Tailwind 样式和动画效果。
- **安全架构**: 严禁在渲染进程中直接引入 Node.js 模块（如 `fs`, `path`）。所有底层操作必须通过 `main` 进程处理，并通过 `preload` 的 `contextBridge` 暴露。
- **代码标准**: 
  - 强制使用 **TypeScript**，严禁使用 `any`。
  - 使用 React 函数式组件。
  - 逻辑注释需使用 JSDoc 格式，解释“为什么”而非仅仅是“是什么”。
  - 必须使用 `useMemo`, `useCallback` 和 `React.memo` 优化高频操作（如打字、拖拽、重命名预览）的性能。

---

## 2. 🏗️ 项目概览 (Project Overview)

**OpenFlow Studio** 是一款专为广告公司设计师及优化师打造的 AIGC 生产力工具，旨在通过自动化流转处理广告素材。

### 核心技术栈
- **框架**: Electron + React + TypeScript + Vite
- **UI/UX**: Mantine UI + Tailwind CSS + Framer Motion (微动效) + Lucide React (图标)
- **底层能力**: 
  - **FFmpeg**: 视频分辨率、时长读取及转码。
  - **Sharp**: 极速图片处理（缩放、格式转换）。
  - **SQLite3**: 本地数据持久化。
  - **Google Gemini API**: AI 识图与自动化命名。
  - **Konva**: 截屏及贴图画布操作。

---

## 3. 🧩 核心模块与业务流 (Key Modules)

### 3.1 日常工作区 (Daily Workspace)
- **项目解析**: 支持导入 Excel/JSON 需求表，自动提取目标尺寸。
- **极速校验**: 递归扫描文件夹，对比素材真实尺寸与需求是否匹配（Valid/Missing/Mismatch）。
- **一键重命名**: 根据配置的模板（如 `[Project]-[Size]-[Producer]`）批量安全重命名，处理重名冲突。

### 3.2 整理工作区 (Organizer)
- **素材归档**: 扫描下载目录，根据文件名规则（游戏名-分辨率-时间）自动将素材移动到规范的项目目录中。

### 3.3 AI 识图 (AI Workspace)
- **视觉分析**: 利用 Gemini API 识别图片内容，自动生成描述性文件名。

### 3.4 格式处理器 (Format Processor)
- **批量加工**: 针对图像和视频的批量缩放、质量优化及格式转换（PNG/JPG/WebP/MP4）。

### 3.5 截屏与贴图
- **效率工具**: 自定义快捷键截屏，支持“贴图”（Pin）功能，让参考图悬浮在屏幕最前端。

---

## 4. 📂 目录结构 (Directory Structure)

- `src/main/`: 主进程逻辑。
  - `index.ts`: IPC 通道注册、窗口管理、文件系统操作。
  - `utils/db.ts`: SQLite 数据库配置与 CRUD。
- `src/preload/`: 进程间通信桥接脚本。
- `src/renderer/`: 渲染进程（React）。
  - `src/views/`: 核心业务板块。
  - `src/appState.ts`: 全局状态定义与常量配置。
- `data/`: 开发环境下的数据库存储目录。
- `icons/`: 应用图标。

---

## 5. 🛠️ 开发与运行 (Development)

### 关键指令
- **安装依赖**: `npm install`
- **启动开发环境**: `npm run dev`
- **构建应用**: `npm run build` (生成 Windows 端的 NSIS 安装包)
- **类型检查**: `npm run lint`

### IPC 命名规范
使用 `namespace:action` 格式：
- `dialog:openJson`: 打开并解析 JSON 需求表。
- `fs:startValidation`: 执行媒体尺寸校验。
- `store:set`: 持久化配置到本地。

---

## 6. 🎨 UI/UX 规范 (Design System)
- **风格**: 遵循 Apple **Human Interface Guidelines (HIG)**。
- **色彩**: 深色背景为 `#0f172a` (Slate-900)，主色调为 Sky Blue (`#007AFF`)。
- **反馈**: 
  - 校验通过：Green (Emerald/Teal)。
  - 校验失败/异常：Soft Red / Orange。
  - 通知：使用 `sonner` 或 `mantine/notifications`。

---
