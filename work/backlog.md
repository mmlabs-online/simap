# Backlog

States: BACKLOG → PLANNING → IN_PROGRESS → REVIEW → DONE → MERGED · plus REWORK, BLOCKED, ESCALATED.
**Row order is run order.** `/run` with no ID picks the first runnable row: every `Depends on` ticket is `MERGED`,
every `Needs Ming` item is ticked in `work/ming-todo.md`, and nobody holds a claim (S1 bugs first).
Gate `plan-approval` = the loop stops after PLAN until Ming approves (see `.claude/loop.config.md`).
This board is changed only on `main`; each ticket's `ticket.md` is the source of truth for its state.

| ID | Title | State | Priority | Size | Areas | Depends on | Gate | Attempts | Updated |
|---|---|---|---|---|---|---|---|---|---|
| SIM-001 | Scaffold the Next.js app, tooling and CI | PLANNING | P0 | M | architecture, security | — | plan-approval | 0 | 2026-11-20 |
| SIM-002 | Database client, tudocuatui migrator and readiness | BACKLOG | P0 | M | db, security | SIM-001 | plan-approval | 0 | 2026-11-20 |
| SIM-003 | App shell and UI kit ported from seatMGT | BACKLOG | P1 | M | ui, ux | SIM-001 | none | 0 | 2026-11-20 |
| SIM-004 | Production image and tudocuatui-style deploy | BACKLOG | P1 | M | architecture, security | SIM-002 | plan-approval | 0 | 2026-11-20 |
