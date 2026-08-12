# ADR 0016: Single-Instance, Serialized, Atomic JSON Configuration

**Status**: Accepted
**Date**: 2026-07-14
**Feature**: 2026-07-13-robust-custom-renaming — robust custom renaming

## Context

The desktop app uses a lightweight JSON configuration file. Every `store:set` previously performed
an independent read-modify-write directly to the final path. Concurrent renderer saves could lose
fields. During desktop verification, two development instances writing the same file produced a
valid JSON document followed by a duplicated tail, proving that in-process debouncing alone was not
enough for reliable template persistence.

The rename feature depends on the last visible template edit surviving page changes and restart, so
a damaged or stale config file would recreate the original trust problem.

## Decision

Strengthen the existing JSON store without introducing a database:

- Queue all `store:set` and `store:delete` mutations inside the main process so each mutation reads
  the result of the prior mutation.
- Write the complete JSON document to a unique process-specific temporary file in the destination
  directory, fsync it, then replace the final config path with `node:fs/promises.rename` (without
  deleting the live file first). Best-effort directory fsync follows the replacement.
- Wait for queued mutations before servicing store reads that require a stable snapshot.
- Acquire Electron's single-instance lock. A second launch restores the existing window instead of
  starting another writer.
- Keep workflow persistence in the App component, which remains mounted while users move between
  settings and daily views.

## Rationale

The app already has a small local configuration and does not need database querying or multi-device
coordination. Serialization eliminates lost updates within an instance; temporary-file replacement
prevents partially written JSON; the single-instance lock removes the observed multi-process writer.
Together they address the actual failure modes within a narrow implementation footprint.

The store has failure-injection coverage proving that an interruption before the atomic rename
leaves the previous configuration readable, plus concurrent-mutation coverage proving that queued
nested updates are not lost.

## Alternatives Considered

- **Continue direct `outputJson` writes**: Simple, but proven capable of lost updates and file-tail
  corruption.
- **Add advisory filesystem locking**: Cross-platform lock recovery introduces stale-lock behavior
  while still allowing two user-visible app instances to compete.
- **Replace the store with SQLite or another database**: Stronger transactional semantics, but a
  disproportionate migration for a small settings object.
- **Use only renderer debouncing**: Reduces write frequency but cannot coordinate unrelated store
  keys or multiple app processes.

## Consequences

**Positive**:

- Template, notification, history, and system setting writes no longer overwrite each other's
  read-modify-write snapshots inside one app instance.
- A crash during serialization does not leave half of a JSON document at the final path.
- Launching OpenFlow twice focuses one application instead of creating competing config writers.

**Negative / Trade-offs**:

- The configuration remains local to one machine and is not a team synchronization system.
- Temporary-file replacement provides document integrity, not multi-record database transactions.

**Future considerations**:

- Central template sharing should use an explicit sync service or import/export contract rather
  than weakening the single local authority.
- If configuration size or query needs grow substantially, reevaluate a transactional embedded
  store with a planned migration path.
