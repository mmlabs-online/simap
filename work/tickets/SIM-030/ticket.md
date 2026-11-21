# SIM-030: Pin the `dev:prod` org for the running server

| Field | Value |
|---|---|
| State | REVIEW |
| Priority | P1 |
| Size | S |
| Areas | security |
| Gate | plan-approval |
| Depends on | SIM-029 |
| Needs Ming | — |
| Attempts | 1 |
| Created | 2026-11-21 |
| Claimed by | claude@2026-11-21T04:58:10Z |
| PR | — |

## Goal
A running `pnpm dev:prod` stays on the org it checked at startup, so a token change in another terminal or a stray
`.env*` setting can never send production edits to a different org. Must be done before `dev:prod` is used on real
production data.

## Scope reference
- D56 (keep production data safe in local dev); R6 (org scope comes from the verified token).
- SIM-029 `security-review.md` Attempt 3, findings 🟡 1, 🟡 2 and 🟢 3.

## Scope
- `dev:prod` passes the org it checked to the child as `SIMAP_DEV_EXPECTED_ORG`.
- When `SIMAP_DEV_EXPECTED_ORG` is set, the server's dev-token path sends no token if the file's `org` differs
  (case-insensitive) and warns with a new `wrong_org` reason that contains no token value; the request gets the normal
  401. A refreshed token for the same org keeps working without a restart.
- `dev:prod` refuses (exit 2, value never printed, before the password prompt) when `.env.local`,
  `.env.development.local`, `.env.development` or `.env` sets `SIMAP_DEV_ORG`.
- `tokenOrg` accepts only a UUID, matching the verifier.

## Out of scope
- Other SIM-029 follow-ups: `heapsnapshot` in `NODE_OPTIONS`, `PG*` stripping, lone-CR and split-line `.env` forms, the
  `CLAUDE.md` Commands entry.
- Org switching inside a running app.

## Acceptance criteria
- [ ] With `SIMAP_DEV_EXPECTED_ORG=A`, a token file for org B produces no `Authorization` header, one `wrong_org` warning
      without the token value, and a 401.
- [ ] With `SIMAP_DEV_EXPECTED_ORG=A`, replacing the file with a fresh org A token (any letter case) works on the next
      request without a restart.
- [ ] `dev:prod` starts the child with `SIMAP_DEV_EXPECTED_ORG` set to the checked org, and a value for it in a `.env*`
      file cannot replace that value.
- [ ] `dev:prod` exits 2 before the password prompt when any of the four `.env*` files sets `SIMAP_DEV_ORG`, and never
      prints the value.
- [ ] A non-UUID `org` claim is treated as no org: `dev:prod` does not start on it and never prints it.
- [ ] Plain `pnpm dev` (no `SIMAP_DEV_EXPECTED_ORG`) behaves as before, and all Checks are green.

## Technical notes
- Files (as of the SIM-029 branch): `scripts/dev-prod.mjs` (`tokenOrg`, `envFileSetsDatabaseUrl`, `childEnv`),
  `scripts/dev-prod.test.ts`, `src/lib/dev-token/token.ts` (`Reason`, `devAuthorizationFor`, `warningFor`) + test,
  `src/server/http/dev-token.ts` + test, `README.md`, `.env.example` (name only, if the plan lists it).
- High path: `src/server/http/**` (and `.env.example` if changed).
- Risks: `SIMAP_DEV_EXPECTED_ORG` must stay dev-only, inside the constant-false dev-token guard, so it has no effect in
  `next build` output. Agents never read real `.env*` files; tests use throwaway files or injected readers.

## Test plan
- Unit: `token.test.ts` (`wrong_org`, case-insensitive match, unset pin), `dev-token.test.ts`, `dev-prod.test.ts` (child
  env, four `.env*` files, non-UUID claims).
- Manual: `pnpm dev:prod` for org A, run `pnpm dev:token --org B` in a second terminal, next `/api/me` is 401 with one
  warning; `pnpm dev:token --org A`, next call is 200 without a restart. Needs M-3 and the real tunnel.

## Notes / answers from Ming
- 2026-11-21: Plan approved by Ming, with the plan defaults for both decisions: (1) the verifier stays strict, so a token with an uppercase `org` claim gets a 401; (2) `SIMAP_DEV_EXPECTED_ORG` is not added to `.env.example` and is documented in the README.
- 2026-11-21: Ming asked for this ticket after the SIM-029 Attempt 3 security review.

## Handoff

### 2026-11-21 — claude — BLOCKED
- Agent calls: 1 (planner×1; token usage not reported when this entry was written)
- Done: plan (`Status: READY`). No consult: the `security` area has no consult agent.
- In progress / next: Ming approves `plan.md` and its 2 decisions (uppercase `org` claim stays refused by the verifier; `SIMAP_DEV_EXPECTED_ORG` is not added to `.env.example`); then `/run SIM-030`.
- Gotchas: the org claim is used only to withhold a token; `with-auth` still verifies the token. Live check needs M-3 and the real tunnel.
