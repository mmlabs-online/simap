## Findings

**Existing endpoints.** `GET /api/devices/[id]` already exists. It uses `withAuth(tier:"user")` and `isCanonicalUuid`, so a bad id gives 404 `not_found`. It returns `getDevice(...)` as a `DeviceDto`, scoped by org, and a device from another org comes back as `notFound`. `DeviceDto` already has holding (note, expiresOn), owner, placement, `overdue`, `pendingHandoff` (note excluded, "visible org-wide" per DEV-02) and every `can*` flag. **The detail half of the ticket needs no new API.** The UI page can call `GET /api/devices/{id}` as it is.

**History data.**
- `audit_log` is append-only, with columns (org_id, actor_sub, action, entity, entity_id, meta jsonb, created_at). There is an index on (org_id, entity, entity_id, created_at desc). It has no FK on `entity_id`, so it survives device and member removal.
- Every lifecycle action writes an audit row with `entity='device'` and `entity_id=deviceId`:
  - `device.create`
  - `device.update`
  - `device.assign`, with meta memberId, note, expiresOn
  - `device.holding_update`, with meta from/to {note, expiresOn}
  - `device.<placement kind>`, with meta fromSeatId, fromCode, toSeatId, toCode, role, ownerId
  - `device.{transfer,return,extension}_start`, `_cancel`, `_decline` and `_confirm`, each with meta handoffId, fromMemberId, toMemberId
  - `device.return_take_back`, with meta byAdmin and cancelledHandoffId
  - `device.delete`
- `actor_sub` is the Identity sub. To get a member name, join `members` on (org_id, sub). `members.sub` is unique per org and members are never hard-deleted, only deactivated, so names survive deactivation.
- `device_handoffs` holds note, new_expires_on, requested_by, decided_by and decided_at. It has the index (org_id, device_id, created_at desc). Rows cascade-delete with the device, which is fine because the device is gone then.
- The `_confirm`, `_cancel` and `_decline` audit rows do **not** carry note, expiry or the confirming member. That data lives only on the handoff row, reachable through `meta.handoffId`.
- The audit meta stores only IDs, not names, for members.

**Spec.** DEV-11 says history lists every create, assign, transfer (started, cancelled, declined, confirmed), return (started, cancelled, confirmed, Admin return), extension and expiry change. Each entry shows who, from/to member, when, note, expiry date and who confirmed. History is kept after deactivation or removal. The spec says history is read from the handoff rows and the audit log (spec line 129), so no new table is needed.

## Recommendations

1. **Schema.** No migration is needed. Audit rows plus a left join to `device_handoffs` on `(meta->>'handoffId')::uuid` cover every field. This matches the Architect default and keeps R2 trivially satisfied. Optional: if the join becomes slow, add an expression index later. The existing (org_id, entity, entity_id, created_at desc) index is enough for one device.

2. **Endpoint:** `GET /api/devices/[id]/history?limit=&cursor=`, in a new file `src/app/api/devices/[id]/history/route.ts`.
   - Use `withAuth({tier:"user"})`, which allows any member, with `no-store` and `dynamic=force-dynamic`, like the sibling routes.
   - A non-UUID id returns 404 `not_found`.
   - Check the device exists in the caller's org first, using `getDevice` or a light `select 1 from devices where org_id=$1 and id=$2`. A missing id or another org's device returns 404 `not_found`. The history query must also filter `audit_log.org_id`. Use `orgQuery` so R6 scoping is in the query.
   - A pool failure returns 503 `unavailable`.
   - R7: all 401/403 come from `withAuth` before any query. This route is read-only. Domain refusals are not applicable, since there are no writes.
   - Alternative: embed the first page of history in `GET /devices/[id]`. I advise against this because it would bloat every list-adjacent reload (`reload()` reuses `getDevice`) and break the `DeviceDto` contract. Keep it a separate resource.

3. **Response shape** (add to `src/lib/devices/types.ts`):
   ```ts
   type DeviceHistoryEventType =
     "create" | "update" | "assign" | "holding_update" | "place" | "move" | "unplace" /* actual placement kinds from decision.kind */
     | "transfer_start" | "transfer_cancel" | "transfer_decline" | "transfer_confirm"
     | "return_start" | "return_cancel" | "return_decline" | "return_confirm" | "return_take_back"
     | "extension_start" | "extension_cancel" | "extension_decline" | "extension_confirm";
   type DeviceHistoryEntryDto = {
     id: string;                 // audit_log.id
     type: DeviceHistoryEventType;
     at: string;                 // ISO 8601 UTC
     actor: MemberRef | null;    // from actor_sub via members; null if no matching member
     from: MemberRef | null;
     to: MemberRef | null;
     note: string | null;
     expiresOn: string | null;   // assign: expiresOn; extension: newExpiresOn; holding_update: to.expiresOn
     fromExpiresOn: string | null;  // extension_confirm, holding_update
     confirmedBy: MemberRef | null; // decided_by on confirm rows
     handoffId: string | null;
     place: { fromCode: string|null; toCode: string|null; role: DeviceRole|null } | null;
     fields: string[] | null;    // update / holding_update
     byAdmin: boolean | null;    // flags such as byTakeBack / byManager / byAdmin
   };
   type DeviceHistoryResponse = { items: DeviceHistoryEntryDto[]; nextCursor: string | null };
   ```
   - Take `type` from `action` with the `device.` prefix stripped. Map unknown future actions to a generic entry, and don't 500 on them.
   - Exclude `device.delete`, because the device no longer exists.
   - Resolve names with a single batched `members` lookup over the collected ids. Do not do N+1 queries. Return the display name even for deactivated members.
   - Add a `/lib` pure mapper (audit row, handoff row and name map to DTO). This is the "unit: history mapping" test target.

4. **Pagination.** Use keyset pagination ordered by `(created_at desc, id desc)`, which matches the existing `audit_log_org_created_idx` ordering. The cursor is an opaque base64url of `{t: iso-with-microseconds, id}`.
   - A malformed cursor or an out-of-range `limit` returns 400 `invalid_request`, as the other routes do.
   - Default limit is 50, max 100. Fetch `limit+1` rows to compute `nextCursor`.
   - Do not use the `truncated` pattern from `DeviceListResponse` here. History is unbounded, so it needs a cursor.
   - Timestamp precision: `created_at` has microsecond precision, and JS Dates truncate to milliseconds. Carry the cursor timestamp as text from Postgres (for example `created_at::text`), not as a `Date`, to avoid skipping or duplicating rows.

5. **Visibility.** Every org member sees the full history (DEV-11 and the ticket say "any member"). This includes notes and who confirmed. `pendingHandoff` in `DeviceDto` omits the note, but history is spec-mandated to show notes. State this explicitly in the plan, so the reviewer doesn't read it as a leak.

6. **UI wiring.** The detail page uses `GET /api/devices/{id}` for the `can*` flags and reuses the existing dialogs. The history list is loaded separately with a "Load more" button on `nextCursor`.

## Risks

- **Missing data on audit rows.** If you read only audit, you lose the note, the extension date and the confirmer for confirm, cancel and decline events. Mitigation: always left join `device_handoffs`. Do not change the audit meta shape retroactively. Old rows can't be backfilled, and the join makes that unnecessary.
- **Handoff rows cascade-deleted with the device.** Not a concern for an existing device. A deleted device returns 404, and its audit rows remain, but the page can't open them.
- **Placement action kinds.** `device.${decision.kind}` has several values that I did not enumerate (see `decideX` in `src/lib/devices/` placement rules). The mapper must be checked against that exact list.
- **Audit `actor_sub` is not a member id.** An actor with no member row (for example a system or admin-portal actor) must map to `actor: null` or a placeholder, not crash.
- **Old audit rows from before D63** (for example `ownerId` in create meta and different shapes from earlier tickets) may lack the new fields. Make the mapper tolerant: treat meta as `unknown` and null-coalesce every field.
- **Time-based cursor races.** Rows with equal `created_at` are covered by the `id` tiebreaker. Transaction-time `now()` can make a row appear "older" than one already seen. This is acceptable for a read-only history, since a refresh fixes it.

## Open questions

1. Should expiry-only edits (`holding_update`) show who changed it and the old and new date? I recommend yes. The meta already has it.
2. Should `device.update` (name, serial and similar) edits appear? The spec lists "expiry change" but not field edits. I recommend including them with a `fields` list, which is cheap and complete. Say if Ming wants them hidden.
3. Is it acceptable that a member whose `members` row is missing shows as "Unknown member"? I recommend yes.
4. Confirm that all-member visibility of notes in history is intended. The DTO withholds the note on `pendingHandoff` but not here.
5. Placement-kind labels (`place`, `move`, and so on): confirm the real strings from `decideX` before the plan fixes the type union.
