# src/lib

Pure isomorphic code: types, DTOs and hand-written validators (`src/lib/validate/`).

- May import `src/lib/**` only; no `src/server`, `src/ui` or `src/app`.
- No I/O, no `server-only`. Enforced by `pnpm check:layers`.
