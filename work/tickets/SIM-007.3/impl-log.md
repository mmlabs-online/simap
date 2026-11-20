
# Implementation log — SIM-007.3

## Attempt 1

### Files touched
- `src/lib/identity/flow.ts` — `MeResult.me.member`, `MeView` kind `profile`, `viewForMe` and `readMeResult` (strict member guard). Required: S3.
- `src/lib/identity/flow.test.ts` — member guard, profile view, ready fallbacks (replaced the old "reads tier and email from the SIM-007 body" case, which asserted `member` was dropped).
- `src/ui/org/profile-form.ts` (+ `.test.ts`) — `validateProfileName`, `profilePatchInit`, `mapPatchResult`.
- `src/ui/org/ProfileView.tsx` (+ `profile-views.test.tsx`) — form view.
- `src/ui/copy/profile.ts` — copy.
- `src/ui/auth/AuthGate.tsx` — `profile` view, `apply` case, `saveProfile`, render case.

### Tests added
As listed in the plan (flow, profile-form, profile-views).

### Checks (WSL)
- format:check: exit 0 ("All matched files use the correct format")
- typecheck: exit 0
- check:layers: "202 files, no violations"
- test: 72 files, 711 tests passed
- build: exit 0

### Deviations (adapted to merged SIM-007.2)
- `ProfileView` uses `FilledInput` + its own label instead of `Field`: the shared `Field` does not accept `maxLength`/`required`, and changing `fields.tsx` is outside the plan.
- Validation runs inside `ProfileView` (local state, errors `required`/`invalid`); the gate passes only server-side errors (`invalid` on 400, `retry` otherwise).
- `mapPatchResult` is async (reads the 200 body to check `needsProfile === false`); `saveProfile` then feeds the response into `readMeResult` → `viewForMe` → `apply`.
- No other deviations; org code (`enterOrg`, `selectAndCheck`, switcher) untouched.

### Out-of-plan files
None.

### Follow-ups
- Display name is not in the session/shell yet.
- Manual local run (new account -> profile -> app) not done here: needs Identity and DB. Left for Ming's post-merge check.

### Scope self-check
Only plan files changed; no server, db or High paths.
