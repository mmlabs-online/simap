Status: READY

# Plan — SIM-018: CSV export

## Scope summary
- Spec DSH-02: "Manager+ export CSV (opens in Excel, UTF-8 with BOM for Vietnamese) of seats with occupants, devices and members of the org (D27)."
- D27: "CSV export (seats with occupants, devices, members) for Manager+; room layout export as PNG if feasible in v1."
- Ticket scope: "CSV (UTF-8 with BOM) for seats with occupants, devices, members (Manager+)." Out of scope: `.xlsx`, room layout PNG (D47: follow-up with the map tickets).
- Ming 2026-11-24: Users may see colleagues' emails; exports are Manager+, so email is allowed in the members file.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | CSV opens in Excel with correct Vietnamese characters in names. | `csv.test.ts › starts with the UTF-8 BOM` and `› keeps Vietnamese text intact`. Route test asserts `Content-Type: text/csv; charset=utf-8` and that the body bytes begin `EF BB BF`. Excel itself is checked by Ming (below). |
| 2 | Exports contain only the caller's org. | `export.test.ts › every query goes through orgQuery with scope.orgId as $1` (fake db records SQL and values). `export.db.test.ts › two orgs: each export lists only its own rows` (CI, `pnpm test:db`). |
| 3 | Users get 403 on CSV routes. | `export/[kind]/route.test.ts › user tier gets 403 forbidden for every kind and nothing is queried`. `routes-guarded.test.ts` already proves the route is wrapped by `withAuth`. |
| 4 | Unit tests cover CSV escaping. | `src/lib/export/csv.test.ts` (see Tests). |

## Ming verification after merge
- Open each of the three downloaded files in Excel (double-click, no import wizard): Vietnamese names such as "Nguyễn Thị Ánh" display correctly, columns split correctly, and a cell whose source text is `=1+1` shows as text `'=1+1`, not a result.
- Download from the hosted Dashboard as a Manager (button visible) and confirm a plain User does not see the buttons.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/export/csv.ts` | Create. Pure: `csvCell`, `toCsv(columns, rows)`, `EXPORT_KINDS`, `isExportKind`, `exportFilename(kind, now)`, `EXPORT_MAX_ROWS = 10_000`. | Pure logic first; shared by server and tests. | no |
| `src/lib/export/csv.test.ts` | Create. | Escaping and injection tests. | no |
| `src/server/export/export.ts` | Create (`import "server-only"`). `exportRows(pool, scope, kind)` returns `{ columns, rows, truncated }`; one `withTx` read-only repeatable-read transaction, `orgQuery` for each statement, `limit EXPORT_MAX_ROWS + 1`. Copy the `withTx` + `set transaction ... read only` pattern from `src/server/search/search.ts:171-181`. | Queries for seats, devices, members. | no |
| `src/server/export/export.test.ts` | Create. Fake db: SQL contains `org_id = $1`, values[0] is the org, cap+1 limit, truncation flag, row mapping. | R6 and cap behaviour without a DB. | no |
| `src/server/export/export.db.test.ts` | Create. Two orgs, seeded rows, per-kind assertions (copy the harness of `src/server/search/search.db.test.ts`). | Real SQL check, org isolation. | no |
| `src/app/api/export/[kind]/route.ts` | Create. `GET = withAuth<{kind:string}>(..., { tier: "manager" })`, `dynamic = "force-dynamic"`. | The API entry (R1: the only entry to `src/server/**`). | no |
| `src/app/api/export/[kind]/route.test.ts` | Create (pattern: `src/app/api/dashboard/route.test.ts`). | Tier gate, headers, 404, 503, truncation header. | no |
| `src/ui/dashboard/export-api.ts` | Create. `createExportApi(apiFetch)` → `download(kind)` resolves `{ok:true, blob, filename, truncated}` or `{ok:false, code}`, never throws (same shape as `dashboard-api.ts`). Pure helper `filenameFromDisposition`. | Bearer download via `apiFetch`, no token in URL. | no |
| `src/ui/dashboard/export-api.test.ts` | Create. | Fetch → blob, errors, filename parsing. | no |
| `src/ui/dashboard/save-blob.ts` | Create. `saveBlob(blob, filename)`: `URL.createObjectURL`, hidden `<a download>`, click, `revokeObjectURL` in `setTimeout`. | The only DOM side effect, kept out of the view. | no |
| `src/ui/dashboard/ExportCard.tsx` | Create. Pure card: three buttons (Seats, Devices, Members), `busy` kind disables all, inline `role="alert"` error, truncation notice (`role="status"`). | The UI entry. | no |
| `src/ui/dashboard/DashboardView.tsx` | Modify. New optional props `canExport`, `exporting`, `exportError`, `exportNotice`, `onExport(kind)`; render `<ExportCard>` after the rooms grid, only when `status === "ready"` and `canExport`. | Dashboard hosts the entry. | no |
| `src/ui/dashboard/DashboardPage.tsx` | Modify. `useSession()` + `atLeastTier(session.tier, "manager")` (as `DevicesPage.tsx:28-29`), state for busy/error/notice, call `api.download` then `saveBlob`. | Wiring. | no |
| `src/ui/dashboard/DashboardView.test.tsx` | Modify. Add cases. | Button visibility, disabled while busy. | no |
| `src/ui/copy/dashboard.ts` | Modify. Add `export: { heading, hint, seats, devices, members, busy, truncated(n), failed }` (D36). Errors reuse `apiErrorMessage`. | UI copy lives in `src/ui/copy`. | no |
| `src/lib/api/error.ts` | No change. | No new error code is needed (see API contract). | no |

No High path file is touched (`src/server/http/**`, `with-auth.ts` stay unchanged). `src/server/**` is a security-review trigger path, so expect `security-review.md`.

## Data model / migration
None. Read-only queries on existing tables (`seats`, `rooms`, `members`, `groups`, `projects`, `devices`). No new index: each statement is a single org-scoped scan capped at 10,001 rows, ordered by columns already covered by `(org_id, ...)` keys or a bounded sort.

## API contract
| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| GET | `/api/export/seats` \| `/api/export/devices` \| `/api/export/members` | No body, no query. Bearer header via `apiFetch`. | 200 `text/csv; charset=utf-8`, body = BOM + CRLF-terminated rows. Headers: `Cache-Control: no-store`, `Content-Disposition: attachment; filename="simap-<kind>-YYYYMMDD.csv"` (ASCII, built only from the whitelisted kind and a UTC date), `X-Content-Type-Options: nosniff`, and `X-Export-Truncated: true` only when the cap was hit. | 401/403 `unauthenticated`/`forbidden`/`org_required`/`member_deactivated` (from `withAuth` only, before any query, R7); 404 `not_found` for an unknown kind; 503 `unavailable` (no pool); 500 `internal`. | Manager and Admin (`tier: "manager"`). Users get 403 `forbidden`. |

Error responses use the existing JSON shape via `apiError`. `GET` has no side effect, so R7 holds.

Columns (header row in English, fixed order):
- seats: Room code, Room name, Floor, Seat code, Status (`occupied` / `free` / `cannot_seat`, derived from `occupant_id` and `cannot_seat`), Occupant name, Occupant employee code, Occupant email, Group, Project, Cannot-seat reason. Order: `lower(r.code), s.seq, s.id`.
- devices: Name, Type, Inventory number, MAC, Role, Owner name, Owner employee code, Location (`placed` / `inventory`), Room code, Seat code. Order: `lower(d.name), d.id`.
- members: Display name, Employee code, Email, Group, Status (`active` / `deactivated`). Order: `lower(display_name), id`. Org roles are not in the DB (they come from Identity tokens), so no role column.
- Decision on email: included in the members file and in the seats file (occupant email). Not in devices. Reason: Ming 2026-11-24 allows Users to see colleagues' emails, so a Manager+ export adds no new exposure. `members.email` is `not null` in the init migration.
- No timestamps are exported (avoids the UTC vs UTC+7 trap).

Size cap: `EXPORT_MAX_ROWS = 10_000` per file. The query asks for cap+1 rows; if more come back, the file holds the first 10,000 rows in the stable order above, the response sets `X-Export-Truncated: true`, and the UI shows "Export limited to the first 10,000 rows." next to the card. Past the cap the export is not refused and not silent. Rationale: a hard refusal would leave a large org with no export at all, and the warning makes the partial file visible.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/lib/export/csv.test.ts › plain text is left unquoted` | `abc` → `abc`. |
| `› quotes cells containing comma, double quote, CR or LF` | RFC 4180: `a,b` → `"a,b"`; `say "hi"` → `"say ""hi"""`; embedded `\n` and `\r\n` quoted. |
| `› prefixes = + - @ TAB CR with an apostrophe` | Each of `=1+1`, `+1`, `-1`, `@SUM(A1)`, `\tx`, `\rx` starts with `'`. |
| `› formula guard then quoting compose` | `=a,b` → `"'=a,b"`; `-"x"` → `"'-""x"""`; a cell starting with CR is guarded and quoted. |
| `› does not touch a leading apostrophe or safe symbols mid-string` | `a=b`, `x-y`, `'ok` unchanged. |
| `› null, undefined and empty become empty cells` | Domain focus: empty/null fields. |
| `› keeps Vietnamese text intact` | "Nguyễn Thị Ánh", "Đặng" round-trip unchanged (NFC and NFD not altered). |
| `› toCsv starts with U+FEFF, uses CRLF between and after rows, header first` | BOM and Excel line endings. |
| `› toCsv with zero rows still outputs BOM + header` | Empty org. |
| `› exportFilename is ASCII and built from kind and UTC date` | `simap-seats-20261124.csv`; near-midnight UTC case. |
| `› isExportKind rejects unknown, empty and prototype names` | `constructor`, `__proto__`, `Seats`. |
| `src/server/export/export.test.ts › every query goes through orgQuery with scope.orgId as $1` | R6, criterion 2. |
| `› limit is cap+1 and truncated is true only when more than cap rows return` | Cap behaviour (inject smaller cap via parameter default). |
| `› maps rows: status derivation, null occupant, inventory device location` | Mapping. |
| `› runs in a read-only repeatable-read transaction` | Snapshot consistency. |
| `src/server/export/export.db.test.ts › two orgs: each export lists only its own rows` | Real SQL, isolation, CI only. |
| `src/app/api/export/[kind]/route.test.ts › user tier gets 403 and nothing is queried` | Criterion 3. |
| `› manager and admin get 200 with BOM body, text/csv, no-store, attachment filename, nosniff` | Headers and bytes. |
| `› unknown kind gets 404 not_found` | Whitelist. |
| `› X-Export-Truncated only when truncated` | Cap signalling. |
| `› no pool gives 503` | Pattern parity. |
| `src/ui/dashboard/export-api.test.ts › resolves blob, filename from Content-Disposition and truncated flag` | Client download. |
| `› falls back to simap-<kind>.csv when the header is missing or odd` | Robustness. |
| `› maps 403 ApiAccessError and non-ok responses to {ok:false, code}` | Error path. |
| `src/ui/dashboard/DashboardView.test.tsx › export card shown only when canExport` | UI gate. |
| `› buttons call onExport(kind) and are disabled while exporting` | UI behaviour. |
| `› shows export error and truncation notice` | Messages. |

## Approach
1. `src/lib/export/csv.ts` (pure, `lib` layer). `csvCell(v: string | number | null | undefined)`: null → empty; string starting with `=`, `+`, `-`, `@`, TAB or CR gets a leading `'`; then if it contains `,`, `"`, CR or LF wrap in quotes and double the quotes. `toCsv` returns `"﻿" + [header, ...rows].map(join(",")).join("\r\n") + "\r\n"`. Write the tests first.
2. `src/server/export/export.ts`: one function per kind with SQL modelled on the joins in `src/server/search/search.ts:93-168` (seats: `seats s join rooms r left join members m left join groups g left join projects p`, every join also matches `org_id`). Use `orgQuery`, start the `where` with `<t>.org_id = $1`, bind the cap as the only extra value. Return string-only rows ready for `toCsv`.
3. Route: validate `kind` with `isExportKind` (404 otherwise), `getPool()` (503 otherwise), build the body with `toCsv`, return `new Response(body, { headers })`. Filename from `exportFilename`, never from input. Do not log row data.
4. UI: `export-api.ts` uses `fetcher("/api/export/<kind>")` (token travels in the bearer header only, never the URL), `res.blob()` keeps the BOM bytes. `saveBlob` creates and revokes the object URL. `DashboardPage` shows the card only for Manager+ (`atLeastTier`); the server enforces it regardless. One download at a time (`exporting` state).
5. Placement decision: one "Export" card on the Dashboard, because DSH-02 and D27 describe a single org-wide export and the Dashboard is the Manager's overview. Per-list-page buttons (Devices, Members) would need the Members page changes and duplicate the code; they can follow later if wanted.
6. Run `pnpm format`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`. Rules: R1 (route → server, lib only; UI imports only `@/lib/export/csv` kinds and `@/lib/tier`), R3 (no env), R6 (orgQuery), R7 (auth codes only from `withAuth`), R4 (no files outside the table).

Size estimate: roughly 330 source lines plus tests; below the 500-line split threshold.

## Specialist input used
None (fast lane, no consults).

## Assumptions
- Hotspots: `src/ui/dashboard/DashboardView.tsx`, `DashboardPage.tsx`, `src/ui/copy/dashboard.ts` were last changed by the merged dashboard ticket; no open ticket edits them as far as `work/backlog.md` shows. The implementer should check the board before starting and expect a rebase if another ticket is `IN_PROGRESS` on the Dashboard.
- Seat status words (`occupied`, `free`, `cannot_seat`) are plain English tokens chosen here; spec v1 has no wording for the file.
- UTC date in the filename (server clock), not UTC+7; the filename is a label, not data.
- The formula guard adds the apostrophe to every matching string including legitimate negative-number-like text (for example a name `-x`). That is the accepted trade-off of the OWASP rule. Cells are always strings, so numeric columns do not exist.
- `X-Export-Truncated` is readable by the same-origin `fetch`; no CORS exposure header is needed.
- Cap 10,000 rows per file is an assumption; it is one constant (`EXPORT_MAX_ROWS`) if Ming wants another number.

## Blocking questions
None

## Split proposal
None
