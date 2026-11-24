# SIM-036.1: Google Drive image storage client (tudocuatui pattern)

| Field | Value |
|---|---|
| State | DONE |
| Priority | P2 |
| Size | M |
| Areas | architecture, security |
| Gate | plan-approval |
| Depends on | — |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-24 |
| Claimed by | claude@2026-11-24T15:10:59Z |
| PR | — |

## Goal
simap can store and read small images in Google Drive from the server only, the same way tudocuatui stores item
photos, so device types can carry an image (SIM-036.2).

## Scope reference
- `work/decisions.md` D61 (images in Google Drive like tudocuatui), R3 (config from env only).
- tudocuatui reference: its `server/drive.js` and decisions D27, D28, D34, D41 (`spaceM/projects/tudocuatui`).

## Scope
- `src/server/drive/` (server-only): config loader from env (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `GOOGLE_REFRESH_TOKEN`, `DRIVE_FOLDER_ID`; all unset = off, partly set or malformed = startup error naming variables
  only), OAuth token refresh, upload (multipart), download (`alt=media`), delete, and a per-org subfolder
  (`<root>/<org_id>/`, cached in memory, single-flight). A TypeScript port of tudocuatui's client: plain `fetch`, no
  new dependency.
- Errors carry a fixed code only (no Google message, URL or headers); logs hold `{event, op, status, code}` only.
- Variable names (no values) in `.env.example`.

## Out of scope
- Any route, table or UI (SIM-036.2+). An orphan sweep job (follow-up if needed).

## Acceptance criteria
- [ ] Config: all four unset gives `off`; any subset set, whitespace, or a malformed client id / folder id gives an
      error naming the variables only; unit tests.
- [ ] Upload, download and delete call the Drive v3 endpoints with scope `drive.file` and map Google failures to fixed
      codes (`drive_auth`, `drive_not_found`, `drive_rate_limited`, `drive_unavailable`, `drive_too_large`, ...);
      unit tests with a fake `fetch`.
- [ ] Files go into the org's subfolder; the subfolder is created once per org (concurrent calls share one lookup);
      a file id is validated before it is used in a URL.
- [ ] No secret, token or Drive response text appears in logs, errors or client bundles (`pnpm check:layers` passes;
      a test asserts the error and log shape).

## Technical notes
- High path: `.env.example`. The new server module starts with `import "server-only"`.
- Risks / open questions: one Drive account for every org (Ming's, as tudocuatui D38); confirm at plan approval.

## Test plan
- Unit: config loader; client with fake fetch (token refresh, upload, download, delete, error mapping, folder cache).
- Manual (after M-46): a dev script uploads and reads back one PNG.

## Notes / answers from Ming
- 2026-11-24: "Lưu trên GG drive như bên tudocuatui" (D61).
- 2026-11-24: Plan approved (Ming: "duyệt"), defaults A1-A12 as written in plan.md.

## Handoff

### 2026-11-24 — claude — BLOCKED
- Agent calls: 2, tokens ~95k total (software-architect×1 default 39k, planner×1 default 57k)
- Done: consult (architecture), plan.md READY with defaults A1-A12.
- In progress / next: Ming approves the plan (M-48, High path `.env.example` and `src/server/drive/config.ts`), then /run SIM-036.1 implements.
- Gotchas: planner could not grep `.env.example` names (permission); implementer must grep `^(GOOGLE_|DRIVE_)` before adding. Production env reaches the container only via `simap.env` (deploy writes only DATABASE_URL): passing the Drive values needs a separate deploy ticket before SIM-036.2 goes live.
