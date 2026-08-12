# OpenFlow Chrome 扩展

这是 OpenFlow Studio 配套的 Chrome Manifest V3 扩展。Electron 桌面端和扩展在同一个 OpenFlow 仓库中维护，本目录是扩展的唯一源码入口。

## 功能边界

- 在用户主动点击扩展时读取当前标签页。
- 按用户指定的截止日期，从当前已加载的工单列表提取项目名称、任务状态、制作信息、素材尺寸和所需数量。
- 导出 Excel 报表或 `openflow.requirements.v1` JSON。
- JSON 可由 OpenFlow Studio 直接导入，用于建目录、素材校验和重命名。

扩展不直接修改本地素材，也不与桌面端建立后台常驻连接。当前联动方式是导出 JSON 后由桌面端导入。

## 权限

- `activeTab`：只访问用户当前主动使用的标签页。
- `scripting`：按需注入 `content.js` 完成页面提取。
- `downloads`：保存 JSON 和 Excel 文件。
- `storage`：保存扩展设置和最近一次提取结果。

扩展没有声明 `host_permissions`，也没有后台 Service Worker。

## 本地加载

1. 打开 `chrome://extensions/`。
2. 开启“开发者模式”。
3. 选择“加载已解压的扩展程序”。
4. 选择本目录 `extensions/chrome`。

修改源码后，在扩展管理页面点击“重新加载”。

## 按截止日期抓取

1. 在品创工作台打开目标时间范围；扩展会自动向下加载当前筛选范围内的任务卡片。
2. 打开扩展，选择目标截止日期。
3. 点击“按截止日期提取任务”。任务状态可以是未开始、交付中或完成。
4. 核对预览数量后导出 JSON，并在 OpenFlow Studio 中导入。

## 验证

在仓库根目录运行：

```powershell
npm run check:extension
npm test
```

前者检查 Manifest、最小权限、资源引用和 JavaScript 语法；后者还会用桌面端解析器读取扩展契约样例，防止两端格式漂移。

## 产品边界

已废弃的第一代 PySide6 桌面端原型已经被当前 Electron 桌面端取代，不属于当前产品。扩展不是 Git 子模块，也不依赖其他源码仓库。

## 第三方组件

扩展内置的 Excel 导出库及许可信息见 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)。打包脚本会把这些声明随扩展一起放入桌面端资源目录。
