// Scripted check of the real db/migrations against a real Postgres (CI and local `pnpm schema:check`).
// Refuses a non-local DATABASE_URL (exit 2, before connecting). Creates a throwaway database from DATABASE_URL, applies the migrations, runs catalogue and constraint cases, seeds
// twice, drops the database. Prints step names and pass/FAIL only: never the URL, row values or Postgres detail.
import { randomBytes, randomUUID } from "node:crypto";
import { copyFile, mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { runMigrations } from "../db/migrator.js";
import { SEED_ORGS, assertDevSeedTarget, seedDev, seedRows } from "../db/seeder.js";

const base = process.env.DATABASE_URL;
if (!base) {
  console.error("DATABASE_URL is not set");
  process.exit(2);
}
try {
  assertDevSeedTarget({ databaseUrl: base, nodeEnv: process.env.NODE_ENV });
} catch (err) {
  console.error(`schema check refused: ${err instanceof Error ? err.message : "bad target"}`);
  process.exit(2);
}

const dbName = `simap_schema_${randomBytes(6).toString("hex")}`;
const url = (() => {
  const u = new URL(base);
  u.pathname = `/${dbName}`;
  return u.toString();
})();
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../db/migrations");

let failed = false;
/** @type {string | null} */
let stageDir = null;
function check(/** @type {string} */ step, /** @type {boolean} */ ok) {
  console.log(`${ok ? "pass" : "FAIL"}: ${step}`);
  if (!ok) failed = true;
}

const admin = new pg.Client({ connectionString: base });
await admin.connect();
await admin.query(`create database ${dbName}`);

try {
  // 1 migrations
  const run = async (d = dir) => {
    /** @type {string[]} */
    const lines = [];
    await runMigrations({ connectionString: url, dir: d, log: (l) => lines.push(l) });
    return lines;
  };
  // Stage 1 runs the migrations before the device types one, so orgs can exist when it is applied (backfill case).
  const DEVICE_TYPES_VERSION = "20261124160000";
  stageDir = await mkdtemp(path.join(os.tmpdir(), "simap-schema-"));
  for (const f of (await readdir(dir)).filter(
    (n) => n.endsWith(".sql") && n < DEVICE_TYPES_VERSION,
  )) {
    await copyFile(path.join(dir, f), path.join(stageDir, f));
  }
  const first = await run(stageDir);
  check(
    "1 first run applies init",
    first.some((l) => l.includes("init")),
  );

  const c = new pg.Client({ connectionString: url });
  await c.connect();
  const rows = async (/** @type {string} */ sql, /** @type {unknown[]} */ params = []) =>
    (await c.query(sql, params)).rows;

  // orgs that exist before the device types migration: one with only a member, one with only a room
  const oldMemberOrg = randomUUID();
  const oldRoomOrg = randomUUID();
  await c.query(
    `insert into members (org_id, sub, email, display_name) values ($1, $2, 'old@simap.example', 'Old')`,
    [oldMemberOrg, randomUUID()],
  );
  await c.query(`insert into rooms (org_id, code, name) values ($1, 'OLD-1', 'Old room')`, [
    oldRoomOrg,
  ]);

  const later = await run();
  check(
    "1 later run applies device_types",
    later.some((l) => l.includes("device_types")),
  );
  const second = await run();
  check("1 second run is up to date", second.length === 1 && second[0] === "up to date");

  // 2 catalogue (R6)
  const noOrg = await rows(`
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relname <> 'schema_migrations'
      and not exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'org_id'
                      and a.attnotnull and not a.attisdropped)`);
  check("2 every table has org_id not null", noOrg.length === 0);
  const badFk = await rows(`
    select con.conname from pg_constraint con
    join pg_class c on c.oid = con.conrelid join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and con.contype = 'f'
      and not ((select attname from pg_attribute where attrelid = con.conrelid and attnum = con.conkey[1]) = 'org_id'
           and (select attname from pg_attribute where attrelid = con.confrelid and attnum = con.confkey[1]) = 'org_id')`);
  check("2 every FK includes org_id on both sides", badFk.length === 0);
  const badUnique = await rows(`
    select ic.relname from pg_index i
    join pg_class ic on ic.oid = i.indexrelid join pg_class t on t.oid = i.indrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and i.indisunique and not i.indisprimary and t.relname <> 'schema_migrations'
      and coalesce((select attname from pg_attribute a where a.attrelid = t.oid and a.attnum = i.indkey[0]), '') <> 'org_id'`);
  check("2 every unique key/index except the id PK includes org_id", badUnique.length === 0);

  // Seed (5) twice and count.
  const counts = async () =>
    (
      await Promise.all(
        [
          "groups",
          "projects",
          "members",
          "rooms",
          "seats",
          "devices",
          "seat_requests",
          "layout_fixtures",
          "invitations",
          "audit_log",
          "device_types",
          "device_type_catalogs",
        ].map(async (t) => (await rows(`select count(*)::int as n from ${t}`))[0].n),
      )
    ).join(",");
  const seed = async () => {
    await c.query("begin");
    try {
      await seedDev(c);
      await c.query("commit");
    } catch (err) {
      await c.query("rollback").catch(() => {});
      throw err;
    }
  };
  await seed();
  const afterFirst = await counts();
  await seed();
  check(
    "5 seed is idempotent",
    afterFirst === (await counts()) && afterFirst.split(",").every((n) => Number(n) > 0),
  );

  /**
   * Runs fn in a transaction and returns null on success or { code, constraint } of the first error
   * (deferred triggers raise at COMMIT). With commit=false the transaction is rolled back after fn succeeds.
   */
  const tx = async (/** @type {() => Promise<void>} */ fn, commit = true) => {
    await c.query("begin");
    try {
      await fn();
      await c.query(commit ? "commit" : "rollback");
      return null;
    } catch (err) {
      await c.query("rollback").catch(() => {});
      const e = /** @type {{ code?: string, constraint?: string }} */ (err);
      return { code: e.code, constraint: e.constraint };
    }
  };
  const refused = (
    /** @type {{ code?: string, constraint?: string } | null} */ r,
    /** @type {string} */ code,
    /** @type {string | undefined} */ constraint,
  ) => r !== null && r.code === code && (constraint === undefined || r.constraint === constraint);

  const [A, B] = SEED_ORGS;
  const a = seedRows(A);
  const roomA = a.uid("5", 1);
  const seatA = a.uid("6", 11); // occupied by member 1, holds the primary device
  const freeSeatA = a.uid("6", 12);
  const [m1, m2, m3] = a.members;
  const q =
    (/** @type {string} */ sql, /** @type {unknown[]} */ p = []) =>
    async () => {
      await c.query(sql, p);
    };
  const newDevice = (
    /** @type {string} */ inv,
    /** @type {string} */ owner,
    /** @type {string | null} */ seat,
    /** @type {string} */ role,
    /** @type {string | null} */ mac = null,
  ) =>
    q(
      `insert into devices (org_id, name, type, inventory_number, owner_id, seat_id, role, mac)
       values ($1, 'd', 't', $2, $3, $4, $5, $6)`,
      [A.org, inv, owner, seat, role, mac],
    );

  // 2 behavioural: no cross-org references
  check(
    "2 cross-org seat→room FK refused (23503)",
    refused(
      await tx(
        q(`insert into seats (org_id, room_id, seq, code) values ($1, $2, 9, 'X-09')`, [
          B.org,
          roomA,
        ]),
      ),
      "23503",
      undefined,
    ),
  );
  check(
    "2 cross-org device→owner FK refused (23503)",
    refused(
      await tx(
        q(
          `insert into devices (org_id, name, type, inventory_number, owner_id) values ($1, 'd', 't', 'X-1', $2)`,
          [B.org, m1.id],
        ),
      ),
      "23503",
      undefined,
    ),
  );

  // 3 one primary per seat
  check(
    "3 second primary device on a seat refused (23505 devices_one_primary_per_seat)",
    refused(
      await tx(newDevice("T-DUP", m1.id, seatA, "primary")),
      "23505",
      "devices_one_primary_per_seat",
    ),
  );

  // 4 codes unique per org
  const sameCode = async (/** @type {string} */ table, /** @type {string} */ code) =>
    (await rows(`select count(*)::int as n from ${table} where code = $1`, [code]))[0].n === 2;
  check("4 same room code in two orgs accepted", await sameCode("rooms", "C302"));
  check(
    "4 duplicate room code in one org refused (23505)",
    refused(
      await tx(q(`insert into rooms (org_id, code, name) values ($1, 'C302', 'n')`, [A.org])),
      "23505",
      "rooms_org_code_key",
    ),
  );
  check("4 same seat code in two orgs accepted", await sameCode("seats", "C302-01"));
  check(
    "4 duplicate seat code in one org refused (23505)",
    refused(
      await tx(
        q(`insert into seats (org_id, room_id, seq, code) values ($1, $2, 9, 'C302-01')`, [
          A.org,
          roomA,
        ]),
      ),
      "23505",
      "seats_org_code_key",
    ),
  );

  // 6 invariant 3 and 8
  check(
    "6 primary device owned by a non-occupant refused at commit (23514)",
    refused(
      await tx(newDevice("T-P1", m2.id, freeSeatA, "primary")),
      "23514",
      "devices_primary_owner_is_occupant",
    ),
  );
  check(
    "6 occupant change without demote refused at commit (23514)",
    refused(
      await tx(q(`update seats set occupant_id = $1 where id = $2`, [m2.id, seatA])),
      "23514",
      "devices_primary_owner_is_occupant",
    ),
  );
  const changeWithDemote = async () => {
    await c.query(`update seats set occupant_id = $1 where id = $2`, [m2.id, seatA]);
    await c.query(`update devices set role = 'secondary' where seat_id = $1 and role = 'primary'`, [
      seatA,
    ]);
  };
  check(
    "6 occupant change with demote in the same transaction accepted",
    (await tx(changeWithDemote)) === null,
  );
  check(
    "6 primary device without a seat refused (23514)",
    refused(
      await tx(newDevice("T-P2", m1.id, null, "primary")),
      "23514",
      "devices_primary_needs_seat_check",
    ),
  );

  // 7 seat shape
  check(
    "7 seats has no status column",
    (
      await rows(
        `select 1 from information_schema.columns where table_name = 'seats' and column_name = 'status'`,
      )
    ).length === 0,
  );
  check(
    "7 reason without cannot_seat refused (23514)",
    refused(
      await tx(
        q(
          `insert into seats (org_id, room_id, seq, code, cannot_seat_reason) values ($1, $2, 9, 'C302-09', 'r')`,
          [A.org, roomA],
        ),
      ),
      "23514",
      "seats_cannot_seat_reason_check",
    ),
  );
  check(
    "7 seq <= 0 refused (23514)",
    refused(
      await tx(
        q(`insert into seats (org_id, room_id, seq, code) values ($1, $2, 0, 'C302-00')`, [
          A.org,
          roomA,
        ]),
      ),
      "23514",
      "seats_seq_check",
    ),
  );

  // 8 tile layout (SIM-015.1)
  const insSeat = (/** @type {string} */ cols, /** @type {string} */ vals, seq = 90) =>
    q(
      `insert into seats (org_id, room_id, seq, code${cols}) values ($1, $2, ${seq}, 'C302-90'${vals})`,
      [A.org, roomA],
    );
  const insFixture = (
    /** @type {string} */ kind,
    /** @type {string} */ cols,
    /** @type {string} */ vals,
  ) =>
    q(
      `insert into layout_fixtures (org_id, room_id, kind${cols}) values ($1, $2, ${kind}${vals})`,
      [A.org, roomA],
    );
  const seatTile = ", tile_x, tile_y, tile_rotation, sprite_key";
  check(
    "8 old-shape room, seat and fixture inserts still work",
    (await tx(async () => {
      await c.query(`insert into rooms (org_id, code, name) values ($1, 'C8-OLD', 'old')`, [A.org]);
      await insSeat("", "")();
      await insFixture("'door'", ", x, y, rotation, w, h", ", 1, 2, 90, 3, 4")();
    }, false)) === null,
  );
  check(
    "8 partial seat placement refused (23514)",
    refused(await tx(insSeat(", tile_x, tile_y", ", 1, 1")), "23514", "seats_tile_placement_check"),
  );
  check(
    "8 partial fixture placement refused (23514)",
    refused(
      await tx(insFixture("'door'", ", tile_x, sprite_key", ", 1, 'door'")),
      "23514",
      "layout_fixtures_tile_placement_check",
    ),
  );
  check(
    "8 full seat placement accepted",
    (await tx(insSeat(seatTile, ", 1, 2, 90, 'desk.single'"), false)) === null,
  );
  check(
    "8 seat bad rotation refused (23514)",
    refused(
      await tx(insSeat(seatTile, ", 1, 2, 45, 'desk.single'")),
      "23514",
      "seats_tile_rotation_check",
    ),
  );
  check(
    "8 seat negative tile refused (23514)",
    refused(
      await tx(insSeat(seatTile, ", -1, 2, 0, 'desk.single'")),
      "23514",
      "seats_tile_xy_check",
    ),
  );
  check(
    "8 seat blank sprite key refused (23514)",
    refused(await tx(insSeat(seatTile, ", 1, 2, 0, '  '")), "23514", "seats_sprite_key_check"),
  );
  check(
    "8 fixture bad rotation refused (23514)",
    refused(
      await tx(insFixture("null", seatTile, ", 1, 2, 360, 'door'")),
      "23514",
      "layout_fixtures_tile_rotation_check",
    ),
  );
  check(
    "8 fixture negative tile refused (23514)",
    refused(
      await tx(insFixture("null", seatTile, ", 1, -2, 0, 'door'")),
      "23514",
      "layout_fixtures_tile_xy_check",
    ),
  );
  check(
    "8 fixture blank sprite key refused (23514)",
    refused(
      await tx(insFixture("null", seatTile, ", 1, 2, 0, '  '")),
      "23514",
      "layout_fixtures_sprite_key_check",
    ),
  );
  check(
    "8 partial grid refused (23514)",
    refused(
      await tx(
        q(`insert into rooms (org_id, code, name, grid_w) values ($1, 'C8-G1', 'g', 5)`, [A.org]),
      ),
      "23514",
      "rooms_grid_pair_check",
    ),
  );
  check(
    "8 non-positive grid refused (23514)",
    refused(
      await tx(
        q(
          `insert into rooms (org_id, code, name, grid_w, grid_h) values ($1, 'C8-G2', 'g', 0, 5)`,
          [A.org],
        ),
      ),
      "23514",
      "rooms_grid_size_check",
    ),
  );
  check(
    "8 non-array floor_zones refused (23514)",
    refused(
      await tx(
        q(
          `insert into rooms (org_id, code, name, floor_zones) values ($1, 'C8-F', 'f', '{}'::jsonb)`,
          [A.org],
        ),
      ),
      "23514",
      "rooms_floor_zones_check",
    ),
  );
  check(
    "8 negative layout_version refused (23514)",
    refused(
      await tx(
        q(`insert into rooms (org_id, code, name, layout_version) values ($1, 'C8-V', 'v', -1)`, [
          A.org,
        ]),
      ),
      "23514",
      "rooms_layout_version_check",
    ),
  );
  check(
    "8 fixture with neither kind nor sprite refused (23514)",
    refused(await tx(insFixture("null", "", "")), "23514", "layout_fixtures_kind_or_sprite_check"),
  );
  check(
    "8 placed fixture with null kind accepted",
    (await tx(insFixture("null", seatTile, ", 1, 2, 0, 'door'"), false)) === null,
  );
  check(
    "8 unknown legacy kind still refused (23514)",
    refused(await tx(insFixture("'sofa'", "", "")), "23514", "layout_fixtures_kind_check"),
  );

  // 9 device types (SIM-036.2)
  const typeNames = async (/** @type {string} */ org) =>
    (await rows("select name from device_types where org_id = $1 order by name", [org]))
      .map((r) => r.name)
      .join(",");
  const FIVE = "IP phone,Laptop,Monitor,Other,PC";
  const marker = async (/** @type {string} */ org) =>
    (await rows("select 1 from device_type_catalogs where org_id = $1", [org])).length;
  check(
    "9 orgs existing before the migration get 5 types",
    (await typeNames(oldMemberOrg)) === FIVE &&
      (await typeNames(oldRoomOrg)) === FIVE &&
      (await marker(oldMemberOrg)) === 1 &&
      (await marker(oldRoomOrg)) === 1,
  );
  const newOrg = randomUUID();
  const addMemberTo = (/** @type {string} */ org) =>
    q(
      `insert into members (org_id, sub, email, display_name) values ($1, $2, 'n@simap.example', 'N')`,
      [org, randomUUID()],
    );
  await addMemberTo(newOrg)();
  check(
    "9 org created after the migration gets 5 types on first member",
    (await typeNames(newOrg)) === FIVE,
  );
  await addMemberTo(newOrg)();
  check("9 second member adds none", (await typeNames(newOrg)) === FIVE);
  await c.query(`delete from device_types where org_id = $1 and name = 'Monitor'`, [newOrg]);
  await addMemberTo(newOrg)();
  check(
    "9 deleted seed type stays deleted",
    (await typeNames(newOrg)) === "IP phone,Laptop,Other,PC",
  );
  const insType = (
    /** @type {string} */ name,
    /** @type {string} */ slot = "other",
    org = newOrg,
  ) => q(`insert into device_types (org_id, name, slot) values ($1, $2, $3)`, [org, name, slot]);
  check(
    "9 duplicate name case/space-insensitive refused (23505 device_types_org_name_key)",
    refused(await tx(insType("  ip   PHONE ")), "23505", "device_types_org_name_key"),
  );
  check(
    "9 same name in two orgs accepted",
    (await tx(async () => {
      await insType("Shared", "other", newOrg)();
      await insType("Shared", "other", oldMemberOrg)();
    }, false)) === null,
  );
  check(
    "9 bad slot refused (23514 device_types_slot_check)",
    refused(await tx(insType("Printer", "printer")), "23514", "device_types_slot_check"),
  );
  check(
    "9 blank and 61-char name refused (device_types_name_check)",
    refused(await tx(insType("   ")), "23514", "device_types_name_check") &&
      refused(await tx(insType("x".repeat(61))), "23514", "device_types_name_check"),
  );
  check(
    "9 bad Drive id refused (23514 device_types_image_check)",
    refused(
      await tx(
        q(
          `insert into device_types (org_id, name, slot, image_drive_file_id) values ($1, 'Img', 'other', 'short')`,
          [newOrg],
        ),
      ),
      "23514",
      "device_types_image_check",
    ),
  );
  check(
    "9 negative image_version refused (23514 device_types_image_version_check)",
    refused(
      await tx(
        q(
          `insert into device_types (org_id, name, slot, image_version) values ($1, 'Ver', 'other', -1)`,
          [newOrg],
        ),
      ),
      "23514",
      "device_types_image_version_check",
    ),
  );

  // extras
  const reqIns = q(
    `insert into seat_requests (org_id, seat_id, subject_id, created_by_id) values ($1, $2, $3, $3)`,
    [A.org, freeSeatA, m3.id],
  );
  check(
    "x duplicate pending request refused (23505)",
    refused(await tx(reqIns), "23505", "seat_requests_one_pending_idx"),
  );
  check(
    "x new pending request allowed after the old one is rejected",
    (await tx(async () => {
      await c.query(
        `update seat_requests set status = 'rejected', decided_at = now() where seat_id = $1 and subject_id = $2`,
        [freeSeatA, m3.id],
      );
      await reqIns();
    }, false)) === null,
  );
  check(
    "x audit_log update refused (55000)",
    refused(await tx(q(`update audit_log set action = 'x'`)), "55000", undefined),
  );
  check(
    "x audit_log delete refused (55000)",
    refused(await tx(q(`delete from audit_log`)), "55000", undefined),
  );
  check(
    "x audit_log truncate refused (55000)",
    refused(await tx(q(`truncate audit_log`)), "55000", undefined),
  );
  check(
    "x upper-case MAC refused (23514)",
    refused(
      await tx(newDevice("T-MAC", m1.id, null, "secondary", "AA:BB:CC:DD:EE:FF")),
      "23514",
      "devices_mac_check",
    ),
  );
  await c.end();
} finally {
  if (stageDir) await rm(stageDir, { recursive: true, force: true }).catch(() => {});
  await admin.query(`drop database if exists ${dbName} with (force)`).catch(() => {});
  await admin.end().catch(() => {});
}

if (failed) process.exit(1);
console.log("schema check ok");
