# SIM-046.1: Profile photo in the Profile tab and the shell avatar

| Field | Value |
|---|---|
| State | DONE |
| Priority | P3 |
| Size | M |
| Areas | ui |
| Gate | none |
| Depends on | SIM-046, SIM-045.1 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-26 |
| Claimed by | — |
| PR | https://github.com/mmlabs-online/simap/pull/131 |

## Goal
A member sees, uploads, replaces and removes their own profile photo in the My Portal Profile tab, and sees it in the app shell avatar (SIM-046 slice 2).

## Scope reference
- Split off from the parent plan (batch 2026-11-26-1, Ming 2026-11-26: "duyệt hết theo mặc định"). See the parent's
  plan.md "Split proposal" for the exact files; the parent ticket's acceptance criteria and spec references apply.

## Scope
- Profile tab photo section: preview, upload / replace / remove, client pre-check with `validatePhoto`, error copy in `src/ui/copy/portal.ts`.
- `src/ui/portal/photo-api.ts` and an own-photo context in `src/ui/AppShell.tsx` (blob URL by `photoVersion`, refresh after a change, reset on session change).
- `Avatar.tsx` optional `src`; `AppShellView.tsx` passes the shell photo; initials when there is no photo.
- Guard test: `src/ui/roomlayout/**` and `src/lib/sprites/**` never reference a photo path.

## Out of scope
- Anything the parent slice already ships; server, schema and API changes (none needed).

## Acceptance criteria
- [ ] The Profile tab shows the current photo (or initials) and can upload, replace and remove it; the server's 422 codes show readable messages.
- [ ] The shell avatar shows the member's photo, and updates after a change without a reload.
- [ ] The room map never draws a photo (guard test).
- [ ] All Checks pass.

## Notes / answers from Ming
- Plan approved (2026-11-26, batch 2026-11-26-3): "duyệt hết theo mặc định"; Q3 default: no confirm on own photo removal.

## Handoff

### 2026-11-26 — claude — DONE
- Agent calls: 4, ~285k tokens (frontend-developer×1 default 39k, planner×1 default 104k, implementer×1 default 83k, reviewer×1 default 57k; batch 2026-11-26-3).
- Done: own photo upload/replace/remove in Profile tab, shell avatar via OwnPhotoProvider, Avatar `src` prop, `sections` slot, no-photo-on-map guard; review PASS attempt 1; PR #131.
- In progress / next: Ming merges PR #131; then SIM-047.1 is rebased onto main and built.
- Gotchas: store is created in useEffect (StrictMode); a member without a photo costs one 404 GET per mount.
