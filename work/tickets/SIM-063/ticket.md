# SIM-063: Third-party check-in provider: REST pull adapter and mock

| Field | Value |
|---|---|
| State | BACKLOG |
| Priority | P2 |
| Size | M |
| Areas | architecture, api, security |
| Gate | plan-approval |
| Depends on | SIM-058 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-26 |
| Claimed by | — |
| PR | — |

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

## Handoff
