# Scope: 基础功能保护门槛

## Hill Position
● Done — Regression tests now prove retained core IPC/preload surfaces stay available while retired surfaces are absent.

## Must-Haves
- [x] Add regression tests that prove retained core IPC/preload surfaces are still present.
- [x] Add regression tests that prove retired surfaces are absent after implementation.
- [x] Keep the tests focused on user-visible outcomes, not implementation trivia.

## Nice-to-Haves (~)
- [ ] ~ Add a smoke helper that lists retained app views from one source of truth.

## Notes
Implemented in `src/renderer/src/featureRetirement.test.ts`; verified with node tests, TypeScript, and Electron/Vite build.
