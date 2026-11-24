import "server-only";
import { encodeCursor } from "@/lib/audit/cursor";
import type {
  MyRequestsFilter,
  MyRequestsPage,
  RequestListFilter,
  RequestListItemDto,
  RequestPage,
  RequestsSeenResult,
} from "@/lib/requests/types";
import { withTx, type TxClient } from "@/server/db/tx";
import { orgQuery, type OrgScope } from "@/server/http/org-scope";
import type { Db } from "@/server/seats/seats";
import { ISO, REQUEST_FROM, REQUEST_SELECT, toRequestDto, type RequestRow } from "./requests";

type ListRow = RequestRow & { occupant_id: string | null; occupant_name: string | null };
type MineRow = RequestRow & { is_new: boolean };

/** Numbers parameters from `$2` (`$1` is the org id bound by `orgQuery`). */
function binder(values: unknown[]) {
  return (v: unknown): string => {
    values.push(v);
    return `$${values.length + 1}`;
  };
}

/** REG-02: Approvals list, newest first, keyset-paged on (created_at, id). */
export async function listRequests(
  db: Db,
  scope: OrgScope,
  f: RequestListFilter,
): Promise<RequestPage> {
  const values: unknown[] = [];
  const bind = binder(values);
  const where = ["q.org_id = $1", `q.status = ${bind(f.status)}`];
  if (f.cursor !== undefined) {
    where.push(
      `(q.created_at, q.id) < (${bind(f.cursor.at)}::timestamptz, ${bind(f.cursor.id)}::uuid)`,
    );
  }
  const limit = bind(f.limit + 1);
  const { rows } = await orgQuery<ListRow>(
    db,
    scope,
    `select ${REQUEST_SELECT}, o.id as occupant_id, o.display_name as occupant_name
     from ${REQUEST_FROM}
       left join members o on o.org_id = s.org_id and o.id = s.occupant_id
     where ${where.join(" and ")}
     order by q.created_at desc, q.id desc
     limit ${limit}::int`,
    values,
  );
  const page = rows.slice(0, f.limit);
  const last = page[page.length - 1];
  const items: RequestListItemDto[] = page.map((r) => ({
    ...toRequestDto(r),
    currentOccupant: r.occupant_id ? { id: r.occupant_id, displayName: r.occupant_name! } : null,
  }));
  const nextCursor =
    rows.length > f.limit && last !== undefined
      ? encodeCursor({ at: last.created_at, id: last.id })
      : null;
  return { items, nextCursor };
}

const UNSEEN = `status in ('approved','rejected') and decided_at > coalesce($3::timestamptz, '-infinity'::timestamptz)`;

async function countUnseen(
  c: TxClient,
  scope: OrgScope,
  memberId: string,
  seenAt: string | null,
): Promise<number> {
  const { rows } = await orgQuery<{ n: number }>(
    c,
    scope,
    `select count(*)::int as n from seat_requests
     where org_id = $1 and subject_id = $2 and ${UNSEEN}`,
    [memberId, seenAt],
  );
  return rows[0]!.n;
}

/** D24: the caller's requests, newest first. Page and count read one snapshot. */
export function listMyRequests(
  db: Db,
  scope: OrgScope,
  sub: string,
  f: MyRequestsFilter,
): Promise<MyRequestsPage> {
  return withTx(db, async (c) => {
    await c.query("set transaction isolation level repeatable read, read only");
    const me = await orgQuery<{ id: string; seen_at: string | null }>(
      c,
      scope,
      `select id, to_char(requests_seen_at at time zone 'UTC', ${ISO}) as seen_at
       from members where org_id = $1 and sub = $2::uuid`,
      [sub],
    );
    const member = me.rows[0];
    if (!member) return { items: [], unseen: 0, nextCursor: null };

    const values: unknown[] = [member.id, member.seen_at];
    const bind = binder(values);
    const where = ["q.org_id = $1", "q.subject_id = $2"];
    if (f.cursor !== undefined) {
      where.push(
        `(q.created_at, q.id) < (${bind(f.cursor.at)}::timestamptz, ${bind(f.cursor.id)}::uuid)`,
      );
    }
    const limit = bind(f.limit + 1);
    const { rows } = await orgQuery<MineRow>(
      c,
      scope,
      `select ${REQUEST_SELECT},
         (q.status in ('approved','rejected')
           and q.decided_at > coalesce($3::timestamptz, '-infinity'::timestamptz)) as is_new
       from ${REQUEST_FROM}
       where ${where.join(" and ")}
       order by q.created_at desc, q.id desc
       limit ${limit}::int`,
      values,
    );
    const page = rows.slice(0, f.limit);
    const last = page[page.length - 1];
    return {
      items: page.map((r) => ({ ...toRequestDto(r), isNew: r.is_new })),
      unseen: await countUnseen(c, scope, member.id, member.seen_at),
      nextCursor:
        rows.length > f.limit && last !== undefined
          ? encodeCursor({ at: last.created_at, id: last.id })
          : null,
    };
  });
}

/** Moves `requests_seen_at` forward only, never past now; no audit row. A caller without a member row is a no-op. */
export function markRequestsSeen(
  db: Db,
  scope: OrgScope,
  sub: string,
  seenUpTo: string | null,
): Promise<RequestsSeenResult> {
  return withTx(db, async (c) => {
    const { rows } = await orgQuery<{ id: string; seen_at: string }>(
      c,
      scope,
      `update members
       set requests_seen_at = greatest(
         coalesce(requests_seen_at, '-infinity'::timestamptz),
         least(coalesce($3::timestamptz, now()), now()))
       where org_id = $1 and sub = $2::uuid
       returning id, to_char(requests_seen_at at time zone 'UTC', ${ISO}) as seen_at`,
      [sub, seenUpTo],
    );
    const row = rows[0];
    if (!row) return { unseen: 0, requestsSeenAt: null };
    return {
      unseen: await countUnseen(c, scope, row.id, row.seen_at),
      requestsSeenAt: row.seen_at,
    };
  });
}
