## Findings

**Existing building blocks (reuse as is)**
- `GET /api/devices/[id]` already exists (`src/app/api/devices/[id]/route.ts`, `withAuth` tier `user`, UUID check -> 404, returns the full `DeviceDto`). `DeviceDto` already has every field the page needs: fields, `holding` (note, expiresOn), `owner`, `placement`, `mine`, `overdue`, `pendingHandoff`, and the `can*` flags. `devices-api.ts` already has `api.get(id)`, which nothing uses yet. No new endpoint is needed for the detail half. Only `/api/devices/[id]/history` is new.
- Page/view split: `src/app/(app)/devices/page.tsx` is a thin server component that renders `DevicesPage` from `@/ui`. `DevicesPage.tsx` is the client container (api via `useApiFetch` + `createDevicesApi`, dialog state, `notice`, `headingRef`, focus after actions). `DevicesView.tsx` is a pure view with `status: loading|error|ready` and `errorCode`. Dynamic routes follow `src/app/(app)/rooms/[roomCode]/page.tsx`: `await params`, then `<SeatsPage key={roomCode} roomCode=... />`.
- Loading/error pattern in `DevicesView`: `aria-busy` skeleton `Card`s with `animate-pulse`; an error `Card` with `role="alert"`, `apiErrorMessage(code)` and a tonal "Retry" button; an empty `Card`. Heading is `h1` with `tabIndex={-1}`, `outline-none` and a `headingRef`. Notices live in an `aria-live="polite"` region.
- Hooks: `useDevices` + `devicesReducer` (`devices-state.ts`) give a counter-based stale-answer guard, a `mounted` ref, and `load` (clears) vs `refresh` (keeps rows). Mirror this for the detail and history hooks.
- Display helpers in `devices-state.ts` and `DeviceTable.tsx`: `expiryText(h, overdue)`, `pendingText(d)` (chip + "to" line), `placementText`, `detailsText`. The private components `OwnerLabel`, `PlacementLabel`, `Details` and `Mac` in `DeviceTable.tsx` hold the chip logic: "You" chip, pending chip, overdue chip using `--error-container`, role chip, and the note rendered with `whitespace-pre-line` + `CLIP`. `DeviceRowActions` + `rowActions(d, handlers, busyId)` build the buttons purely from the server's `can*` flags and the handlers that were passed, so the detail page can render `<DeviceRowActions>` as is.
- Dialogs (`TransferDeviceDialog`, `ReturnDeviceDialog`, `ExtendDeviceDialog`, `TakeBackDeviceDialog`, `PlaceDeviceDialog`, `AssignDeviceDialog`, `DeviceFormDialog`, `DeleteDeviceDialog`) take `device`, `devicesApi` and `onClose`/`onStale`/`onDone`. They are wired in the 378-line `DevicesPage` and not extracted.
- Links today: `DeviceTable` has no link on the device name. `SeatDetailPanel.tsx` `Device` renders a plain `<span className="font-bold">{device.name}</span>`. `SearchView.tsx` `DeviceRow` links to `DEVICES_HREF` (the list). `nav.ts` has `roomDetailHref(code)` with a dot-segment guard; there is no device href helper.
- Audit data: `device.*` audit rows are written with these actions: `create`, `update`, `assign`, `holding_update`, `delete`, `transfer_start`, `return_start`, `extension_start`, `{transfer|return|extension}_{cancel|decline}`, `transfer_confirm`, `return_confirm`, `extension_confirm`, `return_take_back`, plus a placement action (`device.${decision.kind}`, devices.ts:320). `entity_id` is the device id. Meta keys differ per action:
  - `handoffId`, `fromMemberId`, `toMemberId`
  - `note`, `newExpiresOn`, `fromExpiresOn`/`toExpiresOn`
  - `from`/`to` (holding edit)
  - `byManager`, `byTakeBack`, `byAdmin`, `cancelledHandoffId`
  - `placementMeta(p)`
  - `memberId`/`expiresOn` (assign)
- `listAudit` (`src/server/audit/audit.ts`) is the keyset template: `(created_at, id) < (cursor)`, fetch `limit+1`, `order by created_at desc, id desc`, `encodeCursor`/`nextCursor` from `@/lib/audit/cursor`, and it left-joins `members` for the actor name (`display_name` nullable, so a deactivated or removed member still has a row). The Audit page UI already pages with this cursor.

## Recommendations

1. **API** (R1, R6, R7)
   - Add `src/app/api/devices/[id]/history/route.ts` with `withAuth` tier `user`, `isCanonicalUuid` -> 404, `getPool` 503, and `Cache-Control: no-store`, like the sibling routes. Parse `limit` and `cursor` through a new validator in `src/lib/validate/` (reuse the audit cursor codec, or parameterise it).
   - Add `listDeviceHistory` in `src/server/devices/history.ts` (starts with `import "server-only"`). It first checks the device exists in the org (use `getDevice`) and returns 404 `not_found` for another org's id. Do this before reading history, and do not rely on audit rows alone, because `device.delete` rows keep the entity_id. Also decide the deleted-device case (see Open questions).
   - Query `audit_log where org_id=$1 and entity='device' and entity_id=$2 and action like 'device.%'`. Keyset on `(created_at,id)` as in `listAudit`. Resolve names by left-joining `members` for the actor, `fromMemberId`, `toMemberId` and the confirmer. Keep the display name when the member is deactivated (the ticket's "survives deactivation" AC). Fall back to a "former member" label when the member row is missing. Use the member row, not live Identity.
   - **Audit-only is the one-source option.** Per the ticket's Architect default, every handoff event writes an audit row. "Confirmed by" is the actor of the `*_confirm` row. "Requested by" is the actor of the `*_start` row. So `device_handoffs` is only needed to fill gaps. Check that the confirm/decline/cancel audit rows are sufficient before joining `device_handoffs` as a second source. Merging two sources under one keyset cursor is more complex. If the join is needed, do it via `meta->>'handoffId'`.
   - Return a DTO in a UI-friendly shape: `{ id, kind (one union of event kinds), at, actor, from, to, note, expiresOn/newExpiresOn, confirmedBy, placement? }`. Map the raw `action` + `meta` in a pure function in `src/lib/devices/history.ts` (unit-testable, matches the "unit: history mapping" test plan). Unknown future actions should map to a generic "updated" kind, not throw.
2. **Routing and page/view split**
   - `src/app/(app)/devices/[id]/page.tsx`: `await params` and render `<DeviceDetailPage key={id} deviceId={id} />` from `@/ui`. Export it from `src/ui/index.ts`.
   - Put the files in `src/ui/devices/`:
     - `DeviceDetailPage.tsx` (client container): `createDevicesApi`, hooks, dialog state.
     - `DeviceDetailView.tsx` (pure view).
     - `DeviceHistory.tsx` (pure list).
     - `useDeviceDetail.ts` (load/refresh, stale-guard and `mounted` pattern from `useDevices`).
     - `useDeviceHistory.ts` (first page + "Load more" with cursor, list in the reducer).
     - `device-history.ts` (+ test): copy and formatting helpers.
   - Add to `devices-api.ts`: `history(id, cursor?)` that validates `{items:[], nextCursor}`. `get` is already there. Give `get` a `not_found` branch: 404 -> `fail("not_found")`. The `call` helper already forwards the server's error code.
   - Reducer states for the detail: `loading | error | notFound | ready`. Treat `not_found` as its own state with a "Back to Devices" link, not the generic retry card, because it is not retryable and the ticket requires another org's device to return not found.
3. **View content**
   - `h1` (device name, `tabIndex={-1}`, `headingRef`) with a back link to `/devices`. A detail `Card` with `<dl>` for type, inventory number, MAC, serial, manufacturer and brand.
   - Where it is (`PlacementLabel` link to the room + role chip) and who holds it (`owner`/`orgInventory` + "You" chip + overdue chip + `expiryText(holding, overdue)` + note).
   - Pending handoff section from `pendingText` (+ requested by, createdAt).
   - **Extract `OwnerLabel`, `PlacementLabel`, `Details` and `Mac` from `DeviceTable.tsx` into a shared file and export them** (for example `device-labels.tsx`), instead of copying them. Any change to the overdue chip then stays in one place. Keep the `DeviceTable` output unchanged so `DevicesView.test.tsx` still passes.
   - Actions: `<DeviceRowActions device handlers busyId />` with the same `rowActions` gating. Offer `onTransfer`, `onReturn`, `onExtend`, `onCancelHandoff`, `onTakeBack`, `onAssign`, `onEditHolding`, `onPlace`, and Edit/Delete if wanted. The ticket only requires transfer, return and assign. Pass only those handlers (as `bannerHandlers` does) and leave the rest to the list.
   - History: an ordered list `<ol>` in a `Card`, one `<li>` per event with a kind label (a Chip), time, actor, "from -> to", note (`whitespace-pre-line`), expiry text and "Confirmed by". Skeleton while loading, an `aria-busy` region, an empty state ("No history yet") and "Load more" (a `Button` with a busy state). Keep a separate `status`/`errorCode` for history, so a history failure does not hide the detail card; add a retry button inside the history card.
   - Copy: new `devicesCopy.detail`/`devicesCopy.history` keys in `src/ui/copy/devices.ts` (D36), including all kind labels. Add `shellCopy.pages.deviceDetail`, as `roomDetail` has.
4. **Dialog reuse**: `DevicesPage` owns the dialog wiring inline. For the new page, either duplicate the small handler block (about 60 lines) or extract a `useDeviceDialogs` hook/`DeviceDialogs` component used by both pages. Extraction is the cleaner option but touches `DevicesPage` (R4: keep the extraction behaviour-preserving, with the existing tests green). If the plan wants a smaller diff, mount the same dialog components with `onDone` -> `refresh()` of the detail + history, and `setNotice`.
5. **Focus and notices**
   - After a dialog `onDone`: refresh the device and the first history page, then focus the `h1`. Reuse the existing `devicesCopy.transfer.sent`, `giveBack.sent` and `extend.sent` notice texts.
   - After a delete (if offered), `router.replace("/devices")`.
   - On the 404 and error states, put focus on the heading or the alert.
   - Use `next/link` for navigation. On page entry, move focus to the h1 (the container does `headingRef.current?.focus()` after the first ready state).
6. **Links (AC4)**
   - Add `deviceDetailHref(id)` in `src/lib/nav.ts` (`/devices/${encodeURIComponent(id)}`) and a unit test.
   - `DeviceTable`: wrap the name in `Link` (table cell and mobile card). `SearchView.DeviceRow`: link the name to the detail, and keep or drop `DEVICES_HREF` (decide; `search-state.ts` also builds hrefs, see `roomDetailHref` at line 161). `SeatDetailPanel.Device`: link `device.name`. `SeatDeviceDto` has `id` (the panel uses `key={d.id}`), so no type change is needed.
   - Update the existing tests (`SeatDetailPanel.test.tsx`, `SearchView.test.tsx`, `search-state.test.ts`, `DevicesView.test.tsx`) for the extra link.
   - Add `/devices/<id>` to nav `isActive` (already works through `startsWith`).
7. **Tests** (R5)
   - Unit: history mapping, `deviceDetailHref`, the history validator/cursor, the reducer.
   - Route tests (pattern: `devices-routes.test.ts`): 401, 404 for a bad uuid, cursor 400.
   - DB test (`pnpm test:db`): a device walked through create -> assign -> transfer -> confirm -> return -> take-back gives the right order and "confirmed by"; another org's id -> 404; a deactivated actor keeps their name.
   - Component: `DeviceDetailView` in loading, error, notFound, empty history, pending handoff and overdue states; the "Load more" action; focus.

## Risks

- Audit rows record only the actor's `sub`. Names come from `members` at read time. A member that was removed (not just deactivated) has no row and needs a fallback label. Display-name changes are shown with the current name (acceptable, but note it).
- `device.update` stores `from`/`to` only for the inventory number; other field edits have only the `fields` list. History can say "edited name, serial" without old/new values. Do not promise more than that.
- The placement audit action is `device.${decision.kind}` (devices.ts:320). Confirm the exact values and the `meta` keys, and map them (`fromCode`/`toCode`) so a seat move shows "A-12 -> inventory".
- Meta shape drift: history mapping must treat `meta` as untyped (`Record<string, unknown> | null`), as `AuditEntryDto.meta` is. Read fields defensively.
- Audit rows with `entity_id` set but a different `entity` value (a handoff entity with the device as `entityId`, see handoffs.ts:362 `entityId: dto.device.id`). The query must select by `entity_id = device id` and `action like 'device.%'`, not by `entity = 'device'` alone. Verify which `entity` those rows use.
- Extracting the labels from `DeviceTable` and the dialogs from `DevicesPage` risks regressions in the existing list tests. Keep the output identical.
- R7: the history route must return 401/403 only from `withAuth`, before any side effect. It is read-only, so it is safe.
- Pending-handoff "note is not included" in `PendingHandoffDto`. If the page needs to show the pending note, the DTO would change (then every list consumer changes). The history shows notes from the `*_start` audit row, so the page can avoid the DTO change.
- A deleted device is gone from `getDevice` so its history is unreachable (404). That fits "any member opens a device".
- No index check: `audit_log` filtering by `(org_id, entity_id)` may need an index (check the migrations; R2 requires a forward-only migration if one is added). A scan on a large audit table would make the history slow.

## Open questions

1. Is audit_log alone enough for "confirmed by" and "requested by", or must `device_handoffs` also be joined (the ticket says "handoff rows and device audit rows")? The Architect default says audit_log plus device_handoffs, no new table.
2. Do the history events include the device's current pending handoff as the newest entry (a `*_start` row exists already), or is the pending one shown only in the pending section? Recommend showing it only in the pending section and in history as its start event.
3. Should the history show deletion rows? Deleted devices 404, so the question is moot unless a tombstone is wanted. Which visibility rule applies for the history of a device that has had a take-back?
4. Should the detail page offer Edit/Delete/Place, or only transfer, return and assign (ticket scope)? Recommend limiting to the ticket scope plus extend, cancel and take-back, which come free with `rowActions`.
5. Page size and the "Load more" vs infinite scroll: recommend limit 50 with a "Load more" button (keyboard-friendly).
6. Search hit: keep the link to `/devices` for the owner or move it entirely to the detail page?
7. Does the `audit_log` have an index covering `(org_id, entity_id, created_at desc, id desc)`? If not, the plan needs a migration (R2) or a justification.
