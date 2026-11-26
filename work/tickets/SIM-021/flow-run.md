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

Precondition: each test account has signed in once, because only known members can be assigned (SEA-03, D16). With
only three accounts, the rival request (REG-02) and the transfer (DEV-08) rows are N-A (A5).

Result values: PASS, FAIL, BLOCKED, N-A.


## F1 Sign in and org

| # | Flow | Step | Tier | Expected (spec ID) | Result | Notes | BUG id |
|---|---|---|---|---|---|---|---|
| F1.1 | Sign in and org | Sign in with a wrong password | User A | AUT-01: a clear error message, no session | | | |
| F1.2 | Sign in and org | Sign in with the right password | User A | AUT-01: lands in the app, shell shows the org and tier | | | |
| F1.3 | Sign in and org | Use "Continue as" on a return visit | User A | AUT-02: continues without a new password | | | |
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
| F4.3 | Layout designer | Place a fixture on a desk | Admin | LAY-03: refused | | | |
| F4.4 | Layout designer | Save and reload | Admin | LAY-01: the layout is the same after reload | | | |
| F4.5 | Layout designer | Save a stale layout from a second tab | Admin | LAY-01, LAY-06: a conflict message, no overwrite | | | |
| F4.6 | Layout designer | Map items: rename and hide an item | Admin | LAY-07, D62: change shows in the editor palette | | | |
| F4.7 | Layout designer | Open the room view at 390 px width | User A | LAY-06, D62: map is usable on a phone | | | |

## F5 Manager assigns

| # | Flow | Step | Tier | Expected (spec ID) | Result | Notes | BUG id |
|---|---|---|---|---|---|---|---|
| F5.1 | Manager assigns | Assign a member to a free seat | Manager | SEA-03: the seat shows the occupant | | | |
| F5.2 | Manager assigns | Reassign the seat to another member and confirm | Manager | SEA-03, DEV-06, D18: the old occupant's primary device is demoted | | | |
| F5.3 | Manager assigns | Clear the seat | Manager | SEA-03: the seat is free | | | |
| F5.4 | Manager assigns | Assign the same member again | Manager | SEA-03: nothing changes | | | |
| F5.5 | Manager assigns | Open a seat by its ?seat= URL | Manager | SEA-05: the seat detail opens | | | |

## F6 Devices

| # | Flow | Step | Tier | Expected (spec ID) | Result | Notes | BUG id |
|---|---|---|---|---|---|---|---|
| F6.1 | Devices | Upload a device type image (Drive) | Admin | DEV-01, D61: the image shows on the type | | | |
| F6.2 | Devices | Create a device in the org inventory | Admin | DEV-01, DEV-07: status is in org inventory | | | |
| F6.3 | Devices | Assign the device to User A with an expiry | Manager | DEV-07, D31: the device shows with User A and the expiry | | | |
| F6.4 | Devices | User A places it as primary at their own seat | User A | DEV-02, DEV-03: placed as primary | | | |
| F6.5 | Devices | User A places it as primary at another seat | User A | DEV-03: refused | | | |
| F6.6 | Devices | Lend it as secondary to another seat | User A | DEV-04: shown as secondary at that seat | | | |
| F6.7 | Devices | Move the device | User A | DEV-05: new place is shown | | | |
| F6.8 | Devices | Return it to own inventory | User A | DEV-02, D63: back in own inventory | | | |
| F6.9 | Devices | Transfer to User B and confirm | User A | DEV-08: User B accepts; custody changes | | | |
| F6.10 | Devices | Transfer to User B and decline | User A | DEV-08: User B declines; custody is unchanged | | | |
| F6.11 | Devices | Transfer to User B and cancel | User A | DEV-08: the sender cancels; custody is unchanged | | | |
| F6.12 | Devices | Return the device to the org and confirm as Admin | Admin | DEV-09, D68: Admin confirm moves it to org inventory | | | |
| F6.13 | Devices | Admin takes a device back | Admin | DEV-09, D68: it returns to org inventory | | | |
| F6.14 | Devices | Delete a device that is placed | Admin | DEV-01, D61: refused | | | |
| F6.15 | Devices | Delete the device from org inventory | Admin | DEV-01: deleted | | | |
| F6.16 | Devices | Open the device detail history | Admin | DEV-11: the events so far are listed | | | |
| F6.17 | Devices | Overdue check (an expiry of today, check next day) | Manager | DEV-10: shows overdue; N-A on the run day | | | |

## F7 Seat request

| # | Flow | Step | Tier | Expected (spec ID) | Result | Notes | BUG id |
|---|---|---|---|---|---|---|---|
| F7.1 | Seat request | User A requests a free seat | User A | REG-01: the request is pending | | | |
| F7.2 | Seat request | User A requests the same seat again | User A | REG-01: no duplicate is created | | | |
| F7.3 | Seat request | Request an occupied seat | User A | REG-01: refused | | | |
| F7.4 | Seat request | User B requests the same free seat | User B | REG-02: second pending request is accepted | | | |
| F7.5 | Seat request | Manager approves A's request | Manager | REG-02, D23: A is seated; B's request is auto-rejected | | | |
| F7.6 | Seat request | Check the My requests badge | User B | REG-01, D24: the badge shows the new status | | | |
| F7.7 | Seat request | User A cancels a pending request | User A | REG-01: the request is cancelled | | | |
| F7.8 | Seat request | Manager rejects a request | Manager | REG-02: the request shows rejected | | | |
| F7.9 | Seat request | User A releases own seat | User A | REG-03: the seat is free | | | |

## F8 Members

| # | Flow | Step | Tier | Expected (spec ID) | Result | Notes | BUG id |
|---|---|---|---|---|---|---|---|
| F8.1 | Members | Edit member fields | Manager | MEM-01: the changes are saved | | | |
| F8.2 | Members | Deactivate User B (warning shows counts) | Manager | MEM-01, D34: the warning shows seat and device counts | | | |
| F8.3 | Members | User B makes an API call while deactivated | User B | MEM-01, D34: refused (member_deactivated) | | | |
| F8.4 | Members | Reactivate User B | Manager | MEM-01, MEM-02: access returns | | | |

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
| F10.3 | Roles, audit, shell | Filter the audit log | Admin | SYS-03: events filter by actor and action | | | |
| F10.4 | Roles, audit, shell | Switch the theme and reload | User A | SHL-02: the theme is kept | | | |
| F10.5 | Roles, audit, shell | Change a role in Identity, then "refresh permissions" | Manager | SYS-01, AUT-02: after a 403 the token is re-minted and the new tier shows | | | |

## F11 Org isolation

| # | Flow | Step | Tier | Expected (spec ID) | Result | Notes | BUG id |
|---|---|---|---|---|---|---|---|
| F11.1 | Org isolation | The real first org's Admin lists rooms | Admin | SYS-01, R6: the test org's rooms are not shown | | | |
| F11.2 | Org isolation | Open a test-org room URL while in the real org | Admin | SYS-01, R6: the answer is not-found | | | |

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
- Things outside the spec (placeholder art, no members sync before SIM-020) go into Notes, not into bugs.
- After fixes ship, re-run only the failed rows and append the results with the new version.
