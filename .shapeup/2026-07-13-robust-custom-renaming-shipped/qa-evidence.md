# QA Evidence — 稳定且高度可定制的文件重命名

**Feature ID**: 2026-07-13-robust-custom-renaming
**Final verification date**: 2026-07-14

## Automated Gate

- `npm test`: 73/73 passed.
- `npm run lint`: TypeScript check passed.
- `electron-vite build`: main, preload and renderer production bundles passed.
- Temporary-filesystem integration tests cover real image/video renames, preserved extensions,
  fixed-name and case-only collisions, partial failure retry, overlong names and Windows-reserved
  names.
- Configuration tests cover 24 concurrent nested mutations, CRUD, atomic-replace failure recovery,
  prototype-pollution paths, v2 hydration and legacy hand-made-template migration.

## Desktop Automation

The desktop app was exercised through the macOS accessibility tree and screenshots after the final
fixes:

1. Settings > Naming Templates showed separate System and Custom groups, text labels, semantic
   colors, search, visible save state, image/video tabs and full-width custom-text inputs.
2. A one-field custom template containing only `CON` displayed “暂时无法生成”, “需要修正” and
   “是系统保留文件名，请调整模板”; the planner integration test returned the same blocking
   condition without touching the source.
3. Replacing it with `突发验收` immediately produced `突发验收.jpg` and “规则有效”.
4. Rename, copy and delete were performed through the UI; the copy preserved its field value, and
   search for `突发` reduced the library to the matching custom template.
5. Leaving Settings for Daily, enabling Custom mode and selecting the named template showed the
   template in “本次使用的自定义模板”.
6. After stopping and restarting the app, the named template and `突发验收` field were still
   present, proving the visible save state survived a process restart.
7. Earlier in the same build session, light/dark/narrow layouts were checked; narrow layout kept
   the custom text editor usable after moving it to its own row, and no primary action was placed in
   the application top-right notification area.

## Generated Media Smoke Test

Programmatically generated 64×96 PNG and MP4 fixtures were validated and renamed using the same
persisted UI template settings. Resulting files were:

- `验收突发-20260714-突发项目-MXW-竖-(1).png`
- `验收视频-20260714-突发项目-MXW-竖-(1).mp4`

Fixtures were removed after verification; no user material was required. The user's normal
configuration was restored after desktop QA.
