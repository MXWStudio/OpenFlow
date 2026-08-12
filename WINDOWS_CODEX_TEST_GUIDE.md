# OpenFlow Windows Codex 测试指南

此压缩包是 2026-07-14 的源码测试快照，包含当前工作区中的自定义重命名实现、73 项测试、Shape Up 归档和架构决策；不包含 macOS 的 `node_modules`、构建产物或 Git 历史。

## 推荐环境

- Windows 10/11 x64
- Node.js 22 LTS 或更高版本
- 可访问 npm registry 的网络
- 建议解压到较短且无特殊字符的目录，例如 `C:\Work\OpenFlow`

## 安装与启动

在 PowerShell 或 Windows Codex 终端中执行：

```powershell
Set-Location C:\Work\OpenFlow
node --version
npm --version
npm ci
npm test
npm run lint
npm run dev
```

预期结果：

- `npm test` 显示 73 项通过、0 失败。
- `npm run lint` 无 TypeScript 错误。
- `npm run dev` 打开 OpenFlow Studio 桌面窗口。

## Windows 重点验收

1. 打开“设置 > 命名模板”，确认系统模板和自定义模板有明确分组、颜色和文字标签。
2. 新建或复制一个自定义模板，修改模板名称，并分别编辑图片、视频规则。
3. 输入自定义文本，离开设置页，再返回确认保存；重启应用后再次确认模板存在。
4. 在日常页选择“自定义”，选择刚才的具名模板并检查真实预览。
5. 用 JPG/PNG 与 MP4/MOV 各测试一次，确认自定义文本进入文件名且原扩展名保留。
6. 测试固定文本且无“序号”字段的模板；同名目标应得到 `-2` 等有限后缀，不得卡死或覆盖。
7. 测试 `CON`、`NUL`、尾点名称和超长名称；应在改动源文件前明确阻断。
8. 模拟文件占用失败，确认成功项保留、失败项可通过“仅重试失败项”再次执行。
9. 确认主要操作按钮不位于应用右上角，避免被系统通知遮挡。

## 构建 Windows 安装包

在上述检查通过后执行：

```powershell
npm run build
```

安装包输出到 `build-dist`。这是未配置发布证书的测试构建，正式分发前仍需按团队发布流程完成签名与 Windows 实机验收。

## 验收记录

功能范围与已有验证记录位于：

- `.shapeup\2026-07-13-robust-custom-renaming-shipped\qa-evidence.md`
- `.shapeup\2026-07-13-robust-custom-renaming-shipped\build-summary.md`
- `docs\architecture.md`
