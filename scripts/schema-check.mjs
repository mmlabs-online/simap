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
  const oldMember = (
    await c.query(
      `insert into members (org_id, sub, email, display_name) values ($1, $2, 'old@simap.example', 'Old') returning id`,
      [oldMemberOrg, randomUUID()],
    )
  ).rows[0].id;
  // a device that exists before the lifecycle migration (OQ-45: it keeps its owner)
  const oldDevice = (
    await c.query(
      `insert into devices (org_id, name, type, inventory_number, owner_id) values ($1, 'Old device', 'laptop', 'OLD-1', $2) returning id`,
      [oldMemberOrg, oldMember],
    )
  ).rows[0].id;
  const oldRoom = (
    await c.query(
      `insert into rooms (org_id, code, name) values ($1, 'OLD-1', 'Old room') returning id`,
      [oldRoomOrg],
    )
  ).rows[0].id;
  // placements that exist before the map items migration (SIM-039.1): valid ones, undrawable ones, a legacy fixture
  const oldSeat = async (/** @type {number} */ seq, /** @type {string} */ key) =>
    (
      await c.query(
        `insert into seats (org_id, room_id, seq, code, tile_x, tile_y, tile_rotation, sprite_key)
         values ($1, $2, $3, $4, 0, 0, 90, $5) returning id`,
        [oldRoomOrg, oldRoom, seq, `OLD-1-0${seq}`, key],
      )
    ).rows[0].id;
  const oldSeatOk = await oldSeat(1, "desk.single");
  const oldSeatGone = await oldSeat(2, "gone.item");
  const oldFixture = async (/** @type {string} */ key) =>
    (
      await c.query(
        `insert into layout_fixtures (org_id, room_id, kind, tile_x, tile_y, tile_rotation, sprite_key)
         values ($1, $2, null, 3, 3, 0, $3) returning id`,
        [oldRoomOrg, oldRoom, key],
      )
    ).rows[0].id;
  const oldFixtureOk = await oldFixture("plant.large");
  const oldFixtureGone = await oldFixture("gone.item");
  const oldFixtureLegacy = (
    await c.query(
      `insert into layout_fixtures (org_id, room_id, kind, x, y, rotation, w, h)
       values ($1, $2, 'door', 1, 2, 90, 3, 4) returning id`,
      [oldRoomOrg, oldRoom],
    )
  ).rows[0].id;

  // Stage 2 (SIM-042): everything before the new built-in items migration, so an org seeded with 53 items exists
  // (one renamed so its name collides with a new default, one hidden, one deleted) when the backfill runs.
  const NEW_BUILTIN_VERSION = "20261126120000";
  const stage2Lines = [];
  for (const f of (await readdir(dir)).filter(
    (n) => n.endsWith(".sql") && n < NEW_BUILTIN_VERSION,
  )) {
    await copyFile(path.join(dir, f), path.join(stageDir, f));
  }
  stage2Lines.push(...(await run(stageDir)));
  const stage2Org = randomUUID();
  await c.query(
    `insert into members (org_id, sub, email, display_name) values ($1, $2, 'stage2@simap.example', 'Stage2')`,
    [stage2Org, randomUUID()],
  );
  const stage2Count = (
    await rows("select count(*)::int as n from map_items where org_id = $1", [stage2Org])
  )[0].n;
  await c.query(
    `update map_items set name = 'Clock Wall' where org_id = $1 and builtin_key = 'wall.top'`,
    [stage2Org],
  );
  await c.query(
    `update map_items set hidden = true where org_id = $1 and builtin_key = 'plant.small'`,
    [stage2Org],
  );
  await c.query(`delete from map_items where org_id = $1 and builtin_key = 'sofa'`, [stage2Org]);
  const stage2Snapshot = JSON.stringify(
    await rows("select * from map_items where org_id = $1 order by builtin_key", [stage2Org]),
  );

  const laterOnly = await run();
  const later = [...stage2Lines, ...laterOnly];
  check("1 stage 2 org was seeded with 53 map items", stage2Count === 53);
  check(
    "1 later run applies map_items_new_builtin",
    laterOnly.some((l) => l.includes("map_items_new_builtin")),
  );
  check(
    "1 later run applies members_photo",
    later.some((l) => l.includes("members_photo")),
  );
  check(
    "1 later run applies device_types",
    later.some((l) => l.includes("device_types")),
  );
  check(
    "1 later run applies device_type_sprite",
    later.some((l) => l.includes("device_type_sprite")),
  );
  check(
    "1 later run applies map_items",
    later.some((l) => l.includes("map_items")),
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
          "map_items",
          "map_item_catalogs",
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

  check(
    "9 bad sprite_key refused (23514 device_types_sprite_key_check)",
    refused(
      await tx(
        q(
          `insert into device_types (org_id, name, slot, sprite_key) values ($1, 'Spr', 'other', ' x')`,
          [newOrg],
        ),
      ),
      "23514",
      "device_types_sprite_key_check",
    ),
  );
  check(
    "9 sprite_key family or null accepted",
    (await tx(
      q(
        `insert into device_types (org_id, name, slot, sprite_key) values ($1, 'Spr1', 'other', 'device.laptop'), ($1, 'Spr2', 'other', null)`,
        [newOrg],
      ),
    )) === null,
  );

  // 10 device lifecycle (SIM-037.1)
  const od = (await rows("select * from devices where id = $1", [oldDevice]))[0];
  check(
    "10 existing device keeps its owner after the lifecycle migration",
    od.owner_id === oldMember &&
      od.serial === null &&
      od.manufacturer === null &&
      od.brand === null &&
      od.holding_note === null &&
      od.holding_expires_on === null,
  );
  check(
    "10 owner_id is nullable",
    (
      await rows(
        `select 1 from pg_attribute where attrelid = 'devices'::regclass and attname = 'owner_id' and not attnotnull`,
      )
    ).length === 1,
  );
  // an unowned device; `col` (optional) is one extra column set to `val`
  const unowned = (inv, col = "seat_id", val = null, role = "secondary") =>
    q(
      `insert into devices (org_id, name, type, inventory_number, owner_id, role, ${col})
       values ($1, 'u', 't', $2, null, $3, $4)`,
      [A.org, inv, role, val],
    );
  check("10 unowned device without a seat accepted", (await tx(unowned("U-1"), false)) === null);
  check(
    "10 unowned device at a seat refused (23514 devices_unowned_not_placed_check)",
    refused(
      await tx(unowned("U-2", "seat_id", freeSeatA)),
      "23514",
      "devices_unowned_not_placed_check",
    ),
  );
  check(
    "10 nulling the owner of a placed device refused (23514 devices_unowned_not_placed_check)",
    refused(
      await tx(
        q(`update devices set owner_id = null where org_id = $1 and id = $2`, [
          A.org,
          a.uid("8", 2),
        ]),
      ),
      "23514",
      "devices_unowned_not_placed_check",
    ),
  );
  check(
    "10 unowned device with a holding note refused (23514 devices_unowned_no_holding_check)",
    refused(
      await tx(unowned("U-3", "holding_note", "lent")),
      "23514",
      "devices_unowned_no_holding_check",
    ),
  );
  check(
    "10 unowned device with an expiry refused (23514 devices_unowned_no_holding_check)",
    refused(
      await tx(unowned("U-4", "holding_expires_on", "2027-01-01")),
      "23514",
      "devices_unowned_no_holding_check",
    ),
  );
  const ownedWith = (inv, col, v, org = A.org, owner = m1.id) =>
    q(
      `insert into devices (org_id, name, type, inventory_number, owner_id, ${col})
       values ($1, 'o', 't', $2, $3, $4)`,
      [org, inv, owner, v],
    );
  check(
    "10 serial unique per org (23505 devices_org_serial_key)",
    refused(
      await tx(async () => {
        await ownedWith("S-1", "serial", "SN-1")();
        await ownedWith("S-2", "serial", "SN-1")();
      }),
      "23505",
      "devices_org_serial_key",
    ),
  );
  const bOwner = seedRows(B).members[0].id;
  check(
    "10 same serial in another org accepted",
    (await tx(async () => {
      await ownedWith("S-3", "serial", "SN-2")();
      await ownedWith("S-3", "serial", "SN-2", B.org, bOwner)();
    }, false)) === null,
  );
  for (const col of ["serial", "manufacturer", "brand"]) {
    check(
      `10 blank, untrimmed and 101-char ${col} refused (23514 devices_${col}_check)`,
      refused(await tx(ownedWith("C-1", col, "")), "23514", `devices_${col}_check`) &&
        refused(await tx(ownedWith("C-2", col, " x")), "23514", `devices_${col}_check`) &&
        refused(await tx(ownedWith("C-3", col, "x".repeat(101))), "23514", `devices_${col}_check`),
    );
  }
  check(
    "10 blank holding note refused (23514 devices_holding_note_check)",
    refused(await tx(ownedWith("C-4", "holding_note", " ")), "23514", "devices_holding_note_check"),
  );

  const insHandoff = (device, kind, to, status = "pending", newExpires = null, from = m1.id) =>
    q(
      `insert into device_handoffs (org_id, device_id, kind, from_member_id, to_member_id, requested_by_id, status,
         new_expires_on, decided_at, decided_by_id)
       values ($1, $2, $3, $4, $5, $4, $6, $7, case when $6 = 'pending' then null else now() end,
         case when $6 = 'pending' then null else $4::uuid end)`,
      [A.org, device, kind, from, to, status, newExpires],
    );
  const hDev = a.uid("8", 3); // owned by m2, not placed
  check(
    "10 second pending handoff refused (23505 device_handoffs_one_pending_idx)",
    refused(
      await tx(async () => {
        await insHandoff(hDev, "return", null)();
        await insHandoff(hDev, "transfer", m3.id)();
      }),
      "23505",
      "device_handoffs_one_pending_idx",
    ),
  );
  check(
    "10 new pending handoff accepted after the old one is cancelled",
    (await tx(async () => {
      await insHandoff(hDev, "return", null, "cancelled")();
      await insHandoff(hDev, "return", null)();
    }, false)) === null,
  );
  check(
    "10 cross-org handoff member refused (23503)",
    refused(
      await tx(insHandoff(hDev, "return", null, "pending", null, oldMember)),
      "23503",
      undefined,
    ),
  );
  check(
    "10 bad kind refused (23514 device_handoffs_kind_check)",
    refused(await tx(insHandoff(hDev, "swap", null)), "23514", "device_handoffs_kind_check"),
  );
  check(
    "10 bad status refused (23514 device_handoffs_status_check)",
    refused(
      await tx(insHandoff(hDev, "return", null, "rejected")),
      "23514",
      "device_handoffs_status_check",
    ),
  );
  check(
    "10 transfer without a recipient refused (23514 device_handoffs_shape_check)",
    refused(await tx(insHandoff(hDev, "transfer", null)), "23514", "device_handoffs_shape_check"),
  );
  check(
    "10 extension without a new expiry refused (23514 device_handoffs_shape_check)",
    refused(await tx(insHandoff(hDev, "extension", null)), "23514", "device_handoffs_shape_check"),
  );
  check(
    "10 decided status without decided_at refused (23514 device_handoffs_decided_check)",
    refused(
      await tx(
        q(
          `insert into device_handoffs (org_id, device_id, kind, from_member_id, requested_by_id, status, decided_by_id)
           values ($1, $2, 'return', $3, $3, 'confirmed', $3)`,
          [A.org, hDev, m1.id],
        ),
      ),
      "23514",
      "device_handoffs_decided_check",
    ),
  );
  check(
    "10 pending handoff with decided_by_id refused (23514 device_handoffs_decided_by_check)",
    refused(
      await tx(
        q(
          `insert into device_handoffs (org_id, device_id, kind, from_member_id, requested_by_id, decided_by_id)
           values ($1, $2, 'return', $3, $3, $3)`,
          [A.org, hDev, m1.id],
        ),
      ),
      "23514",
      "device_handoffs_decided_by_check",
    ),
  );
  check(
    "10 decided handoff without decided_by_id refused (23514 device_handoffs_decided_by_check)",
    refused(
      await tx(
        q(
          `insert into device_handoffs (org_id, device_id, kind, from_member_id, requested_by_id, status, decided_at)
           values ($1, $2, 'return', $3, $3, 'declined', now())`,
          [A.org, hDev, m1.id],
        ),
      ),
      "23514",
      "device_handoffs_decided_by_check",
    ),
  );
  check(
    "10 device delete cascades its non-pending handoffs",
    (await tx(async () => {
      await insHandoff(hDev, "return", null, "declined")();
      await c.query(`delete from devices where org_id = $1 and id = $2`, [A.org, hDev]);
      const left = await rows(`select 1 from device_handoffs where device_id = $1`, [hDev]);
      if (left.length !== 0) throw new Error("handoff left");
    }, false)) === null,
  );

  // 11 map items (SIM-039.1)
  const itemCount = async (/** @type {string} */ org) =>
    (await rows("select count(*)::int as n from map_items where org_id = $1", [org]))[0].n;
  const catalogMarker = async (/** @type {string} */ org) =>
    (await rows("select 1 from map_item_catalogs where org_id = $1", [org])).length;
  check(
    "11 orgs seeded before SIM-042 get 59 map items",
    (await itemCount(oldMemberOrg)) === 59 &&
      (await itemCount(oldRoomOrg)) === 59 &&
      (await itemCount(stage2Org)) === 58 &&
      (await catalogMarker(oldMemberOrg)) === 1 &&
      (await catalogMarker(oldRoomOrg)) === 1,
  );
  const itemOrg = randomUUID();
  await addMemberTo(itemOrg)();
  check(
    "11 org created after the migration gets 59 map items on first member",
    (await itemCount(itemOrg)) === 59 && (await catalogMarker(itemOrg)) === 1,
  );
  await addMemberTo(itemOrg)();
  check("11 second member adds none", (await itemCount(itemOrg)) === 59);
  const sizes = (
    await rows(
      `select builtin_key, w, h from map_items where org_id = $1
       and builtin_key in ('door', 'table.meeting', 'desk.single', 'prop.mug', 'screen.projector', 'clock.wall')`,
      [itemOrg],
    )
  )
    .map((r) => `${r.builtin_key} ${r.w}x${r.h}`)
    .sort()
    .join(",");
  check(
    "11 spot sizes door 1x2, table.meeting 3x2, desk.single 2x1, prop.mug 1x1, screen.projector 2x1, clock.wall 1x1",
    sizes ===
      "clock.wall 1x1,desk.single 2x1,door 1x2,prop.mug 1x1,screen.projector 2x1,table.meeting 3x2",
  );
  await c.query(`delete from map_items where org_id = $1 and builtin_key = 'sofa'`, [itemOrg]);
  await addMemberTo(itemOrg)();
  check("11 deleted map item stays deleted", (await itemCount(itemOrg)) === 58);

  // SIM-042 backfill: collision fallback, existing rows untouched, a row deleted before it is not restored
  const stage2Names = await rows(
    `select builtin_key, name from map_items where org_id = $1
     and builtin_key in ('clock.wall', 'cooler.water', 'screen.projector')`,
    [stage2Org],
  );
  check(
    "11 SIM-042 backfill: a renamed 'Clock Wall' row makes the new row 'clock wall (built-in)'",
    stage2Names.length === 3 &&
      stage2Names.find((r) => r.builtin_key === "clock.wall")?.name === "clock wall (built-in)" &&
      stage2Names.find((r) => r.builtin_key === "cooler.water")?.name === "cooler water",
  );
  const newKeys =
    "'bin.trash','chart.flip','clock.wall','cooler.water','lamp.desk','screen.projector'";
  check(
    "11 SIM-042 backfill leaves existing rows unchanged",
    JSON.stringify(
      await rows(
        `select * from map_items where org_id = $1 and builtin_key not in (${newKeys}) order by builtin_key`,
        [stage2Org],
      ),
    ) === JSON.stringify(JSON.parse(stage2Snapshot)),
  );
  check(
    "11 SIM-042 backfill does not restore a row deleted before it",
    (await rows("select 1 from map_items where org_id = $1 and builtin_key = 'sofa'", [stage2Org]))
      .length === 0,
  );

  const placement = async (/** @type {string} */ table, /** @type {string} */ id) =>
    (await rows(`select * from ${table} where id = $1`, [id]))[0];
  const keptSeat = await placement("seats", oldSeatOk);
  const keptFixture = await placement("layout_fixtures", oldFixtureOk);
  const legacy = await placement("layout_fixtures", oldFixtureLegacy);
  check(
    "11 backfill keeps valid placed fixtures and seats",
    keptSeat?.sprite_key === "desk.single" &&
      keptSeat.tile_x === 0 &&
      keptSeat.tile_rotation === 90 &&
      keptFixture?.sprite_key === "plant.large" &&
      keptFixture.tile_x === 3 &&
      legacy?.kind === "door" &&
      legacy.sprite_key === null,
  );
  const goneSeat = await placement("seats", oldSeatGone);
  check(
    "11 backfill drops undrawable fixtures and unplaces undrawable seats",
    (await placement("layout_fixtures", oldFixtureGone)) === undefined &&
      goneSeat?.tile_x === null &&
      goneSeat.tile_y === null &&
      goneSeat.tile_rotation === null &&
      goneSeat.sprite_key === null,
  );
  check(
    "11 fixture with a key not in the org catalog refused (23503 layout_fixtures_map_item_fkey)",
    refused(
      await tx(insFixture("null", seatTile, ", 1, 2, 0, 'gone.item'")),
      "23503",
      "layout_fixtures_map_item_fkey",
    ),
  );
  check(
    "11 seat with a key not in the org catalog refused (23503 seats_map_item_fkey)",
    refused(await tx(insSeat(seatTile, ", 1, 2, 0, 'gone.item'")), "23503", "seats_map_item_fkey"),
  );
  check(
    "11 map item referenced by a placement cannot be deleted (23503)",
    refused(
      await tx(async () => {
        await insFixture("null", seatTile, ", 1, 2, 0, 'door'")();
        await c.query(`delete from map_items where org_id = $1 and builtin_key = 'door'`, [A.org]);
      }),
      "23503",
      "layout_fixtures_map_item_fkey",
    ) &&
      refused(
        await tx(async () => {
          await insSeat(seatTile, ", 1, 2, 0, 'desk.single'")();
          await c.query(`delete from map_items where org_id = $1 and builtin_key = 'desk.single'`, [
            A.org,
          ]);
        }),
        "23503",
        "seats_map_item_fkey",
      ),
  );
  check(
    "11 cross-org key refused",
    refused(
      await tx(async () => {
        const bare = randomUUID(); // an org with a room but no catalog
        const room = (
          await c.query(
            `insert into rooms (org_id, code, name) values ($1, 'X-1', 'x') returning id`,
            [bare],
          )
        ).rows[0].id;
        await c.query(
          `insert into layout_fixtures (org_id, room_id, kind, tile_x, tile_y, tile_rotation, sprite_key)
           values ($1, $2, null, 1, 1, 0, 'door')`,
          [bare, room],
        );
      }),
      "23503",
      "layout_fixtures_map_item_fkey",
    ),
  );
  const insItem = (
    /** @type {string} */ key,
    /** @type {string} */ name,
    /** @type {string} */ group,
    /** @type {number} */ w,
    /** @type {number} */ h,
    extra = "",
  ) =>
    q(
      `insert into map_items (org_id, builtin_key, name, group_name, w, h${extra ? ", " + extra.split("=")[0] : ""})
       values ($1, $2, $3, $4, $5, $6${extra ? ", " + extra.split("=")[1] : ""})`,
      [A.org, key, name, group, w, h],
    );
  check(
    "11 size 0 and 5 refused (23514 map_items_size_check)",
    refused(await tx(insItem("x.size", "Size 0", "prop", 0, 1)), "23514", "map_items_size_check") &&
      refused(await tx(insItem("x.size", "Size 5", "prop", 1, 5)), "23514", "map_items_size_check"),
  );
  check(
    "11 blank and 61-char name refused (23514 map_items_name_check)",
    refused(await tx(insItem("x.name", "  ", "prop", 1, 1)), "23514", "map_items_name_check") &&
      refused(
        await tx(insItem("x.name", "n".repeat(61), "prop", 1, 1)),
        "23514",
        "map_items_name_check",
      ),
  );
  check(
    "11 blank and 41-char group refused (23514 map_items_group_name_check)",
    refused(await tx(insItem("x.group", "G", " ", 1, 1)), "23514", "map_items_group_name_check") &&
      refused(
        await tx(insItem("x.group", "G", "g".repeat(41), 1, 1)),
        "23514",
        "map_items_group_name_check",
      ),
  );
  check(
    "11 duplicate name refused case- and space-insensitively (23505 map_items_org_name_key)",
    refused(await tx(insItem("x.dup", "  DOOR ", "prop", 1, 1)), "23505", "map_items_org_name_key"),
  );
  check(
    "11 duplicate key refused (23505 map_items_pkey)",
    refused(await tx(insItem("door", "Another", "prop", 1, 1)), "23505", "map_items_pkey"),
  );
  check(
    "11 bad key refused (23514 map_items_builtin_key_check)",
    refused(
      await tx(insItem("Door x", "Bad key", "prop", 1, 1)),
      "23514",
      "map_items_builtin_key_check",
    ),
  );
  check(
    "11 bad Drive id refused (23514 map_items_art_image_check)",
    refused(
      await tx(insItem("x.img", "Img", "prop", 1, 1, "art_w_drive_file_id='short'")),
      "23514",
      "map_items_art_image_check",
    ),
  );
  check(
    "11 negative image version refused (23514 map_items_art_image_version_check)",
    refused(
      await tx(insItem("x.ver", "Ver", "prop", 1, 1, "art_e_image_version=-1")),
      "23514",
      "map_items_art_image_version_check",
    ),
  );
  check(
    "11 bad sprite refused (23514 map_items_art_sprite_check)",
    refused(
      await tx(insItem("x.spr", "Spr", "prop", 1, 1, "art_n_sprite=' x'")),
      "23514",
      "map_items_art_sprite_check",
    ),
  );

  // 12 member photo (SIM-046)
  const setPhoto = (/** @type {string} */ id, /** @type {number} */ version) =>
    q(`update members set photo_drive_file_id = $2, photo_version = $3 where id = $1`, [
      m1.id,
      id,
      version,
    ]);
  const oldPhoto = (
    await rows("select photo_drive_file_id as f, photo_version as v from members where id = $1", [
      oldMember,
    ])
  )[0];
  check(
    "12 member created before the migration has no photo, version 0",
    oldPhoto.f === null && oldPhoto.v === 0,
  );
  check(
    "12 bad Drive id refused (23514 members_photo_check)",
    refused(await tx(setPhoto("bad id", 1)), "23514", "members_photo_check"),
  );
  check(
    "12 negative version refused (23514 members_photo_version_check)",
    refused(await tx(setPhoto("file_abcdefghij", -1)), "23514", "members_photo_version_check"),
  );
  check(
    "12 valid id with version 1 accepted",
    (await tx(setPhoto("file_abcdefghij", 1), false)) === null,
  );
  // 13. pixel look (SIM-047)
  const setLook = (/** @type {string} */ json) =>
    q(`update members set pixel_look = $1::jsonb where id = $2`, [json, m1.id]);
  check(
    "13 member without a look reads pixel_look null",
    (await c.query(`select pixel_look from members where id = $1`, [m1.id])).rows[0].pixel_look ===
      null,
  );
  check(
    "13 valid looks (boundaries) accepted, null again accepted",
    (await tx(async () => {
      await setLook('{"skin":0,"hair":0,"style":1,"shirt":0}')();
      await setLook('{"skin":3,"hair":5,"style":3,"shirt":6}')();
      await q(`update members set pixel_look = null where id = $1`, [m1.id])();
    }, false)) === null,
  );
  const badLooks = [
    "{}",
    '{"skin":0,"hair":0,"style":1}',
    '{"skin":0,"hair":0,"style":1,"shirt":0,"x":1}',
    '{"skin":4,"hair":0,"style":1,"shirt":0}',
    '{"skin":0,"hair":6,"style":1,"shirt":0}',
    '{"skin":0,"hair":0,"style":1,"shirt":7}',
    '{"skin":0,"hair":0,"style":0,"shirt":0}',
    '{"skin":0,"hair":0,"style":4,"shirt":0}',
    '{"skin":-1,"hair":0,"style":1,"shirt":0}',
    '{"skin":"2","hair":0,"style":1,"shirt":0}',
    '{"skin":1.5,"hair":0,"style":1,"shirt":0}',
    '{"skin":1.0,"hair":0,"style":1,"shirt":0}',
    "[]",
    "3",
    '"x"',
  ];
  for (const bad of badLooks) {
    check(
      `13 bad look refused (23514 members_pixel_look_check): ${bad}`,
      refused(await tx(setLook(bad)), "23514", "members_pixel_look_check"),
    );
  }

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
