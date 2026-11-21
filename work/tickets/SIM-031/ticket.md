# SIM-031: Pin the Identity issuer for `pnpm dev:prod`

| Field | Value |
|---|---|
| State | BACKLOG |
| Priority | P1 |
| Size | S |
| Areas | security |
| Gate | none |
| Depends on | SIM-028.1 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-21 |
| Claimed by | — |
| PR | — |

## Goal
A running `pnpm dev:prod` accepts tokens only from the production Identity, so a stray `.env*` issuer and a token from
another Identity can never act on the production database. Must be done before `dev:prod` is used on real production
data.

## Scope reference
- D56 (keep production data safe in local dev); R6 (org scope comes from the verified token).
- SIM-028.1 `security-review.md` Attempt 4, finding 🟢 N1.

## Scope
- `childEnv` in `scripts/dev-prod.mjs` drops every letter-case variant of `MM_IDENTITY_ISSUER` from the inherited
  environment and sets `MM_IDENTITY_ISSUER=https://api.mmlabs.online`.
- `dev:prod` refuses (exit 2, value never printed, before the password prompt) when `.env.local`,
  `.env.development.local`, `.env.development` or `.env` sets a non-canonical letter-case variant of
  `MM_IDENTITY_ISSUER`, because on Windows such a line can overwrite the pinned value.

## Out of scope
- Plain `pnpm dev` behaviour.
- Changes to `src/server/identity/**`.
- SIM-028.1 follow-ups S3, S4, S6, S7, F4 and F6.
- Case-variant hardening of `SIMAP_DEV_EXPECTED_ORG` and `DATABASE_URL`.

## Acceptance criteria
- [ ] The `dev:prod` child has exactly one issuer key, `MM_IDENTITY_ISSUER=https://api.mmlabs.online`, whatever issuer
      variants the shell passes.
- [ ] An exact-case `MM_IDENTITY_ISSUER` in any of the four `.env*` files, with any value, cannot replace the pinned
      value, and `dev:prod` still starts.
- [ ] A non-canonical letter-case variant in any of the four `.env*` files makes `dev:prod` exit 2 before the password
      prompt, naming the file and never printing the value.
- [ ] Plain `pnpm dev` passes its issuer settings through unchanged.
- [ ] All Checks are green and the new logic has tests.

## Technical notes
- Files: `scripts/dev-prod.mjs` (`childEnv`, the `.env*` checks), `scripts/dev-prod.test.ts`, `README.md`
  ("Production database (dev)"). No High path is expected; if the plan needs one, set `Gate: plan-approval`.
- Reuse the Next-compatible, case-insensitive `envFileSetsKey` and the fail-closed reader from PR #34, so this ticket
  must start from a `main` that contains PR #34.
- Do not refuse the exact-case key: a `.env.local` may legitimately set it for plain `pnpm dev`, and Next does not
  override a key already in the process environment.
- Risks: the planner confirms that `pnpm dev:token` obtains its token from the same production issuer, so the pin does
  not reject a valid token.
- Agents never read real `.env*` files; tests use throwaway files or injected readers.

## Test plan
- Unit: `dev-prod.test.ts` (inherited variants, exact-case `.env*` value, each of the four files with a case variant, no
  value in output, no prompt or spawn on refusal, plain dev unchanged).
- Scripted: real `@next/env` on a throwaway directory confirms the exact-case file value does not replace the pin.
- Manual: under `pnpm dev:prod`, a valid production token still reaches `/api/me`. Needs M-3 and the real tunnel.

## Notes / answers from Ming
- 2026-11-21: Ming asked for this ticket after the SIM-028.1 Attempt 4 security review.

## Handoff
