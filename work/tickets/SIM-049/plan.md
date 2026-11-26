Status: READY

# Plan — SIM-049: Wall clock and projector screen face only north or south

**High paths: none touched.** No file below matches `loop.config.md` High paths (no migration, no auth/config, no deploy files). Gate `none`, so no plan approval is needed.

**Local env for the implementer:** Node/pnpm are not on PATH. In PowerShell run
`$fnm = Get-ChildItem "C:\Users\ttngo\AppData\Local\Microsoft\WinGet\Packages\Schniz.fnm_Microsoft.Winget.Source_8wekyb3d8bbwe" -Filter fnm.exe -Recurse | Select-Object -First 1 -ExpandProperty FullName; & $fnm env --shell powershell | Out-String | Invoke-Expression; & $fnm use 22`,
then `cmd /c "pnpm ..."`. Local Postgres: `docker compose -f compose.dev.yml up -d`, `DATABASE_URL=postgres://simap@127.0.0.1:5432/simap`. Imersa sheets are present locally.

## Scope summary
Ticket scope: "`clock.wall` and `screen.projector` accept only rotations 0° (s) and 180° (n). The other four SIM-042 items keep all four directions." Editor rotate toggles s and n; validator refuses 90/270 with the existing `layout_bad_rotation` (422, before any write); "Map items" art lists only n and s; "Atlas and sprite map: e/w frames ... are dropped or no longer used, whichever the plan picks; the registry tests and the committed atlas test still pass." Out of scope: other items, migration (footprints at 0° unchanged). Amends D73 / SIM-042 A7 per Ming 2026-11-26.

### Decision: per-key allowed-rotations rule (keep the e/w keys) — not removing the e/w keys
Chosen: **keep `clock.wall.e/.w` and `screen.projector.e/.w` in `keys.json`, `sprite-map.json` and the atlas; add one pure rule "n/s only" for the two base keys.** Why:
- Removing the e/w keys changes the registry invariant (`scripts/sprites/registry.test.ts` "every directional group has exactly n/e/s/w"), needs `keys.json` edits, `sprite-map.json` edits, a repacked committed atlas (`public/sprites/office.png/json`, binary churn; every frame after the removed ones can move), and it still would not stop the editor/art dialog by itself: `rotateItems` would step 0->90 and fail, `artDirs` would still list 4 directions. So the rule is needed anyway; removing keys only adds churn and risk to the build/atlas tests.
- Keeping the keys: zero atlas/registry/sprite-map changes, the registry and atlas tests pass untouched, the e/w frames are simply never reachable (unused). Reversible later if Ming changes his mind (just edit the rule). Cost: ~4 unused frames in the atlas, acceptable.
- Server refusal is explicit instead of a side effect of a missing frame, so the code stays `layout_bad_rotation` (not `layout_unknown_sprite`, which `checkLayoutBasics` would return for a missing frame).

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | In the editor, placing and rotating `clock.wall` or `screen.projector` only ever gives s or n | `draft.test.ts` › "rotateItems toggles clock.wall and screen.projector between 0 and 180"; `place-tool` check (see Approach step 4); manual in `/dev/roommap` or editor: R twice returns to start, never e/w |
| 2 | Saving 90/270 for the two keys is refused with 422 `layout_bad_rotation`, nothing written; 0/180 save and read back | `layout.test.ts` › "n/s-only items refuse 90 and 270 with layout_bad_rotation, accept 0 and 180"; `layout.db.test.ts` › "a 180° clock.wall and screen.projector save and read back" and "90° is refused 422 and nothing is written" (run `pnpm test:db` locally; CI runs it) |
| 3 | "Map items" art per direction lists only n and s for the two items | `map-item-art.test.ts` › "artDirs lists n and s for clock.wall and screen.projector"; `art.test.ts` › "artDirAllowed refuses e/w for n/s-only items" (server `edit.ts`/`image.ts` refuse e/w art with 422 `not_allowed` through this); `MapItemArtDialog.test.tsx` renders two panels (North, South) |
| 4 | `bin.trash`, `chart.flip`, `cooler.water`, `lamp.desk` still accept all four directions | `layout.test.ts` › "other SIM-042 items accept 0/90/180/270"; `artDirs` test for those keys returns n,e,s,w |
| 5 | All Checks pass (including `test:db` in CI) | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`; `pnpm test:db` locally and in CI |

## Ming verification after merge
None (the manual editor check is doable by the reviewer locally). Optional: look at the two items in the editor after the next deploy.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/sprites/rotations.ts` (new) | Pure rule, no imports from validate/map-items: `const NS_ONLY = new Set(["clock.wall","screen.projector"])`; `allowedRotations(base): readonly Rotation[]` (`[0,180]` for NS_ONLY, else `[0,90,180,270]`; callers only use it for directional keys); `allowedDirs(base): readonly Direction[]` (`["n","s"]` or `["n","e","s","w"]`); `rotationAllowed(base, rotation)`; `nextRotation(base, rotation)` (NS_ONLY: 0<->180; else 0->90->180->270->0) | One shared source for validator, editor and art dirs; `src/lib/**` is pure code, importable from every layer | No |
| `src/lib/sprites/rotations.test.ts` (new) | Unit tests of the rule | R5 new logic has tests | No |
| `src/lib/validate/layout.ts` (lines ~175-180, `checkGridSpritesRotations`) | After the `ROTATIONS`/directional checks, also `return fail("layout_bad_rotation")` when `!rotationAllowed(item.sprite, item.rotation)`. Runs before bounds/overlap and before any write (R7: refusal is a domain 422 from the validator, not an auth code) | Server-side refusal | No |
| `src/lib/validate/layout.test.ts` | Add cases (existing clock/screen cases at 9 occurrences; keep the ones at 0/180, change any that use 90/270 for these keys) | Criteria 2, 4 | No |
| `src/lib/layout-editor/draft.ts` (line 14 `NEXT_ROTATION`, line 188 in `rotateItems`) | Use `nextRotation(sprite, rotation)` instead of `NEXT_ROTATION[i.rotation]` for turnable items; keep the `NEXT_ROTATION` constant only if still used elsewhere (grep; otherwise drop it) | Criterion 1 | No |
| `src/lib/layout-editor/draft.test.ts` | Rotate toggle test for both keys and four-step test for `bin.trash` | Criteria 1, 4 | No |
| `src/lib/map-items/art.ts` (line 18 `artDirAllowed`) | Change param to `Pick<LibraryItem,"directional"\|"builtinKey">`; `item.directional ? allowedDirs(item.builtinKey).includes(dir) : dir === "s"`. Callers in `src/server/map-items/edit.ts:237`, `image.ts:70,142` already pass a full `LibraryItem` (verify types, no edits expected) | Server refuses e/w art for the two items | No |
| `src/lib/map-items/art.test.ts` | New `artDirAllowed` cases | Criterion 3 | No |
| `src/ui/mapItems/map-item-art.ts` (line 10 `artDirs`) | Param `Pick<MapItemDto,"directional"\|"builtinKey">`; return `item.directional ? allowedDirs(item.builtinKey) : ["s"]`. `thumbDir`, `thumbSprite`, `artImageEntries`, `isCustomised` already go through `artDirs`, so e/w are ignored there too | UI list of directions | No |
| `src/ui/mapItems/map-item-art.test.ts` (lines ~28-35) | Add expectations for the two keys (`["n","s"]`) and one of the four-way keys; the `chair.office` line passes only `{directional}`: update it to pass `builtinKey` too | Criterion 3 | No |
| `src/ui/mapItems/MapItemArtDialog.test.tsx` | Add: n/s-only item renders two panels, legends North and South | Criterion 3 | No |
| `src/server/layout/layout.db.test.ts` | Add the 180°-saves-and-reads-back and 90°-refused-nothing-written cases | Criteria 2, 5 | No |

Not touched on purpose: `src/lib/sprites/keys.json`, `assets/art/sprite-map.json`, `public/sprites/office.*`, `scripts/sprites/registry.test.ts`, `scripts/sprites/placeholders.mjs`, migrations.

## Data model / migration
None. Catalog rows are per base key; 0° footprints are unchanged (screen 2x1, clock 1x1).

## API contract
| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| (existing) layout save | unchanged | unchanged | unchanged | 422 `layout_bad_rotation` now also for 90/270 on `clock.wall` / `screen.projector` | unchanged |
| (existing) map item art/image | unchanged | unchanged | unchanged | 422 `not_allowed` now also for e/w art of the two items | unchanged |

No route handler changes; the validators live in `src/lib` and are called before writes.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/lib/sprites/rotations.test.ts` › "allowedRotations is 0/180 for clock.wall and screen.projector, all four for others" | Rule |
| same › "nextRotation toggles 0<->180 for n/s-only, cycles four for others" | Rule |
| same › "allowedDirs is n,s for the two keys, n,e,s,w otherwise" | Rule |
| `src/lib/validate/layout.test.ts` › "n/s-only items refuse 90 and 270 with layout_bad_rotation, accept 0 and 180" | Criterion 2 (both keys, as seat/fixture lists) |
| same › "bin.trash, chart.flip, cooler.water, lamp.desk accept 0/90/180/270" | Criterion 4 |
| `src/lib/layout-editor/draft.test.ts` › "rotateItems toggles clock.wall and screen.projector between s and n" | Criterion 1 |
| same › "rotateItems still cycles four directions for bin.trash" | Criterion 4 |
| `src/lib/map-items/art.test.ts` › "artDirAllowed refuses e and w for n/s-only items" | Criterion 3 server side |
| `src/ui/mapItems/map-item-art.test.ts` › "artDirs for clock.wall and screen.projector is n,s" | Criterion 3 |
| `src/ui/mapItems/MapItemArtDialog.test.tsx` › "an n/s-only item renders two panels, North and South" | Criterion 3 |
| `src/server/layout/layout.db.test.ts` › "180° clock.wall and screen.projector save and read back" / "90° is refused 422 layout_bad_rotation, nothing written" | Criteria 2, 5 (DB) |

Edge cases: a mixed layout with one valid and one 90° item is refused whole; a rotation not in {0,90,180,270} still gives `layout_bad_rotation`; a non-directional key at 180 is still refused as before.

## Approach
1. Add `src/lib/sprites/rotations.ts` (+ test). Keys are base keys (no `.n/.s` suffix), matching `SPRITES` in the validator. Type `Rotation` from `src/lib/sprites/layout.ts`, `Direction` from `types.ts`.
2. Validator: one extra `rotationAllowed` check inside `checkGridSpritesRotations` (keeps the fixed failure order: grid, sprite, rotation, ...). Tests.
3. Editor: `rotateItems` uses `nextRotation`. Multi-select with mixed items works because it is per item.
4. Check `src/lib/layout-editor/place-tool.ts` and any hotkey/palette code for a rotation-on-place state (grep `rotation` showed 1 hit in place-tool, 3 in palette): if a new item is placed with a preset rotation other than 0, it must go through `rotationAllowed`; if placement is always 0, no change. Record the finding in impl-log.
5. Map items: `artDirAllowed` and `artDirs` read `allowedDirs`. Update the existing tests that build items with only `{directional}`.
6. Existing data: SIM-042 is merged but not released (latest tag `v0.1.9`), so no production layout holds these items at 90/270 and no read-side fallback is added. Merge before the release that ships SIM-042. If it ships first, a follow-up must read 90/270 as 0/180 (note in Assumptions).
7. Run all Checks and `pnpm test:db` locally. Rules: R1 (the new module is `src/lib`, imported via `@/`; run `pnpm check:layers`), R4 (stay in the file list), R5 (tests above), R7 (refusal is a domain 422 in validation before writes).

## Specialist input used
None (Size S, Gate none, fast lane skips consult). Prior context read: SIM-042 plan/impl-log/consult for how keys reach registry, palette, validator, Map items art and atlas; the decision above follows that every consumer already derives from `REGISTRY` dir suffixes and library `directional`.

## Assumptions
- Hotspots: `src/lib/validate/layout.ts`, `src/lib/layout-editor/draft.ts`, `src/lib/map-items/art.ts`, `src/ui/mapItems/map-item-art.ts` and `layout.db.test.ts` were edited by SIM-042 (merged, in `main`). SIM-045 (`IN_PROGRESS` per the board commit) may also touch the layout editor or map-items files; expect a possible rebase.
- The e/w frames remain in the atlas, unused (placeholders keep generating them). Not a problem for `registry.test.ts` and the committed-atlas test, which are unchanged.
- No per-org stored art for e/w of these items exists (feature unreleased); if one existed, it would stay in the DB, ignored by the UI (`artDirs`). No cleanup is planned.
- If SIM-042 is released before this ticket merges, add a follow-up for reading 90/270 layouts of these keys as 0/180.
- `artDirs` signature change may need `builtinKey` in the test fixtures (`dto(...)` helper in `map-item-art.test.ts` probably already has it; verify).

## Blocking questions
None.

## Split proposal
None. Estimated diff well under 400 lines (mostly tests).
