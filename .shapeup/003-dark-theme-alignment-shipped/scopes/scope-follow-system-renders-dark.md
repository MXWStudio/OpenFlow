# Scope: Follow System Renders Dark

## Hill Position
✓ Done — resolved theme helper, provider baseline, and runtime auto-dark behavior are validated.

## Must-Haves
- [x] Add deterministic coverage for resolving `light`, `dark`, and `auto` against system light/dark.
- [x] Provide a small renderer helper so components do not branch on raw `auto`.
- [x] Set the main Mantine provider baseline so first render respects follow-system behavior.

## Nice-to-Haves (~)
- [x] ~ Evaluate whether a helper is warranted; kept it small because it gives deterministic coverage for `auto` resolution.

## Notes
This scope covers R0 and provides the mechanism for later UI scopes. It did not add a new user-facing setting.
