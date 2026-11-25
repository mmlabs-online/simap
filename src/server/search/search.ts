import "server-only";
import { escapeLike } from "@/lib/members/search";
import { encodeSearchCursor } from "@/lib/search/cursor";
import { foldSql, macCompact } from "@/lib/search/fold";
import type {
  DeviceHit,
  MemberHit,
  SearchGroup,
  SearchKind,
  SearchResponse,
  SeatHit,
} from "@/lib/search/types";
import type { SearchFilter } from "@/lib/validate/search-query";
import { withTx } from "@/server/db/tx";
import { orgQuery, type OrgScope } from "@/server/http/org-scope";
import type { Db } from "@/server/rooms/rooms";

type Query = { query(text: string, values: unknown[]): Promise<{ rows: any[] }> };

type SeatRow = {
  id: string;
  code: string;
  room_id: string;
  room_code: string;
  occupant_id: string | null;
  occupant_name: string | null;
  sort_key: string;
};
type DeviceRow = {
  id: string;
  name: string;
  inventory_number: string;
  mac: string | null;
  owner_id: string | null;
  owner_name: string | null;
  role: "primary" | "secondary";
  seat_id: string | null;
  seat_code: string | null;
  room_id: string | null;
  room_code: string | null;
  sort_key: string;
};
type MemberRow = {
  id: string;
  display_name: string;
  employee_code: string | null;
  status: "active" | "deactivated";
  sort_key: string;
};

const like = (col: string, p: string) => `${foldSql(col)} like ${p} escape '\\'`;

/** One kind's query: `select` (ends with `where <t>.org_id = $1`) + `match`, keyset on (sortExpr, idExpr), limit + 1. */
async function page<R extends { id: string; sort_key: string }, T>(
  c: Query,
  scope: OrgScope,
  f: SearchFilter,
  kind: SearchKind,
  spec: {
    select: string;
    sortExpr: string;
    idExpr: string;
    match: (bind: (v: unknown) => string, p: string) => string;
    map: (r: R) => T;
  },
): Promise<SearchGroup<T>> {
  const values: unknown[] = [];
  const bind = (v: unknown): string => {
    values.push(v);
    return `$${values.length + 1}`;
  };
  const p = bind(`%${escapeLike(f.folded)}%`);
  let where = spec.match(bind, p);
  if (f.cursor && f.cursor.t === kind) {
    where += ` and (${spec.sortExpr}, ${spec.idExpr}) > (${bind(f.cursor.k)}::text, ${bind(f.cursor.id)}::uuid)`;
  }
  const limit = bind(f.limit + 1);
  const { rows } = await orgQuery<R>(
    c,
    scope,
    `${spec.select} and ${where} order by ${spec.sortExpr}, ${spec.idExpr} limit ${limit}`,
    values,
  );
  const items = rows.slice(0, f.limit);
  const last = items[items.length - 1];
  const nextCursor =
    rows.length > f.limit && last
      ? encodeSearchCursor({ t: kind, k: last.sort_key, id: last.id })
      : null;
  return { items: items.map(spec.map), nextCursor };
}

const seats = (c: Query, scope: OrgScope, f: SearchFilter) =>
  page<SeatRow, SeatHit>(c, scope, f, "seat", {
    select: `select s.id, s.code, s.room_id, r.code as room_code, s.occupant_id,
        m.display_name as occupant_name, lower(s.code) as sort_key
      from seats s
        join rooms r on r.org_id = s.org_id and r.id = s.room_id
        left join members m on m.org_id = s.org_id and m.id = s.occupant_id
      where s.org_id = $1`,
    sortExpr: "lower(s.code)",
    idExpr: "s.id",
    match: (_b, p) => `(${like("s.code", p)} or ${like("m.display_name", p)})`,
    map: (r) => ({
      id: r.id,
      code: r.code,
      roomId: r.room_id,
      roomCode: r.room_code,
      occupant: r.occupant_id ? { id: r.occupant_id, displayName: r.occupant_name! } : null,
    }),
  });

const devices = (c: Query, scope: OrgScope, f: SearchFilter) => {
  const mac = macCompact(f.q);
  return page<DeviceRow, DeviceHit>(c, scope, f, "device", {
    select: `select d.id, d.name, d.inventory_number, d.mac, d.owner_id, m.display_name as owner_name,
        d.role, d.seat_id, s.code as seat_code, s.room_id, r.code as room_code, lower(d.name) as sort_key
      from devices d
        left join members m on m.org_id = d.org_id and m.id = d.owner_id
        left join seats s on s.org_id = d.org_id and s.id = d.seat_id
        left join rooms r on r.org_id = s.org_id and r.id = s.room_id
      where d.org_id = $1`,
    sortExpr: "lower(d.name)",
    idExpr: "d.id",
    match: (bind, p) => {
      const alts = [
        like("d.name", p),
        like("d.inventory_number", p),
        like("d.mac", p),
        like("m.display_name", p),
      ];
      if (mac !== null) alts.push(`replace(d.mac, ':', '') like ${bind(`%${mac}%`)}`);
      return `(${alts.join(" or ")})`;
    },
    map: (r) => ({
      id: r.id,
      name: r.name,
      inventoryNumber: r.inventory_number,
      mac: r.mac,
      owner: r.owner_id === null ? null : { id: r.owner_id, displayName: r.owner_name! },
      placement: r.seat_id
        ? {
            seatId: r.seat_id,
            seatCode: r.seat_code!,
            roomId: r.room_id!,
            roomCode: r.room_code!,
            role: r.role,
          }
        : null,
    }),
  });
};

const members = (c: Query, scope: OrgScope, f: SearchFilter) =>
  page<MemberRow, MemberHit>(c, scope, f, "member", {
    select: `select m.id, m.display_name, m.employee_code, m.status, lower(m.display_name) as sort_key
      from members m
      where m.org_id = $1`,
    sortExpr: "lower(m.display_name)",
    idExpr: "m.id",
    match: (_b, p) => `(${like("m.display_name", p)} or ${like("m.employee_code", p)})`,
    map: (r) => ({
      id: r.id,
      displayName: r.display_name,
      employeeCode: r.employee_code,
      status: r.status,
    }),
  });

/** DSH-02: case- and diacritics-insensitive search, one keyset-paged group per requested kind, from one snapshot. */
export function search(pool: Db, scope: OrgScope, f: SearchFilter): Promise<SearchResponse> {
  return withTx(pool, async (c) => {
    await c.query("set transaction isolation level repeatable read, read only");
    const want = (k: SearchKind) => f.kind === "all" || f.kind === k;
    return {
      seats: want("seat") ? await seats(c, scope, f) : null,
      devices: want("device") ? await devices(c, scope, f) : null,
      members: want("member") ? await members(c, scope, f) : null,
    };
  });
}
