# SIM-025: Fix rooms API security findings (streamed body cap, delete lock order)

| Field | Value |
|---|---|
| State | PLANNING |
| Priority | P1 |
| Size | S |
| Areas | security, api |
| Gate | none |
| Depends on | SIM-010 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-20 |
| Claimed by | claude@2026-11-20T08:46:02Z |
| PR | — |

## Goal
Close the two 🟡 findings left open when SIM-010 merged, so one oversized request cannot exhaust server memory and a
plain room delete can never remove an occupied seat. Must land before any seat or device writer (SIM-012, SIM-013,
SIM-015.x).

## Scope reference
- `work/tickets/SIM-010/security-review.md` Attempt 1, findings 1–2; review.md nits on the INSERT form.
- spec ROO-01 (delete guard), §8 Security; CLAUDE.md R5, R6. Ming 2026-11-20: "tạo 2 ticket follow-up".

## Scope
- `src/server/request/read-json.ts`: read `req.body` as a stream, count bytes, cancel and refuse as soon as the total
  passes `maxBytes` (also without or with a lying `content-length`); decode with a fatal UTF-8 decoder; keep the
  `content-length` fast path.
- `src/server/rooms/rooms.ts` `deleteRoom`: lock the room's seats (`select … from seats … for update` through
  `orgQuery`) before the impact check; document the lock order every future seat/device writer must follow (room row
  first, then seats).
- One-line comments at the two INSERTs that use the `select … from (select $1::uuid as org_id) o` form
  (`rooms.ts`, `audit/write.ts`), explaining why.
- Cheap 💭 from the same review: add the pending-request count to the delete audit `meta`.

## Out of scope
- An `orgInsert` helper (High path `src/server/http/**`).
- DB integration tests (SIM-026).
- Other 💭 (500-room truncation signal, control/bidi characters).

## Acceptance criteria
- [ ] A body larger than the cap is refused (`invalid_request`) without reading it whole: tests with a `ReadableStream`
  body that has no `content-length`, and with a lying small `content-length`; the stream is cancelled.
- [ ] Invalid UTF-8 is refused.
- [ ] `deleteRoom` locks the seats before counting the impact (statement-order test on the fake client).
- [ ] The lock-order rule is written in `rooms.ts` (and `src/server/README.md` if that is where conventions live).
- [ ] The delete audit meta includes the pending-request count.
- [ ] All loop checks green; security rescan marks SIM-010 findings 1–2 resolved.

## Technical notes
- Files: `src/server/request/read-json.ts` (+ test), `src/server/rooms/rooms.ts` (+ test), `src/server/audit/write.ts`,
  possibly `src/server/README.md`. No High path.
- Real-DB behaviour of the lock is verified by SIM-026.

## Test plan
- Unit: readJson stream cases, deleteRoom statement order, audit meta.
- Manual: none.

## Notes / answers from Ming
- 2026-11-20: created on Ming's request ("tạo 2 ticket follow-up") from the SIM-010 security review.

## Handoff
