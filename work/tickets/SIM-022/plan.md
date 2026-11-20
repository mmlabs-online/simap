Status: READY

# Plan — SIM-022: Switch UI copy to English by default

## Scope summary
- Ticket scope: "Translate the copy SIM-003 shipped (shell, nav, page titles, empty states, theme toggle) to English."
  "Make sure no user-facing literal lives in a component: all text comes from the copy files under `src/ui/` … one file
  per feature." "Set `<html lang="en">` and the page titles/metadata in English." "Update CLAUDE.md /
  `.claude/loop.config.md` "Domain focus" wording if they still say Vietnamese UI copy."
- D36: "UI copy is English by default; all user-facing text lives in copy files so another language can be added later.
  Names/data keep Vietnamese diacritics (display, sort, search)."
- D39: SIM-003 merged with Vietnamese copy; this ticket switches it. D40: "v1 ships English only; … a language switcher and
  Vietnamese translation come after v1." (out of scope here).
- `docs/spec-v1.md` §8 (line ~460) already says copy lives in copy files and names keep diacritics.

Findings in the current code (SIM-003 on main):
- Copy files exist: `src/ui/copy/shell.ts` (`shellCopy`), `src/ui/copy/kit.ts` (`kitCopy`), test `src/ui/copy/copy.test.ts`.
  Components already import them (`AppShellView`, `ThemeToggle`, `RoleBadge`, `EntityFormDialog`, route pages).
- One stray set of literals: `src/app/dev/shell/KitGallery.tsx` (dev-only gallery, lines 19-23, 32-78: Vietnamese
  button/field/dialog text inline).
- `src/app/layout.tsx:17` has `lang="vi"`; `metadata.title` is the literal `"simap"` (line 13).
- Tests assert Vietnamese strings: `src/ui/AppShellView.test.tsx:33` (`Điều hướng chính`), `src/ui/kit.test.tsx` (lines
  ~9-30, `Tìm`, `Hủy`, `Đang lưu…`).

## Copy-file convention (SIM-006 and SIM-010 must follow this)
1. **Location and naming**: `src/ui/copy/<feature>.ts`, one file per feature (`shell.ts`, `kit.ts` exist; SIM-006 adds
   e.g. `signIn.ts`, SIM-010 adds `rooms.ts`). File name is lower camelCase of the feature.
2. **Shape**: each file exports one `export const <feature>Copy = { ... } as const;` (e.g. `roomsCopy`). Nested objects
   group by screen/part (`title`, `empty`, `actions`, `errors`, `fields`). Strings that need values are small pure
   functions in the same object, e.g. `seatsFree: (n: number) => \`${n} free\``. Use `satisfies Record<Id, string>` for
   per-enum labels (as `shellCopy.nav`/`tiers` do). Only English text, NFC, no mojibake. Names, codes and other data are
   never in copy files.
3. **How components import copy**: UI components import relatively (`import { roomsCopy } from "./copy/rooms"`); pages
   under `src/app/**` import with the alias (`import { roomsCopy } from "@/ui/copy/rooms"`). Copy files import only types
   from `@/lib/**` (layer rule R1 unchanged; `pnpm check:layers` is not touched). Components take text from copy and
   pass it down as props; reusable kit components get text via props with defaults from `kitCopy`.
4. **No literal check**: new test `src/ui/copy/no-literals.test.ts` (runs in `pnpm test`) scans every non-test `.tsx`
   file under `src/ui/**` and `src/app/**` (excluding `src/app/api/**`) and fails on (a) JSX text children containing a
   letter (`>Some text<` including text on its own line inside an element), and (b) string literals (`"…"`, `'…'`)
   assigned to user-facing props: `aria-label`, `title`, `placeholder`, `alt`, `label`, `subtitle`, `submitLabel`,
   `cancelLabel`, `emptyText`, `description`. Values that are only `{expr}` expressions pass. Same test also fails if any
   `src/ui/copy/*.ts` string contains a Vietnamese diacritic (regex on NFD combining marks and `đĐ`), so copy stays
   English. Escape hatch: a line ending with `// copy-ok: <reason>` (for non-text such as `aria-current="page"` style
   values; the reviewer checks each use). `copy.test.ts` keeps the structural checks (NFC, non-empty, key coverage) and
   automatically covers new copy files, because it imports the list via `import.meta.glob("./*.ts")` (see Tests).
5. **Metadata**: page titles come from copy too (`export const metadata = { title: shellCopy.brand }`-style, or
   `generateMetadata` using the feature copy).

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | Every string visible in the shell and the page skeletons is English. | `pnpm dev`, open `/`, `/rooms`, `/rooms/A1`, `/rooms/A1/edit`, `/members`, `/devices`, `/approvals`, `/dev/shell?tier=admin`: all text English. Test `src/ui/copy/no-literals.test.ts › copy files contain no Vietnamese diacritics`. |
| 2 | No user-facing literal remains in `src/ui/**` or `src/app/**` components outside the copy files (enforced by a test). | `pnpm test` → `no-literals.test.ts › components contain no user-facing literals`; reviewer greps `KitGallery.tsx` for quoted words. |
| 3 | `<html lang>` is `en`. | `src/app/layout.tsx` has `lang="en"`; one-off: `pnpm build && node .next/standalone/server.js`, `curl /` shows `<html lang="en"`. Also test `src/ui/copy/no-literals.test.ts › root layout declares lang en` (reads layout.tsx text). |
| 4 | Names with Vietnamese diacritics still render correctly (font covers them). | `layout.tsx` still has `subsets: ["latin", "vietnamese"]` (unchanged, reviewer checks diff); `KitGallery` avatars keep "Nguyễn Văn An" / "Lê Thị Bình" as data and render in Manrope in `/dev/shell` (manual, light and dark). |
| 5 | Checks green. | `pnpm format:check && pnpm typecheck && pnpm check:layers && pnpm test && pnpm build`. |

## Ming verification after merge
None (the manual page walk-through is done by the reviewer in a local run).

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/ui/copy/shell.ts` | translate all strings to English; doc comment says English | AC1 | no |
| `src/ui/copy/kit.ts` | translate (`Cancel`, `Save`, `Saving…`, `Close`) | AC1 | no |
| `src/ui/copy/gallery.ts` | create: `galleryCopy` for the dev gallery (headings, buttons, filters, dialog) | AC2, KitGallery has literals | no |
| `src/app/dev/shell/KitGallery.tsx` | replace all literals with `galleryCopy` (import `@/ui/copy/gallery`); avatar names stay as data | AC2 | no |
| `src/app/layout.tsx` | `lang="en"`; `metadata.title` from `shellCopy.brand` | AC3 | no (not matched by `**/config.*` etc.) |
| `src/ui/copy/copy.test.ts` | load all copy files via `import.meta.glob`; relax the `"?"` rule to `"??"` (English questions are legal); keep NFC/non-empty/U+FFFD and NavId/Tier coverage | new copy files auto-covered | no |
| `src/ui/copy/no-literals.test.ts` | create: the literal check described above (node `fs` scan, no new dependency) | AC2, AC3 | no |
| `src/ui/AppShellView.test.tsx` | line 33 and any Vietnamese expectation: use `shellCopy.navLabel` instead of a literal | tests follow copy | no |
| `src/ui/kit.test.tsx` | update Vietnamese expectations (`Tìm` label, `Hủy`, `Đang lưu…`) to `kitCopy.*` / English; rename test titles ("shows tier label") | tests follow copy | no |
| `src/ui/README.md` | add a short "Copy" section with the convention above | SIM-006/010 need it written down | no |
| `.claude/loop.config.md` | Domain focus line 81: "Vietnamese text and diacritics" → "Vietnamese diacritics in names and data (UI copy is English, D36)" | ticket scope | no |
| `CLAUDE.md` | no change needed: only mention is "reports to Ming in Vietnamese" (line 79), which stays; add one Conventions line "UI copy: English, in `src/ui/copy/<feature>.ts` (D36)" | ticket scope | no |

No file on the High-path list is touched (`scripts/check-layers.mjs` deliberately left alone).

## Data model / migration
None.

## API contract
None.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/ui/copy/no-literals.test.ts › components contain no user-facing literals` | JSX text and user-facing string props in `src/ui/**`, `src/app/**` (not api, not tests); includes a self-check on a fixture string so the regex is proven to catch `<p>Hello</p>` and `aria-label="Hi"` and to pass `{shellCopy.x}` |
| `src/ui/copy/no-literals.test.ts › copy files contain no Vietnamese diacritics` | every `src/ui/copy/*.ts`: no `/[̀-ͯ]/` after NFD, no `đ`/`Đ` |
| `src/ui/copy/no-literals.test.ts › root layout declares lang en` | `lang="en"` present in `src/app/layout.tsx`, `lang="vi"` absent |
| `src/ui/copy/copy.test.ts › every copy string is NFC, non-empty, no U+FFFD` | updated rule, all copy files via glob (string-valued leaves; function leaves skipped) |
| `src/ui/copy/copy.test.ts › labels cover every NavId and Tier` | existing, unchanged (no missing key) |
| `src/ui/AppShellView.test.tsx` (existing cases) | still pass with English `navLabel`, skip link, signed-out text |
| `src/ui/kit.test.tsx` (existing cases) | RoleBadge shows tier label, Icon label, dialog buttons with `kitCopy` values |

## Approach
1. Translate `shell.ts` and `kit.ts` (keep keys identical so no component changes). Proposed English: brand `simap`;
   navLabel `Main navigation`; skipLink `Skip to main content`; nav Dashboard / Rooms / Devices / Members / Approvals /
   Edit room layout; tiers User / Manager / Admin; actions `Switch organization`, `Refresh permissions`, `Sign out`,
   `Toggle light/dark theme`; signedOut `Signed out` / `Sign in with your mmlabs account to continue.` / `Sign in`;
   pages: `No data yet.`, `No rooms yet.`, `No members yet.`, `No devices yet.`, `No pending requests.`; roomDetail
   `Room details`.
2. Create `gallery.ts`, rewrite `KitGallery.tsx` to use it (FILTERS built inside the component from copy). Keep
   avatar names, room code `A1` placeholder as data.
3. `layout.tsx`: `lang="en"`, title from copy. Leave fonts and subsets untouched (D36 keeps diacritic names).
4. Write `no-literals.test.ts` (recursive `readdirSync`, skip `*.test.*`, `src/app/api`, `src/ui/copy`, and
   `src/test`), run it, fix any component it flags by moving text into copy.
5. Update `copy.test.ts`, `AppShellView.test.tsx`, `kit.test.tsx`.
6. Docs: `src/ui/README.md`, `loop.config.md` domain focus, `CLAUDE.md` conventions line.
7. Run all checks; manual walk of every route in light and dark. Rules: R1 (copy only imports lib types), R4 (only these
   files), R5 (tests added).

## Specialist input used
None (fast lane: Size S, Gate none, no consult).

## Assumptions
- Default: the literal check is a Vitest test using regex scanning, not a script in `scripts/` (avoids the High-path
  `scripts/check-layers.mjs`, runs in the existing `pnpm test` check, no `.github` or package.json change). Regex scanning
  is heuristic (it cannot see strings built in code); this is stated in the test header.
- Default: dev gallery text also moves to copy (`gallery.ts`) instead of being exempted, so the rule has no exceptions.
- Default: the English wording in Approach step 1 is final unless Ming edits it in the approval round; wording is cheap
  to change later because it is centralised.
- Default: `"?"` is no longer banned in copy (it was a Vietnamese-mojibake guard); `"??"` and U+FFFD are.
- Default: no per-page `metadata` exists yet; only the root `title` is set from copy. Feature tickets add page titles
  via their copy file.
- Convention (above) applies to SIM-006 and SIM-010; if either lands before this ticket, its copy files must already be
  English and pass the new test (the test applies to all `src/ui/copy/*.ts`).
- Hotspots: `src/ui/copy/shell.ts` and `src/ui/kit.test.tsx` may also be edited by SIM-006 / SIM-010 (they add keys);
  expect a trivial rebase. `src/app/layout.tsx` is touched by SIM-006 if it wires auth providers.
- SIM-023 (new on the board) is not read here; if it also edits copy, same rebase note applies.

## Blocking questions
None.

## Split proposal
None. Estimated diff well under 400 lines (mostly the new test and gallery copy).
