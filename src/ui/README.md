# src/ui

Components, hooks and the `src/ui/api/` fetch client that attaches the bearer token.

- May import `src/ui/**` and `src/lib/**` only; never `src/server` (D4).
- Org data is fetched from `/api/*`, never read directly. Enforced by `pnpm check:layers`.
