# Decisions Made — 校验详情降噪与异常优先

**Feature ID**: 002-validation-details  
**Shipped**: 2026-06-02  
**Appetite**: Small Batch (1 session)  
**Actual effort**: 1 build session plus user-testing fixes

## Key Architectural Decisions

- **Renderer presentation model**: Validation details now use a pure renderer helper to classify, sort, count, and explain validation rows before rendering.
- **Action-oriented row taxonomy**: Rows are classified as blocking, missing, extra, or passed so the UI can distinguish hard blockers from warnings and skipped material.
- **Recoverable cleanup action**: The inline delete affordance moves files to the system trash through a narrow main-process IPC instead of permanently deleting files.
- **Passed rows are traceable but quiet**: Passed files are summarized and collapsed by default, then expandable when needed.

## What Was Cut (Scope Hammering)

- Nothing was cut. The work stayed inside validation details and avoided rewriting the validator, plugin scraper, or global UI.

## What Surprised Us

- The 001 data model already carried enough fields for 002, so the key work was information hierarchy rather than validation logic.
- User testing exposed a separate semantic case: a manually created size folder can hold non-required extra assets, which should be skipped rather than treated as a true error.
- Main/preload IPC changes require restarting Electron during development; renderer hot reload can show the button before the new backend API exists.

## Future Improvement Areas

- **Requirement vs workspace size display**: The left size selector still mixes JSON-required sizes and detected workspace sizes.
- **Batch cleanup**: A future iteration could add a careful batch action for multiple bad files if single-row cleanup proves repetitive.
- **Revalidate after cleanup**: After moving several files to trash, a shortcut to rerun validation may reduce another click.
