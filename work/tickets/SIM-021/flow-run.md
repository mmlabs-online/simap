# Flow run — SIM-021 (manual run on production)

Template for the manual run of seatMGT's flows (spec §6 "v1 done means"). Ming runs it on production after the first
release (`docs/go-live.md` item 12). Claude records the results in SIM-021.1. Leave Result, Notes and BUG id empty until
the run.

## Header

| Field | Value |
|---|---|
| Date | |
| Version (from the app header) | |
| Browser and device | |
| Org | test org (label only) |

Accounts (tier labels only, no emails):

| Label | Tier | Signed in once? |
|---|---|---|
| Admin | Admin (org owner role) | |
| Manager | Manager | |
| User A | User | |
| User B | User | |

Precondition: each test account has signed in once, because only known members can be assigned (SEA-03, D16). The run
uses all four accounts (A5), so the rival request (REG-02) and transfer (DEV-08) rows are runnable.

Result values: PASS, FAIL, BLOCKED, N-A.


## F1 Sign in and org

| # | Flow | Step | Tier | Expected (spec ID) | Result | Notes | BUG id |
|---|---|---|---|---|---|---|---|
| F1.1 | Sign in and org | Sign in with a wrong password | User A | AUT-01: a clear error message, no session | | | |
| F1.2 | Sign in and org | Sign in with the right password | User A | AUT-01: lands in the app, shell shows the org and tier | | | |
| F1.3 | Sign in and org | Use "Continue as" on a return visit | User A | AUT-01, D33: continues without a new password | | | |
| F1.4 | Sign in and org | Pick or switch org (an account with two orgs) | Admin | AUT-06, D33: the picker lists the orgs; switching changes the data shown | | | |
| F1.5 | Sign in and org | Sign out, then trigger an API call from an old tab | User A | AUT-01, AUT-02: the call is refused and the app returns to sign-in | | | |
| F1.6 | Sign in and org | Open /sign-up and /forgot-password | User A | AUT-01, D53: the Turnstile widget renders and passes | | | |
| F1.7 | Sign in and org | Request a password reset and open the email link | User A | AUT-01, D53: the link host is simap.mmlabs.online and opens /reset-password | | | |

## F2 Invite and accept

| # | Flow | Step | Tier | Expected (spec ID) | Result | Notes | BUG id |
|---|---|---|---|---|---|---|---|
| F2.1 | Invite and accept | Admin invites a new Manager | Admin | AUT-03, MEM-01: invitation is sent | | | |
| F2.2 | Invite and accept | Manager tries to offer the Admin role | Manager | AUT-03, D11: the Admin role is not offered | | | |
| F2.3 | Invite and accept | Open the pending invitations list | Admin | MEM-01, D17: the pending invitation is listed | | | |
| F2.4 | Invite and accept | Accept the invitation from the email | Manager | AUT-03: link host is simap.mmlabs.online; sign-in follows | | | |
| F2.5 | Invite and accept | First visit asks for a display name | Manager | MEM-01, D17: display name is saved and shown | | | |

## F3 Rooms and seats

| # | Flow | Step | Tier | Expected (spec ID) | Result | Notes | BUG id |
|---|---|---|---|---|---|---|---|
| F3.1 | Rooms and seats | Create a room | Admin | ROO-01: the room appears in the list | | | |
| F3.2 | Rooms and seats | Create a second room with the same code | Admin | ROO-01: refused with a duplicate-code message | | | |
| F3.3 | Rooms and seats | Add seats to the room | Admin | ROO-02, SEA-01: seat codes are <room>-01 and up | | | |
| F3.4 | Rooms and seats | Mark a seat cannot-seat with a reason | Admin | SEA-01, SEA-02: status shows the reason | | | |
| F3.5 | Rooms and seats | Change the room code | Admin | ROO-02: seat codes are regenerated | | | |
| F3.6 | Rooms and seats | Delete an occupied seat | Admin | SEA-01: refused | | | |
| F3.7 | Rooms and seats | Delete a room | Admin | ROO-01: the impact is shown before confirm; the room is gone after | | | |

## F4 Layout designer

| # | Flow | Step | Tier | Expected (spec ID) | Result | Notes | BUG id |
|---|---|---|---|---|---|---|---|
| F4.1 | Layout designer | Place desks and fixtures on the grid | Admin | LAY-01, LAY-02, LAY-03: items appear; a desk is a seat | | | |
| F4.2 | Layout designer | Rotate an item | Admin | LAY-05: it turns and keeps its place | | | |
| F4.3 | Layout designer | Place a fixture on a desk | Admin | LAY-03, D62: refused | | | |
| F4.4 | Layout designer | Save and reload | Admin | LAY-01: the layout is the same after reload | | | |
| F4.5 | Layout designer | Save a stale layout from a second tab | Admin | LAY-01: a conflict message, no overwrite | | | |
| F4.6 | Layout designer | Map items: rename and hide an item | Admin | LAY-07: change shows in the editor palette | | | |
| F4.7 | Layout designer | Open the room view at 390 px width | User A | Room view (spec §6 LAY), LAY-06: map is usable on a phone | | | |

## F5 Manager assigns

| # | Flow | Step | Tier | Expected (spec ID) | Result | Notes | BUG id |
|---|---|---|---|---|---|---|---|
| F5.1 | Manager assigns | Assign a member to a free seat | Manager | SEA-03: the seat shows the occupant | | | |
| F5.2 | Manager assigns | Reassign the seat to another member and confirm | Manager | SEA-03, DEV-06, D18: the old occupant's primary device is demoted | | | |
| F5.3 | Manager assigns | Clear the seat | Manager | SEA-03: the seat is free | | | |
| F5.4 | Manager assigns | Assign the same member again | Manager | SEA-03: nothing changes | | | |
| F5.5 | Manager assigns | Open a seat by its ?seat= URL | Manager | SEA-05: the seat detail opens | | | |

## F6 Devices

Precondition: User A occupies a seat (assign again if F5.3 cleared it). The rows run top to bottom: device D1 goes
through the placement, transfer and return rows; a second device D2 is created in F6.13 for the take-back and delete rows.

| # | Flow | Step | Tier | Expected (spec ID) | Result | Notes | BUG id |
|---|---|---|---|---|---|---|---|
| F6.1 | Devices | Upload a device type image (Drive) | Admin | DEV-01, D68: the image shows on the type | | | |
| F6.2 | Devices | Create device D1 in the org inventory | Admin | DEV-01, DEV-02: status is in org inventory | | | |
| F6.3 | Devices | Assign D1 to User A with an expiry | Manager | DEV-07, D63: D1 shows with User A and the expiry | | | |
| F6.4 | Devices | User A places D1 as primary at their own seat | User A | DEV-03: placed as primary | | | |
| F6.5 | Devices | User A moves D1 as primary to another seat | User A | DEV-03: refused (A is not that seat's occupant) | | | |
| F6.6 | Devices | Lend D1 as secondary to another seat | User A | DEV-04: shown as secondary at that seat | | | |
| F6.7 | Devices | Move D1 back to own seat as primary | User A | DEV-05, DEV-03: the new place is shown | | | |
| F6.8 | Devices | Move D1 to own inventory | User A | DEV-05, DEV-02: back in own inventory, not placed | | | |
| F6.9 | Devices | A starts a transfer of D1 to User B; B declines | User A, then User B | DEV-08: custody is unchanged (A keeps D1) | | | |
| F6.10 | Devices | A starts a transfer of D1 to User B, then cancels | User A | DEV-08: custody is unchanged (A keeps D1) | | | |
| F6.11 | Devices | A starts a transfer of D1 to User B; B confirms | User A, then User B | DEV-08: D1 is in B's inventory, not placed | | | |
| F6.12 | Devices | B starts a return of D1 to the org; the Admin confirms | User B, then Admin | DEV-09, D63: D1 moves to org inventory | | | |
| F6.13 | Devices | Create device D2, assign it to User A, A places it as primary at own seat | Admin, then Manager, then User A | DEV-01, DEV-07, DEV-03: D2 is placed at A's seat | | | |
| F6.14 | Devices | Admin opens D2's actions while placed | Admin | DEV-01, D63: no Delete action; only org-inventory devices can be deleted | | | |
| F6.15 | Devices | Take D2 back directly, without a request | Admin | DEV-09, D63: D2 leaves the seat and is in org inventory | | | |
| F6.16 | Devices | Delete D2 from org inventory | Admin | DEV-01: deleted | | | |
| F6.17 | Devices | Open the D1 detail history | Admin | DEV-11: the events so far are listed | | | |
| F6.18 | Devices | Manager assigns D1 (now in org inventory) to User A with an expiry of today; check the next day | Manager | DEV-07, DEV-10: D1 shows Overdue the next day; N-A on the run day | | | |

## F7 Seat request

| # | Flow | Step | Tier | Expected (spec ID) | Result | Notes | BUG id |
|---|---|---|---|---|---|---|---|
| F7.1 | Seat request | User A requests a free seat | User A | REG-01: the request is pending | | | |
| F7.2 | Seat request | User A requests the same seat again | User A | REG-01: no duplicate is created | | | |
| F7.3 | Seat request | Request an occupied seat | User A | REG-01: refused | | | |
| F7.4 | Seat request | User B requests the same free seat | User B | REG-01: second pending request is accepted | | | |
| F7.5 | Seat request | Manager approves A's request | Manager | REG-02, D23: A is seated; B's request is auto-rejected | | | |
| F7.6 | Seat request | Check the My requests badge | User B | REG-02, D24: the badge shows the new status | | | |
| F7.7 | Seat request | User A cancels a pending request | User A | REG-02, D24: the request is cancelled | | | |
| F7.8 | Seat request | Manager rejects a request | Manager | REG-02: the request shows rejected | | | |
| F7.9 | Seat request | User A releases own seat | User A | REG-03: the seat is free | | | |

## F8 Members

| # | Flow | Step | Tier | Expected (spec ID) | Result | Notes | BUG id |
|---|---|---|---|---|---|---|---|
| F8.1 | Members | Edit member fields | Manager | MEM-01: the changes are saved | | | |
| F8.2 | Members | Deactivate User B (warning shows counts only if B occupies a seat or owns a placed device) | Manager | MEM-01, D34: the warning shows seat and device counts | | | |
| F8.3 | Members | User B makes an API call while deactivated | User B | MEM-01, D34: refused (member_deactivated) | | | |
| F8.4 | Members | Reactivate User B | Manager | MEM-01, D34: access returns | | | |

## F9 Dashboard, search, export

| # | Flow | Step | Tier | Expected (spec ID) | Result | Notes | BUG id |
|---|---|---|---|---|---|---|---|
| F9.1 | Dashboard, search, export | Read the dashboard numbers | Manager | DSH-01: counts match the rooms and seats made | | | |
| F9.2 | Dashboard, search, export | Search "nguyen" for a member named Nguyễn | User A | DSH-02, D27: the member is found | | | |
| F9.3 | Dashboard, search, export | Export CSV and open it in Excel | Manager | DSH-02, D27: diacritics display correctly | | | |

## F10 Roles, audit, shell

| # | Flow | Step | Tier | Expected (spec ID) | Result | Notes | BUG id |
|---|---|---|---|---|---|---|---|
| F10.1 | Roles, audit, shell | User opens the nav | User A | SYS-01, SHL-01: no Approvals or Admin pages | | | |
| F10.2 | Roles, audit, shell | Check the Groups nav entry | User A | SHL-01, D65: hidden | | | |
| F10.3 | Roles, audit, shell | Filter the audit log | Admin | SYS-03: newest first; filters by actor, entity type and date range | | | |
| F10.4 | Roles, audit, shell | Switch the theme and reload | User A | SHL-02: the theme is kept | | | |
| F10.5 | Roles, audit, shell | Change a role in Identity, then "refresh permissions" | Manager | SYS-01, AUT-02: after a 403 the token is re-minted and the new tier shows | | | |

## F11 Org isolation

| # | Flow | Step | Tier | Expected (spec ID) | Result | Notes | BUG id |
|---|---|---|---|---|---|---|---|
| F11.1 | Org isolation | The real first org's Admin lists rooms | Admin | SYS-01, R6: the test org's rooms are not shown | | | |
| F11.2 | Org isolation | Open a test-org room URL while in the real org | Admin | SYS-01, R6: the answer is not-found | | | |
| F11.3 | Org isolation | The test org's Admin lists rooms | Admin | SYS-01, R6: the real org's rooms are not shown | | | |
| F11.4 | Org isolation | Open a device or member detail URL from the other org | Admin | SYS-01, R6: the answer is not-found | | | |

## Summary

| Item | Value |
|---|---|
| PASS | |
| FAIL | |
| BLOCKED | |
| N-A | |
| Open S1 | |
| Open S2 | |
| Go or no-go | |

## How to record and file bugs

- Ming reports the results (Vietnamese is fine). Claude fills the table above.
- Each FAIL becomes a `/bug` with `Found in: v0.1.0 (production)` (use the version from the header) and a severity:
  - S1: blocks a v1 flow, or crosses org scope (R6).
  - S2: wrong result, a workaround exists.
  - S3: cosmetic.
- The BUG id goes back into the row's BUG id column.
- No personal data, and no screenshots that show emails.
- Never paste links from emails (reset and invite links carry tokens), `Authorization` headers, HAR exports or Network
  screenshots that show request headers. Describe the host and path only.
- Things outside the spec (placeholder art, no members sync before SIM-020) go into Notes, not into bugs.
- After fixes ship, re-run only the failed rows and append the results with the new version.

## Automated checks without sign-in (Claude, 2026-11-26)

Run from a cloud session (curl + headless Chromium) against `https://simap.mmlabs.online`. No account was used, so the
F1–F11 rows above stay for Ming's signed-in run. The session's network allowed only `simap.mmlabs.online`; requests to
`api.mmlabs.online` (Identity), `challenges.cloudflare.com` (Turnstile) and `static.cloudflareinsights.com` were blocked
by the session's proxy, not by the app, so those failures are environment artifacts.

| # | Check | Result | Notes |
|---|---|---|---|
| A1 | `GET /api/healthz` | PASS | 200 `{"status":"ok"}` |
| A2 | `GET /api/readyz` | PASS | 200 `{"status":"ok"}` (DB reachable) |
| A3 | Org API without a token (`/api/me`, `/api/devices`, `/api/devices/mine`) | PASS | 401 `unauthenticated`, `cache-control: no-store` |
| A4 | Malformed / wrong bearer and Basic auth on `/api/me`; `POST /api/devices` without a token | PASS | all 401 `unauthenticated`, no 500 |
| A5 | Unknown API route `/api/nope` | PASS | 404 |
| A6 | Security headers on `/` (SIM-027) | PASS | CSP with per-request nonce + `strict-dynamic`, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'none'`, `connect-src 'self' https://api.mmlabs.online`, Turnstile allowed; HSTS 1 year; `X-Frame-Options: DENY`; `nosniff`; `Referrer-Policy: strict-origin-when-cross-origin`; COOP same-origin; Permissions-Policy denies camera/mic/geo/payment/usb; HTML `no-store` |
| A7 | Signed-out pages at 390 px and 1280 px: `/`, `/sign-in`, `/sign-up`, `/forgot-password`, `/accept-invitation` | PASS | render, no horizontal overflow, no page (JS) errors; `/accept-invitation` without a token shows "Invitation not valid" |
| A8 | Protected routes signed out: `/portal`, `/portal?tab=profile`, `/devices`, `/rooms`, `/members`, `/credits` | PASS | each shows the sign-in screen, no overflow, no page errors |
| A9 | `/sign-up` security check | N-A | "The security check failed" because Turnstile was blocked by the session's network (artifact) |
| A10 | Availability | Note | one request to `/sign-up` at 1280 px got a 503 "Scheduled maintenance" page from the edge; 15 follow-up requests were all 200 (likely a deploy window). Worth a look if it recurs |

Not checked here (needs sign-in or Identity): every F1–F11 row, the app-header version, Turnstile on sign-up, and the
DevTools CSP-violation check of M-14 in a signed-in session.
