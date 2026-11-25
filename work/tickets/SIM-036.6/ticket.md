# SIM-036.6: Device type images in the admin page

| Field | Value |
|---|---|
| State | BACKLOG |
| Priority | P2 |
| Size | M |
| Areas | ui, ux |
| Gate | none |
| Depends on | SIM-036.3 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-25 |
| Claimed by | — |
| PR | — |

## Goal
Slice 2 of SIM-036.3: an Admin uploads, previews and removes a device type's square image on the Device types page.

## Scope reference
- `work/decisions.md` D61, D52, D36; split proposal in `work/tickets/SIM-036.3/plan.md` (§ Split proposal).

## Scope
- List preview: 24 px PNG shown enlarged (`image-rendering: pixelated`), placeholder when `hasImage` is false; loaded with
  `apiFetch` (bearer) as `blob:` URLs, cached per `{id, imageVersion}`, revoked on replace or unmount.
- Dialog upload: `<input type="file" accept="image/png">`, client check (`file.size <= IMAGE_LIMITS.maxBytes`, then
  `validatePng`), local preview, `PUT` raw bytes with `content-type: image/png`; Remove image (`DELETE /image`).
- Save sequence: POST/PATCH first, then PUT/DELETE the image; if the type saved but the image step failed, stay open in
  edit mode for the saved type and show the message inline.

## Out of scope
- Map drawing (SIM-036.4). Image editing or cropping in the browser.

## Acceptance criteria
- [ ] Image upload rejects a non-PNG, a non-24 × 24 image or a file over 20 KB before sending; a valid image shows in
      the preview and in the list after save; images load with the bearer as `blob:` URLs.
- [ ] Server image refusals (422 `image_*`, `images_unavailable`, `drive_error`, `image_changed`) show inline.
- [ ] Component tests cover the image check (fabricated PNG bytes, wrong size, over 20 KB, non-PNG).

## Test plan
- Unit/component: image check, blob URL cache and revoke. Manual: upload a 24 px PNG and see it in the list.

## Notes / answers from Ming
- 2026-11-25: split from SIM-036.3 by its planner (ticket too large for one cycle).

## Handoff
