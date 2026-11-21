# Review — SIM-007.3

## Attempt 1 — 2026-11-21
Verdict: PASS

### Checks (run by reviewer)
Local (WSL, HEAD `1ba72f8`, after `pnpm install --frozen-lockfile`):
- `pnpm format:check` — exit 0, "All matched files use the correct format" (229 files).
- `pnpm typecheck && pnpm check:layers` — exit 0 / exit 0, "check-layers: 202 files, no violations".
- `pnpm test` — exit 0, 72 files, 711 tests passed (matches impl-log). Targeted run of `flow.test.ts`, `profile-form.test.ts`, `profile-views.test.tsx`: 3 files, 41 tests passed.
- `pnpm build` — exit 0.
- `pnpm test:db` (CI-only) — CI run 44779918383 (`ci` workflow, draft PR #26, headSha `1ba72f89350631de93890513a6f6487f8b647e6d` = branch HEAD): conclusion success; steps typecheck, check:layers, test, "db integration tests", format:check, build, standalone server check all success; `image` job success. `risk-tier` run 44779918440 success.

### Acceptance criteria
Plan verification table:
- [x] 1 Display name required on first visit (`needsProfile: true` → profile screen, not the app) — evidence: `src/lib/identity/flow.ts:65-72` (`viewForMe` returns `profile`), `src/ui/auth/AuthGate.tsx:243-246` (apply case) and the `profile` render case (only `ready` renders children); tests `flow.test.ts` › "viewForMe: needsProfile true -> profile view carrying tier, email, displayName", "viewForMe: needsProfile false or member absent -> ready" — pass.
- [x] 2 Prefilled with the server default — evidence: `ProfileView` `useState(initialName)` fed from `member.displayName`; `profile-views.test.tsx` › "prefilled value, label, autocomplete nickname, maxlength 80, required" (also checks HTML escaping of `<b>`); `flow.test.ts` › "readMeResult keeps a well-formed member and drops a malformed one" — pass.
- [x] 3 Required, visible error, client validation via `normalizeDisplayName` — evidence: `src/ui/org/profile-form.ts:10-14`; `profile-form.test.ts` › "rejects blank, whitespace-only, ZWJ/control chars, 81 code points; accepts 80" (verified the source really contains U+200D and U+0007); `profile-views.test.tsx` › "shows error text with role alert and aria-invalid; submitting state disables the button" — pass.
- [x] 4 Stored in NFC — evidence: `profile-form.test.ts` › "Vietnamese name: NFD `Nguyễn Văn An` returns NFC…" (verified the literal is NFD bytes: `e 314 202 314 203`); the submitted value is `check.value` from `normalizeDisplayName` (`ProfileView.tsx` submit → `profilePatchInit`); server NFC already on main (`validateMePatch`).
- [x] 5 Submit does `PATCH /api/me`; success enters the app; failure keeps the screen and entered value with a message — evidence: `AuthGate.tsx` `saveProfile` (busy guard, `++seq`, stale-epoch check, saved → `readMeResult` → `viewForMe` → `apply`, access → `meErrorView`, else sets `error` on the existing profile view so `ProfileView` stays mounted and keeps its state); `profile-form.test.ts` › "200 + needsProfile false -> saved; 200 + needsProfile true -> retry", "400 -> invalid; 503 -> retry; a thrown network error -> retry; ApiAccessError -> access", "the saved response body stays readable" — pass. The plan's "manual local run in impl-log" was not done (impl-log Follow-ups: needs Identity and DB); see Nits — covered by the Ming check below.
- [x] 6 Copy follows SIM-022 — evidence: all strings in `src/ui/copy/profile.ts`, English, no diacritics; `no-literals` / copy tests green in the full run.
- [x] 7 All loop checks green — see Checks.

Ming verification after merge (not verified here; carry into the PR):
- Sign in to a real org with a never-seen account: the profile screen appears with the email local part prefilled, saving enters the app, a reload does not show it again.

### Issues
None blocking.

Deviations from the plan (impl-log), judged against the plan's intent:
- `FilledInput` + own `<label htmlFor>` instead of `Field`: accepted — `Field` does not pass `maxLength`/`required`, and editing `fields.tsx` would leave the file list. Label/id association, `aria-invalid`, `aria-describedby` are all present.
- Client validation inside `ProfileView` (local state); gate only carries server errors: accepted — keeps the typed value on failure, matches AC3/AC5.
- `mapPatchResult` async and reads a clone of the 200 body; `saveProfile` reuses the original response: accepted (plan default 2, no extra GET); test covers that the body stays readable.
- Gate `profile` view drops `tier`: harmless, `viewForMe` recomputes the tier on save.

### Scope
Changed files: `flow.ts`, `flow.test.ts`, `AuthGate.tsx`, `copy/profile.ts`, `ProfileView.tsx`, `profile-form.ts`, `profile-form.test.ts`, `profile-views.test.tsx` — all in the plan's file list; plus ticket workflow files. No High path, no `src/server/**`, no `db/**`. Org code (`enterOrg`, `selectAndCheck`, switcher) unchanged, as planned.

### Rules (CLAUDE.md)
No violations found. R1: `src/ui/org/*` imports only `@/lib/*` and `../` UI modules (`check:layers` clean). R3/R6/R2: not touched. R4: within plan. R5: checks green, new logic tested.

### Blockers from review agents
None: `security-review.md` Attempt 1 has 0 🔴 (1 🟡 → follow-up, fix before go-live: `AuthError` from the token mint during PATCH shows inline retry instead of gate routing).
<Filled by the orchestrator. Note: `src/ui/auth/AuthGate.tsx` may match the `**/auth*` trigger of `security-ai-generated-code-auditor`.>

### Nits (do not block)
- `src/ui/copy/profile.ts` `errors.invalid` says "Use letters or numbers", but `normalizeDisplayName` also accepts symbols and punctuation; the real refusals are invisible/control characters and length. Wording to polish with Ming's copy pass (plan default 5).
- `maxLength={80}` on the input counts UTF-16 code units, the validator counts code points: names with astral characters (emoji) are capped earlier in the browser than on the server. More restrictive, no data loss.
- `saveProfile` wiring in `AuthGate.tsx` has no direct test (the gate has no component tests); the manual local run the plan named was deferred to Ming's post-merge check.

### Follow-ups (out of scope)
- Display name in the session/shell (avatar/name), as noted in the plan and impl-log.
