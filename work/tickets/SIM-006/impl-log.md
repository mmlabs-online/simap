## Attempt 1 — 2026-11-20 (slice S1 only: auth library; S2 = SIM-006.2, S3 = SIM-006.3 not built)

Port source: tudocuatui `origin/main:src/features/auth/*`. A7 check: tudocuatui's working tree has no diff against
`origin/main` for `src/features/auth/`, so the planner's reading and the merged code agree.

### Files touched
| File | Required because |
|---|---|
| `src/lib/identity/types.ts` | port of `types.ts` lines 1-41 (error/credential/account types); `join_approval_unavailable` replaced by `join_rejected`, `join_queue_full`; view prop types, `SubmitStatus`, `ResendState` left for S2/S3 |
| `src/lib/identity/errors.ts` | port; same code swap |
| `src/lib/identity/config.ts` | new: simap constants (`APP_KEY`, lock/channel names, prod base, Turnstile key) + `identityBaseFrom`, `turnstileSiteKeyFrom` (High path `**/config.*`) |
| `src/lib/identity/flow.ts` | new: `viewForTokenError`, `viewForMe`, `initialView` |
| `src/lib/validate/credentials.ts` | port of `validation.ts` without the token parsers (move to S3); `FieldErrorCode` type defined here because lib cannot import the ui copy file |
| `src/lib/api/fetch.ts` | new: `createApiFetch`, `ApiAccessError` (retry rule, AC3a) |
| `src/ui/auth/{accountId,refreshLock,authChannel,fakeTabs}.ts` | verbatim ports; lock/channel names from `@/lib/identity/config` |
| `src/ui/auth/identityClient.ts` | port, three-mode `post` (A13: signup/forgot `omit` + `X-MM-App`), `join` returns `member`/`pending` |
| `src/ui/auth/tokenStore.ts` | port; `join()` returns `joined`/`pending`/`stale`; new `renewNow()` |
| tests (listed below) | R5 |

### Tests added / changed
- `src/lib/api/fetch.test.ts` (new, all rows of the plan table)
- `src/lib/identity/flow.test.ts`, `config.test.ts` (new)
- `src/lib/identity/errors.test.ts`, `src/lib/validate/credentials.test.ts` (ports; plus `join_rejected`/`join_queue_full`, `join_approval_unavailable` -> unknown, `no_access` never from a body)
- `src/ui/auth/{tokenStore,tabs,refreshLock,authChannel,accountId,identityClient}.test.ts` (ports); new: `renewNow` (2), `join` 202 pending, `credentials and X-MM-App per call` table (10 calls), signup/forgot now expect `omit`
- Test adaptations (env is `node`, not jsdom): `accountId.test.ts` and `tokenStore.test.ts` stub `localStorage`, `sessionStorage`, `history` with `vi.stubGlobal`; `tokenStore.test.ts` setup passes `createRefreshLock({ locks: undefined })` because Node 24 has `navigator.locks` (jsdom and Node 22 do not), which made three tests order-dependent.

### Checks (actual output summary)
- typecheck: `pnpm typecheck` exit 0 (next typegen + tsc, no errors)
- format:check: "All matched files use the correct format."
- check:layers: "95 files, no violations"
- test: Test Files 38 passed (38); Tests 390 passed | 3 skipped (393) (the 3 skips were not touched by this change)
- build: `next build` Compiled successfully; static pages 8/8
- Ran on local Node 24.20 with `--config.engine-strict=false`; CI is Node 22.

### Differences from tudocuatui (A7 / A13)
- A13: signup and forgot use `credentials: "omit"` + `X-MM-App` (tudocuatui sends `include`).
- `join` returns the status; 202 `pending` accepted (tudocuatui threw `unknown`).
- `tokenStore.join()` returns a status string instead of a boolean; `renewNow()` added.
- `validation.ts` lost `parseVerifyToken`/`parseResetToken` (S3 `email-link.ts`).
- `FieldErrorCode` moved into `credentials.ts` (lib may not import ui copy).
- Test env (see above).

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- Debt issue for tudocuatui (`project:tudocuatui`): signup/forgot use `credentials: "include"` where consumers.md says `omit` (A13); the orchestrator opens it.
- New env names (`NEXT_PUBLIC_IDENTITY_BASE`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`) are not read anywhere yet; S2 wires `identityBaseFrom`/`turnstileSiteKeyFrom` and the `.env.example` names (Ming step).
- Ming: add `simap.mmlabs.online` and `localhost` to the shared Turnstile widget hostnames (plan Q2).

### Scope self-check
- Could the diff be smaller? No: ports plus their ported tests; nothing outside the S1 file list.
- Diff size: about +3,050 lines (new files only, about 1,500 of them tests), -0.
