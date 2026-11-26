import { describe, expect, it } from "vitest";
import type { DeviceDto } from "@/lib/devices/types";
import type { SeatDto } from "@/lib/seats/types";
import { apiErrorMessage } from "../copy/api";
import { devicesCopy } from "../copy/devices";
import {
  offeredRoles,
  ownSeats,
  placeModes,
  placeVerb,
  planSubmit,
  primaryRefusal,
  seatTarget,
  settle,
  toPlacementBody,
} from "./place-device";

const device = (over: Partial<DeviceDto> = {}): DeviceDto => ({
  id: "d1",
  name: "Laptop",
  type: "PC",
  inventoryNumber: "INV-1",
  mac: null,
  owner: { id: "u1", displayName: "Ha" },
  placement: null,
  mine: true,
  canEdit: true,
  canPlace: true,
  canDelete: false,
  serial: null,
  manufacturer: null,
  brand: null,
  holding: null,
  canAssign: false,
  canEditHolding: false,
  canTransfer: false,
  canReturn: false,
  canTakeBack: false,
  overdue: false,
  pendingHandoff: null,
  ...over,
});
const placed = (seatId = "s0", role: "primary" | "secondary" = "secondary") =>
  device({ placement: { seatId, seatCode: "C-00", roomId: "r1", roomCode: "C", role } });
const seat = (over: Partial<SeatDto> = {}): SeatDto => ({
  id: "s1",
  code: "C-01",
  seq: 1,
  roomId: "r1",
  roomCode: "C",
  status: "empty",
  cannotSeat: false,
  cannotSeatReason: null,
  occupant: null,
  mine: false,
  group: null,
  project: null,
  deviceCount: 0,
  devices: [],
  ...over,
});
const owner = { id: "u1", displayName: "Ha" };
const other = { id: "u2", displayName: "Binh" };
const primaryDev = (id: string) => ({
  id,
  name: "x",
  type: "PC",
  inventoryNumber: "I",
  role: "primary" as const,
  owner,
});

describe("placeModes", () => {
  it("is empty without canPlace, place when unplaced, move and return when placed", () => {
    expect(placeModes(device({ canPlace: false }))).toEqual([]);
    expect(placeModes(device())).toEqual(["place"]);
    expect(placeModes(placed())).toEqual(["move", "return"]);
  });
});

describe("offeredRoles and primaryRefusal", () => {
  it("empty seat: secondary only", () => {
    expect(offeredRoles(device(), seat(), "manager")).toEqual(["secondary"]);
    expect(primaryRefusal(device(), seat(), "manager")).toBe("seat_has_no_occupant");
  });
  it("owner at the seat, no primary: both", () => {
    expect(offeredRoles(device(), seat({ occupant: owner }), "manager")).toEqual([
      "secondary",
      "primary",
    ]);
    expect(primaryRefusal(device(), seat({ occupant: owner }), "manager")).toBeNull();
  });
  it("another member at the seat: secondary only (lend)", () => {
    expect(offeredRoles(device(), seat({ occupant: other }), "manager")).toEqual(["secondary"]);
    expect(primaryRefusal(device(), seat({ occupant: other }), "manager")).toBe(
      "owner_not_occupant",
    );
  });
  it("owner's seat with another primary: secondary only", () => {
    const s = seat({ occupant: owner, devices: [primaryDev("d9")] });
    expect(offeredRoles(device(), s, "manager")).toEqual(["secondary"]);
    expect(primaryRefusal(device(), s, "manager")).toBe("seat_has_primary");
  });
  it("the device is that seat's primary: primary stays offered", () => {
    const s = seat({ occupant: owner, devices: [primaryDev("d1")] });
    expect(offeredRoles(placed("s1", "primary"), s, "manager")).toEqual(["secondary", "primary"]);
  });
});

describe("ownSeats and tier (D72)", () => {
  const mine = seat({ id: "s1", occupant: owner });
  const theirs = seat({ id: "s2", occupant: other });
  const empty = seat({ id: "s3" });
  const all = [mine, theirs, empty];
  it("user keeps only seats occupied by the owner; manager and admin keep all", () => {
    expect(ownSeats(device(), all, "user")).toEqual([mine]);
    expect(ownSeats(device(), all, "manager")).toEqual(all);
    expect(ownSeats(device(), all, "admin")).toEqual(all);
  });
  it("an unowned device leaves a user no seat", () => {
    expect(ownSeats(device({ owner: null }), all, "user")).toEqual([]);
  });
  it("offeredRoles and planSubmit honour the tier", () => {
    expect(offeredRoles(device(), mine, "user")).toEqual(["secondary", "primary"]);
    expect(primaryRefusal(device(), theirs, "user")).toBe("seat_not_yours");
    expect(primaryRefusal(device(), theirs, "manager")).toBe("owner_not_occupant");
    expect(planSubmit(device(), "place", mine, "primary", "user")).toMatchObject({
      kind: "send",
      body: { role: "primary" },
    });
    expect(planSubmit(device(), "place", theirs, "secondary", "manager")).toMatchObject({
      kind: "send",
      body: { seatId: "s2" },
    });
  });
});

describe("seatTarget", () => {
  it("takes primaryId from the primary device, null when none", () => {
    expect(seatTarget(seat({ occupant: owner, devices: [primaryDev("d9")] }))).toEqual({
      seatId: "s1",
      occupantId: "u1",
      primaryId: "d9",
    });
    expect(seatTarget(seat())).toEqual({ seatId: "s1", occupantId: null, primaryId: null });
  });
});

describe("placeVerb", () => {
  it("place, move, lend", () => {
    expect(placeVerb(device(), null)).toBe("place");
    expect(placeVerb(placed(), null)).toBe("move");
    expect(placeVerb(device(), seat({ occupant: other }))).toBe("lend");
    expect(placeVerb(placed(), seat({ occupant: other }))).toBe("lend");
    expect(placeVerb(device(), seat())).toBe("place");
    expect(placeVerb(placed(), seat())).toBe("move");
    expect(placeVerb(device(), seat({ occupant: owner }))).toBe("place");
  });
});

describe("toPlacementBody", () => {
  it("place, move and return bodies", () => {
    expect(toPlacementBody(device(), { seatId: "s1", role: "secondary" })).toEqual({
      seatId: "s1",
      role: "secondary",
      expectedSeatId: null,
    });
    expect(toPlacementBody(placed("s0"), { seatId: "s1", role: "primary" })).toEqual({
      seatId: "s1",
      role: "primary",
      expectedSeatId: "s0",
    });
    const ret = toPlacementBody(placed("s0"), null);
    expect(ret).toEqual({ seatId: null, expectedSeatId: "s0" });
    expect("role" in ret).toBe(false);
  });
});

describe("planSubmit", () => {
  it("needs a seat, detects a no-op, otherwise sends", () => {
    expect(planSubmit(device(), "place", null, "secondary", "manager")).toEqual({
      kind: "invalid",
      message: devicesCopy.place.pickSeat,
    });
    expect(planSubmit(placed("s1"), "move", seat(), "secondary", "manager")).toEqual({
      kind: "noop",
    });
    expect(planSubmit(device(), "place", seat(), "secondary", "manager")).toEqual({
      kind: "send",
      body: { seatId: "s1", role: "secondary", expectedSeatId: null },
    });
    expect(planSubmit(placed("s0"), "return", null, "secondary", "manager")).toEqual({
      kind: "send",
      body: { seatId: null, expectedSeatId: "s0" },
    });
  });
  it("a role that is not offered falls back to secondary", () => {
    expect(planSubmit(device(), "place", seat(), "primary", "manager")).toMatchObject({
      body: { role: "secondary" },
    });
  });
});

describe("settle", () => {
  it("ok and not_found are done; placement_changed refetches; others error", () => {
    expect(settle({ ok: true, value: device() })).toEqual({ kind: "done" });
    expect(settle({ ok: false, code: "not_found" })).toEqual({ kind: "done" });
    expect(settle({ ok: false, code: "placement_changed" })).toEqual({
      kind: "refetch",
      message: apiErrorMessage("placement_changed"),
    });
    for (const code of [
      "seat_has_no_occupant",
      "owner_not_occupant",
      "seat_has_primary",
      "seat_not_yours",
      "not_allowed",
    ]) {
      expect(settle({ ok: false, code })).toEqual({
        kind: "error",
        message: apiErrorMessage(code),
      });
    }
  });
});
