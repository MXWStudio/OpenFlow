# Package: 夜间深色主题一致性

**Feature ID**: 003-dark-theme-alignment  
**Created**: 2026-06-02  
**Frame**: [frame.md](./frame.md)  
**Appetite**: Small Batch (1 session)  
**Status**: Shipped — archived 2026-06-03

---

## Problem

OpenFlow 的外观主题默认是“跟随系统”，但夜晚或系统深色模式下启动时，主工作区已经是深色，左侧全局 tab 栏仍像浅色侧栏；“素材自动整理”页面外层为深色，首屏状态卡又出现大面积浅色区域。用户一打开应用就看到主题割裂，容易觉得深色模式没有真正生效。

这个 package 的目标是让主窗口在 `auto` 外观下按真实系统状态渲染深色 UI，并让全局导航和整理页首屏主要 surface 使用同一套主题语义。它不是全应用重设计，也不展开到低频页面 polish。

## Requirements

- **R0**: 当外观主题为“跟随系统”且系统处于深色模式时，主窗口首屏必须按真实 dark 状态渲染，而不是把 `auto` 当作 light。
- **R1**: 左侧全局 tab 栏必须与主工作区的深色主题统一，包括侧栏背景、激活态、通知/设置入口状态。
- **R2**: “素材自动整理”页面首屏主要区域必须消除明显浅色残留，系统状态卡、快捷操作卡、待整理空状态和底部操作条应使用一致的主题 surface。
- **R3**: 主题修正不能改变日常/整理主流程功能、IPC、扫描、校验、重命名或整理逻辑。
- **R4**: 后续实现必须有可验证路径，覆盖 `auto -> dark`、固定 `dark`、固定 `light` 三种主题状态，并遵守不把新按钮放在应用右上角的 UI 指南。

## Solution

把“保存的主题偏好”和“实际渲染主题”分开处理。`useMantineColorScheme()` 继续负责读取和设置用户选择的 `light/dark/auto`；组件里所有需要判断深浅分支的地方改用 Mantine 已提供的 `useComputedColorScheme()` 或一个本地轻量 wrapper，得到 resolved `light/dark`。

在此基础上，只整理两个首屏可见面：`App.tsx` 的左侧全局导航，以及 `OrganizerWorkspace.tsx` 的整理页顶部/状态/空状态/底部操作条。颜色和层级以 Mantine CSS variables 为主，手写分支只保留在需要明确区分导航层级的地方。

### Element: Resolved Theme Wiring

**What**: 用 resolved color scheme 替代当前 `colorScheme === 'dark'` 判断，避免 `auto` 落入浅色分支。  
**Where**: `src/renderer/src/App.tsx`, `src/renderer/src/views/OrganizerWorkspace.tsx`; 如 builder 判断复用价值明确，可新增 `src/renderer/src/theme.ts` 或 `src/renderer/src/useResolvedTheme.ts`。  
**Wiring**: `SettingsWorkspace` 继续通过 `setColorScheme(newTheme)` 保存用户选择；Mantine Provider 已能把 `auto` 写成真实 `data-mantine-color-scheme`；组件只读 resolved 值决定局部样式。  
**Affected code**: `src/renderer/src/App.tsx:93`, `src/renderer/src/App.tsx:98`, `src/renderer/src/views/OrganizerWorkspace.tsx:20`, `src/renderer/src/views/OrganizerWorkspace.tsx:51`.  
**Complexity**: Low.  
**Status**: Validated.

### Element: Sidebar Theme Alignment

**What**: 调整左侧导航栏的背景、阴影、激活 tab、通知入口和设置入口，让它在深色模式中读作导航层，而不是浅色残留。  
**Where**: `src/renderer/src/App.tsx` 的 sidebar render block。  
**Wiring**: `activeView` 仍驱动当前 tab；`isNotificationCenterOpened` 和 `activeView === 'settings'` 仍驱动底部入口状态；只替换样式表达。  
**Affected code**: `src/renderer/src/App.tsx:481`, `src/renderer/src/App.tsx:485`, `src/renderer/src/App.tsx:558`, `src/renderer/src/App.tsx:605`, `src/renderer/src/App.tsx:624`.  
**Complexity**: Low.  
**Status**: Validated.

### Element: Organizer First-Screen Surface Alignment

**What**: 统一整理页首屏主要 surface：顶部 header、系统状态 card、快捷操作 card、待整理空状态、底部操作条和主按钮。去掉会在深色模式下显得浅色发亮的大面积 radial gradient。  
**Where**: `src/renderer/src/views/OrganizerWorkspace.tsx`。  
**Wiring**: `statusLabel/statusTitle/statusDescription`、`files`、`hasScanned`、`hasOrganized`、`isScanning`、`isOrganizing` 的状态逻辑保持不变；builder 只调整这些状态的承载 surface。  
**Affected code**: `src/renderer/src/views/OrganizerWorkspace.tsx:238`, `src/renderer/src/views/OrganizerWorkspace.tsx:278`, `src/renderer/src/views/OrganizerWorkspace.tsx:374`, `src/renderer/src/views/OrganizerWorkspace.tsx:511`, `src/renderer/src/views/OrganizerWorkspace.tsx:607`, `src/renderer/src/views/OrganizerWorkspace.tsx:625`.  
**Complexity**: Medium.  
**Status**: Validated.

### Element: Theme Regression Verification

**What**: 给 build 阶段明确验证路径：单元层验证 `auto` resolved 逻辑或本地 helper；人工/截图层验证主窗口在 light、dark、auto dark 三种状态下没有首屏割裂。  
**Where**: 测试文件可放在 `src/renderer/src/theme.test.ts` 或和本地 helper 同目录；视觉验证通过现有 Electron dev server 手工切换设置完成。  
**Wiring**: 不新增 IPC，不新增设置项；如果抽 helper，只测试 helper 输入输出。视觉验证只改变已存在的设置页外观主题 select。  
**Affected code**: `src/renderer/src/main.tsx:20`, `src/renderer/src/views/SettingsWorkspace.tsx:296`, `src/renderer/src/views/SettingsWorkspace.tsx:300`, possible `src/renderer/src/theme.test.ts`.  
**Complexity**: Low.  
**Status**: Validated.

### Changes

| File / Module | Change | Serves |
|---------------|--------|--------|
| `src/renderer/src/App.tsx` | Import `useComputedColorScheme` or a local resolved-theme helper; keep `setColorScheme` for stored preference; use resolved `isDark` for sidebar background and active entry styles. | R0, R1, R3 |
| `src/renderer/src/App.tsx` | Replace fixed `rgba(46, 88, 168, 0.34)` active states with theme-aware tokens for nav tabs, notification center entry, and settings entry. Keep `activeView` and drawer behavior unchanged. | R1, R3 |
| `src/renderer/src/views/OrganizerWorkspace.tsx` | Use resolved theme instead of raw `colorScheme`; remove the light-looking radial state card in dark mode; align header, status panel, quick action panel, empty state, and bottom action tray to Mantine surface variables. | R0, R2, R3 |
| `src/renderer/src/views/OrganizerWorkspace.tsx` | Keep scan/organize/undo/select state flows intact; only change visual containers and button surface treatment. | R2, R3 |
| `src/renderer/src/main.tsx` | Revisit `defaultColorScheme="light"` during build: either set it to `auto`, or leave it if Mantine manager plus explicit `setColorScheme('auto')` makes startup stable. This must be decided by runtime verification, not guessed. | R0, R4 |
| `src/renderer/src/views/SettingsWorkspace.tsx` | Keep the existing “浅色 / 深色 / 跟随系统” select and `setColorScheme(newTheme)` wiring; no new setting. | R0, R3 |
| `src/renderer/src/theme.test.ts` or equivalent | If a local helper is introduced, test light/dark/auto-dark/auto-light behavior with deterministic inputs. | R0, R4 |

**Fit check**: Every R above maps to at least one change. No gaps.

## Rabbit Holes

- **Treating this as a full design-system rewrite**: Declared out of bounds. The frame targets visible dark-mode inconsistency, so the build should touch the resolved theme wiring, global sidebar, and organizer first-screen surfaces only.
- **Polishing every screen that contains hand-written colors**: Cut back. Search found additional custom shadows and backgrounds in other views, but the screenshots and frame identify left nav plus organizer. Other pages can be follow-up frames if they still feel inconsistent after the shared nav fix.
- **Adding a new “night mode” setting**: Declared out of bounds. Existing `SystemSettings.theme` already supports `light | dark | auto`; the problem is resolved rendering, not missing settings.
- **Overriding Mantine with global CSS hacks**: Patched. Mantine already exposes `useComputedColorScheme()` and `data-mantine-color-scheme`; use those first, and only add local CSS variables/helpers if the builder needs readable names.
- **Putting theme controls or actions in the top-right**: Declared out of bounds. No new controls are needed; if any visual verification helper is temporary, it must not ship. This follows `AGENTS.md`.
- **Changing scan/organize behavior while touching the organizer screen**: Declared out of bounds. The organizer page has real workflow logic in `handleScan`, `handleOrganize`, selection state, and IPC calls; this package only changes presentation surfaces.

## No-Gos

- **No functional changes to daily validation, renaming, organizer scan, organizer move, or undo IPC**: The work is visual/theme alignment only.
- **No new theme preference values**: Keep `light`, `dark`, and `auto`.
- **No screenshot/pin window theme work in this package**: `src/renderer/src/screenshot.tsx` and `src/renderer/src/pin.tsx` have separate providers and are separate window experiences.
- **No full app redesign**: Do not re-layout navigation, reorder tabs, or revisit low-frequency page IA.
- **No new top-right application buttons**: Existing notification behavior already risks visual overlap; this package should not add more.

## Technical Validation

**Key files reviewed**:

- `src/renderer/src/appState.ts`: `DEFAULT_SYSTEM.theme` is `auto`, so following system is the default expectation.
- `src/renderer/src/main.tsx`: `MantineProvider` currently sets `defaultColorScheme="light"`.
- `src/renderer/src/App.tsx`: `useMantineColorScheme()` returns the saved value; sidebar uses `colorScheme === 'dark'` and fixed active backgrounds.
- `src/renderer/src/views/SettingsWorkspace.tsx`: theme select writes `light/dark/auto` through `setColorScheme(newTheme)` and saves `systemSettings`.
- `src/renderer/src/views/OrganizerWorkspace.tsx`: organizer reads raw `colorScheme`, has manual dark/light radial gradients, and has fixed dark/green bottom button surfaces.
- `node_modules/@mantine/core/esm/core/MantineProvider/use-mantine-color-scheme/use-computed-color-scheme.mjs`: `useComputedColorScheme()` returns OS color scheme when saved value is `auto`.
- `node_modules/@mantine/core/esm/core/MantineProvider/use-mantine-color-scheme/use-provider-color-scheme.mjs`: Mantine sets `data-mantine-color-scheme` to computed dark/light when value is `auto` and listens to OS changes.

**Approach validated**: The mechanism exists locally in Mantine 8.3.18. The current bug is not that Mantine cannot follow the OS; it is that OpenFlow components branch on raw `colorScheme`, where `auto` is neither `dark` nor `light`. Replacing those branches with resolved scheme checks lets `auto` behave like the real system theme while preserving the existing settings model.

**Flagged unknowns resolved**:

- `auto` can resolve to actual dark/light: validated through Mantine's `useComputedColorScheme()` implementation.
- Settings persistence does not need a new model: validated because `SettingsWorkspace` already saves `systemSettings` and calls `setColorScheme(newTheme)`.
- Organizer state logic can be left alone: validated because its visual inconsistency sits in render styles, while scan/organize behavior is isolated in handlers and IPC calls.
- Tests can stay lightweight: validated by existing `node:test` renderer tests such as `validationPresentation.test.ts` and `utils.test.ts`.

**Test strategy**:

- If a local resolved-theme helper is introduced, write `node:test` coverage for `light`, `dark`, `auto + system dark`, and `auto + system light`.
- Run `npm run lint` after build edits.
- With the dev app running, verify three manual states: fixed light, fixed dark, and follow-system while macOS is dark.
- In dark/follow-system verification, inspect at least the “日常” default screen and “整理” screen: left nav must not appear as a pale strip, organizer status card must not be a large white panel, and bottom action tray must remain readable.
- Confirm no new app controls appear in the top-right corner.

---

## Status: Shipped — archived 2026-06-03
