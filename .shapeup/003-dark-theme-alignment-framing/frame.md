# Frame: 夜间深色主题一致性

**Record ID**: 003  
**Feature ID**: 003-dark-theme-alignment  
**Created**: 2026-06-02  
**Status**: Frame Go — approved 2026-06-02

---

## Problem

OpenFlow 当前外观设置默认跟随系统。用户在夜晚打开软件时，整体应该进入深色体验，但实际首屏出现了明显割裂：

- 主工作区已经呈现深色背景和深色卡片。
- 左侧 tab 栏仍然像浅色侧栏，和工作区主题不统一。
- 当前激活 tab 的浅蓝选中块、文字、图标和深色工作区的视觉语言不一致。
- “素材自动整理”页面虽然外层是深色，但局部状态卡仍有大面积浅色区域，和页面整体不统一。

这不是单纯“好看一点”的问题。左侧 tab 栏是所有页面都会看到的导航骨架，整理页又是主流程里高频使用的页面。用户一打开应用就会看到浅色侧栏和深色内容并列，容易感觉主题切换没有真正生效，界面像是由几套不同设计拼起来的。

当前 workaround 是用户只能忍受这种不一致，或者改成固定主题绕开“跟随系统”的预期。但如果用户选择跟随系统，夜晚打开时就应该得到可信的一致深色体验，而不是局部深色、局部浅色。

## Affected Segment

受影响的是所有使用“外观主题：跟随系统”的 OpenFlow 用户，尤其是夜间或系统深色模式下启动应用的人。

高频受影响区域包括：

- 左侧全局 tab 栏，因为它跨所有页面存在。
- “日常”工作面板库首页，因为它是默认入口。
- “素材自动整理”页面，因为它在截图中已经暴露出局部浅色状态卡和深色页面不统一。

这个问题对新用户和日常使用者都明显：新用户会把它理解成产品质感不稳定，日常使用者会在每次切换页面时被视觉割裂打断。

## Business Value

如果解决这个问题，OpenFlow 的夜间使用体验会更稳定、更像一个完整产品：

- 提升用户对“跟随系统”设置的信任感。
- 降低打开应用后的视觉突兀感。
- 让全局导航和页面内容使用同一套主题语言。
- 减少未来页面继续各自手写深色/浅色样式造成的主题回归。
- 为后续整理其他页面的视觉层级打基础，但不把本 frame 扩展成全应用重设计。

## Evidence

来自用户在 2026-06-02 提供的两张截图：

- “工作区面板库”处于深色主界面，但左侧 tab 栏是浅灰背景，和深色工作区割裂。
- “素材自动整理”页面外层是深色，系统状态区域却出现大面积浅色卡片，页面整体深色不统一。
- 用户明确反馈：“开启软件后，外观主题，跟随系统，现在是夜晚”；“左侧的tab栏是与软件的主题不统一”；“整理页面的深色整体不统一”。

来自代码检查的证据：

- `src/renderer/src/appState.ts:234` 中默认系统设置为 `theme: 'auto'`，说明跟随系统是预期默认行为。
- `src/renderer/src/main.tsx:20` 中 Mantine Provider 使用 `defaultColorScheme="light"`，和默认跟随系统之间存在初始主题基线不一致的风险。
- `src/renderer/src/App.tsx:218` 会把保存的 `sys.theme` 直接传给 `setColorScheme`；当值是 `auto` 时，后续用 `colorScheme === 'dark'` 判断的组件可能拿不到真实 resolved dark 状态。
- `src/renderer/src/App.tsx:485` 的左侧栏背景只按 `colorScheme === 'dark'` 分支判断；截图中的浅色侧栏符合 `auto` 没有被当成实际 dark 处理的表现。
- `src/renderer/src/App.tsx:558` 的激活 tab 使用固定 `rgba(46, 88, 168, 0.34)`，不是围绕统一主题 token 设计。
- `src/renderer/src/views/OrganizerWorkspace.tsx:278` 的系统状态卡在深/浅模式下写了两套手动 radial gradient。
- `src/renderer/src/views/OrganizerWorkspace.tsx:625` 的底部主按钮固定使用 `var(--mantine-color-dark-8)`，整理页存在局部手写深色样式和整体主题 token 混用。

## Appetite

Small Batch（1 个会话）。

理由：问题边界应聚焦在深色主题一致性，不应该扩展成全局视觉重设计。优先验证“跟随系统在夜间是否真正得到 resolved dark 状态”，并让左侧 tab 栏和整理页主要区域与当前主题统一。

## Work To Clarify During Shaping

后续 shaping 需要回答这些问题：

1. “跟随系统”在 Mantine 中应该读取保存值、系统值，还是 resolved color scheme。
2. 左侧 tab 栏的深色模式基线应该和主内容区一致，还是作为更深/更浅一级的导航层。
3. 激活 tab 的选中态应该如何在深色模式下保持清晰，但不显得像浅色主题残留。
4. 整理页哪些区域属于必须统一的首屏主题问题，哪些属于后续页面 polish。
5. 是否需要抽出共享的导航/页面 surface token，避免每个页面继续手写深浅分支。
6. 修正时如何遵守项目 UI 指南：避免把新按钮或关键操作放在应用右上角，防止被系统通知遮挡。

## Non-Goals For This Frame

- 不做全应用视觉重设计。
- 不改变主流程功能、校验逻辑或整理逻辑。
- 不重新设计所有页面的布局。
- 不处理低频页面的完整深色 polish，除非它们共享同一个全局导航问题。
- 不新增主题设置项；本 frame 只围绕现有“跟随系统/深色/浅色”预期。
- 不在 framing 阶段决定具体实现方案。

## Frame Statement

> If we can shape this into something doable and execute within a Small Batch,
> it will make OpenFlow feel coherent when launched at night with system-following appearance,
> so users trust that dark mode is intentional and consistent across the global navigation and organizer workflow.

---

## Status: Frame Go — approved 2026-06-02
