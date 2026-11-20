# Backlog

States: BACKLOG → PLANNING → IN_PROGRESS → REVIEW → DONE → MERGED · plus REWORK, BLOCKED, ESCALATED.
**Row order is run order.** `/run` with no ID picks the first runnable row: every `Depends on` ticket is `MERGED`,
every `Needs Ming` item is ticked in `work/ming-todo.md`, and nobody holds a claim (S1 bugs first).
Gate `plan-approval` = the loop stops after PLAN until Ming approves (see `.claude/loop.config.md`).
This board is changed only on `main`; each ticket's `ticket.md` is the source of truth for its state.

| ID | Title | State | Priority | Size | Areas | Depends on | Gate | Attempts | Updated |
|---|---|---|---|---|---|---|---|---|---|
