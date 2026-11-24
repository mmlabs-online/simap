# SIM-036.3: Device types admin page

| Field | Value |
|---|---|
| State | BACKLOG |
| Priority | P2 |
| Size | M |
| Areas | ui, ux |
| Gate | none |
| Depends on | SIM-036.2, SIM-036.5 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-24 |
| Claimed by | — |
| PR | — |

## Goal
An Admin adds and edits the org's device types (name, where it sits on the desk, its square image) from one
management page.

## Scope reference
- `work/decisions.md` D61, D52 (management screens use the clean UI kit), D36 (copy in `src/ui/copy/`).

## Scope
- A "Device types" management page (Admin): list with image preview (pixelated, 24 px shown enlarged), name, slot.
- Create / edit dialog: name; slot (fixed list with a small desk diagram); image upload with a client-side check
  (PNG, 24 × 24, at most 20 KB) and a preview; remove image; delete with a confirm that says devices of this type will
  show the placeholder.
- The device create/edit dialog's Type suggestions come from the catalog (free text still allowed, D37).

## Out of scope
- Map drawing (SIM-036.4). Image editing or cropping in the browser.

## Acceptance criteria
- [ ] Only Admins see the nav entry and the page; others get the no-access card.
- [ ] Create, rename, change slot and delete work and show server refusals (duplicate name 409, bad image 422) inline.
- [ ] Image upload rejects a non-PNG, a non-24 × 24 image or a file over 20 KB before sending; a valid image shows in
      the preview and in the list after save; images load with the bearer as `blob:` URLs.
- [ ] The device dialog's Type field suggests catalog names.
- [ ] UI copy lives in `src/ui/copy/deviceTypes.ts`; component tests cover the dialog validation.

## Test plan
- Unit/component: dialog validation, list states. Manual: upload a 24 px PNG and see it in the list.

## Notes / answers from Ming
- 2026-11-24: "cho phép admin đặt thêm loại device kèm hình ảnh đại diện" (D61).

## Handoff
