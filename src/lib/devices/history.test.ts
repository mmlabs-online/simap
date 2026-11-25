import { describe, expect, it } from "vitest";
import { historyMemberIds, toHistoryEntry, type DeviceHistoryRow } from "./history";
import { DEVICE_HISTORY_ACTIONS, DEVICE_HISTORY_KINDS, type MemberRef } from "./types";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const ACTOR = "33333333-3333-4333-8333-333333333333";
const names = new Map<string, MemberRef>([
  [A, { id: A, displayName: "Nguyễn Văn Ánh" }],
  [B, { id: B, displayName: "Bea" }],
]);
const actor = { id: ACTOR, displayName: "Cy" };

const row = (
  action: string,
  meta: unknown,
  extra: Partial<DeviceHistoryRow> = {},
): DeviceHistoryRow => ({
  id: "row-1",
  action,
  at: "2026-03-05T17:30:00.000000Z",
  actorId: ACTOR,
  actorName: "Cy",
  meta,
  hNote: null,
  hNewExpiresOn: null,
  ...extra,
});
const map = (r: DeviceHistoryRow) => toHistoryEntry(r, names)!;

describe("toHistoryEntry", () => {
  it("create: nothing but actor and time", () => {
    const e = map(row("device.create", { inventoryNumber: "X", ownerId: null }));
    expect(e).toMatchObject({
      kind: "create",
      actor,
      from: null,
      to: null,
      note: null,
      expiresOn: null,
    });
  });

  it("assign: to the member with note and expiry", () => {
    const e = map(row("device.assign", { memberId: A, note: "loan", expiresOn: "2026-12-31" }));
    expect(e).toMatchObject({ kind: "assign", from: null, note: "loan", expiresOn: "2026-12-31" });
    expect(e.to?.id).toBe(A);
  });

  it("holding_update: ownerId, new note and expiry, the old expiry", () => {
    const e = map(
      row("device.holding_update", {
        ownerId: A,
        from: { note: "a", expiresOn: "2026-01-01" },
        to: { note: "b", expiresOn: "2026-02-02" },
      }),
    );
    expect(e).toMatchObject({ note: "b", expiresOn: "2026-02-02", fromExpiresOn: "2026-01-01" });
    expect(e.to?.id).toBe(A);
  });

  it("transfer start: from, to, note from meta", () => {
    const e = map(row("device.transfer_start", { fromMemberId: A, toMemberId: B, note: "n" }));
    expect(e).toMatchObject({ note: "n", confirmedBy: null, cause: null });
    expect([e.from?.id, e.to?.id]).toEqual([A, B]);
  });

  it("transfer cancel/decline: note falls back to the handoff", () => {
    const e = map(
      row("device.transfer_decline", { fromMemberId: A, toMemberId: B }, { hNote: "h" }),
    );
    expect(e.note).toBe("h");
  });

  it("transfer confirm: handoff note, carried expiry, confirmedBy the actor", () => {
    const e = map(
      row(
        "device.transfer_confirm",
        { fromMemberId: A, toMemberId: B, expiresOn: "2026-09-09" },
        { hNote: "h" },
      ),
    );
    expect(e).toMatchObject({ note: "h", expiresOn: "2026-09-09", confirmedBy: actor });
  });

  it("return start/cancel: to is org inventory (null)", () => {
    const e = map(row("device.return_start", { fromMemberId: A, note: "n" }));
    expect(e.from?.id).toBe(A);
    expect(e.to).toBeNull();
    expect(e.note).toBe("n");
    expect(map(row("device.return_cancel", { fromMemberId: A }, { hNote: "h" })).note).toBe("h");
  });

  it("return confirm and take back: confirmedBy the actor", () => {
    const c = map(row("device.return_confirm", { fromMemberId: A }, { hNote: "h" }));
    expect(c).toMatchObject({ note: "h", confirmedBy: actor, to: null });
    const t = map(row("device.return_take_back", { fromMemberId: A, byAdmin: true }));
    expect(t).toMatchObject({ note: null, confirmedBy: actor, to: null });
    expect(t.from?.id).toBe(A);
  });

  it("extension start/cancel/decline: new expiry from meta, else from the handoff", () => {
    const s = map(
      row("device.extension_start", { fromMemberId: A, newExpiresOn: "2027-01-01", note: "n" }),
    );
    expect(s).toMatchObject({ expiresOn: "2027-01-01", note: "n" });
    const d = map(
      row("device.extension_decline", { fromMemberId: A }, { hNewExpiresOn: "2027-02-02" }),
    );
    expect(d.expiresOn).toBe("2027-02-02");
  });

  it("extension confirm: to/from expiry and confirmedBy", () => {
    const e = map(
      row(
        "device.extension_confirm",
        { fromMemberId: A, fromExpiresOn: "2026-01-01", toExpiresOn: "2026-06-06" },
        { hNote: "h" },
      ),
    );
    expect(e).toMatchObject({
      note: "h",
      expiresOn: "2026-06-06",
      fromExpiresOn: "2026-01-01",
      confirmedBy: actor,
    });
  });

  it("returns null for an action outside the allowlist (device.update, device.place, device.return, device.delete)", () => {
    for (const a of ["device.update", "device.place", "device.return", "device.delete", "seat.x"]) {
      expect(toHistoryEntry(row(a, {}), names)).toBeNull();
    }
    expect(DEVICE_HISTORY_ACTIONS).toHaveLength(DEVICE_HISTORY_KINDS.length);
    expect(DEVICE_HISTORY_ACTIONS).toContain("device.return_start");
    expect(DEVICE_HISTORY_ACTIONS).not.toContain("device.return");
  });

  it("tolerates null meta, missing keys, wrong types and a non-uuid member id (all null, no throw)", () => {
    const bad = { fromMemberId: 5, toMemberId: "nope", note: 3, expiresOn: "x" };
    for (const meta of [null, undefined, "x", 5, [], {}, bad]) {
      for (const kind of DEVICE_HISTORY_KINDS) {
        const e = toHistoryEntry(row(`device.${kind}`, meta), names)!;
        expect(e.from).toBeNull();
        expect(e.to).toBeNull();
        expect(e.note).toBeNull();
        expect(e.expiresOn).toBeNull();
      }
    }
  });

  it("cause: byTakeBack, byDeactivation, byManager; byManager false -> null", () => {
    const c = (meta: object) =>
      map(row("device.transfer_cancel", { fromMemberId: A, ...meta })).cause;
    expect(c({ byTakeBack: true })).toBe("take_back");
    expect(c({ byDeactivation: true })).toBe("deactivation");
    expect(c({ byManager: true })).toBe("manager");
    expect(c({ byManager: false })).toBeNull();
  });

  it("a member id missing from the name map gives null; Vietnamese display name kept as is (Nguyễn Văn Ánh)", () => {
    const gone = "44444444-4444-4444-8444-444444444444";
    const e = map(row("device.transfer_start", { fromMemberId: A, toMemberId: gone }));
    expect(e.from?.displayName).toBe("Nguyễn Văn Ánh");
    expect(e.to).toBeNull();
    expect(map(row("device.create", {}, { actorId: null, actorName: null })).actor).toBeNull();
  });
});

describe("historyMemberIds", () => {
  it("collects canonical uuids only", () => {
    const meta = { fromMemberId: A, toMemberId: "x", memberId: B, ownerId: 3 };
    expect(historyMemberIds(meta)).toEqual([A, B]);
    expect(historyMemberIds(null)).toEqual([]);
  });
});
