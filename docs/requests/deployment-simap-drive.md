# Request for mmlabs-online/deployment: Google Drive secrets for simap

Paste the prompt below into a Claude Code session on `mmlabs-online/deployment`. It changes only
`.github/workflows/deploy-simap.yml` (and the simap section of the README, if there is one). Context: simap stores
device-type images in Google Drive (simap D61, tickets SIM-036.1/.2/.5). The app reads four env vars and treats them
as a group: all unset → images off (upload answers 503 `images_unavailable`); all four set and valid → images on;
anything in between → every image request fails. Today `deploy-simap.yml` writes only `DATABASE_URL` to the host env
file, so secrets alone do not reach the container.

---

## Prompt

You are working in `mmlabs-online/deployment`. Make one pull request from a branch that does **not** start with
`release/` (so `pr-scope` allows it). Ming reviews and merges it; do not merge, do not run any workflow, and do not
touch any other app.

**Goal:** `deploy-simap` writes simap's four Google Drive values to the host env file, exactly the way
`deploy-tudocuatui.yml` already does for TuDoCuaTui (its `envfile` step). Follow that step as the reference and keep
simap's existing behaviour for everything else.

**Change `.github/workflows/deploy-simap.yml`:**

1. In the `envfile` step, add an `env:` block that maps repository secrets to the names the app reads:
   ```yaml
   env:
     GOOGLE_CLIENT_ID: ${{ secrets.SIMAP_GOOGLE_CLIENT_ID }}
     GOOGLE_CLIENT_SECRET: ${{ secrets.SIMAP_GOOGLE_CLIENT_SECRET }}
     GOOGLE_REFRESH_TOKEN: ${{ secrets.SIMAP_GOOGLE_REFRESH_TOKEN }}
     DRIVE_FOLDER_ID: ${{ secrets.SIMAP_DRIVE_FOLDER_ID }}
   ```
2. After the existing password check and before writing the temp file, add the **all-or-none** check over those
   four names. If 1–3 are set, fail with
   `::error::Google Drive secrets are all-or-none; missing: <SIMAP_… names>. Nothing was started; $ENV_FILE was not changed.`
   and exit 1 (the old env file stays, nothing is started).
3. When all four are set, validate the format and fail the same way, naming only the bad secret names:
   - `GOOGLE_CLIENT_ID` matches `^[A-Za-z0-9._-]+\.apps\.googleusercontent\.com$`
   - `GOOGLE_CLIENT_SECRET` matches `^[A-Za-z0-9._-]+$`
   - `GOOGLE_REFRESH_TOKEN` matches `^[A-Za-z0-9._/-]+$`
   - `DRIVE_FOLDER_ID` matches `^[A-Za-z0-9_-]{10,200}$` (the same pattern simap's `src/server/drive/config.ts` uses)
4. After the existing `printf 'DATABASE_URL=…'` line, append the four lines only when all four are set:
   ```bash
   printf 'GOOGLE_CLIENT_ID=%s\nGOOGLE_CLIENT_SECRET=%s\nGOOGLE_REFRESH_TOKEN=%s\nDRIVE_FOLDER_ID=%s\n' \
     "$GOOGLE_CLIENT_ID" "$GOOGLE_CLIENT_SECRET" "$GOOGLE_REFRESH_TOKEN" "$DRIVE_FOLDER_ID" >> "$tmp"
   ```
   Keep `umask 077`, the temp file, `chmod 600`, the `cmp`/`changed` output and the `mv` exactly as they are, so a
   changed env file still recreates the container (the existing `CHANGED` / `workflow_dispatch` → `--force-recreate`
   logic).
5. Never print a secret value: no `echo`, no `set -x`, no value in an argv, no value in an error message (names only).
6. Update the header comment: step 2 now writes `DATABASE_URL` and, when all four are set, the Google Drive values;
   replace "No repository secret is used" with a short note naming the four `SIMAP_*` secrets (all-or-none, written
   only to the host env file, never printed) and saying that after changing them you run `deploy-simap` with
   `workflow_dispatch` from `main`. The job already runs only on `main` (`if: github.ref == 'refs/heads/main'`); keep that.
7. If the README has a simap section, add the same four secret names and the `workflow_dispatch` note there.

**Check before opening the PR:**
- `git diff` touches only `deploy-simap.yml` (and the README, if changed).
- Run `actionlint` on the workflow if it is available; otherwise check the YAML parses
  (`python3 -c 'import yaml,sys; yaml.safe_load(open(sys.argv[1]))' .github/workflows/deploy-simap.yml`).
- Extract the `envfile` script and run it locally in a temp `HOME` with fake values for three cases: none set (env
  file has only `DATABASE_URL`), all four set (five lines), two set (exits 1, file unchanged). Use obviously fake
  values, never real secrets.

**PR text:** title `simap: write Google Drive secrets to the host env file`; say that it mirrors
`deploy-tudocuatui.yml`, that it is a no-op until the four `SIMAP_*` secrets exist, and list the steps for Ming
below.

---

## Ming's steps around this PR

1. Google (simap `work/ming-todo.md` M-46): create the Drive folder `simap/`, an OAuth client and a refresh token
   with scope `drive.file`, like tudocuatui (its D27/D28).
2. `mmlabs-online/deployment` → Settings → Secrets and variables → Actions: add `SIMAP_GOOGLE_CLIENT_ID`,
   `SIMAP_GOOGLE_CLIENT_SECRET`, `SIMAP_GOOGLE_REFRESH_TOKEN`, `SIMAP_DRIVE_FOLDER_ID` (all four together).
3. Merge the PR, then run `deploy-simap` with `workflow_dispatch` from `main`. The run rewrites
   `/Users/mingming/.config/simap/simap.env` and recreates the container.
4. Check on `simap.mmlabs.online` as an Admin, after SIM-036.3 ships (or with the API directly): upload a 24 × 24 PNG
   for a device type, load it, replace it, remove it, and confirm the old files leave the Drive folder.

The simap repo keeps a draft of this workflow in `deploy/deployment-repo/`; ticket SIM-038 syncs that draft with the
merged deployment-repo file afterwards.
