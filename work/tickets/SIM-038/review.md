# Review — SIM-038

## Attempt 1 — 2026-11-25
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check`: exit 0 (oxfmt does not flag the copied YAML, so A2 did not trigger).
- `pnpm typecheck && pnpm check:layers`: exit 0; "check-layers: 666 files, no violations".
- `pnpm test`: exit 0; "Test Files 253 passed | 1 skipped (254)", "Tests 2502 passed | 7 skipped (2509)". `scripts/deploy-envfile.test.ts` run alone: 13 passed (the bash-gated suite ran, it was not skipped).
- `pnpm build`: exit 0.
- `pnpm test:db`: not run (CI only, as instructed).
- Extra: `python3 -I -c 'import yaml…'` on the draft: parses OK. `git -C /home/user/deployment status --short`: clean (the deployment repo was not written).
- These results match impl-log Attempt 1.

### Acceptance criteria
- [x] The draft is byte-identical to the merged deployment-repo file. Evidence: `cmp deploy/deployment-repo/.github/workflows/deploy-simap.yml /home/user/deployment/.github/workflows/deploy-simap.yml` exit 0, no output. Both sha256 = `301a10f0a21715dcfe32e2d4768efa6f42be25b295c0ca291f52f6df70064211`. Deployment HEAD is `29cb93f Merge pull request #109`.
- [x] The README names the four secrets (all-or-none) and says to run `workflow_dispatch` after changing them. Evidence: `deploy/deployment-repo/README.md:31-37` names `SIMAP_GOOGLE_CLIENT_ID`, `SIMAP_GOOGLE_CLIENT_SECRET`, `SIMAP_GOOGLE_REFRESH_TOKEN` and `SIMAP_DRIVE_FOLDER_ID`, says "all-or-none", and says to run `deploy-simap` with `workflow_dispatch` from `main` after adding, changing or removing any of them. It contains no secret values.
- [x] (Derived, R5) Tests are green and cover the new envfile logic. Evidence: `scripts/deploy-envfile.test.ts:114-186` has the five planned tests: empty strings, all four set, every subset of 1 to 3 (masks 1-14), malformed values (one per secret, plus folder ids of 9 and 201 chars), and changed=true after a value changes. Each runs the real `envfile` run block of the copied draft. The static test at `:211-226` asserts exactly the four `SIMAP_*` secrets and checks they map to the unprefixed names in the envfile `env:` block before `run: |`. The test env is isolated (no `process.env` spread except PATH), so CI env vars cannot leak in.

### Issues
None.

### Rules (CLAUDE.md)
No violations found. R3: secret names only, fake test values only, and no `*.env` file was read. R4: the changed files are the three planned files plus orchestrator bookkeeping (`work/ming-todo.md` M-56, `ticket.md`, `plan.md`, `impl-log.md`). High path `deploy/deployment-repo/**` is named in the plan, and Ming approved the plan (M-56). R5: checks green, and the new logic has tests.

### Blockers from review agents
None. The orchestrator should add any security-review findings here (review trigger: area `security`, `.github/workflows/`).

### Nits (do not block)
- `deploy/deployment-repo/.github/workflows/deploy-simap.yml:83` comment still says "Writes DATABASE_URL to the host env file". It does not mention the Drive lines. Do not change it here, because byte-identity wins; fix it upstream (see Follow-ups).

### Follow-ups (out of scope)
- In `mmlabs-online/deployment`, update the envfile step comment (`deploy-simap.yml:83`) to mention the optional Drive lines, then re-sync the draft.
