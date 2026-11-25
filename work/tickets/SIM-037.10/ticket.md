# SIM-037.10: Devices UI: return dialog, pending returns and Admin take-back

| Field | Value |
|---|---|
| State | IN_PROGRESS |
| Priority | P1 |
| Size | M |
| Areas | ui, ux |
| Gate | plan-approval |
| Depends on | SIM-037.4 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-25 |
| Claimed by | claude@2026-11-25T08:57Z |
| PR | — |

## Goal
An owner (or Manager+) gives a device back to the org from the Devices page, Admins see pending returns and confirm them, Admins take a device back directly, and Admins see the pending-returns count in the nav.

## Scope reference
docs/spec-v1.md §6 DEV-09; D63; OQ-44. UI slice split from SIM-037.4 (its plan.md `## Split proposal`, approved by Ming 2026-11-25). API from SIM-037.4: `POST /api/devices/:id/handoffs` `{kind:"return", note}`, `POST /api/devices/:id/take-back`, `GET /api/handoffs?box=returns`, `GET /api/handoffs/count` → `{incoming, returns}`, `DeviceDto.canReturn` / `canTakeBack`. UI design: work/tickets/SIM-037.4/consult-frontend-developer.md §2-8.

## Scope
- `ReturnDeviceDialog.tsx` with a pure `return-device.ts` (optional note; outcome and stale handling generalised from `settleTransfer`).
- Row actions: "Give back to org" (`canReturn`), "Take back" (`canTakeBack`, danger style, confirm dialog showing owner and seat), "Cancel return" (`cancelTransfer` made kind-aware). Copy keys distinct from the existing `place` mode "Return".
- A "Return pending" chip.
- `PendingReturns.tsx` section for Admins with Confirm (and Cancel when `canCancel`), own hook on `box=returns`, wired into the shared `act()` / `acting` / focus handling.
- Admin nav badge: incoming + returns as one number, aria breakdown in `src/ui/copy/shell.ts`; update `useHandoffBadge` / `badgeCountAfter`.
- `devices-api`: `startReturn`, `takeBack`, `pendingReturns`, count parsing of `returns`.
- Copy in `src/ui/copy/devices.ts` (D36).

## Out of scope
- API and deactivation (SIM-037.4). Overdue (SIM-037.5), history (SIM-037.6).

## Acceptance criteria
- [ ] Owner or Manager+ can start and cancel a return from the Devices page; only Admins see Confirm.
- [ ] Admins see each pending return (device, from, note) and confirm it; the device then shows as unowned.
- [ ] Admin Take back works after a confirm dialog, including on a deactivated member's device.
- [ ] Admins see the number of pending returns in the Devices nav badge (summed with incoming transfers, aria breakdown).
- [ ] All new strings live in `src/ui/copy/*` (D36).

## Technical notes
- Files: see plan.
- Risks / open questions: two "Return" labels on one row (place mode vs give back) — keep distinct copy.

## Test plan
- Unit: return outcomes, rowActions gating, badge sum, API client paths. Markup: ReturnDeviceDialog, PendingReturns, AppShellView badge text. Manual: return then Admin confirm; Admin take-back.

## Notes / answers from Ming
Split from SIM-037.4 with Ming's approval (2026-11-25, "duyệt").
Plan approved 2026-11-25 (Ming: "duyệt"); place-mode label stays "Return" (default).

## Handoff

### 2026-11-25 — claude — BLOCKED
- Agent calls: 3, tokens ~185k total (frontend-developer×1 consult 51k, ux-architect×1 consult 33k, planner×1 opus 100k; in/out split not reported)
- Done: consults saved; plan.md READY (UI only, binds to the merged SIM-037.4 API; no High path). Place-mode "Return" label kept (FE view); flip to "Remove from seat" only if Ming says so.
- In progress / next: Ming approves the plan (M-67). Then /run SIM-037.10 resumes at IMPLEMENT.
- Gotchas: plan is ~450-550 product lines (over the guide); a fallback split is named in plan.md. Non-Admins must never call box=returns (422).
