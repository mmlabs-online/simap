## Attempt 1 — 2026-11-25
Verdict: REWORK

### Checks (run by reviewer)
- `pnpm typecheck` — exit 0, "Types generated successfully", tsc no errors.
- `pnpm check:layers` — exit 0, "check-layers: 796 files, no violations".
- `pnpm format:check` — exit 0, "All matched files use the correct format." (850 files).
- `pnpm test` — exit 0, "Test Files 302 passed | 1 skipped (303)", "Tests 3051 passed | 7 skipped (3058)". Matches impl-log.
- `pnpm build` — exit 0, route table printed (impl-log said "not run"; I ran it).
- `pnpm test:db` — not run locally. No server, SQL or migration file changed (A14), so CI's run covers it.

### Acceptance criteria
- [x] AC1, part 1: every art action is reachable and its errors map to map-item copy. Evidence: `map-items-api.test.ts` › "putArt …", "putArt(null) …", "putImage …", "deleteImage …", "ApiAccessError on an art write …". `MapItemArtDialog.test.tsx` › "a panel offers Choose package sprite, Upload image, Use library sprite …". `map-item-image.test.ts` › "artErrorMessage …" (x2) and "artOutcome …". `MapItemArtDialog.test.tsx` › "an error shows as role=alert inside its own direction panel only". All pass.
- [ ] AC1, part 2: the stateful dialog behaves as the plan says. FAILED, see Issues 1-3. This wiring has no unit tests (no DOM), so I read the code. The local `pnpm dev` click-through in the AC1 row was not possible here because there is no Identity token or DB in this environment. Ming's post-merge checks cover that run.
- [x] AC2: images never rotate, and a non-directional item offers only `s`. Evidence: `map-item-art.test.ts` › "artDirs …" and "artImageEntries … never makes an entry for a direction the item does not allow". `MapItemArtDialog.test.tsx` › "a non-directional item renders one panel and no direction legends" and "no copy-to-other-directions control is rendered". The `putImage` URL test shows that only the panel's own `{key, dir}` is used.
- [x] AC3: checks are green. See Checks.

### Size and deviations
- Product lines: dialog 301, browser 91, image 84, art 78, copy 55, hook 48, view +44/-10, page +26/-2, api +26. That is about 750 lines against the ~480 estimate. The overrun is justified. Most of it is the dialog (301 against 160). That covers the native `<dialog>` shell (open, Esc, scrim and focus return, about 70 lines, copied in form from `EntityFormDialog.tsx` as A3 says), the 1× and 2× `<figure>` previews, the hidden file inputs, and oxfmt's wrapping of JSX attributes. I found no feature beyond the plan: no atlas, no filter, no confirm, no copy-to-directions control. R4 is not broken.
- The listed deviations are acceptable. `artOutcome(result, item, dir)` needs the item and direction for the server-side `image_bad_size` text. The extra `status` and `chooseRefs` props and the dropped `busyDir` prop are internal API only. The method/object type forms are lint-driven. "Saved for Art" is consistent with A4.
- The impl-log does **not** list two deviations: Issue 1 (`not_found` does not reload) and Issue 2 (the dialog is hidden instead of closed when its item leaves the list).

### Issues
#### Issue 1 — 🟡 should-fix — plan deviation (not_found)
- **Where**: `src/ui/mapItems/MapItemArtDialog.tsx:211`. The page's `close` is at `src/ui/mapItems/MapItemsPage.tsx:44`.
- **Expected**: Plan Approach step 5.3 says "`gone`: call `onGone` (close and reload)". The UX input adopted "`not_found` closes the dialog and reloads".
- **Actual**: `if (out.kind === "gone") return onClose();`. The page's `close` only sets `{kind:"none"}`. The list is not reloaded, so the stale row stays and the Art button reopens the same dead item.
- **Fix instruction**: On `gone`, call `void onReload()` before `onClose()`, or pass an `onGone` from the page that does `close(); void items.reload();` (the page's existing `done` already does exactly that, l.45-48). Note the change in impl-log.

#### Issue 2 — 🔴 blocker — the dialog reappears after a failed reload (A5)
- **Where**: `src/ui/mapItems/MapItemsPage.tsx:50-51, 76`.
- **Expected**: A5, approved by Ming, says: "If the reload itself fails, the list shows its error and the dialog closes, because the item is no longer in the list." Plan step 7 says the dialog "closes otherwise".
- **Actual**: When `items.reload()` fails, `useList` sets `items: []`, so `artItem` is `undefined` and the dialog unmounts. But the `dialog` state stays `{kind:"art", key}`. When the Admin then presses Retry on the list error and the list loads, `artItem` is found again. The art dialog then pops open by itself (`showModal` on mount, `MapItemArtDialog.tsx:193-202`), which nobody asked for. The same happens for any reload where the key is briefly missing.
- **Fix instruction**: Close the dialog for real when its item is gone. One way is an effect in `MapItemsLoaded`: `useEffect(() => { if (dialog.kind === "art" && !artItem) setDialog({ kind: "none" }); }, [dialog, artItem]);`. Another is to compute this in the reload path. Keep the render guard.

#### Issue 3 — 🔴 blocker — focus is lost after "Use this sprite" (plan step 6)
- **Where**: `src/ui/mapItems/MapItemArtDialog.tsx:214-221`.
- **Expected**: Plan step 6 says: "On Cancel or a successful save, the browser closes and focus returns to that panel's 'Choose package sprite' button."
- **Actual**: `chooseRefs.current[dir]?.focus()` runs after `await onReload()` but before `setBusy(false)`. React batches state updates after an `await`, so at that moment the DOM still shows the busy render. The Choose button has `disabled` (l.99), and `focus()` on a disabled button does nothing. The "Use this sprite" button that had focus is then unmounted. Keyboard and screen-reader users end up on `<body>` inside the modal. Cancel (l.279-283) works because nothing is busy there.
- **Fix instruction**: Move the focus to after the re-render in which `busy` is false and the browser is closed. For example, keep a `focusDir` state (or ref) that is set on success, plus a `useEffect(() => { if (!busy && focusDir) { chooseRefs.current[focusDir]?.focus(); setFocusDir(null); } }, [busy, focusDir])`. Or call `setBusy(false)` first and wrap the close in `flushSync` before `focus()`. Do not leave the focus call where it is now.

#### Issue 4 — 🟡 should-fix — the non-directional size error says "South"
- **Where**: `src/ui/mapItems/map-item-image.ts:226`, reached from `MapItemArtDialog.tsx:210, 228`.
- **Expected**: For a non-directional item, the panel's legend is "Art" (A4), and the status line already uses `name(dir)` and says "Saved for Art" (l.204).
- **Actual**: `artErrorMessage` always uses `copy.dirs[dir]`, so a plant's wrong-size upload says "South needs 32 × 64 px …" inside a panel labelled "Art". The impl-log lists this as a follow-up, but it is in this ticket's own copy and the fix is a few lines.
- **Fix instruction**: Add `directional` to `ArtItem` (`Pick<MapItemDto, "kind" | "w" | "h" | "directional">`) and use `copy.single` when `!item.directional`. Extend the `artErrorMessage` test with one non-directional case.

### Code review notes (no issue)
- Blob URLs (`useMapItemImages.ts`): one cache per page, disposed on unmount (l.21-38). After an upload, the reload gives the new `imageVersion`. On that render, `cache.url` returns null for the mismatched version, so no stale or revoked URL is shown ("Preview not available" flashes). Then `sync` revokes the old URL and loads the new one. After a remove, `hasImage:false` gives null before `sync` drops and revokes. I found no use-after-revoke.
- Effect deps: `[api]` for the cache, `[cache, entries]` for sync, and `entries` is memoised on `items` (whose identity changes only on reload). The `useCallback([cache])` identity is stable, but `bump` re-renders `MapItemsLoaded`, so the rows and the dialog pick up new URLs. This is correct.
- Error mapping by direction: errors are keyed by `dir`, and `run` clears only that dir (l.207). Precheck failures stay inline and send nothing (l.225-230). `image_changed` shows the message and reloads. Other codes go to `mapItemErrorMessage`, so the device-type size copy is never used. `call` never throws (`map-items-api.ts:27-47`), so `busy` cannot get stuck.

### Rules (CLAUDE.md)
No violations found.
- R1: ui imports only ui and `@/lib/**`. `check:layers` is clean.
- D36: all strings are in `src/ui/copy/mapItems.ts`. The only literal `${w} × ${h}` (`SpriteBrowser.tsx:64`) matches the existing row badge pattern.
- R4: every file is in the plan's file list. `work/ming-todo.md` and `ticket.md` are workflow edits.
- R5: the checks are green and the pure logic has tests. The hook and dialog wiring are untested as the plan allows, which is why Issues 2-3 were found by reading.
- R3, R7, R2, R6: not affected.

### Blockers from review agents
None.

### Nits (do not block)
- `MapItemArtBody` is called "pure" but holds a `useRef` for the file inputs (l.38). Either is fine. The comment could say "stateless".
- `copy.dirs` is typed `Record<string, string>`, which forces `!` at each use. `Record<Direction, string>` would remove them.

### Follow-ups (out of scope)
- `useMapItems.ts` is dead code (A13).
- SIM-039.10: atlas previews for package and library art.
