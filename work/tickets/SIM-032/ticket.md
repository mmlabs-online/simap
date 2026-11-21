# SIM-032: One-command local start on production data

| Field | Value |
|---|---|
| State | ESCALATED |
| Priority | P1 |
| Size | M |
| Areas | security |
| Gate | none |
| Depends on | SIM-031 |
| Needs Ming | — |
| Attempts | 2 |
| Created | 2026-11-21 |
| Claimed by | — |
| PR | — |

## Goal
Ming starts simap on production data with one command, `scripts/start-dev.sh`, without filling in `.env.local`. The
command signs in, connects through the tunnel, starts the app, and prints the local URL with a clear production warning.

## Scope reference
- D56 (keep production data safe in local dev); R3 (no secrets in code, logs or client bundles).
- Ming's one-command brief, 2026-11-21. SIM-028.1 security S3; SIM-031 security Attempt 1 N2.

## Scope
- Add `scripts/start-dev.sh` as a thin wrapper around `scripts/dev-prod.mjs`. Extend that launcher; do not replace it.
- Run every read-only preflight check before sign-in and before the tunnel starts: required tools and all `.env*`
  refusals.
- Refuse `DATABASE_URL` in any of the four `.env*` files, not only `.env.local`.
- Refuse to start when the app port is in use, naming the port.
- Work without `--org`: reuse the org of the existing token, else ask for the org UUID once and pass it to `dev:token`.
- After start, wait for `/api/readyz` (30 s max), verify that the process we started is alive and owns the port, then
  print the local URL and `PRODUCTION DATA: every change is real.` A failed readiness check stops the child.
- Ctrl-C or any exit stops every child process, including on Windows, and leaves the tunnel running.
- The wrapper works from Git Bash on Windows, where stdin may not be a TTY for Node, with hidden input and no secret in
  a process argument.
- `.env.local` is not required for this command.
- Short README section and a manual list that includes taking a `pg_dump` before the first run.

## Out of scope
- A separate API process (simap is one Next.js app) and a new proxy (the server-side dev token already exists).
- Encryption keys and production storage (simap has none).
- SIM-028.1 follow-ups S4, F4 and F6.
- Migrations, seeds, resets or any destructive SQL from this command.

## Acceptance criteria
- [ ] With no `.env.local`, `scripts/start-dev.sh` runs the full flow in stubbed tests: sign-in, tunnel, database
      password, app, readiness, then the URL and `PRODUCTION DATA: every change is real.`
- [ ] A `.env*` refusal, a missing tool or a busy app port exits non-zero before any sign-in prompt, tunnel start or
      password prompt, names the file or port, and never prints a value.
- [ ] A failed sign-in starts no tunnel and no app, and prompts for no database password.
- [ ] With no usable token and no `SIMAP_DEV_ORG`, the command asks for the org UUID once, validates it and passes it to
      `dev:token`; a fresh token's org is reused without asking.
- [ ] A readiness timeout, an early child exit, or a port owned by another process stops the child and exits non-zero.
- [ ] Ctrl-C leaves no child process, including the Next.js process tree on Windows, and does not stop the tunnel.
- [ ] No password, token or `DATABASE_URL` appears in stdout, stderr, process arguments or a repo file. All Checks are
      green, `bash -n` passes, and shellcheck passes or is recorded as unavailable.

## Technical notes
- Files: `scripts/start-dev.sh` (new), `scripts/dev-prod.mjs`, `scripts/dev-prod.test.ts`, possibly `scripts/dev.mjs`,
  `scripts/dev-token.mjs` and their tests, `README.md`, `package.json` only if the plan needs it.
- No High path is expected. If the plan needs one, set `Gate: plan-approval`.
- `scripts/dev-prod.mjs` currently needs `process.stdin.isTTY`, which can be false under Git Bash on Windows. The planner
  decides how the wrapper gets hidden input (for example through `winpty`, or by telling the user which terminal to use
  when that is unavailable), without placing a secret in argv.
- `shellcheck` is not installed on this machine. Do not download it without Ming's approval.
- Risks: the readiness probe must target loopback only. Stopping a process tree on Windows must never kill a process the
  launcher did not start.
- Agents never read real `.env*` files and never run this command against production.

## Test plan
- Unit: stubs for login, docker and the app cover each acceptance criterion through `run()`.
- Scripted: `bash -n scripts/start-dev.sh`; a fake child process tree proves that Ctrl-C leaves no process.
- Manual (Ming, needs M-1, M-3 and the real tunnel): take a `pg_dump`, run `scripts/start-dev.sh`, confirm the URL, the
  warning, the red badge and `/api/readyz`; press Ctrl-C and confirm the app stops and the tunnel keeps running.

## Notes / answers from Ming
- 2026-11-21: Ming supplied the one-command brief after finding the `.env` variables too many to fill in.

## Handoff

### 2026-11-21 — claude — ESCALATED
- Agent calls: 10, tokens 826k plus reviewer Attempt 3 (usage not reported when this entry was written) (planner×1 103k, implementer×3 268k, reviewer×3 189k + pending, security-ai-generated-code-auditor×3 267k; in/out split not reported)
- Done: wrapper, preflight before sign-in, org flow, readiness with a hard deadline, single database login check, `PG*` handling. Checks green (1034 tests). All work is on `ticket/SIM-032`; no PR.
- In progress / next: Ming picks an option in `escalation.md` (M-20). Open: 🔴 T1 and reviewer Issue 1.
- Gotchas: do not run `scripts/start-dev.sh` on production from this branch: stop can report success while a process survives. Winpty, real Ctrl-C, sign-in, tunnel and `/api/readyz` are unverified.
