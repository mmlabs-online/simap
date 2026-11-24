## Attempt 1 — 2026-11-23
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format" (467 files)
- `pnpm typecheck` — exit 0 (next typegen + tsc --noEmit)
- `pnpm check:layers` — exit 0, "413 files, no violations"
- `pnpm test` — exit 0, 166 files, 1777 passed, 3 skipped (1780); matches impl-log
- `pnpm build` — exit 0
- `pnpm test:db` — not run (CI-only; no server, route or SQL change in the diff)

### Acceptance criteria
- [x] AC1 New desk gets the server's `<room>-NN` code, named "New desk" before Save — evidence: `save-run.test.ts` › "created seats map by ascending seq onto new desks in add order … (Phòng-A-06, Phòng-A-07 after a gap at 04)" and "deletes, then creates, then PUT …"; `editor-state.test.ts:508` "saveDone after desk add …"; `LayoutEditorViews.test.tsx:279` "new desk is named New desk …"; codes only come from `assignCreatedSeats` (`save-plan.ts:40-58`), the editor never invents one. Real numbering: Ming verification 1.
- [x] AC2 Occupied seat delete refused with SEA-01 message, desk back, no POST/PUT — evidence: `save-run.test.ts:159` and `:182` (map and tray restore, call log has no add/put); `save-run.ts:74-79`; `editor-state.test.ts:469` "saveFailed with progress …"; `LayoutEditorViews.test.tsx:315` banner names Phòng-A-02 and where the desk is back, no button.
- [x] AC3 Save sequence tests with a fake seats API (order, chunks of 50, partial failure per stage, 404 as done, retry without duplicates, never throws) — evidence: `save-run.test.ts` 13 tests (`:95`-`:311`); retry test `:266` asserts each retry sends only the remaining calls and `f.created()` is 2.
- [x] AC4 Palette "Desks" / "New desk", desk tool stays armed, seat limit refused — evidence: `place-tool.test.ts` desk tests, `palette.test.ts` editorPalette, `LayoutEditorViews.test.tsx:155`, `:359`; `place-tool.ts` desk branch (seat items + tray >= `LAYOUT_LIMITS.seats`).
- [x] AC5 Delete of seats: existing to `removed`, new dropped, one undo step, no network on undo; Inspector Delete enabled with note — evidence: `editor-state.test.ts:104`; `EditorInspector.tsx` (`hasSavedSeat`, `deleteSeatNote`); reducer `delete` only calls `deleteItems` (no API).
- [x] AC6 Save not blocked by pending seats; invalid payload still refused with no calls — evidence: `editor-state.test.ts:175`, `:156`; `savePayload` uses `withPlaceholderSeatIds` (`save-plan.ts:109-119`), tested in `save-plan.test.ts`.
- [x] AC7 R1 layers and all checks green — evidence: Checks above; lib files import only `@/lib/**` and `./*`; `src/ui/copy/roomlayout.ts` imports a lib type (ui → lib allowed).

Ming verification after merge (carry to the PR): plan.md items 1-5 (real counter numbering with a gap, occupied-seat 409 flow, no network for unsaved-desk delete and undo, offline partial-failure retry, leave dialog during Save).

### Save runner review (partial failure, retry, R7)
- DELETE ok or 404: seat leaves `removed` and the baseline (`dropSeat`), so a retry never re-sends it; a lost DELETE response retried later gets 404 and counts as done. Correct.
- DELETE 409: seat restored (map or tray), run stops before POST/PUT; later seats stay in `removed` for the next Save (A1). A tray restore blocks Save as `unplaced` until placed (A2). Correct.
- DELETE other code: seat kept in `removed`, stop. Correct.
- POST chunk ok: that chunk's desks become `s:<id>` with real ids in the draft; a later failure keeps them, so the retry only POSTs the remaining `n:` desks. Baseline does not get the created seats, so the draft stays dirty and the retry PUT places them. Correct.
- Count mismatch: `seats_unmatched` is a conflict (Save off, Reload), so no duplicate POST from a retry. Correct.
- PUT failure after creates: created ids kept, `removed` empty; retry sends only the PUT; a lost-but-applied PUT retried gets `layout_stale` (conflict). Correct.
- `reset` (deleted + created > 0) clears undo history so an undo cannot resurrect a deleted seat or drop a created one into a duplicate POST (`editor-state.ts` saveFailed). Correct.
- try/catch: a throwing API resolves to `failed internal` with progress so far (test `:301`); `inFlight` is released in `finally`.
- R7: no route handler changed. The runner does not retry; `apiFetch`'s single re-send on 401/403 cannot repeat an applied write because auth codes come only from the wrapper before side effects; the one re-send risk (DELETE) is covered by 404 = done.

### Issues
None.

### Rules (CLAUDE.md)
No violations found. R1 (check:layers green), R2/R3/R6/R7 untouched (no server, SQL or env change), R4 (all changed source files are in the plan's file list; `work/ming-todo.md` M-30 and the ticket files are workflow records), R5 (runner, reducer, tool, palette, error-kind and view tests added; checks green).

### Blockers from review agents
None.

### Nits (do not block)
- 💭 Delete-only partial save: if all DELETEs succeed and the PUT then fails with a retryable code while there are no other edits, the draft equals the new baseline (dirty false, nothing left to send, which is correct), but the banner still offers "Try again", which is a no-op because `save()` returns on `!flags.canSave` (`LayoutEditor.tsx:63`). The banner could clear or hide the button when nothing is dirty.
- 💭 For stage `assign`, `saveDetail` counts only the earlier chunks in "N new seats were created."; the unmatched chunk's seats also exist. The `seats_unmatched` message covers it, so wording only.

### Follow-ups (out of scope)
- POST is not idempotent: if the network drops after the server applied a POST (client sees `unavailable`), the retry creates a second batch. The server's set-equality check makes the next PUT fail with `layout_seats_changed` (conflict → Reload, extras in Seats not placed), so nothing is silently misplaced, but orphan seats remain and Ming verification 4's "no duplicate seats" only holds when the request never reached the server. Consider an idempotency key on `POST /api/rooms/{id}/seats` or a seat re-fetch after an `unavailable` create.
