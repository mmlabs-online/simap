# SIM-063: Third-party check-in provider: REST pull adapter and mock

| Field | Value |
|---|---|
| State | MERGED |
| Priority | P2 |
| Size | M |
| Areas | architecture, api, security |
| Gate | plan-approval |
| Depends on | SIM-058 |
| Needs Ming | — |
| Attempts | 1 |
| Created | 2026-11-26 |
| Claimed by | — |
| PR | https://github.com/mmlabs-online/simap/pull/156 |

## Goal
simap can take check-ins from a third-party check-in system through a server-side adapter that pulls its REST API;
this ticket ships the provider interface and a mock provider for dev and tests.

## Scope reference
`docs/spec-v1.md` PRE-04, PRE-03; decision D83 (pulled REST API, no webhook); OQ-69a–c (open, block the real
provider); rule R3.

## Scope
- Provider interface and pull adapter in `src/server/**`; mock provider for dev and tests.
- Provider check-ins recorded through the SIM-058 presence code with source `provider`.
- Env-only config names in `.env.example` (R3).

## Out of scope
- A real provider (blocked by OQ-69a–c); webhooks (D83); per-org credentials in the DB (needs Ming, OQ-69c).

## Acceptance criteria
- [ ] A server-side adapter behind a provider interface pulls check-ins from the provider's REST API; there is no
  webhook into simap. Only a mock provider ships.
- [ ] A provider check-in counts exactly like a self check-in, with source `provider`; if the member is already checked
  in, nothing changes (first source wins).
- [ ] A member already checked in by the provider skips the popup and is shown seated without the walk-in.
- [ ] Provider credentials and endpoints come from env only (names in `.env.example`, no values, R3); no provider
  payload, token or personal data is logged.
- [ ] Unit tests cover the mock pull, first-source-wins and the popup/walk-in skip.

## Technical notes
- Files: new `src/server/presence/provider/**`, `.env.example` (High path), the SIM-058 presence service, the SIM-059
  popup and SIM-061 walk-in skip.
- When and how often it pulls is a plan choice (PRE-04).
- Gate `plan-approval`: touches `.env.example` (High path) and provider config/secrets.

## Test plan
- Unit: mock provider pull, idempotence, logging redaction.
- Manual: dev with the mock provider, open simap as a provider-checked-in member (no popup, seated).

## Notes / answers from Ming
- Waiting for Ming: plan approval (High tier: `.env.example`, `src/server/presence/provider/config.ts`; M-96).
- 2026-11-27: Plan approved (Ming: "duyệt plan SIM-063"; M-96; defaults G1–G9 as planned).

## Handoff

### 2026-11-27 — claude — BLOCKED
- Agent calls: 3, ~163k tokens total (software-architect×1 default 50k; api-platform-engineer×1 default 34k; planner×1 default 79k).
- Done: consults saved; `plan.md` Status READY, defaults G1–G9 for the gate; no migration, no UI change; mock only (no REST client).
- In progress / next: Ming approves the plan (M-96), then `/run SIM-063` resumes at IMPLEMENT.
- Gotchas: High paths `.env.example` and `provider/config.ts` (security review will trigger). The planner could not read `.env.example` (deny rule); the implementer adds two names in its existing style.

### 2026-11-27 — claude — DONE
- Agent calls: 7 this run (implementer×3 default model: attempt 1, `.env.example` try (denied), rework 22k; reviewer×2 default model 76k/26k; security-ai-generated-code-auditor×2 60k/30k); plus consult×2 and planner×1 in the planning run.
- Done: attempt 1 implemented; `.env.example` names appended by the orchestrator with Ming's permission (7d194aaa; the agent was denied by `Read(**/.env.*)`); review 1 PASS, but security 🔴 (mock not refused under `pnpm dev:prod`) → REWORK; attempt 2 adds the `SIMAP_DB_TARGET=production` guard; review 2 PASS, security 2 PASS; merged origin/main (SIM-070, SIM-071 slices 1–2), checks green; PR #156.
- In progress / next: Ming reviews and merges PR #156, then the manual mock check in dev (PR "Needs Ming's decision").
- Gotchas: SIM-063's plan-approval item renumbered M-95 → M-96 on merge (SIM-071 used M-95 on main); review.md still says M-95. The ticket title mentions a REST pull adapter, but the approved plan ships the mock only (OQ-69a–c). Real-provider preconditions are in the PR follow-ups.
