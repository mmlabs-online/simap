# SIM-036.5: Device type image upload, remove and serve

| Field | Value |
|---|---|
| State | DONE |
| Priority | P2 |
| Size | M |
| Areas | api, security |
| Gate | plan-approval |
| Depends on | SIM-036.2, SIM-036.1 |
| Needs Ming | M-46 (go-live only) |
| Attempts | 0 |
| Created | 2026-11-24 |
| Claimed by | — |
| PR | https://github.com/mmlabs-online/simap/pull/79 |

## Goal
An Admin can give a device type its own square image, and every member of the org can load it for the map, stored in
Google Drive (D61).

## Scope reference
- `work/decisions.md` D61 (Drive storage, 24 × 24 PNG, at most 20 KB).
- Split from SIM-036.2 (`work/tickets/SIM-036.2/plan.md` → Split proposal, approved by Ming 2026-11-24).
- `work/tickets/SIM-036.1/security-review.md` → Follow-ups for SIM-036.2 (requirements here).

## Scope
- `PUT /api/device-types/{id}/image` (Admin): raw `image/png` body read by a new `readBytes(req, 20480, "image/png")`
  (exact content-type, `content-length` precheck, streaming cap); pure `src/lib/validate/png.ts` (signature, first chunk
  IHDR length 13, width = height = 24, ends with IEND). Order: wrapper, uuid, pool, body + PNG check (422), org-scoped
  row lookup `for update` (404), `getDrive()` (null → 503 `images_unavailable`), upload with a server-chosen name and
  mimeType `image/png`, one compare-and-set update (new id, `image_version + 1`), then a best-effort delete of the old
  file after commit (or of the new file if the update fails).
- `DELETE /api/device-types/{id}/image` (Admin, 204): DB first (`null`, version + 1), best-effort Drive delete after
  commit; works when Drive is off (orphan logged). `deleteDeviceType` deletes the image file the same way.
- `GET /api/device-types/{id}/image` (any member): org-scoped lookup (404 for none / other org), `If-None-Match` →
  304 before any Drive call, `getFile` + PNG signature check, fixed `Content-Type: image/png`,
  `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-cache`, ETag `"<id>-<imageVersion>"`,
  `Content-Disposition: inline`, `Content-Security-Policy: sandbox`.
- Every `DriveError` / `DriveConfigError` maps to a fixed 502 `drive_error` or 503 `images_unavailable`; `err.code` is
  never forwarded; `drive_auth` never becomes 401/403 (R7).

## Out of scope
- UI (SIM-036.3, SIM-036.4). Orphan Drive file sweep. Production secrets deploy (separate deploy ticket, M-46).

## Acceptance criteria
- [ ] Image upload accepts only a real PNG of exactly 24 × 24 px and at most 20 KB (422 otherwise, before any DB or
      Drive call); replacing or removing an image deletes the old Drive file; Drive failures map to a fixed 5xx code.
- [ ] `GET` image returns the bytes only to members of the same org (404 across orgs), with ETag and
      `private, no-cache`, a fixed `image/png` content type and `nosniff`.
- [ ] The server picks the Drive file name; no client filename is used.
- [ ] `drive_auth` and every other Drive failure map to a 5xx code, never 401/403; a test proves it.
- [ ] Unit tests for `png.ts` and `readBytes`; handler tests with a fake `OrgDrive` (ordering, compare-and-set,
      cleanup on failure, no Drive call on 422); DB tests for cross-org 404 and the version bump.

## Technical notes
- No migration: `image_drive_file_id` and `image_version` come from the SIM-036.2 migration.
- Risks / open questions: orphan Drive files after a failure between upload and commit (accepted, sweep is a
  follow-up).

## Test plan
- Unit, handler and DB tests as listed. Manual (after M-46): upload a 24 px PNG, load it, replace it, remove it.

## Notes / answers from Ming
- 2026-11-24: split approved with the SIM-036.2 plan (Ming: "duyệt").
- 2026-11-24: Ming ran `/run SIM-036.5`; M-46 is go-live only ("code and tests do not need it"), so it does not block this run.

Waiting for Ming: plan approval (ticket Gate)
- 2026-11-25 Plan approved (Ming: "1ok"; A1 no row lock across the Drive upload, compare-and-set with 409 `image_changed`, and the Q2–Q6 defaults). M-50.

## Handoff

### 2026-11-24 — claude — BLOCKED
- Agent calls: 2, ~120k tokens (api-platform-engineer×1 opus 45.8k, planner×1 opus 74.4k; per-call in/out split not reported)
- Done: consult (api; security has no consult agent), plan READY. No High path. Gate is `plan-approval` from the ticket.
- In progress / next: Ming approves `plan.md` (M-50; key decision A1: no row lock across the Drive upload, compare-and-set plus 409 `image_changed`). Then `/run SIM-036.5` resumes at IMPLEMENT.
- Gotchas: ~450 product + ~800 test lines (fallback: move the `deleteDeviceType` cleanup to a follow-up). Session branch `claude/confident-cerf-67q5le`.

### 2026-11-25 — claude — DONE
- Agent calls: 3 this run, ~194k tokens (implementer×1 opus 84.0k, reviewer×1 opus 58.7k, security-ai-generated-code-auditor×1 opus 51.2k; per-call in/out split not reported). Whole ticket: 5 calls, ~314k.
- Done: plan approved (M-50, Ming "1ok"); attempt 1 implemented; review PASS with all checks green incl. `pnpm test:db`; security review no 🔴/🟡. PR https://github.com/mmlabs-online/simap/pull/79.
- In progress / next: Ming reviews and merges PR #79. Then SIM-036.3 and SIM-036.4 become runnable. Manual Drive check after M-46.
- Gotchas: three 🟢 security suggestions are follow-ups. UI must load the image via `apiFetch` + `blob:` URL. Session branch `claude/confident-cerf-67q5le`.

