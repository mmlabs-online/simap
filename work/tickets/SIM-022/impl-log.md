## Attempt 1 — 2026-11-20

### Files touched
| File | Required because |
|---|---|
| `src/ui/copy/shell.ts`, `src/ui/copy/kit.ts` | translated to English (AC1) |
| `src/ui/copy/gallery.ts` (new) | gallery text moved out of the component (AC2) |
| `src/app/dev/shell/KitGallery.tsx` | literals replaced with `galleryCopy`/`kitCopy`; sample room code `A1` kept as data with `// copy-ok` |
| `src/app/layout.tsx` | `lang="en"`, title from `shellCopy.brand` (AC3) |
| `src/ui/copy/copy.test.ts` | all copy files via `import.meta.glob`; `"?"` rule relaxed to `"??"` |
| `src/ui/copy/no-literals.test.ts` (new) | literal / diacritics / lang checks |
| `src/ui/AppShellView.test.tsx`, `src/ui/kit.test.tsx` | expectations follow copy |
| `src/ui/README.md` | Copy convention for SIM-006/010 |
| `.claude/loop.config.md`, `CLAUDE.md` | Domain focus wording; conventions line |

### Tests added / changed
- `src/ui/copy/no-literals.test.ts` › components contain no user-facing literals (with regex self-check), copy files contain no Vietnamese diacritics, root layout declares lang en
- `src/ui/copy/copy.test.ts`, `AppShellView.test.tsx`, `kit.test.tsx` updated

### Checks (actual output summary)
- typecheck: exit 0
- format:check: exit 0 ("All matched files use the correct format")
- check:layers: exit 0 (74 files, no violations)
- test: 28 files passed; 183 passed | 3 skipped
- build: exit 0 (Compiled successfully)

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- Manual light/dark walk of the routes and the `curl /` lang check were not run here; reviewer to do.

### Scope self-check
- Could the diff be smaller? No.
- Diff size: about +114 / -83 lines tracked, plus two new files.

## Attempt 2 — 2026-11-20 (REWORK, review Attempt 1 Issue 1)

### Files touched
| File | Required because |
|---|---|
| `src/ui/copy/no-literals.test.ts` | `JSX_TEXT` leading class no longer excludes `\n`, so own-line JSX text is caught; self-check `<b>\n  Hello\n</b>` added |

### Checks
- format:check, typecheck, check:layers (74 files, no violations), test, build: all exit 0 (test counts below in the report)

### Out-of-plan files
None.

### Follow-ups
None new.

### Scope self-check
- Smaller diff possible? No (+2/-1 lines).
