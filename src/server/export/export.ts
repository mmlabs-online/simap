import "server-only";
import { EXPORT_MAX_ROWS, type ExportKind } from "@/lib/export/csv";
import { withTx } from "@/server/db/tx";
import { orgQuery, type OrgScope } from "@/server/http/org-scope";
import type { Db } from "@/server/rooms/rooms";

export type ExportCell = string | null;
export type ExportResult = { columns: string[]; rows: ExportCell[][]; truncated: boolean };

type Spec = { columns: string[]; sql: string; map: (r: any) => ExportCell[] };

const SPECS: Record<ExportKind, Spec> = {
  seats: {
    columns: [
      "Room code",
      "Room name",
      "Floor",
      "Seat code",
      "Status",
      "Occupant name",
      "Occupant employee code",
      "Occupant email",
      "Group",
      "Project",
      "Cannot-seat reason",
    ],
    sql: `select r.code as room_code, r.name as room_name, r.floor, s.code as seat_code,
        s.occupant_id, s.cannot_seat, m.display_name as occupant_name,
        m.employee_code as occupant_code, m.email as occupant_email,
        g.name as group_name, p.name as project_name, s.cannot_seat_reason
      from seats s
        join rooms r on r.org_id = s.org_id and r.id = s.room_id
        left join members m on m.org_id = s.org_id and m.id = s.occupant_id
        left join groups g on g.org_id = s.org_id and g.id = s.group_id
        left join projects p on p.org_id = s.org_id and p.id = s.project_id
      where s.org_id = $1
      order by lower(r.code), s.seq, s.id
      limit $2`,
    map: (r) => [
      r.room_code,
      r.room_name,
      r.floor,
      r.seat_code,
      r.occupant_id ? "occupied" : r.cannot_seat ? "cannot_seat" : "free",
      r.occupant_name,
      r.occupant_code,
      r.occupant_email,
      r.group_name,
      r.project_name,
      r.cannot_seat_reason,
    ],
  },
  devices: {
    columns: [
      "Name",
      "Type",
      "Inventory number",
      "MAC",
      "Role",
      "Owner name",
      "Owner employee code",
      "Location",
      "Room code",
      "Seat code",
    ],
    sql: `select d.name, d.type, d.inventory_number, d.mac, d.role,
        m.display_name as owner_name, m.employee_code as owner_code,
        d.seat_id, s.code as seat_code, r.code as room_code
      from devices d
        join members m on m.org_id = d.org_id and m.id = d.owner_id
        left join seats s on s.org_id = d.org_id and s.id = d.seat_id
        left join rooms r on r.org_id = s.org_id and r.id = s.room_id
      where d.org_id = $1
      order by lower(d.name), d.id
      limit $2`,
    map: (r) => [
      r.name,
      r.type,
      r.inventory_number,
      r.mac,
      r.role,
      r.owner_name,
      r.owner_code,
      r.seat_id ? "placed" : "inventory",
      r.room_code,
      r.seat_code,
    ],
  },
  members: {
    columns: ["Display name", "Employee code", "Email", "Group", "Status"],
    sql: `select m.display_name, m.employee_code, m.email, g.name as group_name, m.status
      from members m
        left join groups g on g.org_id = m.org_id and g.id = m.group_id
      where m.org_id = $1
      order by lower(m.display_name), m.id
      limit $2`,
    map: (r) => [r.display_name, r.employee_code, r.email, r.group_name, r.status],
  },
};

/** DSH-02 / D27: the org's rows of one kind from one snapshot, at most `cap` rows (`truncated` when more exist). */
export function exportRows(
  pool: Db,
  scope: OrgScope,
  kind: ExportKind,
  cap: number = EXPORT_MAX_ROWS,
): Promise<ExportResult> {
  const spec = SPECS[kind];
  return withTx(pool, async (c) => {
    await c.query("set transaction isolation level repeatable read, read only");
    const { rows } = await orgQuery<any>(c, scope, spec.sql, [cap + 1]);
    return {
      columns: spec.columns,
      rows: rows.slice(0, cap).map(spec.map),
      truncated: rows.length > cap,
    };
  });
}
