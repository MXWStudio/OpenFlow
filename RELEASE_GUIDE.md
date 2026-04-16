# OpenFlow Studio 版本发布规范指南

为了保持项目发布的专业性与一致性，我们在发版时遵循以下规范。

## 1. 语义化版本控制 (Semantic Versioning)
版本号统一格式为 `主版本号.次版本号.修订号` (例如 `2.3.1`)。

*   **主版本号 (Major，如 `3.0.0`)**：做了不兼容的重大修改、UI 彻底重构等核心大动作。
*   **次版本号 (Minor，如 `2.3.0`)**：增加了一些新的功能和特性，但向下兼容。
*   **修订号 (Patch，如 `2.2.1`)**：仅仅修复了 Bug，或者做了一些微小的体验优化，没有加新功能。

## 2. 标签与版本前缀
在 GitHub 上创建新的 Tag 或 Release 时，**必须使用 `v` 前缀**（例如：`v2.1.0`）。这有助于与纯数字的构建版本或分支区分开来。
`package.json` 中的 `version` 字段**不需要**加 `v`（例如：`2.1.0`）。

## 3. 自动化更新日志 (Release Notes)
我们已经配置了 `.github/release.yml`，这能让 GitHub 在创建 Release 时，点击 **"Generate release notes"** 按钮后自动将合并的 Pull Requests 按照分类整理好。

### 如何分类？
自动分类依赖于 PR 或 Commit 上的 **Labels (标签)**。在合并 PR 前，请确保为其添加了正确的标签：
*   **✨ 核心新特性**：使用 `enhancement` 或 `feature` 标签。
*   **🎨 交互与体验优化**：使用 `ui`, `ux`, 或 `design` 标签。
*   **⚡ 性能与架构优化**：使用 `performance`, `refactor`, 或 `architecture` 标签。
*   **🐛 稳定性与修复**：使用 `bug` 或 `fix` 标签。
*   **🔧 维护与依赖**：使用 `dependencies`, `chore`, 或 `docs` 标签。

### 过滤规则
如果不想让某些内部测试的 PR 出现在更新日志中，可以打上 `ignore-for-release` 标签。

## 4. 发版流程简述
1. 确认本次发版的版本号类型（Major, Minor, 或 Patch）。
2. 更新 `package.json` 中的 `version` 字段。
3. 提交代码并推送到 GitHub。
4. 在 GitHub 网页端创建一个新的 Release。
5. Tag 填写为 `v` + 版本号（如 `v2.1.0`）。
6. 点击 "Generate release notes" 自动生成日志，您可以再手动调整文字描述，使其更人性化。
7. 附加软件的截图说明（如有必要）。
8. 点击 Publish release 发布！
