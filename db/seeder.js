// @ts-check
// Dev seed: fake data only (fixed UUIDs, @simap.example emails, invented names). Never run against a shared or
// production database: assertDevSeedTarget refuses any non-local host (including host/hostaddr overrides, parsed
// with the same parser pg uses) and NODE_ENV=production. schema-check.mjs uses the same guard.
import { parse } from "pg-connection-string";
import { classifyTarget } from "./target.js";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/**
 * Throws when the target is not a local dev database or is the production tunnel (db/target.js).
 * Messages never contain the URL.
 * @param {{ databaseUrl: string | undefined, nodeEnv: string | undefined, env?: Record<string, string | undefined> }} input
 */
export function assertDevSeedTarget({ databaseUrl, nodeEnv, env = process.env }) {
  if (nodeEnv === "production") throw new Error("refusing to seed: NODE_ENV is production");
  if (!databaseUrl) throw new Error("refusing to seed: DATABASE_URL is missing or invalid");
  let u;
  try {
    u = new URL(databaseUrl);
  } catch {
    throw new Error("refusing to seed: DATABASE_URL is missing or invalid");
  }
  const notLocal = new Error("refusing to seed: database host is not local");
  if (u.searchParams.has("host") || u.searchParams.has("hostaddr")) throw notLocal;
  let cfg;
  try {
    cfg = parse(databaseUrl);
  } catch {
    throw new Error("refusing to seed: DATABASE_URL is missing or invalid");
  }
  if (cfg.hostaddr || !cfg.host || !LOCAL_HOSTS.has(cfg.host)) throw notLocal;
  if (classifyTarget({ databaseUrl, env }).production) {
    throw new Error("refusing: database target is production");
  }
}

/** Two fake orgs with fixed ids. */
export const SEED_ORGS = [
  { org: "00000000-0000-4000-8000-0000000000a1", key: "00a1" },
  { org: "00000000-0000-4000-8000-0000000000b2", key: "00b2" },
];

/**
 * Fixed fake UUID: kind is one hex digit naming the entity kind, n a counter.
 * @param {string} key
 * @param {string} kind
 * @param {number} n
 */
function uid(key, kind, n) {
  return `00000000-0000-4000-8${kind}00-${key}${String(n).padStart(8, "0")}`;
}

/** @param {{ org: string, key: string }} o */
export function seedRows(o) {
  const k = o.key;
  const names = ["Nguyễn Văn An", "Trần Thị Bình", "Lê Hoàng Cường", "Phạm Minh Dũng"];
  const members = names.map((name, i) => ({
    id: uid(k, "1", i + 1),
    sub: uid(k, "2", i + 1),
    email: `user${i + 1}.${k}@simap.example`,
    name: name.normalize("NFC"),
    status: i === 3 ? "deactivated" : "active",
  }));
  return { members, uid: (/** @type {string} */ kind, /** @type {number} */ n) => uid(k, kind, n) };
}

/**
 * Inserts the seed inside the caller's transaction. Idempotent (on conflict do nothing).
 * @param {{ query: (sql: string, params?: unknown[]) => Promise<unknown> }} client
 */
export async function seedDev(client) {
  for (const o of SEED_ORGS) {
    const { members, uid: u } = seedRows(o);
    const org = o.org;
    for (const n of [1, 2]) {
      await client.query(
        `insert into groups (id, org_id, name) values ($1, $2, $3) on conflict do nothing`,
        [u("3", n), org, `Nhóm ${n}`],
      );
    }
    await client.query(
      `insert into projects (id, org_id, code, name) values ($1, $2, 'PRJ-1', 'Dự án mẫu') on conflict do nothing`,
      [u("4", 1), org],
    );
    for (const [i, m] of members.entries()) {
      await client.query(
        `insert into members (id, org_id, sub, email, display_name, employee_code, group_id, status)
         values ($1, $2, $3, $4, $5, $6, $7, $8) on conflict do nothing`,
        [m.id, org, m.sub, m.email, m.name, `E${i + 1}`, i < 2 ? u("3", i + 1) : null, m.status],
      );
    }
    const rooms = [
      { n: 1, code: "C302", seats: 4 },
      { n: 2, code: "D101", seats: 2 },
    ];
    for (const r of rooms) {
      await client.query(
        `insert into rooms (id, org_id, code, name, floor, seat_counter)
         values ($1, $2, $3, $4, '3', $5) on conflict do nothing`,
        [u("5", r.n), org, r.code, `Phòng ${r.code}`, r.seats],
      );
      for (let s = 1; s <= r.seats; s++) {
        const seatId = u("6", r.n * 10 + s);
        const occupant = r.n === 1 && s === 1 ? members[0].id : null;
        const blocked = r.n === 1 && s === 4;
        await client.query(
          `insert into seats (id, org_id, room_id, seq, code, occupant_id, x, y, cannot_seat, cannot_seat_reason)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) on conflict do nothing`,
          [
            seatId,
            org,
            u("5", r.n),
            s,
            `${r.code}-${String(s).padStart(2, "0")}`,
            occupant,
            s * 80,
            40,
            blocked,
            blocked ? "Cột chắn tầm nhìn" : null,
          ],
        );
      }
      for (const [j, kind] of ["door", "window", "pillar"].entries()) {
        await client.query(
          `insert into layout_fixtures (id, org_id, room_id, kind, x, y)
           values ($1, $2, $3, $4, $5, 0) on conflict do nothing`,
          [u("7", r.n * 10 + j), org, u("5", r.n), kind, j * 100],
        );
      }
    }
    const devices = [
      ["8", 1, "Laptop A", "INV-1", members[0].id, u("6", 11), "primary"],
      ["8", 2, "Monitor B", "INV-2", members[1].id, u("6", 11), "secondary"],
      ["8", 3, "Máy in C", "INV-3", members[1].id, null, "secondary"],
    ];
    for (const [kind, n, name, inv, owner, seat, role] of devices) {
      await client.query(
        `insert into devices (id, org_id, name, type, inventory_number, owner_id, seat_id, role)
         values ($1, $2, $3, 'laptop', $4, $5, $6, $7) on conflict do nothing`,
        [u(String(kind), Number(n)), org, name, `${inv}-${o.key}`, owner, seat, role],
      );
    }
    await client.query(
      `insert into seat_requests (id, org_id, seat_id, subject_id, created_by_id)
       values ($1, $2, $3, $4, $4) on conflict do nothing`,
      [u("9", 1), org, u("6", 12), members[2].id],
    );
    await client.query(
      `insert into invitations (id, org_id, email, role, invited_by_sub)
       values ($1, $2, $3, 'simap:user', $4) on conflict do nothing`,
      [u("a", 1), org, `invitee.${o.key}@simap.example`, members[0].sub],
    );
    for (const n of [1, 2]) {
      await client.query(
        `insert into audit_log (id, org_id, actor_sub, action, entity, entity_id)
         values ($1, $2, $3, 'seed', 'room', $4) on conflict do nothing`,
        [u("b", n), org, members[0].sub, u("5", 1)],
      );
    }
  }
}
