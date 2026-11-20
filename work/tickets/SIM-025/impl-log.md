# Impl log — SIM-025

## Attempt 1 — 2026-11-20

### Files touched
| File | Required because |
|---|---|
| src/server/request/read-json.ts | Streamed byte-counted read, cancel on overflow, fatal UTF-8 (finding 1) |
| src/server/request/read-json.test.ts | AC 1, 2 |
| src/server/rooms/rooms.ts | Seats lock in deleteRoom, `pending` in audit meta, lock-order doc, INSERT comment (findings 2, 3, nit 1) |
| src/server/rooms/rooms.test.ts | Shifted indexes, order and meta assertions (AC 3, 5) |
| src/server/audit/write.ts | INSERT comment (nit 1, TS `//` above the call) |
| src/server/README.md | Lock-order bullet (AC 4) |

### Tests added / changed
- read-json.test.ts › stream over the cap without content-length; lying small content-length with a stream; invalid UTF-8; exactly maxBytes / maxBytes+1 / split multi-byte char; empty or missing body
- rooms.test.ts › forced delete order (updated indexes, `pending`); seats lock runs after the room lock and before the impact count, also without force

### Checks (actual output summary)
- format:check: All matched files use the correct format.
- typecheck: next typegen + tsc --noEmit, exit 0
- check:layers: 121 files, no violations
- test: Test Files 48 passed (48); Tests 467 passed | 3 skipped (470)
- build: exit 0
(Local Node 24; CI is Node 22. Vitest ran in Node, `duplex: "half"` streams worked.)

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- None.

### Scope self-check
- Could the diff be smaller? No.
- Diff size: see git diff --stat
