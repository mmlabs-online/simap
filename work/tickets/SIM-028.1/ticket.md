# SIM-028.1: Browser dev-token mode (AuthGate skips Identity under `pnpm dev`)

| Field | Value |
|---|---|
| State | MERGED |
| Priority | P1 |
| Size | M |
| Areas | ui, security |
| Gate | plan-approval |
| Depends on | SIM-028 |
| Needs Ming | — |
| Attempts | 3 |
| Created | 2026-11-21 |
| Claimed by | — |
| PR | https://github.com/mmlabs-online/simap/pull/33 (merged), https://github.com/mmlabs-online/simap/pull/34 |

## Goal
Under `pnpm dev` (dev-token mode from SIM-028) the browser opens simap signed in and never calls mmlabs Identity, so
local development works without CORS.

## Scope reference
- D56; SIM-028 plan `## Split proposal` (slice 2) and its Decisions B and F, approved by Ming 2026-11-21.
- SIM-028 ticket AC1 (browser half) and AC2 (client-bundle half).
- D2 (Vitest, no jsdom), D36 (UI copy in `src/ui/copy/`).

## Scope
- `AuthGate` renders a lazy `DevGate` only when `process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_SIMAP_DEV_TOKEN === "1"`; the Identity gate is otherwise unchanged.
- `DevGate`: never builds the Identity runtime; `/api/me` through a dev `apiFetch` (no `Authorization`, one send);
  maps the result to ready / profile / no-access / retry / `DevTokenView` (token invalid → `pnpm dev:token`; no org →
  `pnpm dev:token --org <uuid>`), each with "Check again"; a 401 mid-session flips to token-invalid.
- Session `devToken` flag and an amber "Dev token" badge in the shell; sign-out and org switch hidden.
- `ProfileView` / `NoAccessView` `onSignOut` optional.
- `pnpm check:dev-bundle`: after `pnpm build`, fails if `.next/static/**` contains dev-token strings.

## Out of scope
- Server side, token script and launcher (SIM-028). Org switching on a dev token. Adding `check:dev-bundle` to CI
  (follow-up for the workflow owner).

## Acceptance criteria
- [ ] With a valid scoped token file, `pnpm dev` + `http://localhost:3000` shows the app signed in, and the browser
      network log has no request to `api.mmlabs.online`.
- [ ] Missing / expired token → `DevTokenView` naming `pnpm dev:token`; unscoped token → the `--org` hint; "Check again"
      recovers after re-running the script without restarting `pnpm dev`.
- [ ] In dev-token mode the shell shows the "Dev token" badge and no sign-out or org-switch action; the first-visit
      profile can still be saved.
- [ ] `pnpm build` then `pnpm check:dev-bundle` passes: no `DevGate`, `[dev-token]`, `pnpm dev:token` or `.config/simap`
      in `.next/static/**`; the Identity sign-in path is unchanged in production.
- [ ] All Checks green; new pure logic (`dev-fetch`, `dev-flow`) and views have Vitest tests.

## Technical notes
- Files (from the SIM-028 split proposal): `src/ui/auth/AuthGate.tsx`, new `src/ui/auth/DevGate.tsx`,
  new `src/lib/api/dev-fetch.ts`, `src/lib/api/fetch.ts` (export `accessCodeOf`), new `src/lib/identity/dev-flow.ts`,
  `src/lib/session.ts`, `src/ui/AppShellView.tsx`, `src/ui/org/ProfileView.tsx`, `src/ui/auth/views.tsx`,
  new `src/ui/copy/dev-token.ts`, `src/ui/copy/shell.ts`, new `scripts/check-dev-bundle.mjs`, `package.json`.
- Risks: SIM-027 also touches `src/lib/api/fetch.ts`; React StrictMode double effects; manual e2e needs M-1.

## Test plan
- Unit: `dev-fetch.test.ts`, `dev-flow.test.ts`, `DevTokenView` and optional sign-out render tests, shell badge test.
- Manual: `pnpm dev:token --org <uuid>`, `pnpm dev`, Chrome network log; `pnpm build && pnpm check:dev-bundle`.

## Notes / answers from Ming
- 2026-11-21: Ming approved one extra rework beyond the limit of 2: fix security Attempt 3 S5 in PR #34 (force `NODE_ENV=development` in `devEnv`). S6, S7 and other follow-ups stay out.
- 2026-11-21: Ming merged PR #33 at head `4d07c7e`, before attempt 3 reached the branch. S1, S2 and the `.env.example` name are not in that merge; they ship in the fixes PR from `ticket/SIM-028.1-fixes`.
- 2026-11-21: Ming decided M-18: add `NEXT_PUBLIC_SIMAP_DEV_PROD` to `.env.example` (High-path edit approved, name only, as a comment line so a copied file is not refused by the launchers), and fix security Attempt 2 S1 and S2 in this PR.
- 2026-11-21: Plan approved by Ming. Decision 1 = C: `scripts/dev-prod.mjs` sets `NEXT_PUBLIC_SIMAP_DEV_PROD=1` and the browser shows a distinct red "Production data" badge (in scope for this ticket). Decision 2 = default: a mid-session 403 `org_required` flips to the `--org` hint. Decision 3 = default: README "Local development" steps 7-8 are edited in this ticket.
- 2026-11-21: created from the approved SIM-028 split (Decision G).

## Handoff

### 2026-11-21 — claude — BLOCKED
- Agent calls: 2, tokens 56k plus planner (usage not reported when this entry was written) (frontend-developer×1 56k, planner×1 pending; in/out split not reported)
- Done: consult and plan (`Status: READY`).
- In progress / next: Ming approves `plan.md` and its 3 decisions (how `dev:prod` shows production data in the browser; mid-session 403 `org_required` flips to the `--org` hint; edit README steps 7-8); then `/run SIM-028.1`.
- Gotchas: whether Next drops the lazy `DevGate` chunk from the production build is unproven; plan step 1 tests it first. Live browser checks need M-1 and a real token.

### 2026-11-21 — claude — DONE
- Agent calls: 8, tokens 662k (frontend-developer×1 56k, planner×1 123k, implementer×2 152k, reviewer×2 150k, security-ai-generated-code-auditor×2 181k; in/out split not reported)
- Done: browser dev-token mode, red "Production data" badge and notice for `dev:prod`, `.env*` refusal of the flag, `pnpm check:dev-bundle`. Reviewer Attempt 2 PASS. Security Attempt 2 wrote REWORK with no 🔴 (S1, S2 are 🟡), so under the loop rule the ticket passes; both are raised to Ming on the PR.
- In progress / next: Ming decides M-18 (`.env.example`) and whether S1/S2 are fixed before merge, then merges. Live browser checks need a real token (M-1); the `dev:prod` badge also needs M-3.
- Gotchas: `verify.test.ts:169` failed once in six full runs (wall-clock test, no diff under `src/server`, cause not established). The branch merges `main` instead of rebasing, because a force-push was blocked.

### 2026-11-21 — claude — DONE
- Agent calls: 11, tokens 775k plus reviewer Attempt 3 (usage not reported when this entry was written) (frontend-developer×1 56k, planner×1 123k, implementer×3 203k, reviewer×3 150k + pending, security-ai-generated-code-auditor×3 243k; in/out split not reported)
- Done: S1, S2 and the commented `.env.example` name (M-18). Reviewer Attempt 3 PASS. Security Attempt 3 wrote REWORK with no 🔴 (S5 is 🟡), so under the loop rule the ticket passes. Both allowed reworks are used.
- In progress / next: Ming does M-19 (check the `.env.example` lines; decide S5), then merges PR #33. Live checks need M-1 and M-3.
- Gotchas: agents could not read `.env.example`; only its 3-line addition is confirmed. S5 needs `NODE_ENV=test` in the shell plus a `.env.test*` file.

### 2026-11-21 — claude — DONE
- Agent calls: 14, tokens 983k (frontend-developer×1 56k, planner×1 123k, implementer×4 231k, reviewer×4 260k, security-ai-generated-code-auditor×4 313k; in/out split not reported)
- Done: S5 fixed with Ming's approved extra rework. Reviewer Attempt 4 PASS; security Attempt 4 PASS.
- In progress / next: Ming checks the `.env.example` lines (M-19) and merges PR #34; the ticket becomes MERGED then. Live checks need M-1 and M-3.
- Gotchas: security N1 (`dev:prod` does not pin the Identity issuer) is a follow-up and should be fixed before `dev:prod` is used on real data.
