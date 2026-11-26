import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FOLD_FROM, FOLD_TO, foldText } from "@/lib/search/fold";
import { parseSearchQuery } from "@/lib/validate/search-query";
import {
  addDevice,
  addMember,
  addRoom,
  addSeat,
  assertTestDb,
  newOrg,
  testPool,
} from "@/test/db/fixtures";
import type { TxClient, TxPool } from "@/server/db/tx";
import { search } from "./search";

let pool: pg.Pool;

const run = (sql: string, values: unknown[] = []) => pool.query(sql, values);

const filter = (qs: string) => {
  const r = parseSearchQuery(new URLSearchParams(qs));
  if (!r.ok) throw new Error("bad query " + qs);
  return r.value;
};
const MANAGER = { sub: "00000000-0000-4000-8000-000000000000", tier: "manager" as const };
const find = (
  o: { scope: any },
  qs: string,
  p: any = pool,
  viewer: { sub: string; tier: "user" | "manager" | "admin" } = MANAGER,
) => search(p, o.scope, filter(qs), viewer);
const q = (s: string, rest = "") => `q=${encodeURIComponent(s)}${rest}`;

async function member(orgId: string, name: string, code: string | null = null) {
  const id = await addMember(pool, orgId);
  await run("update members set display_name = $2, employee_code = $3 where id = $1", [
    id,
    name,
    code,
  ]);
  return id;
}

beforeAll(async () => {
  pool = testPool();
  await assertTestDb(pool);
});
afterAll(async () => {
  await pool.end();
});

describe("search (db)", () => {
  it("SQL fold equals foldText on the whole map", async () => {
    const sample =
      FOLD_FROM +
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz0123456789" +
      "aàáảãạăắằẳẵặâấầẩẫậeèéẻẽẹêếềểễệiìíỉĩịoòóỏõọôốồổỗộơớờởỡợuùúủũụưứừửữựyỳýỷỹỵđĐ";
    const { rows } = await run(
      `select lower(translate($1::text, '${FOLD_FROM}', '${FOLD_TO}')) as f`,
      [sample],
    );
    // SQL folds the map and lowercases ASCII; đ/Đ are in the map (U+0111, U+0110), as are all tone forms.
    expect(rows[0].f).toBe(foldText(sample));
  });

  it("nguyen finds Nguyễn in every kind; dung finds Đặng/Dũng", async () => {
    const o = newOrg();
    const owner = await member(o.orgId, "Nguyễn Văn An");
    const room = await addRoom(pool, o.orgId, "A1");
    const seat = await addSeat(pool, o.orgId, room, "A1", 1, { occupantId: owner });
    const dev = await addDevice(pool, o.orgId, owner, seat, "primary");
    await run("update devices set name = 'Máy in Đặng' where id = $1", [dev]);
    const tran = await member(o.orgId, "Trần Dũng");

    const n = await find(o, q("nguyen"));
    expect(n.seats!.items.map((i) => i.id)).toEqual([seat]);
    expect(n.devices!.items.map((i) => i.id)).toEqual([dev]);
    expect(n.members!.items.map((i) => i.id)).toEqual([owner]);

    const d = await find(o, q("DUNG"));
    expect(d.members!.items.map((i) => i.id)).toEqual([tran]);
    const dd = await find(o, q("dang"));
    expect(dd.devices!.items.map((i) => i.id)).toEqual([dev]);
  });

  it("fields: seat code and occupant; device name, inventory no., MAC (aa:bb, aa-bb, aabb), owner; member name and employee code; email not matched", async () => {
    const o = newOrg();
    const owner = await member(o.orgId, "Lê Bình", "EMP-9");
    await run("update members set email = 'secret.mail@simap.example' where id = $1", [owner]);
    const room = await addRoom(pool, o.orgId, "B2");
    const seat = await addSeat(pool, o.orgId, room, "B2", 1, { code: "ZX-7", occupantId: owner });
    const dev = await addDevice(pool, o.orgId, owner, null, "secondary");
    await run(
      "update devices set name = 'Zebra', inventory_number = 'INV-4242', mac = 'aa:bb:cc:dd:ee:ff' where id = $1",
      [dev],
    );

    expect((await find(o, q("zx-7"))).seats!.items.map((i) => i.id)).toEqual([seat]);
    expect((await find(o, q("le binh"))).seats!.items.map((i) => i.id)).toEqual([seat]);
    for (const s of [
      "zebra",
      "inv-4242",
      "le binh",
      "aa:bb",
      "aa-bb",
      "aabb",
      "AA-BB:cc",
      "ddeeff",
    ]) {
      expect(
        (await find(o, q(s))).devices!.items.map((i) => i.id),
        s,
      ).toEqual([dev]);
    }
    const byCode = await find(o, q("emp-9"));
    expect(byCode.members!.items.map((i) => i.id)).toEqual([owner]);
    expect((await find(o, q("secret.mail"))).members!.items).toEqual([]);
    const hit = (await find(o, q("zebra"))).devices!.items[0]!;
    expect(hit).toMatchObject({
      inventoryNumber: "INV-4242",
      mac: "aa:bb:cc:dd:ee:ff",
      owner: { id: owner, displayName: "Lê Bình" },
      placement: null,
    });
    expect(Object.keys((await find(o, q("emp-9"))).members!.items[0]!)).not.toContain("email");
  });

  it("an unowned device is found by name and inventory number, owner null", async () => {
    const o = newOrg();
    await member(o.orgId, "Lê Bình");
    const dev = await addDevice(pool, o.orgId, null, null, "secondary");
    await run("update devices set name = 'Bộ sạc', inventory_number = 'INV-9001' where id = $1", [
      dev,
    ]);
    for (const s of ["bo sac", "inv-9001"]) {
      const r = await find(o, q(s));
      expect(r.devices!.items.map((i) => i.id)).toEqual([dev]);
      expect(r.devices!.items[0]!.owner).toBeNull();
    }
  });

  it("finds a device by serial, manufacturer and brand (case and diacritics folded)", async () => {
    const o = newOrg();
    const dev = await addDevice(pool, o.orgId, null, null, "secondary");
    await run(
      "update devices set serial = 'SN-0042', manufacturer = 'Nguyễn Corp', brand = 'Đặng' where id = $1",
      [dev],
    );
    for (const s of ["sn-00", "nguyen", "dang"]) {
      const r = await find(o, q(s));
      expect(r.devices!.items.map((i) => i.id)).toEqual([dev]);
    }
    expect((await find(o, q("sn-9999"))).devices!.items).toEqual([]);
  });

  it("literal % and _ match only themselves", async () => {
    const o = newOrg();
    const a = await member(o.orgId, "Trần 50%_x");
    await member(o.orgId, "Trần 505x");
    for (const s of ["%", "_", "50%_"]) {
      expect(
        (await find(o, q(s, "&kind=member"))).members!.items.map((i) => i.id),
        s,
      ).toEqual([a]);
    }
  });

  it("pages each kind by keyset with equal names, no gaps or repeats", async () => {
    const o = newOrg();
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) ids.push(await member(o.orgId, "Nguyễn Văn A"));
    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const res: Awaited<ReturnType<typeof find>> = await find(
        o,
        q("nguyen", "&kind=member&limit=2" + (cursor ? "&cursor=" + cursor : "")),
      );
      seen.push(...res.members!.items.map((i) => i.id));
      cursor = res.members!.nextCursor;
      pages++;
    } while (cursor);
    expect(pages).toBe(3);
    expect(seen.sort()).toEqual([...ids].sort());
    expect(new Set(seen).size).toBe(5);
  });

  it("kind=all caps each group at limit with its own nextCursor; null when the group fits", async () => {
    const o = newOrg();
    const owner = await member(o.orgId, "Nguyễn A");
    await member(o.orgId, "Nguyễn B");
    await member(o.orgId, "Nguyễn C");
    const room = await addRoom(pool, o.orgId, "C3");
    await addSeat(pool, o.orgId, room, "C3", 1, { occupantId: owner });
    const res = await find(o, q("nguyen", "&limit=2"));
    expect(res.members!.items).toHaveLength(2);
    expect(res.members!.nextCursor).not.toBeNull();
    expect(res.seats!.items).toHaveLength(1);
    expect(res.seats!.nextCursor).toBeNull();
    expect(res.devices).toEqual({ items: [], nextCursor: null });
  });

  it("deactivated members are returned with status deactivated", async () => {
    const o = newOrg();
    const m = await member(o.orgId, "Phạm Cũ");
    await run("update members set status = 'deactivated' where id = $1", [m]);
    const res = await find(o, q("pham", "&kind=member"));
    expect(res.members!.items).toMatchObject([{ id: m, status: "deactivated" }]);
  });

  it("empty org: empty groups, nextCursor null", async () => {
    const res = await find(newOrg(), q("anything"));
    const empty = { items: [], nextCursor: null };
    expect(res).toEqual({ seats: empty, devices: empty, members: empty });
  });

  it("never returns another org's rows", async () => {
    const a = newOrg();
    const b = newOrg();
    for (const o of [a, b]) {
      const m = await member(o.orgId, "Nguyễn Chung", "SAME-1");
      const room = await addRoom(pool, o.orgId, "SAME");
      const seat = await addSeat(pool, o.orgId, room, "SAME", 1, { occupantId: m });
      const dev = await addDevice(pool, o.orgId, m, seat, "primary");
      await run("update devices set name = 'Nguyễn Dev', mac = 'aa:bb:cc:dd:ee:01' where id = $1", [
        dev,
      ]);
    }
    for (const s of ["nguyen", "same", "aabb"]) {
      const res = await find(a, q(s));
      const all = [
        ...res.seats!.items.map((i) => i.id),
        ...res.devices!.items.map((i) => i.id),
        ...res.members!.items.map((i) => i.id),
      ];
      const { rows } = await run(
        "select id from members where org_id = $1 union select id from seats where org_id = $1 union select id from devices where org_id = $1",
        [a.orgId],
      );
      const mine = new Set(rows.map((r) => r.id));
      expect(all.length, s).toBeGreaterThan(0);
      for (const id of all) expect(mine.has(id), s).toBe(true);
    }
  });

  it("runs begin, set transaction repeatable read read only, reads, commit", async () => {
    const o = newOrg();
    const log: string[] = [];
    const wrapped: TxPool = {
      async connect(): Promise<TxClient> {
        const c = await pool.connect();
        return {
          async query(text, values) {
            log.push(text);
            return c.query(text, values);
          },
          release: () => c.release(),
        };
      },
    };
    await find(o, q("x"), wrapped);
    expect(log[0]).toBe("begin");
    expect(log[1]).toBe("set transaction isolation level repeatable read, read only");
    expect(log.at(-1)).toBe("commit");
    expect(log).toHaveLength(6);
  });
});

describe("search (db): device group per tier", () => {
  it("user finds only a device they hold (by name, MAC, owner name); manager finds both", async () => {
    const o = newOrg();
    const x = await member(o.orgId, "Xuan Owner");
    const y = await member(o.orgId, "Yen Holder");
    const mine = await addDevice(pool, o.orgId, x, null, "secondary");
    const theirs = await addDevice(pool, o.orgId, y, null, "secondary");
    await run("update devices set name = 'Zebra mine', mac = 'AA:BB:CC:00:00:01' where id = $1", [
      mine,
    ]);
    await run("update devices set name = 'Zebra theirs', mac = 'AA:BB:CC:00:00:02' where id = $1", [
      theirs,
    ]);
    const subX = (await run("select sub from members where id = $1", [x])).rows[0].sub as string;
    const user = { sub: subX, tier: "user" as const };
    const ids = async (qs: string, viewer: typeof user | typeof MANAGER) =>
      ((await find(o, qs + "&kind=device", pool, viewer)).devices?.items ?? [])
        .map((d) => d.id)
        .sort();
    expect(await ids(q("zebra"), user)).toEqual([mine]);
    expect(await ids(q("theirs"), user)).toEqual([]);
    expect(await ids(q("AA:BB:CC:00:00:02"), user)).toEqual([]);
    expect(await ids(q("Yen Holder"), user)).toEqual([]);
    expect(await ids(q("zebra"), MANAGER)).toEqual([mine, theirs].sort());
    expect(await ids(q("Yen Holder"), MANAGER)).toEqual([theirs]);
  });
});
