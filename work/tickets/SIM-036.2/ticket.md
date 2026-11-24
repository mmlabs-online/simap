# SIM-036.2: Device type catalog: schema and API

| Field | Value |
|---|---|
| State | BACKLOG |
| Priority | P2 |
| Size | M |
| Areas | db, api, security |
| Gate | plan-approval |
| Depends on | SIM-035, SIM-036.1 |
| Needs Ming | M-46 (go-live only) |
| Attempts | 0 |
| Created | 2026-11-24 |
| Claimed by | — |
| PR | — |

## Goal
Each org has a list of device types that an Admin manages (name, desk slot, optional square image), so the map can
draw any kind of device, not only the five built-in ones.

## Scope reference
- `work/decisions.md` D61 (catalog, image format, name matching, placeholder), D37 (free-text type stays).
- `docs/spec-v1.md` DEV-01 (manage devices), LAY-06 (devices drawn by type).

## Scope
- Forward-only migration: `device_types` (`org_id`, `id`, `name`, `slot`, `image_drive_file_id` nullable, timestamps;
  name unique per org, trimmed and case-insensitive; `slot` from the fixed slot list of SIM-035). Seed each org with
  the D37 types (PC, Laptop, Monitor, IP phone, Other) using the built-in sprites (no image).
- API: list types (any member); create, rename, change slot, delete (Admin); upload or replace the image (Admin,
  `image/png`, square 24 × 24 px, at most 20 KB, checked by reading the PNG header, never trusting the client);
  remove the image; `GET` the image bytes behind the bearer (`private, no-cache` + ETag, tudocuatui D34).
- `devices.type` stays free text and matches a catalog type by name (trimmed, case-insensitive). Deleting a type does
  not touch devices; they fall back to the square placeholder.
- The layout read API returns, per seat device, the resolved catalog type (id, slot, image version) or none.
- Spec: add the catalog to DEV-01 / LAY-06 in `docs/spec-v1.md`.

## Out of scope
- UI (SIM-036.3, SIM-036.4). Bulk renaming of the type on existing devices.

## Acceptance criteria
- [ ] The migration is forward-only and expand-only; `pnpm schema:check` and `pnpm migrate:smoke` pass; every org gets
      the five seeded types.
- [ ] Create, rename, delete and slot change are Admin only (403 from the auth wrapper for others, R7); a duplicate
      name (case- and whitespace-insensitive) is refused with 409; every query is org-scoped (R6), covered by a DB test
      with two orgs.
- [ ] Image upload accepts only a real PNG of exactly 24 × 24 px and at most 20 KB (422 otherwise, before any Drive
      call); replacing or removing an image deletes the old Drive file; Drive failures map to a fixed 5xx code.
- [ ] `GET` image returns the bytes only to members of the same org (404 across orgs), with ETag and
      `private, no-cache`.
- [ ] Layout read returns each seat device's resolved type; a device type not in the catalog resolves to none.
- [ ] Spec DEV-01 / LAY-06 updated.

## Technical notes
- High path: `db/migrations/**`. Domain refusals 409/422, never a late 401/403 (R7). Body cap on upload.
- Risks / open questions: seeding orgs created after the migration (on first read or at org bootstrap); planner
  decides. Image cache-busting for the map (a version or ETag in the type DTO).

## Test plan
- Unit: validators (name, slot, PNG header and size), handlers with a fake Drive.
- DB: CRUD, uniqueness, org scope, seed, layout read resolution.

## Notes / answers from Ming
- 2026-11-24: images on Google Drive like tudocuatui; format proposed by the agent (24 px square PNG); a square
  placeholder for types the admin has not defined (D61).

## Handoff
