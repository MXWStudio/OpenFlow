# Scope: Remember Today's Requirements

## Hill Position
✓ Done — session freshness, persistence, restore wiring, and expiry tests are in place.

## Must-Haves
- [x] Persist parsed JSON requirement context as a same-day session snapshot.
- [x] Restore fresh sessions on app startup using local real-world time.
- [x] Expire sessions when the local date changes or the snapshot is older than 24 hours.
- [x] Preserve existing user info updates from imported JSON.
- [x] Cover the expiry rule with tests.

## Nice-to-Haves (~)
- [ ] ~ Show the expired JSON file name in the reimport prompt.

## Notes
Freshness is both same local calendar date and less than 24 hours old. The cache stores normalized parsed data, not a long-term source-file dependency.

## Build Notes
- Added `dailyRequirementSession` helpers and tests.
- `App` stores the normalized snapshot after JSON import and deletes stale snapshots on startup.
