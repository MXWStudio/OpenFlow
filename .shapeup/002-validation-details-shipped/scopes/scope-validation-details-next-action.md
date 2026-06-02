# Scope: 校验详情可一眼判断下一步

## Hill Position
✓ Done — validation details now prioritize next actions, with tests and UI wiring in place.

## Must-Haves
- [x] Sort validation rows by action priority: blocking issues, quantity shortages, then passed files.
- [x] Show group-level counts for blocking issues, missing total, and passed files.
- [x] Keep missing-only validation non-blocking and make that state clear in the details copy.
- [x] Distinguish extra non-required size folders from true size errors.
- [x] Explain true size errors with actual cause instead of pointing users to the left size selector.
- [x] Let users move actionable bad/extra files to the system trash from the details table.
- [x] Collapse or weaken passed files so they do not bury issues.
- [x] Preserve the existing validation and rename data contracts.

## Nice-to-Haves (~)
- [x] ~ Slightly polish the visual weight of passed status badges.

## Notes
This scope covers the whole 002 user outcome: after validation, the user can see what needs action before reading a long file list.
User testing found that a manually added `1080x607` folder can mean "extra non-required assets" instead of "wrong-size assets"; this is now classified separately as `非需求`.
