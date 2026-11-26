# SIM-046: Profile photo upload

| Field | Value |
|---|---|
| State | IN_PROGRESS |
| Priority | P3 |
| Size | M |
| Areas | api, db, ui, security |
| Gate | plan-approval |
| Depends on | SIM-045 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-26 |
| Claimed by | claude@2026-11-26T05:34:54Z |
| PR | — |

## Goal
A member uploads, replaces or removes a real profile photo, shown in the app's people surfaces (not on the map).

## Scope reference
`docs/spec-v1.md` POR-05, Member entity (§4), LAY-06; decision D71 (amends D44). Open questions: OQ-56 (limits:
PNG/JPEG, square, 64–512 px, ≤ 256 KB), OQ-57 (where it shows), OQ-61 (who may remove it). Precedent: D68 and
SIM-036.5 device type image storage.

## Scope
- Forward-only migration adding the photo reference to `members` (expand only, R2).
- Upload / replace / remove API for the caller's own photo, served behind the bearer like device type images.
- Profile tab UI in My Portal; photo shown where OQ-57 says, fallback otherwise.
- Audit every change without image bytes (SYS-03).

## Out of scope
- Pixel character (SIM-047); server-side image resizing (no image library in the stack).

## Acceptance criteria
- [ ] Migration is forward-only and the previous image keeps working (R2).
- [ ] The member uploads, replaces and removes their own photo; the file header and limits (OQ-56) are checked on the
  server before any DB or storage call; refusals are 422 with a domain code.
- [ ] The photo is stored org-scoped with a server-chosen name and served behind the bearer with ETag and
  `private, no-cache`.
- [ ] The photo shows where OQ-57 decides, with the fallback when absent; it is never drawn on the room map.
- [ ] Only the rights OQ-61 decides exist (default: own photo only; Manager+ may remove another's, audited).
- [ ] Every change writes an audit row without the image bytes; tests cover validation and permissions.

## Technical notes
- Files: `db/migrations/*`, `src/server/members/**`, `src/server/drive/**`, `src/app/api/me/**` (or a new route),
  `src/lib/validate/**`, `src/ui/portal/**`, `src/ui/Avatar.tsx`.
- Risks / open questions: High path (migration) → plan approval. Needs OQ-56, OQ-57, OQ-61 answered or defaults
  accepted at the plan gate.

## Test plan
- Unit: validator (format, size, dimensions, animation), permission rules, audit meta.
- DB: `pnpm test:db` for the member photo columns; `pnpm schema:check`.
- Manual: upload, replace, remove; check each place the photo shows.

## Notes / answers from Ming
- Plan approved (2026-11-26, batch 2026-11-26-1; Ming: "duyệt hết theo mặc định", assumptions A1–A12 with defaults; split into SIM-046 server slice + SIM-046.1 + SIM-046.2).

## Handoff
