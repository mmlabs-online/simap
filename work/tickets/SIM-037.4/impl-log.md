## Attempt 1 — 2026-11-25

Slice 1 only (API, DTO, deactivation). The UI is SIM-037.10.

### Files touched
| File | Required because |
|---|---|
| `src/lib/devices/types.ts` | `HandoffStartValue` union, `HandoffBox`, `HandoffCountDto.returns`, `DeviceDto.canReturn/canTakeBack` |
| `src/lib/devices/handoff-rules.ts` | `canStartReturn`, `decideReturnStart`, `canTakeBack`; `decideHandoffAction` and `handoffFlags` take `kind` |
| `src/lib/validate/device.ts` | `validateHandoffStart` accepts `return`; `validateHandoffBox` accepts `returns` |
| `src/server/devices/handoffs.ts` | `lockPlacement` extracted; `startReturn`, `confirmReturnOnce`, `takeBack`; kind-aware cancel audit; list and count `returns` |
| `src/server/devices/devices.ts` | `toDto` flags; `reload` exported for `takeBack` |
| `src/server/members/manage.ts` | `deactivateMember` cancels pending handoffs, audit row each, `cancelledHandoffs` in meta |
| `src/app/api/devices/[id]/handoffs/route.ts` | dispatch return vs transfer |
| `src/app/api/devices/[id]/take-back/route.ts` (new) | `POST`, wrapper tier admin |
| `src/app/api/handoffs/route.ts`, `count/route.ts` | pass `box` and `tier` |
| Tests (see below) and 4 UI test fixtures | R5; new required DTO fields |

### Tests added / changed
- `handoff-rules.test.ts`: `decideReturnStart`, `decideHandoffAction kind=return` (+ extension refused), `canTakeBack`; existing cases get `kind: "transfer"`.
- `validate/device.test.ts`: `validateHandoffStart return`, `validateHandoffBox` with `returns`.
- `handoffs.db.test.ts`: return start/refusals/cancel/confirm/stale/concurrent cancel; take-back (plain, deactivated owner, pending transfer, pending return, unowned, non-Admin, other org, race); returns list and count.
- `devices.db.test.ts`: `return flags`. `manage.db.test.ts`: deactivate cancels handoffs; noop/refuse paths; actor with no member row.
- `devices-routes.test.ts`, `handoffs-routes.test.ts`: return start, take-back, `box=returns`, count shape.
- UI fixtures: `device-form.test.ts`, `place-device.test.ts`, `DevicesView.test.tsx`, `PlaceDeviceDialog.test.tsx` add `canReturn/canTakeBack: false`. (`device-actions.test.ts` needed no change.)

### Checks (actual output summary)
- typecheck: `pnpm typecheck` exit 0; `pnpm check:layers`: 703 files, no violations
- format:check: All matched files use the correct format.
- test: `pnpm test` 264 files passed, 1 skipped; 2692 passed, 14 skipped
- build: `pnpm build` exit 0
- test:db: NOT RUN. No Docker or local Postgres on this machine (`docker` not found, no `DATABASE_URL`). The new DB tests in `handoffs.db.test.ts`, `devices.db.test.ts` and `manage.db.test.ts` are typechecked but unexecuted; CI runs `pnpm test:db`.

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- A10 accepted race (start by an owner during their deactivation can stay pending): file `debt` issue at PR time.
- A9: if pending returns grow, add an index (needs a migration).
- Remove-from-org path (A3) must reuse the cancel step of `deactivateMember`.

### Scope self-check
- Could the diff be smaller? No; all changes come from the plan.
- Diff size: see `git diff --stat` for the commit.
