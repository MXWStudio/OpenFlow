# ADR 0003: Quantity Shortages Do Not Block Renaming Valid Assets

**Status**: Accepted  
**Date**: 2026-06-01  
**Feature**: 001 — plugin-desktop-core-workflow

## Context

After quantity-aware validation shipped, real testing showed a practical workflow problem: when JSON says a project needs five assets but the available folder only has two or four valid assets, blocking all renaming is too rigid. Sometimes the plugin over-extracts, the requirement changes, or the user intentionally wants to process the assets that are ready.

At the same time, true data quality issues such as unreadable files, unsupported formats, or dimensions that do not match the selected requirements should still prevent blind renaming.

## Decision

Treat quantity shortages as warning-level issues rather than hard blockers. When validation results contain only `missing` rows plus valid files, the user can proceed with renaming the valid assets. Blocking remains in place for dimensions that do not match, file read failures, and other non-missing validation errors.

The UI surfaces the shortage (`缺 N 张`, `需要 X / 已有 Y`) and warns that only validated assets will be renamed.

## Rationale

This keeps validation useful without trapping the user. A shortage is often a workflow decision or upstream requirement problem, while a mismatch or read failure means the file itself is unsafe to rename under the selected rule.

The decision also creates a cleaner path for future work: a dedicated validation details or requirement correction flow can help users resolve shortages, but 001 does not need a full requirements editor.

## Alternatives Considered

- **Block renaming until all quantities are satisfied**: Safest on paper, but too rigid for real production when source requirements may be wrong or incomplete.
- **Ignore shortages completely**: Faster, but it would hide the main quantity problem 001 was built to reveal.
- **Build a full requirement editing panel immediately**: Useful, but outside the 001 appetite and better framed as follow-up work.

## Consequences

**Positive**:

- Users can process ready assets without waiting for every requirement gap to be filled.
- Quantity gaps remain visible and explicit.
- Blocking behavior is reserved for actual asset quality problems.

**Negative / Trade-offs**:

- A user can intentionally rename a partial set, so downstream completion still requires discipline.
- The UI must clearly distinguish shortages from hard errors.

**Future considerations**:

- Frame 002 should improve validation details so users can see warnings, blockers, and passed items in the right priority.
- A future requirements correction panel could let users adjust over-extracted or under-extracted quantities before validation.
