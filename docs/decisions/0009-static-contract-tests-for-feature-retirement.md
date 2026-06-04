# ADR 0009: Static Contract Tests for Feature Retirement

**Status**: Accepted
**Date**: 2026-06-03
**Feature**: 004 — cut-secondary-features

## Context

Feature 004 removed code across renderer navigation, settings state, preload APIs, main
IPC handlers, Vite entries, and package dependencies. The key risk was not a new behavior
being wrong; it was accidentally removing or leaving behind the wrong boundary while
protecting the core daily workflow.

Manual `rg` checks are useful during development, but they are easy to forget after the
first deletion pass.

## Decision

Add a focused static regression test, `src/renderer/src/featureRetirement.test.ts`, that
checks both sides of the contract:

- Retained core workflow IPC/preload surfaces are still present.
- Retired navigation labels, settings tabs, organizer library write calls, runtime channels,
  Vite entries, retired files, and package dependencies are absent.

The test is paired with TypeScript, existing core tests, static `rg` scans, and
`electron-vite build` before the feature can ship.

## Rationale

For deletion work, a static contract test gives fast feedback on the exact architectural
boundary being protected. It catches both false positives (retired features still present)
and false negatives (core IPC removed while cutting nearby code).

The test intentionally checks user-visible and runtime contract strings rather than
component implementation details. That keeps it useful as a guardrail without freezing
unrelated UI internals.

## Alternatives Considered

- **Only rely on TypeScript**: Catches type breakage, but not hidden stale strings, files, or dependencies.
- **Only rely on manual `rg` commands**: Effective once, but not repeatable by future agents or CI.
- **Full end-to-end UI automation for every retained flow**: Stronger coverage, but larger than the deletion risk being managed here.

## Consequences

**Positive**:

- Future refactors get a compact reminder of what 004 retired and what must remain.
- The core daily workflow IPC contract is protected during broad deletion work.
- Retired dependencies and entry files are guarded against accidental reintroduction.

**Negative / Trade-offs**:

- Static string tests can require updates when legitimate retained channel names change.
- The test proves contract presence/absence, not the full runtime success of every workflow.

**Future considerations**:

- If retained workflow smoke tests become cheap and stable, add them beside this static contract test.
- Keep retired-surface assertions scoped to meaningful boundaries so the test does not become a brittle changelog.
