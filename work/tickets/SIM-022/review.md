## Attempt 1 — 2026-11-20
Verdict: REWORK

### Checks (run by reviewer)
Local env: Windows, Node 24 (`engine-strict=false`); CI uses Node 22.
- `pnpm format:check` — exit 0, "All matched files use the correct format." (96 files)
- `pnpm typecheck` — exit 0
- `pnpm check:layers` — exit 0, "74 files, no violations"
- `pnpm test` — exit 0, "Test Files 28 passed (28); Tests 183 passed | 3 skipped (186)" (matches impl-log)
- `pnpm build` — exit 0, "Compiled successfully"
- One-off: standalone server (`.next/static` copied next to it), `curl` of `/`, `/rooms`, `/rooms/A1`, `/rooms/A1/edit`,
  `/members`, `/devices`, `/approvals`: every response has `<html lang="en"`, `<title>simap</title>`, visible text
  "Skip to main content", "Signed out", "Sign in with your mmlabs account to continue.", "Sign in", aria-label
  "Toggle light/dark theme"; no Vietnamese. `/dev/shell` returns 404 in production (dev-only `notFound()`, as designed),
  so the gallery was checked from source only. Server stopped afterwards.

### Acceptance criteria
- [x] Every string visible in the shell and the page skeletons is English — evidence: `src/ui/copy/shell.ts`, `kit.ts`,
  `gallery.ts` all English; `no-literals.test.ts › copy files contain no Vietnamese diacritics` passes; curl output above;
  reviewer NFD scan of all non-test `src/**/*.ts(x)` finds diacritics only in data (`KitGallery.tsx:56-57` avatar names,
  `src/app/dev/shell/page.tsx:20` preview org name, `src/lib/format.ts:1` doc comment). Signed-in skeletons are
  client-rendered; covered by `AppShellView.test.tsx` and `kit.test.tsx` asserting copy keys.
- [ ] No user-facing literal remains outside the copy files, enforced by a test — the current code is clean (reviewer's
  broader scan found none), but the enforcing test misses the planned case of text on its own line. See Issue 1.
- [x] `<html lang>` is `en` — `src/app/layout.tsx:18`; curl shows `<html lang="en"`; test `root layout declares lang en`.
- [x] Names with Vietnamese diacritics still render — `layout.tsx:9` keeps `subsets: ["latin", "vietnamese"]`
  (unchanged); avatar names kept as data in `KitGallery.tsx:56-57`. Visual check in `/dev/shell` not possible here
  (no browser, and the route is dev-only); the font subset is unchanged from SIM-003.
- [x] Checks green — see above.

Scope: all 13 changed files are in the plan's file list (plus ticket work files). No High path touched.
`// copy-ok` use: one, `src/app/dev/shell/KitGallery.tsx:84` `placeholder="A1" // copy-ok: sample room code is data`
— acceptable (room code is data, as the plan's Approach step 2 says).

### Issues
#### Issue 1 — 🔴 blocker — literal check does not catch JSX text on its own line
- **Where**: `src/ui/copy/no-literals.test.ts:9` (`JSX_TEXT`) and the self-check at lines 37-40.
- **Expected**: plan "Copy-file convention" item 4(a): the test fails on JSX text children "including text on its own
  line inside an element". oxfmt wraps longer JSX text onto its own line, so this is the common form (the old
  `KitGallery.tsx` had `<Button variant="outlined" icon="add">\n          Viền\n        </Button>`).
- **Actual**: the leading class `[^<>{}();=\n]*` cannot cross the newline after `>`, so own-line text is never matched.
  Reviewer probe: `findLiterals('<Button icon="add">\n          Viền\n        </Button>')` returns `[]`. Running the test's
  regex over `origin/main`'s `KitGallery.tsx` reports 9 literals but misses `Viền`.
- **Fix instruction**: drop `\n` from the leading class:
  `const JSX_TEXT = />([^<>{}();=]*\p{L}[^<>{}();=]*)</gu;`. Reviewer ran this regex over every scanned file in the
  branch: zero matches (no false positives), and over `origin/main`'s `KitGallery.tsx`: all 10 literals including
  `Viền`. Add a self-check line, e.g.
  `expect(findLiterals('<b>\n  Hello\n</b>')).toEqual(["Hello"]);`. Keep everything else unchanged.

### Rules (CLAUDE.md)
No violations found. R1: copy files import only `@/lib` types; `layout.tsx` (page layer) imports `@/ui/copy/shell`,
allowed; `check:layers` green. R4: in plan. R5: new test added (but see Issue 1).

### Blockers from review agents
None.

### Nits (do not block)
- 💭 `src/app/dev/shell/page.tsx:20` preview fixture `orgName: "Tổ chức xem trước"` is data, so allowed by D36, but an
  English preview name (or a diacritic name kept on purpose to exercise the font) would read clearer in an English UI;
  a comment saying which is intended would do.
- 💭 `JSX_TEXT` also misses text that follows an expression (`<p>{n} free</p>`) and text containing `(`, `)`, `;` or
  `=` (e.g. `Sign in (beta)`). Not in the plan; noted in the test header as heuristic is fine.

### Follow-ups (out of scope)
- Consider an AST-based literal check (e.g. TypeScript compiler API over `JsxText` nodes) if the regex heuristic
  produces gaps or false positives as features land.

## Attempt 2 — 2026-11-20
Verdict: PASS

### Checks (run by reviewer)
Local env: Windows, Node 24 (`--config.engine-strict=false`); CI uses Node 22.
- `pnpm format:check` — exit 0 (96 files)
- `pnpm typecheck` — exit 0
- `pnpm check:layers` — exit 0, "74 files, no violations"
- `pnpm test` — exit 0, "Test Files 28 passed (28); Tests 183 passed | 3 skipped (186)"
- `pnpm build` — exit 0

### Issue 1 (attempt 1) — resolved
- Fix commit `b05d574` changes only `src/ui/copy/no-literals.test.ts` (plus impl-log): `JSX_TEXT` is now
  `/>([^<>{}();=]*\p{L}[^<>{}();=]*)</gu` (the `\n` exclusion is dropped) and the self-check
  `findLiterals("<b>\n  Hello\n</b>")` equals `["Hello"]` is added (line 38).
- The test `components contain no user-facing literals` passes, so the self-check holds and the scan over `src/ui` and
  `src/app` (non-test `.tsx`, excluding `src/app/api`) yields `offenders = []`: no false positives.
- Independent probe: the new regex over `origin/main`'s `KitGallery.tsx` finds `Viền` (the own-line case missed in attempt 1).
- Working tree clean after the checks; no other code changed since attempt 1; scope and rules findings from attempt 1 stand.

### Acceptance criteria
All met (the literal-enforcement criterion is now backed by a working test; the others are unchanged from attempt 1).

### Nits (do not block)
- Attempt 1 nits stand (heuristic gaps for text after `{expr}` or containing `(`, `)`, `;`, `=`; preview org name comment).

### Follow-ups (out of scope)
- AST-based literal check if the regex heuristic develops gaps (from attempt 1).
