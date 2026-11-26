# SIM-033: Ship the bundled art package and the in-app Credits page

| Field | Value |
|---|---|
| State | DONE |
| Priority | P1 |
| Size | S |
| Areas | ui, architecture |
| Gate | plan-approval |
| Depends on | SIM-015.3 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-22 |
| Claimed by | claude@2026-11-26T00:58:18Z |
| PR | — |

## Goal
Production shows the real sprites of the bundled package (the library behind the map item catalog, D66) instead of placeholders, and credits its authors as the licence requires.

## Scope reference
- D45 (Credits page), D54, D55, D58, D64, D66 (point 5: committing the packed atlas is allowed, Ming 2026-11-25); `assets/art/CREDITS.md`.

## Scope
- Commit the packed atlas of the licensed pack so the production build shows real sprites; placeholders stay for keys without a source.
- The package sprite list (used by the SIM-039.6 sprite browser) is exactly the bundled keys.
- An in-app Credits page listing each pack's author, source and licence from `assets/art/CREDITS.md`.

## Out of scope
- Per-item art choice and custom images (SIM-039.x).
- Recolouring or drawing new sprites (phase 2, D54).

## Acceptance criteria
- [ ] A production image shows the real art for every key that has a source, and placeholders for the rest.
- [ ] The packed atlas is committed to the repo (D66 point 5) and the pack's licence screenshot and credits row are in place.
- [ ] The Credits page shows the exact attribution text for every third-party pack in use.
- [ ] CI builds from the committed atlas without the original sheets.

## Technical notes
- M-9/M-10 are closed by D64/D66; delivery = commit the packed atlas. Check `Dockerfile`/`.dockerignore` only if the atlas path needs it (High path).
- Files: to be set by the plan.

## Test plan
- Unit: Credits data rendering.
- Manual: build the image and open a room map and the Credits page.

## Notes / answers from Ming
- 2026-11-26: M-63 done (Ming: "Đồng ý, làm luôn"): the real Imersa atlas is packed (55 map frames) and committed on this branch. Gate set to plan-approval (P1 policy `high-paths+P1`, matching the board).
- 2026-11-26: The repo is PUBLIC (gh repo view), contrary to D45/D60; CREDITS.md:16 also says public. Ming: "Anh sẽ chuyển repo sang private" (M-79). The atlas commit (4383539) was already pushed while the repo was public. The PR must not open until the repo is private.
- 2026-11-26: Ming: "ignore đi tôi chuyển private sau. hãy làm như thể repo đã private" — proceed as if the repo is private; M-79 stays open for Ming and does not block the PR.
Waiting for Ming: plan approval (High tier) — M-80 (filed as M-78; renumbered because main took M-77/M-78 for SIM-021). Repo-private item: M-79 (filed as M-77).
Plan approved (2026-11-26, Ming: "duyệt SIM-033" — assumptions A1–A8 as written).
- 2026-11-25: re-scoped to D66 (bundled package committed; per-item art moves to SIM-039.x).
- 2026-11-25: D64 replaces the single-pack plan (M-9/M-10 not needed). Re-scope this ticket before running it: Admins pick art per item from a bundled package or a custom image.
- 2026-11-22 (D58): created from the art review. Waits for M-10.

## Handoff

### 2026-11-26 — claude — BLOCKED
- Agent calls: 3, tokens ~100k+ (in/out split not reported): frontend-developer×1 41k, software-architect×1 59k, planner×1 (tokens not reported); all on default models.
- Done: M-63. The real atlas was packed on Ming's PC (55 map frames) and committed on this branch, with Ming's OK. Consult and plan are done: `Status: READY`, no High path, about 300 lines.
- In progress / next: Ming approves the plan (M-80), then `/run SIM-033` resumes at IMPLEMENT. M-79 (make the repo private) stays open; by Ming's instruction it does not block the PR.
- Gotchas: the repo is PUBLIC, although D45 and D60 say private. The atlas commit 4383539 was pushed while it was public. `committed-atlas.test.ts` "placeholder-only" fails on this branch until the plan's test change lands.
