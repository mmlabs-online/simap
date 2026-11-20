# SIM-022: Switch UI copy to English by default

| Field | Value |
|---|---|
| State | DONE |
| Priority | P1 |
| Size | S |
| Areas | ui |
| Gate | none |
| Depends on | SIM-003 |
| Needs Ming | — |
| Attempts | 1 |
| Created | 2026-11-20 |
| Claimed by | claude@2026-11-20T07:24:39Z |
| PR | — |

## Goal
Make every user-facing string English by default, kept in copy files, so the app matches D36 and a second language can
be added later without touching components.

## Scope reference
`docs/spec-v1.md` §8 Language; `work/decisions.md` D36 (English default, copy files), D40 (v1 English only), D39 (this
ticket follows SIM-003, which shipped Vietnamese copy).

## Scope
- Translate the copy SIM-003 shipped (shell, nav, page titles, empty states, theme toggle) to English.
- Make sure no user-facing literal lives in a component: all text comes from the copy files under `src/ui/` (or the
  location SIM-003 chose), one file per feature.
- Set `<html lang="en">` and the page titles/metadata in English.
- Update CLAUDE.md / `.claude/loop.config.md` "Domain focus" wording if they still say Vietnamese UI copy.

## Out of scope
- A language switcher or a Vietnamese translation (D40: after v1).
- Copy of features not built yet (each feature ticket writes English copy).

## Acceptance criteria
- [ ] Every string visible in the shell and the page skeletons is English.
- [ ] No user-facing text literal remains in `src/ui/**` or `src/app/**` components outside the copy files (a unit test
  or a check script enforces it, or the plan explains why not).
- [ ] `<html lang>` is `en`.
- [ ] Names containing Vietnamese diacritics still render correctly (font covers them).
- [ ] Checks green.

## Technical notes
- Files: SIM-003's copy files, `src/app/layout.tsx`, possibly `scripts/` for the literal check.
- Risks: keep the fonts SIM-003 chose able to render Vietnamese names.

## Test plan
- Unit: copy files export every key the shell uses (no missing key); literal check if added.
- Manual: open every page skeleton in light/dark.

## Notes / answers from Ming
- Plan approved (2026-11-20, batch 2026-11-20-2) — Ming: "duyệt hết … còn lại theo đề xuất": questions 10–15 take their defaults.

## Handoff
