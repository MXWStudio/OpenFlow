# OpenFlow UI-P1 设置中心响应式设计

## 目标与边界

UI-P1 将设置中心从只适配宽屏的固定双栏，调整为可在 `760×520` 最小外窗下完整操作的响应式双栏。业务状态、事件处理、IPC、配置结构、六个设置入口和默认窗口尺寸保持不变。

本阶段只包含：

- 设置中心布局、导航、内容滚动和紧凑字段排列；
- 响应式样式的静态测试；
- BrowserWindow 最小尺寸由 `1080×640` 降为 `760×520`，默认尺寸计算仍以 `1080×640` 为下限；
- 设计与验收记录。

## 布局结构

`SettingsWorkspace` 使用以下稳定语义类：

- `.settings-workspace`：设置页面根容器，限制页面本身溢出；
- `.settings-body`：标题下方可收缩区域；
- `.settings-tabs`：双栏布局容器；
- `.settings-navigation`：六个设置入口的独立纵向导航；
- `.settings-navigation-item`：固定单列、不换行的设置入口；
- `.settings-content`：当前设置面板的独立滚动区；
- `.settings-field-row`：在极窄等效视口中允许字段纵向排列。

导航和内容都设置 `min-width: 0`、`min-height: 0`，避免 Flex 子项的最小内容宽度撑大页面。页面根、双栏容器和内容区均禁止横向溢出。

## 断点与双栏策略

设置中心始终保留双栏，不把 Tabs 改为顶部横向导航，也不隐藏入口。

| 有效 Renderer 宽度 | 导航宽度 | 内容策略 |
| --- | ---: | --- |
| `>1240px` | `196px` | 内容最大 `840px`，居中显示 |
| `<=1240px` | `180px` | 缩小水平留白 |
| `<=980px` | `156px` | 页面间距改用 12/16px 网格 |
| `<=720px` | `136px` | 进一步压缩导航和内容边距 |
| `<=560px` | `124px` | 字段行改为纵向排列 |

`max-height: 720px` 时，设置入口高度由 32px 压缩到 30px、组标题间距收紧；入口仍保持单列和可见焦点。

## 导航滚动

`.settings-navigation` 使用：

- `flex-direction: column`；
- `flex-wrap: nowrap`；
- `overflow-x: hidden`；
- `overflow-y: auto`；
- `scrollbar-gutter: stable`。

组标题和入口均为 `flex: 0 0 auto`，因此窗口高度不足或等效缩放达到 150% 时，最后一个“关于”入口通过导航自身滚动到达，不会换列或覆盖右侧标题。

## 内容宽度与滚动

`.settings-content` 独立纵向滚动，横向溢出隐藏；首层内容宽度为 `100%`，最大宽度 `840px` 并居中。设置导航滚动不会带动内容，内容长页面也不会改变左侧入口位置。

在 `760×520` 外窗、100% 缩放时，Renderer 客户区为 `744×481`；125% 和 150% Chromium 等效缩放的 CSS 视口分别为 `595×385` 与 `496×321`。三种情况下 `body.scrollWidth === body.clientWidth`。

## 可访问性规则

- `Tabs.List` 具有 `aria-label="设置分类"`；
- 保留 Mantine Tabs 原有键盘模型，Tab/Shift+Tab、方向键、Enter、Space 均可操作；
- 所有入口保持原有 DOM 顺序：常规、账户、工作区、命名模板、快捷键、关于；
- `focus-visible` 使用 2px 品牌蓝描边和 2px offset；
- 导航和内容滚动容器为焦点环保留空间，不通过裁切或绝对定位制造“通过”；
- 文本入口使用 `white-space: nowrap`，中文标签不异常折行。

## 窗口约束

BrowserWindow 最小尺寸为：

```text
minWidth: 760
minHeight: 520
```

默认窗口计算保持：

```text
width  >= 1080
height >= 640
```

因此 UI-P1 只开放经过验收的紧凑尺寸，不改变首次启动和常规桌面使用的默认窗口大小。
