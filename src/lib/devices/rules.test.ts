import { describe, expect, it } from "vitest";
import type { Tier } from "@/lib/auth/tier";
import { canCreateFor, canEdit, canPlace, decidePlacement, type PlacementInput } from "./rules";

const D = "d0000000-0000-4000-8000-000000000001";
const OWNER = "a0000000-0000-4000-8000-000000000001";
const OTHER = "a0000000-0000-4000-8000-000000000002";
const A = "50000000-0000-4000-8000-00000000000a";
const B = "50000000-0000-4000-8000-00000000000b";
const OTHER_DEV = "d0000000-0000-4000-8000-000000000002";

const input = (o: Partial<PlacementInput> = {}): PlacementInput => ({
  tier: "user",
  isOwner: true,
  deviceId: D,
  ownerId: OWNER,
  current: { seatId: null, role: "secondary" },
  expectedSeatId: null,
  target: { seatId: A, occupantId: OWNER, primaryId: null },
  role: "primary",
  ...o,
});
const refuse = (status: 409 | 422, code: string) => ({ kind: "refuse", status, code });

describe("permission matrix", () => {
  it("canPlace: owner yes for user/manager/admin; non-owner: user no, manager yes, admin yes", () => {
    const tiers: Tier[] = ["user", "manager", "admin"];
    expect(tiers.map((t) => canPlace(t, true))).toEqual([true, true, true]);
    expect(tiers.map((t) => canPlace(t, false))).toEqual([false, true, true]);
  });

  it("canEdit: owner yes for all tiers; non-owner only admin", () => {
    const tiers: Tier[] = ["user", "manager", "admin"];
    expect(tiers.map((t) => canEdit(t, true))).toEqual([true, true, true]);
    expect(tiers.map((t) => canEdit(t, false))).toEqual([false, false, true]);
  });

  it("canCreateFor: self yes for all tiers; other member only admin", () => {
    const tiers: Tier[] = ["user", "manager", "admin"];
    expect(tiers.map((t) => canCreateFor(t, true))).toEqual([true, true, true]);
    expect(tiers.map((t) => canCreateFor(t, false))).toEqual([false, false, true]);
  });
});

describe("decidePlacement", () => {
  it("not_allowed is checked first (a user moving another's device is refused even when the target is valid)", () => {
    const r = decidePlacement(
      input({ isOwner: false, role: "secondary", expectedSeatId: B, target: null }),
    );
    expect(r).toEqual(refuse(422, "not_allowed"));
    expect(decidePlacement(input({ isOwner: false, role: "secondary" }))).toEqual(
      refuse(422, "not_allowed"),
    );
  });

  it("placement_changed when expectedSeatId differs from the current seat (both null/uuid mixes)", () => {
    const changed = refuse(409, "placement_changed");
    expect(decidePlacement(input({ expectedSeatId: A }))).toEqual(changed);
    expect(decidePlacement(input({ current: { seatId: A, role: "secondary" } }))).toEqual(changed);
    expect(
      decidePlacement(input({ current: { seatId: A, role: "secondary" }, expectedSeatId: B })),
    ).toEqual(changed);
  });

  it("return: from a seat -> return; already in inventory -> noop", () => {
    const here = { current: { seatId: A, role: "secondary" as const }, expectedSeatId: A };
    expect(decidePlacement(input({ ...here, target: null, role: "secondary" }))).toEqual({
      kind: "return",
    });
    expect(decidePlacement(input({ target: null, role: "secondary" }))).toEqual({ kind: "noop" });
  });

  it("same seat and same role -> noop; primary->secondary -> move; secondary->primary on own occupied seat -> move", () => {
    const prim = { current: { seatId: A, role: "primary" as const }, expectedSeatId: A };
    const sec = { current: { seatId: A, role: "secondary" as const }, expectedSeatId: A };
    const target = { seatId: A, occupantId: OWNER, primaryId: D };
    expect(decidePlacement(input({ ...prim, target }))).toEqual({ kind: "noop" });
    expect(decidePlacement(input({ ...prim, target, role: "secondary" }))).toEqual({
      kind: "move",
    });
    expect(
      decidePlacement(input({ ...sec, target: { ...target, primaryId: null }, role: "primary" })),
    ).toEqual({ kind: "move" });
  });

  it("primary: no occupant -> seat_has_no_occupant; occupant != owner -> owner_not_occupant; another primary -> seat_has_primary; the device itself is not 'another'", () => {
    const t = { seatId: A, occupantId: OWNER, primaryId: null as string | null };
    expect(decidePlacement(input({ target: { ...t, occupantId: null } }))).toEqual(
      refuse(409, "seat_has_no_occupant"),
    );
    expect(decidePlacement(input({ target: { ...t, occupantId: OTHER } }))).toEqual(
      refuse(409, "owner_not_occupant"),
    );
    expect(decidePlacement(input({ target: { ...t, primaryId: OTHER_DEV } }))).toEqual(
      refuse(409, "seat_has_primary"),
    );
    expect(decidePlacement(input({ target: { ...t, primaryId: D } }))).toEqual({ kind: "place" });
    expect(decidePlacement(input())).toEqual({ kind: "place" });
  });

  it("secondary: no ownership check (empty seat, other occupant, seat with a primary all OK)", () => {
    const t = { seatId: A, occupantId: null as string | null, primaryId: null as string | null };
    for (const target of [
      t,
      { ...t, occupantId: OTHER },
      { ...t, occupantId: OTHER, primaryId: OTHER_DEV },
    ]) {
      expect(decidePlacement(input({ role: "secondary", target }))).toEqual({ kind: "place" });
    }
  });

  it("manager places another member's device as primary only when that member is the occupant", () => {
    const m = { tier: "manager" as const, isOwner: false };
    expect(decidePlacement(input(m))).toEqual({ kind: "place" });
    expect(
      decidePlacement(input({ ...m, target: { seatId: A, occupantId: OTHER, primaryId: null } })),
    ).toEqual(refuse(409, "owner_not_occupant"));
  });
});
