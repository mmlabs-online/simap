# Security review — SIM-018

## Attempt 1

**Result: no blockers (🔴) and no should-fix items (🟡). I found three minor notes (🟢), and none of them blocks a PASS.**

I read every file in the focus list, plus `src/server/http/with-auth.ts`, `src/server/http/org-scope.ts`, the DashboardPage wiring and the devices/members definitions in `db/migrations/20261120150000_init.sql`. I did not run the checks and only confirmed from source that they apply; the impl-log reports them green.

### Findings

🔴 Blocker: none.

🟡 Should-fix: none.

🟢 **N1. The formula guard does not cover a few edge-case starting characters.**
- Where: `src/lib/export/csv.ts:13`, where `FORMULA_START = /^[=+\-@\t\r]/`.
- What is covered: the full OWASP list (`=` `+` `-` `@` TAB CR). The guard runs before RFC 4180 quoting (lines 19–20), so the `'` prefix ends up inside the quoted cell. Embedded `"` is doubled and cells with `,` CR or LF are quoted. A value that starts with `"` is quoted as text and is not evaluated.
- What is not covered: a leading LF (`\n=...`), leading spaces (` =...`) and the full-width `＝`/`＋`. Excel does not evaluate these as formulas, but some importers (LibreOffice with "evaluate formulas", Google Sheets after trimming) can.
- Risk: low. Data comes from Manager or member-entered names, reasons and device fields inside the same org.
- Optional fix (one line): `/^[\s=+\-@＝＋－＠]/` (`\s` covers TAB, CR, LF and spaces). Add a test for `"\n=1+1"` and `" =1+1"`.

🟢 **N2. Legitimate values that start with `-` get a visible `'` prefix.**
- Where: `csv.ts:19`.
- `rooms.floor` is `text`, so a basement floor `-1` exports as `'-1`. This is the accepted OWASP trade-off and not a security issue. Mention it in the copy or the docs only if users complain.

🟢 **N3. The object URL is revoked after a 1 s delay.**
- Where: `src/ui/dashboard/save-blob.ts:11`.
- Revoking after a delay instead of right after `click()` is the usual safe pattern; browsers capture the blob when the download starts. Nothing to change.

### Checks that passed

**Org scoping (R6).**
- All three queries (`src/server/export/export.ts:27-38`, `66-75`, `91-96`) run through `orgQuery`, which binds `scope.orgId` from the verified token as `$1` and refuses SQL without `org_id = $1`. The cap is `$2`.
- Every join includes the org, not just the id: rooms, members, groups and projects on `s.org_id`; members and seats on `d.org_id`; rooms on `s.org_id`; groups on `m.org_id`.
- For devices, `owner_id` is `not null` with an `(org_id, owner_id)` foreign key, so the inner join to members drops no rows.
- The read runs in one `repeatable read, read only` transaction, so all rows come from one snapshot and nothing is written.

**Manager-tier gate and R7.**
- `src/app/api/export/[kind]/route.ts:25` sets `{ tier: "manager" }`.
- In `with-auth.ts:56-79`, the token is verified, then `org_required`, then the tier from `org_roles` gives `forbidden`, then `member_deactivated`. All of this happens before the handler runs.
- The handler itself returns only 404 `not_found` and 503 `unavailable`, not auth codes. The endpoint is a read-only GET, so the one `apiFetch` re-send on 401/403 is harmless.

**Response headers** (`route.ts:16-22`).
- `Content-Type: text/csv; charset=utf-8`, `Cache-Control: no-store` and `X-Content-Type-Options: nosniff` are set.
- `Content-Disposition` is built only from a kind that has passed `isExportKind` and an ISO date (`csv.ts:33-36`), so no user input reaches the header.
- An unknown `kind` returns 404 before any database access.

**Personal data.**
- Seats export occupant name, employee code and email. Devices export owner name and code (no email) and the MAC. Members export name, code, email, group and status.
- Everything is Manager+ only on the server. This fits Ming's 2026-11-24 rule that even Users may see colleagues' emails.
- No tokens, secrets or internal IDs are exported. Only placement state is derived from `seat_id` and `occupant_id`.

**Row cap and truncation signal.**
- The server asks for `cap + 1` rows, slices to `cap` and sets `X-Export-Truncated: true` (`export.ts:111-115`, `route.ts:22`).
- The client reads that header (`export-api.ts:45`; readable because the request is same-origin) and shows the notice (`DashboardPage.tsx:35`).
- The cap is a server constant (10,000) and the client cannot set it.

**Download path.**
- `src/ui/dashboard/export-api.ts:31` calls the shared bearer `apiFetch` with a bare `/api/export/${kind}`. There is no token in the URL and no cookie, so there is no CSRF exposure.
- The filename from `Content-Disposition` passes a strict allowlist `[A-Za-z0-9._-]+` (line 12), with a fallback built from the typed kind.
- Errors are reduced to a code string and the function never throws.

**R1, R3 and output encoding.**
- The UI imports only from `lib` and `ui`.
- No secrets, no logging of row data and no `dangerouslySetInnerHTML`; `ExportCard` renders copy text and error strings as React text.

### Follow-ups (out of scope)
- Optional: tighten `FORMULA_START` as in N1 and add the two tests.
