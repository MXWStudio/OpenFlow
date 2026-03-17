---
name: install-pua-rules
description: Install or update the pua.mdc rule file under .cursor/rules for Cursor by creating the rules directory and downloading the latest version from the official GitHub repository. Use when the user wants to enable or refresh the PUA anti-manipulation rules in this project.
---

# 安装 / 更新 PUA 规则（pua.mdc）

## 使用场景

当用户提到以下需求时使用本 Skill：
- 安装或启用 PUA 相关的 Cursor 规则
- 更新 `pua.mdc` 到最新版本
- 修复或重新拉取 `.cursor/rules/pua.mdc`

该 Skill 只作用于当前仓库（项目级规则），不会影响其他项目。

## 安装 / 更新步骤

在当前项目根目录（包含 `.cursor` 的目录）下执行以下流程：

1. **确保存在 `.cursor/rules` 目录**
   - 如果目录不存在，创建它：
   ```bash
   mkdir -p .cursor/rules
   ```

2. **从官方仓库下载或更新 `pua.mdc`**
   - 使用 `curl` 将远程文件保存到 `.cursor/rules/pua.mdc`：
   ```bash
   curl -o .cursor/rules/pua.mdc \
     https://raw.githubusercontent.com/tanweai/pua/main/cursor/rules/pua.mdc
   ```

3. **下载失败时的处理建议**
   - 如果 `curl` 不可用或网络失败：
     - 打开浏览器访问：
       - `https://raw.githubusercontent.com/tanweai/pua/main/cursor/rules/pua.mdc`
     - 将页面内容完整复制，保存为：
       - 文件路径：`.cursor/rules/pua.mdc`

4. **确认文件已就绪**
   - 确认以下文件存在且非空：
     - `.cursor/rules/pua.mdc`

## 作为代理时的具体行为（给 AI 看的指令）

当用户在对话中请求安装或更新 PUA 规则时，按以下顺序操作：

1. **在项目根目录执行命令**
   - 使用 Shell 工具（或等效能力）依次执行：
   ```bash
   mkdir -p .cursor/rules
   curl -o .cursor/rules/pua.mdc https://raw.githubusercontent.com/tanweai/pua/main/cursor/rules/pua.mdc
   ```

2. **若命令执行失败**
   - 向用户简要说明失败原因（例如：网络问题、`curl` 不存在）
   - 提供手动安装指引（参考上文第 3 步）

3. **安装完成后**
   - 告知用户已在当前项目启用/更新 `.cursor/rules/pua.mdc`
   - 不需要展示完整文件内容，只需说明路径和状态。

## 使用示例（用户如何触发）

示例输入（不限于以下语句，只要语义相近即可触发本 Skill）：

- “帮我在这个项目里安装 PUA 规则”
- “更新一下 tanweai/pua 的 Cursor 规则”
- “重新下载 `.cursor/rules/pua.mdc`”
- “启用 PUA 反洗脑规则”

对于上述请求，按照本 Skill 的“安装 / 更新步骤”为主流程执行。

