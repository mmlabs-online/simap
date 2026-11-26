import "server-only";
import { encodeCursor } from "@/lib/audit/cursor";
import { deviceVisibility } from "@/lib/devices/visibility";
import type { Tier } from "@/lib/auth/tier";
import { historyMemberIds, toHistoryEntry, type DeviceHistoryRow } from "@/lib/devices/history";
import {
  DEVICE_HISTORY_ACTIONS,
  type DeviceHistoryEntryDto,
  type DeviceHistoryPage,
  type MemberRef,
} from "@/lib/devices/types";
import type { DeviceHistoryQuery } from "@/lib/validate/device-history-query";
import { orgQuery, type OrgScope } from "@/server/http/org-scope";
import { notFound, type Query, type Result } from "./tx";

const TS = `'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'`;

type Row = {
  id: string;
  action: string;
  at: string;
  actor_id: string | null;
  actor_name: string | null;
  meta: unknown;
  h_note: string | null;
  h_new_expires_on: string | null;
};

/**
 * DEV-11/DEV-12: the history of one device, newest first, keyset-paged on (created_at, id). Read from audit_log and
 * the handoff rows (note and new expiry), no new table. An unknown id, another org's id and (User) a device not held are all 404.
 */
export async function listDeviceHistory(
  db: Query,
  scope: OrgScope,
  sub: string,
  tier: Tier,
  deviceId: string,
  q: DeviceHistoryQuery,
): Promise<Result<DeviceHistoryPage>> {
  const dev = await orgQuery<{
    owner_id: string | null;
    holder_since: string | null;
    held: boolean;
  }>(
    db,
    scope,
    `select d.owner_id,
       to_char((select max(a.created_at) from audit_log a
                where a.org_id = d.org_id and a.entity = 'device' and a.entity_id = d.id
                  and a.action in ('device.assign', 'device.transfer_confirm')) at time zone 'UTC', ${TS}) as holder_since,
       coalesce(m.sub = $3::uuid, false) as held
     from devices d
       left join members m on m.org_id = d.org_id and m.id = d.owner_id
     where d.org_id = $1 and d.id = $2`,
    [deviceId, sub],
  );
  if (!dev.rows[0]) return notFound;
  if (deviceVisibility(tier) === "held" && !dev.rows[0].held) return notFound;
  const holderSince = dev.rows[0].owner_id === null ? null : dev.rows[0].holder_since;

  const values: unknown[] = [deviceId, [...DEVICE_HISTORY_ACTIONS]];
  let keyset = "";
  if (q.cursor !== undefined) {
    values.push(q.cursor.at, q.cursor.id);
    keyset = "and (a.created_at, a.id) < ($4::timestamptz, $5::uuid)";
  }
  values.push(q.limit + 1);
  const { rows } = await orgQuery<Row>(
    db,
    scope,
    `select a.id, a.action, am.id as actor_id, am.display_name as actor_name, a.meta,
       to_char(a.created_at at time zone 'UTC', ${TS}) as at,
       h.note as h_note, to_char(h.new_expires_on, 'YYYY-MM-DD') as h_new_expires_on
     from audit_log a
     left join members am on am.org_id = a.org_id and am.sub = a.actor_sub
     left join device_handoffs h on h.org_id = a.org_id and h.device_id = a.entity_id
       and h.id = case when a.meta->>'handoffId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                       then (a.meta->>'handoffId')::uuid end
     where a.org_id = $1 and a.entity = 'device' and a.entity_id = $2 and a.action = any($3::text[])
       ${keyset}
     order by a.created_at desc, a.id desc
     limit $${values.length + 1}::int`,
    values,
  );
  const page = rows.slice(0, q.limit);
  const last = page[page.length - 1];
  const nextCursor =
    rows.length > q.limit && last !== undefined ? encodeCursor({ at: last.at, id: last.id }) : null;

  const ids = [...new Set(page.flatMap((r) => historyMemberIds(r.meta)))];
  const names = new Map<string, MemberRef>();
  if (ids.length > 0) {
    const m = await orgQuery<{ id: string; display_name: string }>(
      db,
      scope,
      "select id, display_name from members where org_id = $1 and id = any($2::uuid[])",
      [ids],
    );
    for (const r of m.rows) names.set(r.id, { id: r.id, displayName: r.display_name });
  }

  const items = page
    .map((r) => {
      const row: DeviceHistoryRow = {
        id: r.id,
        action: r.action,
        at: r.at,
        actorId: r.actor_id,
        actorName: r.actor_name,
        meta: r.meta,
        hNote: r.h_note,
        hNewExpiresOn: r.h_new_expires_on,
      };
      return toHistoryEntry(row, names);
    })
    .filter((e): e is DeviceHistoryEntryDto => e !== null);
  return { ok: true, value: { items, nextCursor, holderSince } };
}
