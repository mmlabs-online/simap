# SIM-036.3: Device types admin page

| Field | Value |
|---|---|
<<<<<<< HEAD
| State | DONE |
=======
| State | MERGED |
>>>>>>> main
| Priority | P2 |
| Size | M |
| Areas | ui, ux |
| Gate | none |
| Depends on | SIM-036.2, SIM-036.5 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-24 |
| Claimed by | — |
| PR | https://github.com/mmlabs-online/simap/pull/80 |

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

- 2026-11-25 (orchestrator): planner split the ticket; this ticket is slice 1 (page, create/edit/delete, slot picker, Type suggestions). Images (AC3 and the 422 half of AC2) move to SIM-036.6.

## Handoff

### 2026-11-25 — claude — DONE
- Agent calls: 5 (frontend-developer×1 45k, ux-architect×1 70k, planner×1 78k, implementer×1 72k, reviewer×1 65k; default models; ~330k total)
- Done: slice 1 — `/device-types` admin page, create/edit/delete dialogs with inline refusals, slot radios + desk diagram, nav entry (`category` icon), catalog Type suggestions in the device dialog. Review PASS on attempt 1; PR https://github.com/mmlabs-online/simap/pull/80.
- In progress / next: SIM-036.6 (images) after merge; manual `pnpm dev` walkthrough by Ming.
- Gotchas: review should-fix (slot `<legend>` not first child of `<fieldset>`), can go into SIM-036.6. Possible conflict with SIM-037.1 in `DeviceFormDialog.tsx`.
