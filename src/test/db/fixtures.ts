import { randomUUID } from "node:crypto";
import type pg from "pg";
import { inject } from "vitest";
import { createPool } from "@/server/db/pool";
import type { OrgScope } from "@/server/http/org-scope";

export const testPool = (): pg.Pool => createPool(inject("simapTestDbUrl"));

/** Refuses to run a test statement anywhere but the throwaway database. */
export async function assertTestDb(pool: pg.Pool): Promise<void> {
  const { rows } = await pool.query("select current_database() as db");
  if (!String(rows[0].db).startsWith("simap_test_")) throw new Error("not a simap_test_ database");
}

export const newOrg = () => {
  const orgId = randomUUID();
  // Test-only brand bypass; `as never` because the org-scope guard test bans an OrgScope cast outside with-auth.ts.
  const scope: OrgScope = { orgId } as never;
  return { orgId, scope };
};

type Q = Pick<pg.Pool, "query">;

export async function addMember(db: Q, orgId: string): Promise<string> {
  const sub = randomUUID();
  const { rows } = await db.query(
    "insert into members (org_id, sub, email, display_name) values ($1, $2, $3, 'Test Member') returning id",
    [orgId, sub, `${sub}@simap.example`],
  );
  return rows[0].id;
}

export async function addRoom(
  db: Q,
  orgId: string,
  code: string,
  opts: { seatCounter?: number } = {},
): Promise<string> {
  const { rows } = await db.query(
    "insert into rooms (org_id, code, name, seat_counter) values ($1, $2, $3, $4) returning id",
    [orgId, code, `Room ${code}`, opts.seatCounter ?? 0],
  );
  return rows[0].id;
}

export async function addSeat(
  db: Q,
  orgId: string,
  roomId: string,
  roomCode: string,
  seq: number,
  opts: { occupantId?: string | null; code?: string } = {},
): Promise<string> {
  const { rows } = await db.query(
    "insert into seats (org_id, room_id, seq, code, occupant_id) values ($1, $2, $3, $4, $5) returning id",
    [
      orgId,
      roomId,
      seq,
      opts.code ?? `${roomCode}-${String(seq).padStart(2, "0")}`,
      opts.occupantId ?? null,
    ],
  );
  return rows[0].id;
}

export async function addDevice(
  db: Q,
  orgId: string,
  ownerId: string | null,
  seatId: string | null,
  role: "primary" | "secondary",
): Promise<string> {
  const { rows } = await db.query(
    `insert into devices (org_id, name, type, inventory_number, owner_id, seat_id, role)
     values ($1, 'Laptop', 'laptop', $2, $3, $4, $5) returning id`,
    [orgId, randomUUID(), ownerId, seatId, role],
  );
  return rows[0].id;
}

export async function addHandoff(
  db: Q,
  orgId: string,
  deviceId: string,
  fromId: string,
  status: "pending" | "confirmed" | "declined" | "cancelled",
): Promise<string> {
  const { rows } = await db.query(
    `insert into device_handoffs (org_id, device_id, kind, from_member_id, requested_by_id, status, decided_at,
       decided_by_id)
     values ($1, $2, 'return', $3, $3, $4, case when $4 = 'pending' then null else now() end,
       case when $4 = 'pending' then null else $3::uuid end) returning id`,
    [orgId, deviceId, fromId, status],
  );
  return rows[0].id;
}

/** A pending transfer from `fromId` (the owner) to `toId`, requested by the sender. */
export async function addTransfer(
  db: Q,
  orgId: string,
  deviceId: string,
  fromId: string,
  toId: string,
): Promise<string> {
  const { rows } = await db.query(
    `insert into device_handoffs (org_id, device_id, kind, from_member_id, to_member_id, requested_by_id)
     values ($1, $2, 'transfer', $3, $4, $3) returning id`,
    [orgId, deviceId, fromId, toId],
  );
  return rows[0].id;
}

export async function addPendingRequest(
  db: Q,
  orgId: string,
  seatId: string,
  subjectId: string,
): Promise<string> {
  const { rows } = await db.query(
    "insert into seat_requests (org_id, seat_id, subject_id, created_by_id) values ($1, $2, $3, $3) returning id",
    [orgId, seatId, subjectId],
  );
  return rows[0].id;
}

/** Polls until another backend in this database waits on a lock; false after `ms`. No sleeps beyond the poll step. */
export async function waitForLockWait(pool: pg.Pool, ms: number): Promise<boolean> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const { rows } = await pool.query(
      `select count(*)::int as n from pg_stat_activity
       where datname = current_database() and wait_event_type = 'Lock' and pid <> pg_backend_pid()`,
    );
    if (rows[0].n > 0) return true;
    await new Promise((r) => setTimeout(r, 25));
  }
  return false;
}
