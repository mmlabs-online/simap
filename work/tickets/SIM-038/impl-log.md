# Impl log — SIM-038

## Attempt 1
Files touched:
- `deploy/deployment-repo/.github/workflows/deploy-simap.yml`: `cp` of the deployment repo file, no edits (AC1).
- `deploy/deployment-repo/README.md`: one paragraph on the four SIMAP_* secrets, all-or-none, workflow_dispatch (AC2).
- `scripts/deploy-envfile.test.ts`: `exec` takes extra env; 5 new envfile tests; static secrets check replaced (AC3, A1).

AC1: `cmp` exit 0. sha256 (both): 301a10f0a21715dcfe32e2d4768efa6f42be25b295c0ca291f52f6df70064211
(source `/home/user/deployment/.github/workflows/deploy-simap.yml` and the draft). A2 did not trigger: oxfmt did not flag the YAML.

Checks: format:check exit 0; typecheck exit 0; check:layers "666 files, no violations"; test "253 passed | 1 skipped; 2502 passed | 7 skipped"; build exit 0.
YAML parse (python yaml.safe_load): ok. actionlint: not installed.

Out-of-plan files: none. Follow-ups: none.
Scope self-check: only the three planned files; deployment repo untouched; no secret values, no *.env read.
