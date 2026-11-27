# SIM-068.1: Four pixel rooms, paths and notes around the sign-in card

| Field | Value |
|---|---|
| State | MERGED |
| Priority | P2 |
| Size | M |
| Areas | ui, ux |
| Gate | none |
| Depends on | SIM-068 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-26 |
| Claimed by | — |
| PR | https://github.com/mmlabs-online/simap/pull/147 |

## Goal
Finish the "small world" landing from Ming's mockup (`work/tickets/SIM-068/mockup-sign-in.webp`): four decorative
pixel rooms joined by dotted paths around the sign-in card, with idle avatars, two note cards and the card avatar.

## Scope reference
SIM-068 (slice 2 of its split proposal, `work/tickets/SIM-068/plan.md` → `## Split proposal`); D85, D52, D41/D46/D48,
D45/D66, D36; style guide §1 and §4.

## Scope
- New `src/lib/sprites/small-world-scenes.ts`: `FOCUS`, `MEETING`, `LOUNGE`, `CAFE` as 12×7 `RoomLayout`s from
  existing atlas keys only (the café has no counter or coffee-machine sprite — SIM-068 Q6), plus avatars for the paths
  and the card ("Player, ready?").
- New `src/ui/auth/SmallWorld.tsx`: `aria-hidden`, `pointer-events-none`, one canvas per room painted with
  `paintRoom(…, 1)`, mounted only at ≥ 1280 px (SIM-068 Q5; atlas never fetched on phones), CSS placeholder per room,
  CSS dashed paths, two note cards ("Your next great day starts with a little hello", "Big ideas. Small pixels."),
  room labels as decorative text.
- `AuthLayout` `landing` renders `SmallWorld` in a grid around the centre column; other screens keep their current
  look (SIM-068 Q4). Decide whether `SignInScene` stays for those screens.

## Out of scope
- New art or fonts; any change to the sign-in form, its controls or authentication.

## Acceptance criteria
- [ ] At ≥ 1280 px the landing shows the four labelled rooms, paths, idle avatars and two notes around the card, as in
  the mockup; below 1280 px they are not rendered and the atlas is not fetched.
- [ ] Every sprite key resolves in the registry; rooms paint at a whole-number scale; all decoration is `aria-hidden`
  and adds no focusable or interactive control (control count unchanged, still one `h1`).
- [ ] An atlas failure leaves calm placeholders and sign-in still works.
- [ ] Copy (room names, notes) in `src/ui/copy/auth.ts`; all Checks pass.

## Technical notes
- Tests as sketched in SIM-068's split proposal (keys, bounds, fake-canvas paint, render regions).
- Ming verification on a deployed build (DevGate replaces the sign-in page under `pnpm dev`).

## Test plan
- Unit/render tests above; manual at 1440, 1280, 1024 and 390 px, light/dark.

## Notes / answers from Ming
- 2026-11-26: split from SIM-068 (Ming: "theo mặc định", Q9).
- Merge approved (2026-11-27): "merge #147"; squash-merged by claude.

## Handoff

### 2026-11-27 — claude — DONE
- Agent calls: 6, ~416k tokens (frontend-developer×1 default 55k, ux-architect×1 default 30k, planner×1 default 112k, implementer×1 default 92k, reviewer×1 default 60k (resumed after a rate limit), security-ai-generated-code-auditor×1 default 35k (resumed)).
- Done: four 12×7 rooms, standing/seated avatars, dotted paths, two notes and the card avatar on the landing at ≥ 1280 px; atlas fetched once behind a JS media gate; review and security PASS attempt 1; PR #147.
- In progress / next: Ming merges PR #147 and checks the look on a deployed build.
- Gotchas: world-palette.test.ts scans from the aw marker to the end of globals.css — no animation words or token blocks after it; pnpm dev shows DevGate, not the sign-in page.
