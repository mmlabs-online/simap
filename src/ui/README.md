# src/ui

Components, hooks and the `src/ui/api/` fetch client that attaches the bearer token.

- May import `src/ui/**` and `src/lib/**` only; never `src/server` (D4).
- Org data is fetched from `/api/*`, never read directly. Enforced by `pnpm check:layers`.

## Copy

All user-facing text lives in `src/ui/copy/<feature>.ts` (English, D36); names and data are never copy.

- One file per feature, lower camelCase name, exporting one `export const <feature>Copy = { ... } as const;`.
  Group by screen/part (`title`, `empty`, `actions`, `errors`, `fields`); strings needing values are small pure
  functions; use `satisfies Record<Id, string>` for per-enum labels.
- Components import relatively (`./copy/rooms`); pages under `src/app/**` import `@/ui/copy/rooms`. Copy files import
  only types from `@/lib/**`. Reusable kit components take text via props, defaulting to `kitCopy`.
- `src/ui/copy/no-literals.test.ts` fails on JSX text or user-facing props (`aria-label`, `title`, `placeholder`, ...)
  holding literals, and on Vietnamese diacritics in copy. Escape hatch: end the line with `// copy-ok: <reason>`.
- Page titles come from copy (`metadata`/`generateMetadata`).
