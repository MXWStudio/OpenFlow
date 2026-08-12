# ADR 0015: Preflight Rename Planning with Recoverable Sequential Execution

**Status**: Accepted
**Date**: 2026-07-14
**Feature**: 2026-07-13-robust-custom-renaming — robust custom renaming

## Context

The previous main-process handler rendered and renamed each file inside one broad loop. Conflict
handling only incremented the sequence variable. A fixed template without a `Sequence` token
therefore generated the same candidate forever and could leave the page stuck in “renaming”. Empty
or missing rules could silently degrade to `untitled`, and videos were renamed with an `.mp4`
extension even when no media conversion occurred.

Teams need batch operations to be predictable: invalid templates must fail before files change,
existing files must not be overwritten, and a locked file must not discard successful work on
other files.

## Decision

Split renaming into a deterministic planner and a recoverable executor:

- `previewRenameRequest()` validates every input, chooses the effective preset, renders the rule,
  reserves names using Unicode NFC plus case-insensitive comparison, and returns a full plan.
- A rule with `Sequence` is rerendered with increasing sequence values; a fixed rule gets a
  deterministic numeric suffix. Allocation attempts have an explicit finite upper bound.
- Any preflight blocker prevents the entire batch from changing files and returns a structured
  error for each item.
- `executeRenameRequest()` replans, checks the target immediately before each rename, processes
  items sequentially, preserves the original extension, and returns path-level success or failure.
- Partial failures keep successful renames and expose only failed inputs for retry. Invalid custom
  rules never silently fall back; the renderer offers an explicit regular-mode action.

## Rationale

Planning makes the intended filesystem mutation inspectable and testable without Electron. It
also ensures template errors are discovered before the first rename. Sequential execution gives
deterministic sequence allocation and simple recovery, which matters more for this desktop batch
size than maximum throughput.

## Alternatives Considered

- **Patch the old loop with a larger counter**: Does not solve empty templates, silent skips,
  preview drift, extension corruption, or path-level recovery.
- **Run all renames concurrently**: Faster for large batches, but sequence allocation, collision
  reservation, and partial-result reasoning become harder and less deterministic.
- **Implement an all-or-nothing transaction and rollback**: Filesystems do not provide a portable
  multi-file transaction; compensating rollback across volumes exceeds the feature appetite.
- **Automatically fall back to regular naming**: Avoids blocking, but can silently produce a large
  batch of names the user did not approve.

## Consequences

**Positive**:

- Fixed templates cannot create infinite conflict loops.
- Preview and execution share the same plan semantics and structured result contract.
- Locked or externally changed files fail individually and can be retried.
- Original file extensions remain truthful to media contents.

**Negative / Trade-offs**:

- Sequential execution has lower peak throughput than `Promise.all`.
- A hostile external process can still create a target in the small interval between the final
  existence check and POSIX `rename`; that item becomes a recoverable failure rather than a
  cross-process transaction.

**Future considerations**:

- If very large batches make sequential throughput material, bounded concurrency can be shaped
  while retaining one planner and directory reservation state.
- Full undo would require an explicit journal and compensation policy, not just reversing the
  current result array.
