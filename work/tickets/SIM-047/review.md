## Attempt 1 — 2026-11-26
Verdict: PASS

Slice A (storage, API, map). AC3 (picker, preview, Reset UI) is slice B, SIM-047.1, per the approved split; SIM-047.1
is on the board on `main` (BACKLOG). SIM-046 (`20261126130000`) is not on this branch by design; this PR must merge and
deploy after SIM-046's (plan Assumption 1).

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format." (903 files)
- `pnpm typecheck` — exit 0 (next typegen + tsc)
- `pnpm check:layers` — exit 0, "848 files, no violations"
- `pnpm test` — exit 0, Test Files 323 passed | 1 skipped (324); Tests 3237 passed | 9 skipped (3246). Re-run after the
  implementer's final test-file typing fix; matches impl-log.
- `pnpm build` — exit 0
- `pnpm migrate:smoke` (local `DATABASE_URL`, throwaway DB) — "migrate smoke ok"
- `pnpm schema:check` — "schema check ok"; section 12: 17 cases pass (null default, boundaries + null again, 15 refused
  shapes with 23514 `members_pixel_look_check`)
- `pnpm test:db` (twice) — 21 files, 325 tests passed both runs
- `pnpm migrate` not run on the local `simap` DB.

### Acceptance criteria
- [x] AC1 Migration forward-only, previous image keeps working, existing members keep the derived look — evidence:
  `db/migrations/20261126140000_members_pixel_look.sql` is one `add column pixel_look jsonb null` (no default, no
  backfill) + one named check; `members.ts` / `COLS` untouched (not in diff); schema:check "12 member without a look
  reads pixel_look null"; `pixel-look.test.ts › resolveLook ... fall back to avatarFor(seed)`; `layout.db.test.ts`
  literals now `look: null`.
- [x] AC2 One preset per layer, non-preset → 422 — evidence: `validate/pixel-look.test.ts` (3 tests),
  `pixel-look.test.ts › isPixelLook accepts every boundary / rejects ...`; `route.test.ts › PUT malformed JSON or a
  non-object -> 400 ...; non-preset -> 422 invalid_look; service not called`; DB backstop in schema:check section 12.
- [~] AC3 Live preview / Reset — slice B (SIM-047.1) by the approved split. Slice A parts verified: `DELETE` resets to
  null (`pixel-look.db.test.ts › ... reset writes one with look null`), `derivedChoice` round-trips to `avatarFor` for
  200 seeds incl. "" and Vietnamese text.
- [x] AC4 Map draws the stored look at the next layout load, for every viewer — evidence: `layout.ts:78,208`
  (`o.pixel_look` via the org-scoped left join at l.82, passed as `occupantLook`); `layout.db.test.ts › stored pixel
  look is returned for every viewer` (three viewers, dressed/plain/empty seats); `seat-view.test.ts`,
  `map-view.test.ts › look is parsed; a bad look becomes null; a missing look (old server) becomes null`;
  `placement.test.ts › stored look tints the avatar frames; null look uses avatarFor(seed)`.
- [x] AC5 Self only; every change audited; tests cover validation and fallback — evidence: route takes no member id,
  `route.test.ts › PUT valid -> service gets ctx.scope, ctx.sub and the look`; `pixel-look.db.test.ts` (5 tests:
  audit meta `{fields:["pixelLook"], self:true, look}`, no-op writes none, reset one row, deactivated 403 with no write,
  org isolation + unknown sub 404 with no audit row).

Ming verification after merge (not reviewer's; carry into the PR): after SIM-046 then SIM-047 deploy, `PUT
/api/me/pixel-look` as a member, reload a room map where that member sits from another account (new look drawn),
`DELETE` restores the old look; one `member.update` audit row per change.

### Issues
None.

### Rules (CLAUDE.md)
No violations found.
- R1: route is the only `src/server` entry; `src/lib/sprites/pixel-look.ts` and `src/lib/validate/pixel-look.ts` import
  lib only; `src/server/members/pixel-look.ts` starts with `import "server-only"`; check:layers clean.
- R2: expand-only nullable column, new file, no applied migration edited.
- R6: every statement through `orgQuery` with `org_id = $1 and sub = $2`; layout join `o.org_id = s.org_id`.
- R7: PUT order readJson → validate → pool → service; the only service 403 (`member_deactivated`) is returned under
  the row lock before the `update`, same precedent as `setOwnDisplayName` (`members.ts:98`); no 401/403 after a write.
- R4: every changed file is on the plan's file list; impl-log "Out-of-plan files: None" confirmed.
- R5: new logic has unit and DB tests.

### Blockers from review agents
None (to be filled by the orchestrator if `security-review.md` reports any).

### Nits (do not block)
- `src/server/members/pixel-look.ts:47-48` — the no-op check relies on jsonb equality; fine since the value is always
  `JSON.stringify` of a normalised 4-key object, just noting it ignores key order by design.
- `scripts/schema-check.mjs` section number 12 may need to become 13 when rebasing on SIM-046 (already in impl-log
  follow-ups).

### Follow-ups (out of scope)
- Spec wording "derived from `sub`" → "derived from the member id" (plan Assumption 2).
- SIM-047.1 slice B (Profile picker, preview, Reset) — already on the board.
- On rebase after SIM-046: keep both README bullets, both schema-check sections, both error codes / copy entries.
