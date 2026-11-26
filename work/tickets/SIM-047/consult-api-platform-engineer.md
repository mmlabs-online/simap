# Consult — api-platform-engineer — SIM-047

## Findings

**How the look is derived today**
- `src/lib/sprites/avatar.ts` (pure lib) defines `SKIN_RAMP` (4), `HAIR_RAMP` (6), `SHIRT_RAMP` (7) as hex arrays, and `avatarFor(seed)`. It uses FNV-1a with salts `:skin/:hair/:shirt/:style` and returns `AvatarLook {skin, hair, shirt (hex strings), style 1|2|3}`. `avatarFrames(look, view)` returns the tinted frames `avatar.body.{view}`, `avatar.shirt.{view}` and `avatar.hair.{style}.{view}`. `keys.json` has exactly those 8 avatar keys (body, shirt, hair 1–3, front and back). The ramps are tints on shared frames, so no new art is needed.
- **The map seed is the member id, not the account sub.**
  - `src/server/layout/layout.ts` line 77–81 selects `s.occupant_id` and joins `members o` for `display_name`.
  - `seatViewOf` (`src/lib/sprites/seat-view.ts`) sets `avatarSeed = occupantId`, which is `members.id`.
  - `placement.ts:447` then calls `avatarFor(view.avatarSeed)`.
  - The ticket and acceptance criteria say "derived from `sub`". That is wrong for the map today. The preview and "Reset" in the Profile tab must use the same seed as the map (`members.id`). If they use `sub`, Reset would change the member's visible look.
  - Flag this as a ticket/code conflict. Decide whether D44/D51's "from `sub`" wording means "from the member". Do not change the seed, because that would change every existing member's look.
- `SeatView` is `{state, avatarSeed, name}` and is parsed in `src/lib/sprites/map-view.ts:99-103`. `seatViews` is already part of the room layout response, and it is the only way the map gets occupant data. Fixtures and tests (`app/dev/roommap/fixture.ts`, `SeatOverlay.tsx` EMPTY, `placement.ts` EMPTY_VIEW, `map-view.ts` emptyView) construct `SeatView` literals.

**Me routes and the update pattern**
- `src/app/api/me/route.ts` has `GET` and `PATCH`, both wrapped in `withAuth(..., {tier:"user"})`. `PATCH` runs `readJson`, then `validateMePatch` (400 `invalid_request`), then `setOwnDisplayName`. The validator in `src/lib/validate/member.ts:39` rejects unknown keys, so `PATCH /api/me` accepts only `displayName`.
- `setOwnDisplayName` (`src/server/members/members.ts:89`) uses `withTx`, then `ensure`, then `find(... for update)`. It returns `deactivated` 403 if the member is deactivated. It runs an update whose where clause skips no-op changes, then `writeAudit({action:"member.update", meta:{fields:[...], self:true}})`. It does nothing and writes no audit row when nothing changed.
- `MeMemberDto` (`src/lib/members/types.ts`) is `{id, displayName, status, needsProfile}`. The `Row`, `COLS` and `toDto` in `members.ts` are shared by all member reads.
- Existing validation errors on `/api/me` are 400 `invalid_request`. The ticket wants **422** for non-preset values (AC2). R7 says auth codes come only from the wrapper. Domain refusals use 409/422, so 422 is allowed after the wrapper.
- Latest migration in `db/migrations/` is `20261126120000_map_items_new_builtin.sql`. The precedent for a profile column is `20261120190000_members_profile_confirmed_at.sql`: one nullable column, no default, no backfill, and the previous image never touches it.

**Rules**
- R1: the picker UI in `src/ui/portal/**` may use `src/lib` only. Preset lists and the validator must live in `src/lib` (the ramps are already there). The server and route handlers import them. The UI must not import `src/server`.
- R2: one expand-only nullable column; the old image ignores it.
- R6: every query uses `orgQuery` with `org_id`, as the existing code does.
- R7: the validator and role/ownership checks run before any write, and the route returns 422 only from validation.

## Recommendations

1. **Storage**
   - Add a single nullable column, e.g. `alter table members add column avatar_look jsonb null;`, in a new migration.
   - Alternative: four nullable smallint index columns plus a `check` constraint.
   - I prefer storing **preset indices** (skin 0–3, hair colour 0–5, shirt 0–6, style 1–3) over hex strings. Indices survive a ramp colour tweak, and server validation is just integer ranges. Put a `check` on the JSON shape only if cheap. Otherwise rely on the validator and on tolerant reads.
   - NULL means "derived". Existing members keep the derived look and there is no backfill (AC1).
   - Name it `avatar_look`, not `avatar`, to avoid colliding with SIM-046's photo columns.

2. **Pure lib (single new file, no overlap)**
   - Create `src/lib/sprites/avatar-look.ts`, or extend `avatar.ts`, with `AvatarChoice {skin, hair, style, shirt}` (indices). Add `choiceToLook(choice)` and `resolveLook(choice|null, seed)`, which returns the stored look or `avatarFor(seed)`. Add `choiceOf(look)` if the picker needs to preselect the derived look.
   - Add `validateAvatarLook(body)` in `src/lib/validate/avatar.ts` (new file). It rejects unknown keys, non-integers and out-of-range values, and requires all four layers, which gives "one preset per layer".
   - Export the preset lengths from `avatar.ts` and have the validator use them, so ramp and validator cannot drift.

3. **API shape: a sub-resource, not `PATCH /api/me`**
   - `PUT /api/me/avatar` with body `{skin, hairColor, hairStyle, shirt}` (indices) sets the look. `DELETE /api/me/avatar` resets it, back to NULL.
   - Creating `src/app/api/me/avatar/route.ts` avoids editing `me/route.ts` and `validate/member.ts`. SIM-046 is adding `/api/me/photo`, so the two siblings do not touch each other.
   - Errors: bad JSON gives 400 `invalid_request`. A non-preset value gives **422** `invalid_look`, via `apiError`, after `withAuth`. Deactivated members get 403 `member_deactivated`.
   - Return the updated `MeMemberDto`, or a small `{look: AvatarChoice|null}`.
   - Self-only is guaranteed because the handler uses `ctx.sub` and `ctx.scope` and takes no member id from the request. Idempotency: PUT and DELETE are naturally idempotent. A no-op change writes no audit row, which matches the displayName pattern. Decide if no-op writes an audit row; I suggest not.
   - Audit: `writeAudit({action:"member.update", entity:"member", entityId, meta:{fields:["avatarLook"], self:true}})`. Alternatively use `member.avatar_set` and `member.avatar_reset`. Include the new indices in `meta`, which are not PII. Check that the audit action allow-list or type (if there is one) in `src/server/audit/write.ts` accepts the new action names.
   - DB code goes in a new file, `src/server/members/avatar.ts`. It exports `setOwnAvatarLook(db, scope, who, choice|null)` and mirrors `setOwnDisplayName`. It imports `ensure`, `find` and the `Result` types from `members.ts`, which are currently not exported. Export `ensure`, `find` and `Row`, which is a small additive edit to `members.ts`. Alternatively, reimplement a minimal `select ... for update` in the new file to avoid touching `members.ts` at all. That is what I recommend because of the parallel edits.

4. **Reading the stored look to the member (Profile tab)**
   - Add the stored look to the `/api/me` GET response. The least-conflict way is to extend `getOrCreateMember`/`toDto` with an optional `avatarLook` field on `MeMemberDto`. That edits `members.ts` `COLS` and `Row`, which is the one unavoidable shared edit.
   - Alternative: `GET /api/me/avatar` in the new route, so `members.ts` and `MeMemberDto` stay untouched. This costs one extra fetch on the Profile tab. I prefer this for overlap reasons.
   - The Profile tab needs `members.id` (already in `MeMemberDto.id`) as the seed for the derived look and the "Reset" preview.

5. **Exposing the look to the map**
   - Add one field to `SeatView`: `avatarLook: AvatarChoice | null` (or `look`).
   - `layout.ts`: add `o.avatar_look` to the existing select (line 77), add a `Row` field, and pass `occupantLook` into `seatViewOf`. Update `seat-view.ts` to emit it.
   - Update `map-view.ts` to parse it tolerantly (invalid, or missing in an old-image/cached response, becomes null).
   - In `placement.ts:447`, change to `avatarFrames(resolveLook(view.avatarLook, view.avatarSeed), ...)`.
   - Make the new field optional or default it to null in `EMPTY_VIEW`, `emptyView`, `SeatOverlay` EMPTY and the dev fixtures, so no literal breaks.
   - AC4 "next layout load, for every viewer" holds because the layout fetch is per-viewer. Check whether the layout response is cached. `layout.ts` is read-only per request, and `/api/me` uses `no-store`. Confirm the layout route does the same.
   - Do not expose the member's id or other fields. The look has no privacy concern beyond what the map already shows.

6. **Minimising overlap**
   - SIM-044.1 edits `src/server/members/manage.ts` and `src/server/seats/**`. This design touches neither. It touches `src/server/layout/layout.ts` only, which is outside both lists. If SIM-044.1 changes seat shapes that `layout.ts` consumes, it is a trivial rebase.
   - SIM-046 adds `src/server/members/photo.ts` and `/api/me/photo`. This design adds `avatar.ts` and `/api/me/avatar` as siblings, and uses separate columns and migration filenames.
   - Migration: use a timestamp after `20261126120000`. SIM-046 will also add a migration, so choose clearly distinct timestamps, for example `20261126140000_members_avatar_look.sql`. Both are expand-only `alter table ... add column`, so the order does not matter. Make sure the two do not both pick the same version string. The shared files to expect conflicts in are `src/lib/members/types.ts` (if the DTO is extended), the Profile tab in `src/ui/portal/**` (SIM-046 also builds a Profile tab section), and `src/ui/copy/*.ts`. Put the picker in a new component file and a new copy file or section, and keep the Profile tab wiring to one import line.
   - Also sync with SIM-046 on who creates the Profile tab container if the other ticket lands first. SIM-047 depends on SIM-045, so check that this exists.

7. **Tests**
   - Unit tests: the validator (accept all boundary values; reject missing, extra, float, string and negative values), `resolveLook` (stored and fallback), `seatViewOf` and `map-view` parsing with the new field, and an audit-meta test.
   - Route test following `src/app/api/me/route.test.ts`. DB tests go in a new `avatar.db.test.ts`: round trip, reset, no-op (no audit), deactivated member, and org isolation.
   - `pnpm schema:check` needs the new column in its expected schema.

## Risks
- **Seed mismatch** (above): ticket says `sub`, code uses `members.id`. Using the wrong one makes Reset visibly change the look.
- High path (migration): needs plan approval, so the plan must be explicit about the expand-only column.
- Layout response shape change: an old client with a new server tolerates the extra field. A new client with an old server (cached, or rolling deploy) must handle a missing field, so parse tolerantly. A stored look that is out of range (ramp shrinks later) must fall back to the derived look rather than crash. `resolveLook` should clamp or fall back on invalid indices.
- `ensure` and `find` are private in `members.ts`. Exporting them is a small edit to a file another ticket may touch. Prefer duplicating a minimal locked read in `avatar.ts`.
- Status codes: 422 for invalid presets differs from the 400 `invalid_request` used by `/api/me` PATCH. Keep 400 for malformed JSON and 422 only for well-formed non-preset values, and say so in the plan.
- A deactivated member should be refused (403 `member_deactivated`, as `setOwnDisplayName` does).

## Open questions
1. Seed for the derived look and Reset: confirm `members.id` (what the map uses today) rather than `sub`, and update the ticket wording.
2. Look storage: index columns/JSON of indices (recommended) or hex values?
3. Does the member's first-visit flow (`needsProfile`) need to be touched? Recommend no.
4. Does a no-op set (same look) write an audit row? Recommend no, matching `setOwnDisplayName`.
5. Include the stored look in `GET /api/me` (touches `members.ts` and `MeMemberDto`) or a separate `GET /api/me/avatar` (recommended for overlap)?
6. Should the hair style be offered as 1–3 with the existing 6 hair and 7 shirt colours, i.e. 4x6x3x7 = 504 looks, and is that enough for D71's "..." (spec POR-06)? D71 lists "skin, hair, shirt, ..." but the ticket scopes to four layers and no new art.
7. Audit action naming: `member.update` with `fields:["avatarLook"]` or new actions? Check the audit action list in `src/server/audit/write.ts`.

Files consulted: `work/tickets/SIM-047/ticket.md`, `src/lib/sprites/avatar.ts`, `src/lib/sprites/seat-view.ts`, `src/lib/sprites/placement.ts`, `src/lib/sprites/map-view.ts`, `src/server/layout/layout.ts`, `src/server/members/members.ts`, `src/app/api/me/route.ts`, `src/lib/validate/member.ts`, `src/lib/members/types.ts`, `work/decisions.md`.
