# OpenFlow UI Foundation

## 定位与边界

OpenFlow 的视觉基础面向 Windows 生产力工具，采用紧凑、清楚、克制的 Fluent 2 / PowerToys 风格。品牌蓝只承担主操作、选中与焦点含义；普通层级使用中性背景和 1px 描边。

UI-P0 只定义 Theme、Token、App Shell、一级页面标题和通用控件基础。日常处理、素材整理、格式处理、设置中心的业务布局和事件逻辑不在本阶段重构。

当前 BrowserWindow 最小尺寸继续使用基线的 1080×640。产品目标 760×520 将在 UI-P1 完成设置导航响应式后独立实施，不能通过修改本文件或 Renderer 样式间接替代主进程窗口约束。

## Token

设计变量的 TypeScript 单一来源是 `src/renderer/src/theme.ts` 中的 `openFlowTokens`；浏览器可用变量在 `src/renderer/src/index.css` 中保持同值映射。

### 间距

所有间距基于 4px 网格：

| Token | 值 | 用途 |
| --- | ---: | --- |
| space-1 | 4px | 图标内部、极小间距 |
| space-2 | 8px | 紧凑元素 |
| space-3 | 12px | 表单与按钮组 |
| space-4 | 16px | 卡片内边距、模块间距 |
| space-6 | 24px | 页面主要区块 |
| space-8 | 32px | 大区块 |

### 文字

| 层级 | 字号 / 行高 / 字重 |
| --- | --- |
| 页面标题 | 20px / 28px / 600 |
| 分区标题 | 16px / 24px / 600 |
| 正文 | 14px / 20px / 400 |
| 控件文字 | 14px / 20px / 600 |
| 辅助文字 | 12px / 18px / 400 |

默认字体优先使用 Segoe UI Variable，并为中文回退到 Microsoft YaHei UI。新代码不应在同一层级引入 700 以上的多档字重。

### 圆角与尺寸

| Token | 值 | 用途 |
| --- | ---: | --- |
| radius-small | 6px | 小控件、按钮、输入 |
| radius-control | 8px | 选中区、图标容器 |
| radius-card | 8px | 普通卡片 |
| radius-dropzone | 12px | 大型拖入区 |
| control-height | 32px | 普通控件 |
| primary-height | 36px | 主要操作 |

999px 仅用于状态胶囊、徽标和明确的圆形控件。

### 色彩与层级

- `openFlowBlue` 是 Mantine 注册的 10 级品牌色板。
- Canvas、Surface、Subtle Surface、Border、Strong Border、Text 和 Muted Text 均有浅色与深色语义值。
- 成功、警告、失败分别使用统一绿、橙、红；不使用无业务含义的彩色装饰。
- 普通 Card/Paper 默认无阴影，通过中性 1px 描边建立层级。
- 只有浮动操作栏、弹窗和悬浮层使用 `shadow-floating`。

## App Shell

- 左侧主导航固定 68px，不改变页面路由或选中逻辑。
- 一级导航按钮为 52×56px，图标 20px，标签 12px 且禁止换行。
- 当前项使用完整的品牌蓝浅底、同色文字和细描边，不再使用多色装饰条。
- 导航主体可独立纵向滚动；通知与设置入口保持在底部，不覆盖内容区。
- 头像、导航和工具区均为独立收缩单元，为后续 760×520 响应式保留压缩空间。

## 一级页面标题

所有一级页面使用 `PageHeader`：

- 高度 76px，水平页边距 24px；
- 20px / 28px / 600 的唯一一级标题；
- 32px 中性图标容器；
- 12px / 18px 辅助说明；
- 可选操作区固定在标题右侧，并保持现有事件处理。

新增一级页面应复用 `src/renderer/src/components/PageHeader.tsx`，不要为单个页面复制标题样式。

## 控件与可访问性

- Button、ActionIcon、Badge、Card、Paper、Modal 和输入类组件使用 Mantine Theme 默认规范。
- 普通 Button/Input 最小高度 32px，主要大按钮最小高度 36px。
- disabled 通过透明度和禁用交互共同区分，不能只依赖颜色。
- 所有键盘可达元素必须保留 2px 品牌蓝 `focus-visible` 外框。
- 主导航使用原生 `button`、`aria-label` 和当前项 `aria-current="page"`；Tab 可聚焦，Enter/Space 使用浏览器原生按钮行为。

## 开发规则

- 优先使用 Theme、Token、语义类名和复用组件。
- 不为单页新增独立色彩、间距、圆角或阴影体系。
- 不新增无必要的 `style={{...}}`、`styles={{...}}`、`!important` 或逐控件媒体查询。
- UI-P0 不允许修改 IPC、业务状态、文件处理、持久化结构、Sharp/FFmpeg 参数或 BrowserWindow 尺寸。
