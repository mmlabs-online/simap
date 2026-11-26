# SIM-048 — security review (security-ai-generated-code-auditor)

## Attempt 1

Verdict: PASS — no 🔴, no 🟡. (Auditor had no shell; reviewed the working tree containing c927c68.)

- 🟢 Server enforcement, single entry: `src/app/api/devices/[id]/placement/route.ts:21` is the only caller of `placeDevice`; tier comes from `ctx.tier`. No other server path sets `devices.seat_id` to a seat (create inserts without seat; handoffs only clear).
- 🟢 Decision logic: `src/lib/devices/rules.ts:85` refuses a User when `occupantId === null || occupantId !== callerId` (null-member hole closed; `rules.test.ts:208`). Order keeps return-to-inventory allowed; unchanged re-PUT of a previously lent device is a noop (M-85 default).
- 🟢 No race: `src/server/devices/devices.ts:258-269` locks target and old seat `for update` (id order) after rooms `for share`; every occupant-changing path takes the same seat lock (`seats.ts:244`, `members/manage.ts:359`).
- 🟢 R6: every query in `placeDevice` goes through `orgQuery`.
- 🟢 R7: 422 `seat_not_yours` thrown at `devices.ts:309` before update (312) and audit (319); tests `devices.test.ts:168`, `devices.db.test.ts:199-214`, `devices-routes.test.ts:138`.
- 🟢 UI advisory only: `src/ui/devices/place-device.ts:34-37`.
- 🟢 (optional hardening) `rules.ts:85` uses `a.tier === "user"`; `!atLeast(a.tier, "manager")` would fail closed if a lower tier is added.
- 🟢 (optional test) no lock-wait DB test specific to `seat_not_yours`.

Follow-up: no report lists devices Users lent to other seats before D72 (left in place per M-85).
