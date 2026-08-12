# ADR 0010: Same-Day Requirement Session Snapshot

**Status**: Accepted
**Date**: 2026-06-11
**Feature**: 005 - guided-daily-workflow

## Context

The daily workflow depends on requirement JSON imported from the plugin or another source.
Before 005, closing or accidentally quitting OpenFlow cleared the parsed `projectsList` and
`jsonFileName`, forcing the user to import the same JSON again during the same working day.

The user explicitly wanted this memory to be short-lived: keep today's import for recovery,
but require a fresh import tomorrow. The app already had a local config store and normalized
requirement parsing, so the question was what to persist and how to expire it.

## Decision

Persist a normalized `dailyRequirementSession` snapshot in the existing local store after a
successful JSON import. The snapshot stores parsed requirement data, imported file metadata,
user-info fields from the JSON, `importedAt`, and a local `importedDateKey`.

On startup, restore the snapshot only when both conditions are true:

- The current local calendar date equals `importedDateKey`.
- The snapshot age is less than 24 hours.

Expired snapshots are deleted from the store.

## Rationale

A normalized snapshot restores the user's daily context without depending on the original
JSON file still being present, unchanged, or readable. The same-local-date plus under-24-hour
rule matches both user constraints: "today's import is remembered" and "tomorrow requires a
new import".

Using the existing store keeps the change inside the renderer and current IPC surface. No new
main-process persistence API is needed.

## Alternatives Considered

- **Remember only the JSON file path**: Smaller payload, but reopening would fail if the file
  moved or changed, and it would make startup dependent on filesystem reads.
- **Remember the raw JSON indefinitely**: Easier restore, but violates the user's rule that
  tomorrow must start with a new import.
- **Session-only memory in React state**: Avoids persistence, but does not solve accidental
  app close or restart.
- **Use elapsed 24 hours only**: Honors the TTL but would restore yesterday evening's JSON the
  next morning, which the user rejected.

## Consequences

**Positive**:

- Same-day restarts recover the imported requirement context.
- The restore rule is deterministic and covered by pure helper tests.
- The app does not need to re-read or trust the source JSON file after import.

**Negative / Trade-offs**:

- A user who changes the source JSON file must reimport to update the snapshot.
- Local clock changes can affect freshness because the rule intentionally uses local real-world time.

**Future considerations**:

- If users need to see why a session expired, add explicit expired-session copy without changing
  the underlying freshness rule.
- If direct plugin-to-desktop handoff ships later, it should still produce the same normalized
  daily session shape.
