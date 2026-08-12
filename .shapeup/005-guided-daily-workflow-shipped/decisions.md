# Decisions Made — 日常流程引导化与 JSON 状态记忆

**Feature ID**: 005-guided-daily-workflow
**Shipped**: 2026-06-11
**Appetite**: Medium Batch
**Actual effort**: 1 build session

## Key Architectural Decisions

- **Same-day requirement snapshot**: Store normalized parsed JSON in `dailyRequirementSession` instead of remembering a file path. Restore only on the same local date and under 24 hours.
- **Split size state by meaning**: Treat JSON requirement sizes, detected folder sizes, and manual fallback targets as separate concepts instead of continuing with `selectedSizes`.
- **Empty folder as explicit validation semantics**: Emit one `missingKind: empty_folder` row from main validation, then prioritize that copy in the renderer presentation model.
- **Guided daily page over draggable panels**: Replace the DnD panel library with a fixed flow and remove the unused DnD dependency.

## What Was Cut (Scope Hammering)

- **Expired JSON filename prompt**: Nice-to-have only. The shipped behavior expires stale sessions cleanly; richer expired-session copy can be shaped later.
- **Non-media-only folder copy**: Nice-to-have only. The current empty media path reports a missing-file style issue; distinguishing unsupported-only folders can be a future `missingKind`.
- **Step microcopy polish**: Nice-to-have only. The main flow and status hierarchy shipped; copy tuning can follow user testing.
- **Requirement editor**: Explicit no-go. Users reimport JSON rather than editing quantities in the daily page.
- **Old layout migration/destructive cleanup**: Explicit no-go. Legacy daily layout keys may remain in config and are ignored.

## What Surprised Us

- The old `selectedSizes` state carried more product meaning than its name suggested: imported requirements, detected folders, and manual choices all passed through it.
- Empty folder handling was better solved in the main process than the renderer because the main process sees the empty `fileList` before missing rows are generated.
- The DnD dependency was isolated enough that removing it after the guided rewrite was straightforward.
- The Shape Up consistency hook referenced by the workflow was not present in the local `.cc-switch` install, so shipping used local evidence audit plus lint/tests instead.

## Future Improvement Areas

- **Expired-session UX**: Add inline copy if users need to understand why yesterday's JSON was not restored.
- **Unsupported-only folders**: Add a separate `missingKind` if users distinguish empty folders from folders containing unsupported file types.
- **Multi-project folder binding**: Replace loose folder-name matching if multiple imported projects make validation target selection ambiguous.
- **Daily flow personalization**: Add small scoped preferences only if repeated use shows a need; avoid returning to general draggable panels.

## Verification

- `npm run lint`
- `node --test src/main/requirements.test.ts src/renderer/src/validationPresentation.test.ts src/renderer/src/dailyRequirementSession.test.ts`
- Static scan confirmed no runtime references to `@hello-pangea/dnd`, `DragDropContext`, `Droppable`, `Draggable`, `selectedSizes`, or the old daily layout callbacks.
