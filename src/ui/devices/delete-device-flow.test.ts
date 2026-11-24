import { describe, expect, it } from "vitest";
import type { DeviceDto } from "@/lib/devices/types";
import { apiErrorMessage } from "../copy/api";
import {
  afterRefetch,
  deleteStep,
  deleteSubmitLabel,
  moveBody,
  settleDelete,
  settleMove,
} from "./delete-device-flow";

const inventory = { id: "d1", placement: null } as DeviceDto;
const placed = {
  id: "d1",
  placement: { seatId: "s1", seatCode: "C1", roomId: "r", roomCode: "R", role: "primary" },
} as DeviceDto;
const fail = (code: string) => ({ ok: false as const, code });

describe("delete-device-flow", () => {
  it("deleteStep: inventory device → confirm; placed device → placed", () => {
    expect(deleteStep(inventory)).toBe("confirm");
    expect(deleteStep(placed)).toBe("placed");
  });

  it("deleteSubmitLabel per step", () => {
    expect(deleteSubmitLabel("placed")).toBe("Move to inventory");
    expect(deleteSubmitLabel("confirm")).toBe("Delete device");
  });

  it("moveBody sends seatId null and the device's current seatId as expectedSeatId", () => {
    expect(moveBody(placed)).toEqual({ seatId: null, expectedSeatId: "s1" });
    expect(moveBody(inventory)).toEqual({ seatId: null, expectedSeatId: null });
  });

  it("settleDelete: ok and not_found → done", () => {
    expect(settleDelete({ ok: true, value: undefined })).toEqual({ kind: "done" });
    expect(settleDelete(fail("not_found"))).toEqual({ kind: "done" });
  });

  it("settleDelete: device_placed → placed with the device_placed message", () => {
    expect(settleDelete(fail("device_placed"))).toEqual({
      kind: "placed",
      message: apiErrorMessage("device_placed"),
    });
  });

  it("settleDelete: not_allowed / unavailable → error with apiErrorMessage", () => {
    for (const code of ["not_allowed", "unavailable"]) {
      expect(settleDelete(fail(code))).toEqual({ kind: "error", message: apiErrorMessage(code) });
    }
  });

  it("settleMove: ok → confirm carrying the returned device (never done)", () => {
    expect(settleMove({ ok: true, value: inventory })).toEqual({
      kind: "confirm",
      device: inventory,
    });
  });

  it("settleMove: not_found → done; placement_changed → refetch with message; other → error", () => {
    expect(settleMove(fail("not_found"))).toEqual({ kind: "done" });
    expect(settleMove(fail("placement_changed"))).toEqual({
      kind: "refetch",
      message: apiErrorMessage("placement_changed"),
    });
    expect(settleMove(fail("unavailable"))).toEqual({
      kind: "error",
      message: apiErrorMessage("unavailable"),
    });
  });

  it("afterRefetch: ok → device; not_found → done; other code → error", () => {
    expect(afterRefetch({ ok: true, value: placed })).toEqual({ kind: "device", device: placed });
    expect(afterRefetch(fail("not_found"))).toEqual({ kind: "done" });
    expect(afterRefetch(fail("unavailable"))).toEqual({
      kind: "error",
      message: apiErrorMessage("unavailable"),
    });
  });
});
