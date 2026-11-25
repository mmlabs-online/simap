import { describe, expect, it } from "vitest";
import type { OrgScope } from "@/server/http/org-scope";
import { startExtension, startReturn, startTransfer } from "./handoffs";

const scope = { orgId: "11111111-1111-4111-8111-111111111111" } as OrgScope;
const ACTOR = "22222222-2222-4222-8222-222222222222";
const ME = "33333333-3333-4333-8333-333333333333";
const OTHER = "44444444-4444-4444-8444-444444444444";
const DEVICE = "55555555-5555-4555-8555-555555555555";
const HID = "66666666-6666-4666-8666-666666666666";

type Call = [string, unknown[]];

function fakeDb() {
  const calls: Call[] = [];
  const query = async (text: string, values: unknown[] = []) => {
    const sql = text.replace(/\s+/g, " ").trim();
    calls.push([sql, values]);
    if (/^(begin|commit|rollback)$/.test(sql)) return { rows: [] };
    if (sql.startsWith("select id from members")) return { rows: [{ id: ME }] };
    if (sql.startsWith("select status from members")) return { rows: [{ status: "active" }] };
    if (sql.startsWith("select owner_id")) {
      return { rows: [{ owner_id: ME, inventory_number: "INV-1" }] };
    }
    if (sql.startsWith("select 1 from device_handoffs")) return { rows: [] };
    if (sql.startsWith("insert into device_handoffs")) return { rows: [{ id: HID }] };
    if (sql.startsWith("select h.id")) {
      return {
        rows: [
          {
            id: HID,
            kind: "transfer",
            status: "pending",
            device_id: DEVICE,
            device_name: "d",
            device_type: "laptop",
            inventory_number: "INV-1",
            expires_on: null,
            from_id: ME,
            from_name: "Me",
            to_id: null,
            to_name: null,
            by_id: ME,
            by_name: "Me",
            decided_by_id: null,
            decided_by_name: null,
            note: null,
            new_expires_on: null,
            created_at: "2026-11-25T00:00:00.000Z",
            decided_at: null,
          },
        ],
      };
    }
    return { rows: [] };
  };
  const db = { query, connect: async () => ({ query, release: () => {} }) };
  const insert = () => calls.find(([s]) => s.startsWith("insert into device_handoffs"))!;
  return { db, insert };
}

describe("device_handoffs start inserts pass the orgQuery guard (BUG-002)", () => {
  it("startTransfer reaches the device_handoffs insert through orgQuery", async () => {
    const t = fakeDb();
    const r = await startTransfer(t.db, scope, ACTOR, "user", DEVICE, {
      kind: "transfer",
      toMemberId: OTHER,
      note: "n",
    });
    expect(r.ok).toBe(true);
    const [sql, values] = t.insert();
    expect(sql).toMatch(/org_id\s*=\s*\$1::uuid/);
    expect(values).toEqual([scope.orgId, DEVICE, ME, OTHER, ME, "n"]);
  });

  it("startReturn reaches the insert", async () => {
    const t = fakeDb();
    const r = await startReturn(t.db, scope, ACTOR, "user", DEVICE, { kind: "return", note: "n" });
    expect(r.ok).toBe(true);
    const [sql, values] = t.insert();
    expect(sql).toMatch(/org_id\s*=\s*\$1::uuid/);
    expect(values).toEqual([scope.orgId, DEVICE, ME, ME, "n"]);
  });

  it("startExtension reaches the insert", async () => {
    const t = fakeDb();
    const r = await startExtension(t.db, scope, ACTOR, "user", DEVICE, {
      kind: "extension",
      newExpiresOn: "2027-01-01",
      note: "n",
    });
    expect(r.ok).toBe(true);
    const [sql, values] = t.insert();
    expect(sql).toMatch(/org_id\s*=\s*\$1::uuid/);
    expect(values).toEqual([scope.orgId, DEVICE, ME, "n", "2027-01-01"]);
  });
});
