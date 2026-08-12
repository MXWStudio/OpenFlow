# Scope: Guided Daily Flow

## Hill Position
✓ Done — DailyWorkspace has moved from draggable panels to a fixed workflow.

## Must-Haves
- [x] Replace draggable panel layout with a fixed guided daily flow.
- [x] Place import, directory, material upload, validation feedback, and rename actions in workflow order.
- [x] Move special/manual naming controls near the rename step.
- [x] Keep settings/history out of the application top-right as critical controls.
- [x] Remove DnD wiring and dependency when no longer referenced.
- [x] Keep daily core interactions wired to existing App callbacks.

## Nice-to-Haves (~)
- [ ] ~ Polish step status microcopy after the core flow is working.

## Notes
Old `dailyLayoutLeft` and `dailyLayoutRight` config may remain in config files, but should no longer drive the visible daily workflow.

## Build Notes
- Replaced the panel library view with an ordered flow: demand, directory, upload, validation feedback, rename.
- Removed `@hello-pangea/dnd` from the dependency tree after all references were gone.
