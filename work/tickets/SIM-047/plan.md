Status: READY

# Plan — SIM-047: Pixel character customisation (slice A: storage, API, map)

## Scope summary
- `docs/spec-v1.md` POR-06 (l.591-599): "The member customises the 32 px layered avatar used on the room map (LAY-06)
  from preset choices per layer: skin, hair colour, hair style, shirt colour (the existing avatar ramps and frames; more
  parts only with new art). No free colour input and no upload." / "A live preview shows the character front and back
  at 1× and 2× before saving. "Reset" goes back to the look derived from `sub`." / "The choice is stored on the member
  (Member entity). A member without a stored look keeps the derived look, so existing members change nothing until
  they choose. The server accepts only preset values (422 otherwise)." / "Open maps show the new look at the next
  layout load. Every change is audited (SYS-03)."
- LAY-06 (l.475-476): "Occupants are 32 px layered avatars (body/hair/shirt): the member's chosen pixel character when
  set (POR-06), else colours derived from `sub`, stable per person (D51, amended by D71)."
- Member entity (l.130): "pixel character look (optional; preset part per layer: skin, hair colour, hair style, shirt
  colour, POR-06) ... no stored look = look derived from `sub` as before (D71)."
- OQ-61 default (l.845-847): "only the member sets their own photo and character; ... the character is the member's
  alone."
- D71 (decisions.md l.78): "a pixel character (the room-map avatar) customised from preset colours/parts (skin, hair,
  shirt, ...) and stored on the member instead of only being derived from `sub`."
- SIM-015.1 plan A7 (accepted): "Avatar seed? **Member id** — D44/D51 say "from `sub`", but sending `sub` to every
  member exposes Identity ids." The map has seeded the derived look from `members.id` since then
  (`src/lib/sprites/seat-view.ts:17`, `src/lib/sprites/placement.ts:447`).

This plan covers **slice A** (see Split proposal): migration, preset validator, look resolution, `/api/me/pixel-look`
(GET/PUT/DELETE) with audit, and the room map drawing the stored look. The Profile picker with live preview and Reset
button (AC3) is slice B, SIM-047.1.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | Migration is forward-only and the previous image keeps working (R2); existing members keep the derived look. | Read `db/migrations/20261126140000_members_pixel_look.sql`: one `add column ... jsonb null` with no default and no backfill, plus one named check. `members.ts` `COLS` is unchanged (the old image never selects the column). `pnpm schema:check` section "pixel look": a member inserted without the column reads `pixel_look is null`. `pixel-look.test.ts › resolveLook null → avatarFor(seed)`. `layout.db.test.ts › seat status from real rows` (now with `look: null`). |
| 2 | One preset per layer (skin, hair colour, hair style, shirt colour); any non-preset value gets 422. | `validate/pixel-look.test.ts` (all boundaries accepted; missing, extra, float, string, negative, out of range, null and array rejected). `app/api/me/pixel-look/route.test.ts › PUT non-preset → 422 invalid_look, service not called`; `› malformed JSON → 400 invalid_request`. `schema:check` DB backstop cases (23514 `members_pixel_look_check`). |
| 3 | Live preview front/back at 1× and 2×; "Reset" returns to the derived look. | **Slice B (SIM-047.1).** Slice A provides and tests the parts it needs: `DELETE /api/me/pixel-look` (reset = null, `pixel-look.db.test.ts › reset`), `derivedChoice(seed)` (`pixel-look.test.ts › derivedChoice matches avatarFor`). |
| 4 | The room map draws the stored look at the next layout load, for every viewer. | `layout.db.test.ts › stored pixel look is returned for every viewer` (two different viewer subs get the same `look`; garbage in the row is not possible because of the check, so tolerant parse is covered by unit tests). `seat-view.test.ts`, `map-view.test.ts › look parsed / bad look becomes null / missing look becomes null`. `placement.test.ts › stored look tints the avatar frames; null look uses avatarFor(seed)`. Layout route is already `no-store` + `force-dynamic` (`src/app/api/rooms/[id]/layout/route.ts:10-12`), so the next load sees the change. Manual: `pnpm dev`, `curl -X PUT /api/me/pixel-look` with the dev token, reload a room map where that member sits. |
| 5 | Only the member changes their own look; every change writes an audit row; tests cover validation and fallback. | Route takes no member id (only `ctx.sub`/`ctx.scope`): `route.test.ts › service gets ctx.sub and ctx.scope`. `pixel-look.db.test.ts`: set writes one `member.update` row with `meta = {fields:["pixelLook"], self:true, look:{...}}`; reset writes one with `look:null`; a no-op set/reset writes none; another org's member with the same sub shape is untouched (org isolation); deactivated member refused with no write. Validation and fallback tests as in rows 2 and 4. |

Checks: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`; plus `pnpm schema:check`
(migration ticket, local DB) and `pnpm test:db` (CI; run locally too).

## Ming verification after merge
- After deploy (with SIM-046 deployed first, see Assumption 1): as any member, `PUT /api/me/pixel-look` (or, after
  SIM-047.1, the Profile picker), then open a room map where that member sits from another account: the new look is
  drawn after a reload; `DELETE` brings back the old look. Check one `member.update` audit row per change.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `db/migrations/20261126140000_members_pixel_look.sql` | New. `alter table members add column pixel_look jsonb null;` + `members_pixel_look_check` (see Data model). SIM-007-style header comment. | AC1, AC2 backstop. | **Yes** (`db/migrations/**`, `**/*.sql`) |
| `db/migrations/README.md` | Add one bullet after the last per-column bullet (and after SIM-046's photo bullet if it is there): `members.pixel_look` meaning, null = derived from the member id, shape, "append-only ramps". | Migration docs convention (l.37). | **Yes** (`db/migrations/**`) |
| `scripts/schema-check.mjs` | New numbered section after section 11 (l.1106, before `// extras`): next free number (12, or 13 if SIM-046 has added 12). Cases listed in Tests. Uses existing `tx`/`refused` helpers (l.242-258). | AC1, AC2 (DB backstop). | No |
| `src/lib/sprites/avatar.ts` | Comment only above the ramps (l.1): "Append-only: stored pixel looks (SIM-047) are indices into these ramps; widening also needs a migration that replaces `members_pixel_look_check`." No code change. | Ramp-reorder risk (DB consult). | No |
| `src/lib/sprites/pixel-look.ts` | New, pure. `PixelLook = {skin:number; hair:number; style:1\|2\|3; shirt:number}`, `PIXEL_LOOK_KEYS`, `isPixelLook(v): v is PixelLook` (exact keys, safe integers, ranges from `SKIN_RAMP.length` etc.), `parsePixelLook(v): PixelLook \| null` (tolerant), `lookFromChoice(c): AvatarLook`, `resolveLook(c: PixelLook\|null\|undefined, seed: string): AvatarLook` (invalid or null → `avatarFor(seed)`), `derivedChoice(seed): PixelLook` (indices of the derived look, same FNV salts as `avatarFor`). | AC1, AC4, slice B's Reset/preselect. | No |
| `src/lib/sprites/pixel-look.test.ts` | New. | R5. | No |
| `src/lib/validate/pixel-look.ts` | New. `validatePixelLook(body): Validated<PixelLook>` (type from `./room`), built on `isPixelLook`; `field` = first bad key, `"body"` for a non-object. | AC2. | No |
| `src/lib/validate/pixel-look.test.ts` | New. | R5. | No |
| `src/lib/api/error.ts` | Append `"invalid_look"` to `API_ERROR_CODES` (after l.64). | AC2 (422 domain code). | No |
| `src/ui/copy/api.ts` | Add `invalid_look: "Choose one of the offered options for each part."` to the `satisfies Record<ApiErrorCode,string>` map (l.75 forces it). | Typecheck; D36. | No |
| `src/server/members/pixel-look.ts` | New, `import "server-only"`. `getOwnPixelLook(db, scope, sub)` and `setOwnPixelLook(db, scope, sub, look: PixelLook\|null)`. Own locked read (does **not** import private `find`/`ensure` from `members.ts`). | AC2, AC5. | No |
| `src/server/members/pixel-look.db.test.ts` | New, `pnpm test:db`. | AC5, R5. | No |
| `src/app/api/me/pixel-look/route.ts` | New. `GET`, `PUT`, `DELETE`, each `withAuth(..., {tier:"user"})`, `force-dynamic`, `no-store`. | AC2, AC5. | No (not under `src/server/http/**`) |
| `src/app/api/me/pixel-look/route.test.ts` | New, mocks as in `src/app/api/me/route.test.ts` (l.6-7). | R5. | No |
| `src/lib/sprites/layout.ts` | `SeatView` (l.35) gets `look: PixelLook \| null` (import type from `./pixel-look`). | AC4. | No |
| `src/lib/sprites/seat-view.ts` | Input gets `occupantLook: unknown`; output `look: s.occupantId !== null ? parsePixelLook(s.occupantLook) : null`. | AC4. | No |
| `src/lib/sprites/seat-view.test.ts` | Update l.29 literal (`look: null`); new cases. | R5. | No |
| `src/server/layout/layout.ts` | `SeatRow` (l.35-42) + `pixel_look: unknown`; select (l.77) adds `o.pixel_look`; `seatViewOf` call (l.202-207) passes `occupantLook: s.pixel_look`. Join already scoped `o.org_id = s.org_id` and `s.org_id = $1` (R6). | AC4. | No |
| `src/server/layout/layout.db.test.ts` | l.179-189: add `look: null` to the `toEqual` literals; new case "stored pixel look is returned for every viewer" in the same `describe`, right after that test (l.192). | AC4. | No |
| `src/lib/sprites/map-view.ts` | `emptyView` (l.70) + `look: null`; `toSeatView` (l.97-104) adds `look: parsePixelLook(raw.look)`. | AC4 (tolerant: old server without the field → null). | No |
| `src/lib/sprites/map-view.test.ts` | Literals at l.20, 49, 55-58, 86-87 get `look`; new cases. | R5. | No |
| `src/lib/sprites/placement.ts` | `EMPTY_VIEW` (l.36) + `look: null`; l.447 `avatarFrames(resolveLook(view.look, view.avatarSeed), ...)`; import `resolveLook` (l.2 area). | AC4. | No |
| `src/lib/sprites/placement.test.ts` | `view()` helper (l.44-47) + `look: null`; new case next to l.238. | R5. | No |
| `src/ui/roomlayout/SeatOverlay.tsx` | `EMPTY` (l.6) + `look: null`. Type only. | Typecheck. | No |
| `src/ui/roomlayout/SeatOverlay.test.tsx` | l.29-30 literals + `look: null`. | Typecheck. | No |
| `src/app/dev/roommap/fixture.ts` | `DEMO_VIEWS` (l.53-58) + `look: null`, and one occupied seat (`seat-b2`) gets a stored look so the dev map shows both paths. | Typecheck; manual check of AC4. | No |
| `src/app/dev/roommap/fixture.test.ts` | l.37 uses `resolveLook(v.look, v.avatarSeed)` instead of `avatarFor(v.avatarSeed)` if it compares looks. | Keeps the fixture test true. | No |

Files deliberately **not** touched: `src/server/members/members.ts`, `src/lib/members/types.ts` (`MeMemberDto`),
`src/app/api/me/route.ts`, `src/lib/validate/member.ts`, everything in `src/ui/portal/**` and `src/ui/copy/portal.ts`
(slice B), `src/server/seats/**`, `src/server/members/manage.ts`, `src/ui/seats/**`.

## Data model / migration
`db/migrations/20261126140000_members_pixel_look.sql`:

```sql
-- SIM-047: pixel character look (spec POR-06, LAY-06, Member entity; D71). Expand-only: one nullable column, no default,
-- no backfill. null = the look derived from the member (avatarFor(members.id), as the map draws it since SIM-015.1);
-- otherwise preset indices into the avatar ramps in src/lib/sprites/avatar.ts (skin 0-3, hair colour 0-5, shirt 0-6,
-- hair style 1-3). The ramps are append-only; widening one needs a new migration that replaces this check.
-- The previous image never reads or writes the column.
alter table members add column pixel_look jsonb null;
alter table members add constraint members_pixel_look_check check (
  pixel_look is null
  or case when jsonb_typeof(pixel_look) = 'object' then
       pixel_look ?& array['skin', 'hair', 'style', 'shirt']
       and pixel_look - array['skin', 'hair', 'style', 'shirt'] = '{}'::jsonb
       and jsonb_typeof(pixel_look -> 'skin') = 'number' and (pixel_look ->> 'skin') ~ '^[0-3]$'
       and jsonb_typeof(pixel_look -> 'hair') = 'number' and (pixel_look ->> 'hair') ~ '^[0-5]$'
       and jsonb_typeof(pixel_look -> 'style') = 'number' and (pixel_look ->> 'style') ~ '^[1-3]$'
       and jsonb_typeof(pixel_look -> 'shirt') = 'number' and (pixel_look ->> 'shirt') ~ '^[0-6]$'
     else false end
);
```
- The `case` guards the `-` / `?&` operators so a scalar or array is refused (23514), never an operator error.
- The regexes refuse floats (`1.5`, `1.0`), negatives and strings (the `jsonb_typeof` check refuses `"2"`).
- Existing rows are all null, so `add constraint` validates instantly; no lock beyond the brief `alter table`.
- No index (never filtered on). No change to unique keys or FKs, so the generic `schema:check` catalogue checks pass.
- Downgrade: none needed (forward-only, R2); the previous image ignores the column. A later contract step is not
  planned.

## API contract
| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| GET | `/api/me/pixel-look` | — | `200 {look: PixelLook \| null}` | 404 `not_found` (no member row yet), 503 `unavailable`; auth codes from `withAuth` only | any active member (`tier: "user"`), own row only |
| PUT | `/api/me/pixel-look` | `{skin, hair, style, shirt}` (integers; `hair` = hair colour, `style` = hair style) | `200 {look: PixelLook}` | 400 `invalid_request` (body not JSON or not an object), 422 `invalid_look` (an object that is not exactly one preset per layer), 404 `not_found`, 403 `member_deactivated` (row locked and found deactivated, before any write, same as `members.ts:98`), 503 | same |
| DELETE | `/api/me/pixel-look` | — | `200 {look: null}` | 404, 403 `member_deactivated` (as above), 503 | same |

- All responses `Cache-Control: no-store`; `export const dynamic = "force-dynamic"`.
- Order in PUT (R7): `readJson` → validate → `getPool` → service. No 401/403 after a write: the only service 403 is
  returned before the `update`.
- `GET /api/rooms/<id>/layout`: each `seatViews[<seat>]` gains `look: PixelLook | null` (null for empty seats and for
  occupants without a stored look). Additive; old clients ignore it.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/lib/sprites/pixel-look.test.ts › ramps are pinned (exact SKIN/HAIR/SHIRT arrays, lengths 4/6/7)` | Ramp reorder risk; DB check ranges in sync |
| `… › isPixelLook accepts every boundary (skin 0,3; hair 0,5; style 1,3; shirt 0,6)` | AC2 |
| `… › isPixelLook rejects missing key, extra key, float, string number, negative, out of range, NaN, null, array` | AC2 |
| `… › lookFromChoice maps indices to the ramp hex and keeps style` | AC4 |
| `… › resolveLook: stored → mapped; null/undefined → avatarFor(seed); garbage/out-of-range → avatarFor(seed)` | AC1, AC4 fallback |
| `… › derivedChoice(seed) maps back to avatarFor(seed) for 200 seeds incl. "" and Vietnamese text` | Slice B Reset; domain: diacritics |
| `src/lib/validate/pixel-look.test.ts › valid body → ok with the same values; non-object → field "body"; bad key → field = that key` | AC2 |
| `src/app/api/me/pixel-look/route.test.ts › GET returns {look} with no-store; 404 when service says not_found` | API |
| `… › PUT malformed JSON → 400 invalid_request; non-preset → 422 invalid_look; service not called in both` | AC2, R7 |
| `… › PUT valid → service called with ctx.scope, ctx.sub and the look; 200 {look}` | AC5 self-only |
| `… › DELETE → service called with null; 200 {look:null}; 503 without a pool` | AC5 |
| `src/server/members/pixel-look.db.test.ts › set stores the look and writes one member.update audit row with meta {fields:["pixelLook"], self:true, look}` | AC5 |
| `… › same look again writes no audit row (no-op); reset writes one with look:null; reset again writes none` | AC5 |
| `… › get returns null for a new member and the stored look after set` | AC1 |
| `… › deactivated member: 403 member_deactivated, column unchanged, no audit row` | AC5 |
| `… › org isolation: a member in another org is untouched; unknown sub → 404 not_found, no audit row` | R6 |
| `src/lib/sprites/seat-view.test.ts › occupant look passed through; invalid look → null; empty seat → look null even if a look is given` | AC4 |
| `src/lib/sprites/map-view.test.ts › look parsed; bad look → null; missing look (old server) → null` | AC4 tolerance |
| `src/lib/sprites/placement.test.ts › stored look tints the avatar frames; null look uses avatarFor(seed)` | AC4 |
| `src/server/layout/layout.db.test.ts › stored pixel look is returned for every viewer` (set `pixel_look` with SQL, read as the occupant and as another member: same `look`; another occupant stays `look: null`) | AC4 |
| `scripts/schema-check.mjs` section "pixel look": member without it reads null; valid insert and update succeed; set back to null succeeds; refused with 23514 `members_pixel_look_check`: `{}`, missing key, extra key, skin 4, hair 6, shirt 7, style 0, style 4, negative, `"2"` string, `1.5`, `1.0`, array `[]`, number `3`, string `"x"` | AC1, AC2 backstop |

## Approach
1. Migration + README bullet + `schema:check` section; run `pnpm migrate` and `pnpm schema:check` on a database that
   already has SIM-046's migration or on a scratch database (Assumption 1).
2. `src/lib/sprites/pixel-look.ts` + tests (ranges from the ramp lengths, never literals), then
   `src/lib/validate/pixel-look.ts` + tests. Comment on the ramps in `avatar.ts`.
3. `src/server/members/pixel-look.ts` (R6 via `orgQuery`, every statement `where org_id = $1 and sub = $2`):
   - `getOwnPixelLook`: `select pixel_look from members where org_id = $1 and sub = $2`; no row → `{ok:false,404,"not_found"}`;
     value through `parsePixelLook`.
   - `setOwnPixelLook` in `withTx`: `select id, status from members where org_id = $1 and sub = $2 for update`;
     missing → 404; `deactivated` → 403 `member_deactivated`; then
     `update members set pixel_look = $3::jsonb, updated_at = now() where org_id = $1 and sub = $2 and pixel_look is distinct from $3::jsonb returning id`
     (`$3` = `JSON.stringify(look)` or `null`; jsonb equality ignores key order). No row returned = no-op, no audit.
     Else `writeAudit(c, scope, {actorSub: sub, action: "member.update", entity: "member", entityId: id, meta: {fields: ["pixelLook"], self: true, look}})`.
4. Route `src/app/api/me/pixel-look/route.ts` (R1: route is the only entry into `src/server`; R7 order as in API
   contract). Add `invalid_look` to `error.ts` and `copy/api.ts`.
5. Map: `SeatView.look`, `seatViewOf`, `layout.ts` select, `map-view.ts` tolerant parse, `placement.ts` uses
   `resolveLook`; fix every `SeatView` literal (list above). The seed stays `members.id` (Assumption 2).
6. Dev fixture shows one stored look. Run all checks.
- R1: lib files import only lib; `pnpm check:layers`. R2: expand-only nullable column. R3: no config. R4: files list
  above. R5: tests above. R6: org-scoped SQL. R7: no 401/403 after a side effect.

Local env (Windows, Node/pnpm not on PATH): in PowerShell
`$fnm = Get-ChildItem "C:\Users\ttngo\AppData\Local\Microsoft\WinGet\Packages\Schniz.fnm_Microsoft.Winget.Source_8wekyb3d8bbwe" -Filter fnm.exe -Recurse | Select-Object -First 1 -ExpandProperty FullName; & $fnm env --shell powershell | Out-String | Invoke-Expression; & $fnm use 22`
then `cmd /c "pnpm ..."`. Local Postgres: `docker compose -f compose.dev.yml up -d`,
`DATABASE_URL=postgres://simap@127.0.0.1:5432/simap`.

## Specialist input used
- DB consult 1 (one nullable jsonb, null = derived): **adopted**; atomic "all four or none", reset = null.
- DB consult 2 (store indices, not hex; pin ramps): **adopted**; ramp-pin test and append-only comment.
- DB consult 2 (check with subquery / plain `-` without guard): **adapted**: no subquery (not allowed), `?&` + `- text[]`
  wrapped in `case` so a scalar cannot raise an operator error; `jsonb_typeof = 'number'` per key.
- DB consult 3 (file name, header, README bullet, keep SIM-046 bullets): **adopted**.
- DB consult 4 (do not add to `COLS`): **adopted**; `members.ts` not touched at all.
- DB consult 5 (pure `resolveLook`, falls back on garbage): **adopted**.
- DB consult 6 (schema:check cases): **adopted**, plus `1.0`, scalar and array cases.
- API consult "seed is members.id, not sub": **adopted and resolved** in Assumption 2 (keep `members.id`; it is the
  accepted SIM-015.1 A7 decision; changing it would change every existing look and expose `sub`).
- API consult 3 (sub-resource, not `PATCH /api/me`; 400 malformed / 422 non-preset): **adopted**; name
  `/api/me/pixel-look` instead of `/api/me/avatar` (Assumption 3).
- API consult 3 (do not export `ensure`/`find`; own locked read): **adopted**; missing row → 404 instead of creating it
  (Assumption 5).
- API consult 4 (separate `GET` instead of extending `MeMemberDto`): **adopted**; avoids `members.ts` and
  `lib/members/types.ts` (SIM-044.1 edits `types.ts`; SIM-046 may extend `MeMemberDto`).
- API consult 5 (`SeatView.look`, tolerant parse, layout no-store): **adopted**; layout route already `no-store`.
- API consult 7 (tests): **adopted**.
- API consult naming `avatar_look`: **rejected** in favour of `pixel_look` (spec term "pixel character look"; keeps
  "avatar" free for SIM-046's photo and `src/ui/Avatar.tsx`).

## Assumptions
Builds on: **SIM-015.1 plan** (A7: avatar seed = member id; `SeatView` shape), **SIM-045 plan** (My Portal and the
Profile tab, merged; slice B adds the picker there), **SIM-007** (`profile_confirmed_at` migration precedent), and runs
after **SIM-046** (batch 2026-11-26-1; its plan is on branch `ticket/SIM-046`, not read from this branch).

Each item has a default Ming can accept in one line ("accept SIM-047 defaults").
1. **Merge/deploy order.** SIM-047's PR merges and deploys only after SIM-046's (`20261126130000`), because
   `db/migrator.js` refuses a pending migration older than the newest applied. If SIM-046 slips, SIM-046 renumbers its
   migration after `20261126140000` (not SIM-047). Locally the implementer runs `pnpm migrate`/`schema:check` on a
   scratch database (e.g. `createdb simap_sim047` inside the compose container) or after rebasing on SIM-046, never
   leaving the shared local `simap` DB at 140000 without 130000. Default: as stated.
2. **Derived look seed = `members.id`** (what the map draws today, SIM-015.1 A7), not the raw `sub`. "Reset" returns
   to `avatarFor(members.id)`; slice B's preview uses `MeMemberDto.id`. Spec wording "derived from `sub`" (Member entity
   l.130, LAY-06 l.476, POR-06 l.596) to be read as "derived from the member"; a follow-up fixes the wording. Default:
   accept.
3. **Names.** Column `pixel_look`, route `/api/me/pixel-look`, TS type `PixelLook`, keys `skin`, `hair` (hair colour),
   `style` (hair style), `shirt` (matching `AvatarLook` in `avatar.ts`), error code `invalid_look`. Default: accept.
4. **Storage = jsonb of ramp indices** (skin 0-3, hair 0-5, style 1-3, shirt 0-6) with the exact ranges in the DB
   check (widening a ramp later = a new migration replacing the check). Not hex, not four columns. Default: accept.
5. **No member row → 404 `not_found`** on GET/PUT/DELETE (no first-visit creation here; the portal always calls
   `/api/me` first, which creates it). Keeps `members.ts` untouched. Default: accept.
6. **Self only, no Admin override** (OQ-61 default: "the character is the member's alone"), so the audit actor is
   always the member and `self: true`. Default: accept.
7. **Audit**: action `member.update` (existing name, `members.ts:111`) with
   `meta {fields:["pixelLook"], self:true, look:<indices>|null}` (after value only; indices are codes, no PII). A no-op
   (same look, or reset when already null) writes no audit row and returns 200, like `setOwnDisplayName`. Default:
   accept.
8. **A chosen look equal to the derived one is stored as chosen** (not normalised to null). Default: accept.
9. **Deactivated member**: blocked by `withAuth`'s member gate first; the service rechecks under the row lock and
   returns 403 `member_deactivated` before any write (same precedent as `members.ts:98`). Default: accept.
10. **Four layers only**, 4 × 6 × 3 × 7 = 504 looks, no new art (POR-06 "more parts only with new art"). Default:
    accept.
11. **Status codes**: 400 `invalid_request` for malformed JSON or a non-object body; 422 `invalid_look` for any object
    that is not exactly one preset per layer (missing/extra key included). Default: accept.

Hotspots / overlaps with open tickets:
- **SIM-046** (`ticket/SIM-046`, migration `20261126130000_members_photo.sql`, `src/server/members/photo.ts`,
  `/api/me/photo`, Profile UI in SIM-046.1): shared files `db/migrations/README.md` (both add a bullet at the end of
  the per-column list: keep both on rebase), `scripts/schema-check.mjs` (both add a section after 11: SIM-047 takes the
  next free number), `src/lib/api/error.ts` and `src/ui/copy/api.ts` (both append codes at the end: keep both).
  Separate migration, server file, route folder and column; no edit to `members.ts`, `MeMemberDto` or
  `src/ui/Avatar.tsx`. Expect a trivial rebase.
- **SIM-045.1** (`ticket/SIM-045.1`, `portal-state.ts`, `PortalPage.tsx`, `copy/portal.ts`): no overlap in slice A
  (no `src/ui/portal/**` edit). Slice B will touch `ProfileTab.tsx`/`ProfileTabView.tsx` and `copy/portal.ts`; SIM-046.1
  will too, so slice B puts the picker in new files (`PixelLookPicker*.tsx`, a `pixelLook` section in
  `copy/portal.ts`) with a one-line mount in `ProfileTabView.tsx`.
- **SIM-044.1** (other session; `manage.ts`, `src/server/seats/**`, `SeatDetailPanel`, `lib/members/types.ts`,
  `layout.db.test.ts`): only shared file is `src/server/layout/layout.db.test.ts`. SIM-044.1 adds a case in
  `describe("getRoomLayout seatDevices (db)")` near l.841; SIM-047 edits l.179-189 and adds a case after l.192.
  Different hunks. `src/server/layout/layout.ts` is not in SIM-044.1's list (its plan l.77 says it stays unchanged).

## Blocking questions
None. (Assumption 2 resolves the `sub` vs `members.id` conflict using the accepted SIM-015.1 A7 decision; Ming only
needs to accept it at the plan gate.)

## Split proposal
The whole ticket is about 650 product lines plus about 700 test lines, more than one implement/review cycle (> ~400).
Split as SIM-046 did:
- **SIM-047 (this plan, slice A)**: migration, preset validator, look resolution, `GET/PUT/DELETE /api/me/pixel-look`
  with audit, room map draws the stored look. Covers AC1, AC2, AC4, AC5 and the lib parts of AC3. About 300 product +
  450 test lines. Gate: plan-approval (migration).
- **SIM-047.1 (slice B, new ticket, Size S/M, Gate none, depends on SIM-047 and lands after SIM-046.1 if that is
  open)**: Profile tab "Pixel character" section: four preset pickers (swatches for skin / hair colour / shirt, three
  hair styles), live preview canvas front and back at 1× and 2× (reuses `useAtlas` and `tintedFrame` from
  `src/ui/roomlayout/`), Save (PUT), Reset (DELETE, preview returns to `derivedChoice(me.id)`), 422/err notices, copy in
  `copy/portal.ts`, unit tests for picker state. Covers AC3 and the manual test plan. No High path.
