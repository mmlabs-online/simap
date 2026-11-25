Status: READY

# Plan — SIM-038: Sync the deploy-simap draft with the deployment repo (Drive secrets)

## Scope summary
Ticket `## Goal`: "The simap repo's draft of the deploy workflow matches what runs in `mmlabs-online/deployment`
after the Drive-secrets PR, so the draft never drifts from production."

Ticket `## Scope`:
- "Copy the merged `.github/workflows/deploy-simap.yml` from `mmlabs-online/deployment` into
  `deploy/deployment-repo/.github/workflows/deploy-simap.yml`."
- "Add the four `SIMAP_*` secret names and the `workflow_dispatch` note to `deploy/deployment-repo/README.md`."

`work/decisions.md` D61 (2026-11-24): device-type images "are stored in Google Drive the tudocuatui way (its
D27/D34/D41: server-only OAuth refresh token, scope `drive.file` ...)". The secret names come from SIM-036.1 plan A6,
confirmed by `work/ming-todo.md:88` (M-46 done 2026-11-25: "four SIMAP_* secrets added to mmlabs-online/deployment").

`docs/requests/deployment-simap-drive.md:81-82`: "The simap repo keeps a draft of this workflow in
`deploy/deployment-repo/`; ticket SIM-038 syncs that draft with the merged deployment-repo file afterwards."
Same file, item 7 (line 54): "add the same four secret names and the `workflow_dispatch` note there."

Source of truth for the copy: `/home/user/deployment/.github/workflows/deploy-simap.yml` (deployment `main` @ 29cb93f,
after PR #109). The deployment repo README has no simap section (grep "simap" in its README: no match), so only
the workflow changed there.

State of the draft today (correction to the dispatch note): the folder **does** contain
`deploy/deployment-repo/.github/workflows/deploy-simap.yml` (a dot-directory, created by SIM-004). It is the
pre-PR-#109 version. The diff against the merged file is limited to:
- header comment lines 7 and 17-18 (draft) → lines 7-9 and 19-23 (merged): step 2 now names the four Google
  Drive values; "No repository secret is used" is replaced by the four `SIMAP_*` secret names, all-or-none, and the
  `workflow_dispatch` note.
- `envfile` step: new `env:` block (merged lines 88-92) mapping `secrets.SIMAP_*` to the four runtime names; the
  all-or-none check and format validation (merged lines 102-126); the conditional `printf` of the four lines
  (merged lines 132-135).
Everything else is identical. `apps/simap/compose.yml` in the deployment repo is byte-identical to the draft
(checked); it is not changed.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | The draft is byte-identical to the merged deployment-repo file. | `cmp /home/user/deployment/.github/workflows/deploy-simap.yml /home/user/simap/deploy/deployment-repo/.github/workflows/deploy-simap.yml` exits 0 with no output (and `sha256sum` of both match). Implementer records both hashes in impl-log. |
| 2 | The README names the four secrets (all-or-none) and says to run `workflow_dispatch` after changing them. | Read `deploy/deployment-repo/README.md`: a new paragraph names `SIMAP_GOOGLE_CLIENT_ID`, `SIMAP_GOOGLE_CLIENT_SECRET`, `SIMAP_GOOGLE_REFRESH_TOKEN`, `SIMAP_DRIVE_FOLDER_ID`, states all-or-none, and says to run `deploy-simap` with `workflow_dispatch` from `main` after changing any of them. `grep -c 'SIMAP_GOOGLE_CLIENT_ID\|SIMAP_GOOGLE_CLIENT_SECRET\|SIMAP_GOOGLE_REFRESH_TOKEN\|SIMAP_DRIVE_FOLDER_ID' deploy/deployment-repo/README.md` ≥ 1 for each name. No secret value anywhere. |
| 3 | (Derived, R5) `pnpm test` stays green with the new draft, and the new envfile logic is covered. | `pnpm test` passes; `scripts/deploy-envfile.test.ts` contains the tests listed below and they run the real `envfile` block of the copied draft. Full Checks from `loop.config.md` green: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`. |

## Ming verification after merge
None for this ticket (the deployment repo change itself is already merged and run by Ming; this only syncs the
draft). The live Drive check stays under the request file's "Ming's steps" item 4.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `deploy/deployment-repo/.github/workflows/deploy-simap.yml` | replace with a byte-for-byte copy of `/home/user/deployment/.github/workflows/deploy-simap.yml` (`cp`, no hand edits) | AC1 | **High** (`deploy/**`) |
| `deploy/deployment-repo/README.md` | add one paragraph on the four Drive secrets (after the `DATABASE_URL` / password-rotation paragraph, lines 25-29) | AC2 | **High** (`deploy/**`) |
| `scripts/deploy-envfile.test.ts` | adapt the static check at lines 127-131 (`not.toMatch(/\$\{\{\s*secrets\./)` would fail on the copied file) and add envfile tests for the Drive secrets | AC3 / R5: the copy alone turns `pnpm test` red; the new all-or-none / validation logic needs tests | No |

No other file. `deploy/deployment-repo/apps/simap/compose.yml` stays as is (identical to production; its comment at
lines 15-19 mentions only `DATABASE_URL` but changing it would make it drift from the deployment repo).

## Data model / migration
None.

## API contract
None.

## Tests to write
All in `scripts/deploy-envfile.test.ts`. Extend `setup()`'s `exec` (lines 65-79) with an optional `extra:
Record<string, string>` env argument merged into the spawned env (keep `envFileOverride` working, e.g.
`exec({ envFile?, env? })` or a second parameter). Fake values only, e.g.
`GOOGLE_CLIENT_ID=fake-client-0001.apps.googleusercontent.com`, `GOOGLE_CLIENT_SECRET=fakeSecret_0001`,
`GOOGLE_REFRESH_TOKEN=1//fake-refresh_token-0001`, `DRIVE_FOLDER_ID=fakeFolderId_0001`.

| Test (file › name) | Covers |
|---|---|
| `deploy-envfile.test.ts › envfile step › writes only DATABASE_URL, mode 600; changed=true first, false on re-run` (existing, line 90, unchanged) | no Drive secret set → one line, as before |
| `… › envfile step › all four Drive secrets empty strings: writes only DATABASE_URL` | GitHub passes an unset secret as `""`; `-n` treats it as unset |
| `… › envfile step › all four Drive secrets set: five lines in order, mode 600, values never printed` | file equals `DB_LINE + "GOOGLE_CLIENT_ID=…\nGOOGLE_CLIENT_SECRET=…\nGOOGLE_REFRESH_TOKEN=…\nDRIVE_FOLDER_ID=…\n"`; mode 0o600; `changed=true`; stdout+stderr contain none of the four fake values nor the password; only `simap.env` left in the dir |
| `… › envfile step › one, two or three Drive secrets set: exit 1, names the missing SIMAP_* secrets, old file unchanged` | loop over subsets of size 1, 2, 3; seed `OLD=1\n`; status 1; stderr/stdout contains `all-or-none` and each missing `SIMAP_<name>`; no value printed; file still `OLD=1\n`; no temp file left |
| `… › envfile step › a malformed Drive secret: exit 1, names only that SIMAP_* secret, old file unchanged` | one case per secret with the other three valid: client id without `.apps.googleusercontent.com`, secret with a space, token with `!`, folder id of 9 chars and of 201 chars; output names the bad `SIMAP_*` name and not the value; file unchanged |
| `… › envfile step › changing one Drive value after a run gives changed=true` | rerun with a different fake secret → `changed=true` (so the deploy step recreates the container) |
| `… › deploy-simap.yml static checks › job deploy runs only on main, has no environment key; the only secrets are the four SIMAP_* in the envfile env block` (replaces line 127's test) | keep the main-only and no-`environment:` assertions; collect every `${{ secrets.X }}` in `yml` and expect exactly `[SIMAP_DRIVE_FOLDER_ID, SIMAP_GOOGLE_CLIENT_ID, SIMAP_GOOGLE_CLIENT_SECRET, SIMAP_GOOGLE_REFRESH_TOKEN]` (sorted), each occurring once, all inside `stepLines("envfile")` and before its `run: |` line; and the envfile `env:` maps each to its unprefixed runtime name (e.g. `GOOGLE_CLIENT_ID: ${{ secrets.SIMAP_GOOGLE_CLIENT_ID }}`) |
| existing `no run block contains ${{` (line 132) | unchanged; still guards against secret interpolation inside the script |

## Approach
1. `cp /home/user/deployment/.github/workflows/deploy-simap.yml /home/user/simap/deploy/deployment-repo/.github/workflows/deploy-simap.yml`;
   then `cmp` both and record `sha256sum` of both in impl-log. Do not hand-edit or reformat the copy.
2. README: insert after line 29 a paragraph, e.g.: "Google Drive (device-type images, D61): deploy-simap also
   writes `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` and `DRIVE_FOLDER_ID` to the same host
   env file, from the deployment repository secrets `SIMAP_GOOGLE_CLIENT_ID`, `SIMAP_GOOGLE_CLIENT_SECRET`,
   `SIMAP_GOOGLE_REFRESH_TOKEN` and `SIMAP_DRIVE_FOLDER_ID`. They are all-or-none: none set → images off; all four
   set → images on; one to three set (or a malformed value) → the run fails and the old env file stays. Values are
   never printed. After adding, changing or removing any of them, run `deploy-simap` with `workflow_dispatch` from
   `main`: a manual run rewrites the env file and recreates the container." Names only, no values (R3).
3. Update `scripts/deploy-envfile.test.ts` as in `## Tests to write`. The existing `runBlock`/`stepLines` helpers
   (lines 19-41) already handle the new `env:` block (it sits between `- name: envfile` and `run: |`).
4. Run all Checks (`loop.config.md` → Checks). Additionally run the YAML parse check from the request file
   (`python3 -I -c 'import yaml,sys; yaml.safe_load(open(sys.argv[1]))' deploy/deployment-repo/.github/workflows/deploy-simap.yml`)
   and `actionlint` if available; record results.

Rules: R3 (secret names only, no values; never read any `*.env` file, including `apps/simap/release.env` in either
repo), R4 (only the three files above), R5 (tests for the copied logic). Guardrail: the deployment repo is read
only; nothing is written there.

## Specialist input used
None (no consult row for area `security`). Review triggers: `security-ai-generated-code-auditor` runs at REVIEW
(area `security`; the changed path contains `.github/workflows/`).

## Assumptions
- A1 Updating `scripts/deploy-envfile.test.ts` is in scope even though the ticket lists only `deploy/deployment-repo/**`:
  without it the static check at line 130 fails on the byte-identical copy, and R5 asks for tests of the new logic.
  The test asserts behaviour of the copy; it never edits the workflow.
- A2 If `pnpm format:check` (oxfmt) flags the copied YAML, do not reformat it (AC1 wins). Record it in impl-log and
  stop for the orchestrator; adding the file to `.prettierignore` would be the proposed fix, but it is outside this
  plan's file list. Unlikely: the changes are inside a `run: |` block scalar, comments, and a plain `env:` map like
  existing ones.
- A3 The README paragraph is new text in the simap draft only; the deployment repo README has no simap section, so
  there is nothing to mirror byte-for-byte there.
- A4 Hotspots: no other open ticket (SIM-037.7 is `IN_PROGRESS`, ui/ux) touches `deploy/**` or
  `scripts/deploy-envfile.test.ts`. No rebase expected.
- A5 The dispatch note said the draft folder has no workflows dir; it does (hidden `.github/`). The plan replaces the
  existing file rather than creating one.

## Blocking questions
None.

## Split proposal
None (about 40 lines in the workflow copy, ~10 in the README, ~80 in the test file).
