## Attempt 1 — 2026-11-26

Base: rebased onto main with SIM-046.1 merged. Per plan A1 the merged code matches the plan: `ProfileTabView` has `sections?: ReactNode`, `ProfileTab` passed `sections={<ProfilePhoto name={load.name} />}`, copy is `portalCopy.profile.photo`. No difference to record, except the two small deviations below.

### Files touched
| File | Required because |
|---|---|
| `src/lib/identity/flow.ts` | AC3: `readMeResult` keeps `member.id` (string only) as the Reset seed |
| `src/lib/identity/flow.test.ts` | expectation now has `id: "m"`; new id-only-when-string case |
| `src/ui/portal/pixel-look-api.ts` (new) | GET/PUT/DELETE `/api/me/pixel-look` returning results |
| `src/ui/portal/pixel-look-state.ts` (new) | pure picker state, canSave/canReset, error mapping |
| `src/ui/portal/pixel-look-preview.ts` (new) | pure preview geometry from manifest anchors |
| `src/ui/portal/LookPreview.tsx` (new) | canvas painting via `tintedFrame` |
| `src/ui/portal/PixelLookPicker.tsx` (new) | pure view: previews, radio groups, Save/Reset, notices |
| `src/ui/portal/PixelLookSection.tsx` (new) | container: load, save, reset, `useAtlas` |
| `src/ui/portal/ProfileTab.tsx` | carries `memberId`, mounts the section after the photo in `sections` |
| `src/ui/copy/portal.ts` | `profile.character` copy (D36) |
| `src/ui/portal/pixel-look-api.test.ts`, `pixel-look-state.test.ts`, `pixel-look-preview.test.ts`, `PixelLookPicker.test.tsx` (new) | plan tests |

### Tests added / changed
- flow.test.ts › "readMeResult keeps a well-formed member and drops a malformed one" (now `id: "m"`); "readMeResult keeps member.id only when it is a string; a member without id is still kept"
- pixel-look-api.test.ts: 5 cases as planned
- pixel-look-state.test.ts: 10 cases as planned (bounds: -1, ramp length, style 0 and 4)
- pixel-look-preview.test.ts: 3 cases as planned
- PixelLookPicker.test.tsx: 7 cases as planned

### Checks (actual output summary)
- format:check: All matched files use the correct format.
- typecheck: exit=0
- check:layers: 892 files, no violations
- test: Test Files 341 passed | 1 skipped (342); Tests 3380 passed | 9 skipped (3389) (includes `no-photo-on-map.test.ts`, `no-literals.test.ts`)
- build: exit=0
- test:db: Test Files 22 passed (22); Tests 344 passed (344)

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- Deviations from the plan text: `LookPreview` has no `failed` prop (the plan said it renders nothing for it; the picker shows the one notice). `PixelLookSection` calls `useAtlas()` and passes `atlas.atlas` / `atlas.failed` to the picker.
- Live redraw and the canvas painting are code-read only (Vitest runs in node, no canvas); verify locally with `pnpm dev` per the plan.

### Scope self-check
- Could the diff be smaller? No; the planned files only, no extras.
- Diff size: about +640 new lines (incl. about 330 tests), +30 / -5 in modified files.
