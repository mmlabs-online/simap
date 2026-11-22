import { describe, expect, it } from "vitest";
import { apiCopy } from "../copy/api";
import { seatsCopy } from "../copy/seats";
import {
  actionOutcome,
  canManageSeats,
  canRelease,
  deleteBlock,
  focusAfterDelete,
  keepRowsOnError,
  parseAddCount,
  routeNotice,
  shouldReplaceAfterDelete,
} from "./seat-actions";

describe("shouldReplaceAfterDelete", () => {
  it("replaces only when mounted and the URL still shows the deleted seat", () => {
    expect(shouldReplaceAfterDelete(true, "C302-01", "C302-01")).toBe(true);
    expect(shouldReplaceAfterDelete(true, "C302-02", "C302-01")).toBe(false);
    expect(shouldReplaceAfterDelete(true, null, "C302-01")).toBe(false);
    expect(shouldReplaceAfterDelete(false, "C302-01", "C302-01")).toBe(false);
  });
});

describe("routeNotice", () => {
  it("shows nothing without a notice", () => {
    expect(routeNotice(null, "C302-01")).toEqual({ panel: null, page: null });
  });
  it("shows a notice for the open seat in the panel, unprefixed", () => {
    expect(routeNotice({ seatCode: "C302-01", text: "x" }, "C302-01")).toEqual({
      panel: "x",
      page: null,
    });
  });
  it("names the seat when the open seat is another one", () => {
    expect(routeNotice({ seatCode: "C302-01", text: "x" }, "C302-02")).toEqual({
      panel: seatsCopy.actions.noticeForSeat("C302-01", "x"),
      page: null,
    });
  });
  it("shows on the page with the seat code when no panel is open", () => {
    expect(routeNotice({ seatCode: "C302-01", text: "x" }, null)).toEqual({
      panel: null,
      page: seatsCopy.actions.noticeForSeat("C302-01", "x"),
    });
  });
  it("keeps an Add notice bare on the page and labels it in an open panel", () => {
    expect(routeNotice({ seatCode: null, text: "x" }, null)).toEqual({ panel: null, page: "x" });
    expect(routeNotice({ seatCode: null, text: "x" }, "C302-01")).toEqual({
      panel: seatsCopy.actions.noticeForAdd("x"),
      page: null,
    });
  });
});

const AUTH = ["unauthenticated", "forbidden", "member_deactivated", "org_required"];
const fail = (code: string) => ({ ok: false as const, code });

describe("role gating", () => {
  it("canManageSeats is admin only", () => {
    expect(canManageSeats("admin")).toBe(true);
    expect(canManageSeats("manager")).toBe(false);
    expect(canManageSeats("user")).toBe(false);
    expect(canManageSeats(null)).toBe(false);
    expect(canManageSeats(undefined)).toBe(false);
  });
  it("canRelease follows seat.mine", () => {
    expect(canRelease({ mine: true })).toBe(true);
    expect(canRelease({ mine: false })).toBe(false);
  });
});

describe("parseAddCount", () => {
  it("accepts 1 to 50 with spaces and leading zeros", () => {
    for (const [raw, count] of [
      ["1", 1],
      ["50", 50],
      [" 5 ", 5],
      ["05", 5],
    ] as const) {
      expect(parseAddCount(raw)).toEqual({ ok: true, count });
    }
  });
  it("rejects everything else", () => {
    for (const raw of ["", "0", "51", "-1", "1.5", "1e1", "0x5", "٥", "５", "9".repeat(400)]) {
      expect(parseAddCount(raw)).toEqual({ ok: false });
    }
  });
});

describe("deleteBlock", () => {
  const base = { occupant: null, deviceCount: 0, devices: [] };
  const occupant = { id: "m", displayName: "Ân" };
  it("empty seat is not blocked", () => {
    expect(deleteBlock(base)).toBeNull();
  });
  it("occupant, devices (by deviceCount) and both", () => {
    expect(deleteBlock({ ...base, occupant })).toBe(seatsCopy.actions.deleteBlockedOccupant);
    expect(deleteBlock({ ...base, deviceCount: 25 })).toBe(seatsCopy.actions.deleteBlockedDevices);
    expect(deleteBlock({ ...base, occupant, deviceCount: 1 })).toBe(
      seatsCopy.actions.deleteBlockedBoth,
    );
  });
});

describe("actionOutcome", () => {
  it("auth codes and invalid_request never reload", () => {
    for (const action of ["add", "delete", "release"] as const) {
      for (const code of [...AUTH, "invalid_request"]) {
        expect(actionOutcome(action, fail(code))).toEqual({
          reload: false,
          closePanel: false,
          message: apiCopy.errors[code as keyof typeof apiCopy.errors],
        });
      }
    }
  });
  it("add", () => {
    expect(actionOutcome("add", { ok: true })).toEqual({
      reload: true,
      closePanel: false,
      message: null,
    });
    expect(actionOutcome("add", fail("not_found")).reload).toBe(true);
    for (const code of ["unavailable", "internal"]) {
      expect(actionOutcome("add", fail(code))).toEqual({
        reload: true,
        closePanel: false,
        message: seatsCopy.actions.addCheckFirst,
      });
    }
  });
  it("delete", () => {
    expect(actionOutcome("delete", { ok: true })).toEqual({
      reload: true,
      closePanel: true,
      message: null,
    });
    expect(actionOutcome("delete", fail("not_found"))).toEqual({
      reload: true,
      closePanel: true,
      message: seatsCopy.actions.deleteGone,
    });
    expect(actionOutcome("delete", fail("seat_not_empty"))).toEqual({
      reload: true,
      closePanel: false,
      message: seatsCopy.actions.deleteChanged,
    });
    expect(actionOutcome("delete", fail("unavailable"))).toMatchObject({
      reload: true,
      closePanel: false,
    });
  });
  it("release", () => {
    expect(actionOutcome("release", { ok: true })).toEqual({
      reload: true,
      closePanel: false,
      message: null,
    });
    expect(actionOutcome("release", fail("not_allowed")).message).toBe(
      seatsCopy.actions.releaseChanged,
    );
    expect(actionOutcome("release", fail("not_found")).reload).toBe(true);
    expect(actionOutcome("release", fail("unavailable")).reload).toBe(true);
  });
  it("an unknown domain code reloads and shows the API message", () => {
    expect(actionOutcome("release", fail("occupant_changed"))).toEqual({
      reload: true,
      closePanel: false,
      message: apiCopy.errors.occupant_changed,
    });
  });
});

describe("keepRowsOnError", () => {
  it("only transient failures keep rows", () => {
    expect(keepRowsOnError("unavailable")).toBe(true);
    expect(keepRowsOnError("internal")).toBe(true);
    for (const code of ["not_found", ...AUTH]) expect(keepRowsOnError(code)).toBe(false);
  });
});

describe("focusAfterDelete", () => {
  const before = ["R-01", "R-02", "R-03"];
  it("next row, else previous, else null", () => {
    expect(focusAfterDelete(before, "R-02", ["R-01", "R-03"])).toBe("R-03");
    expect(focusAfterDelete(before, "R-03", ["R-01", "R-02"])).toBe("R-02");
    expect(focusAfterDelete(["R-01"], "R-01", [])).toBeNull();
  });
  it("never the deleted code, even if a failed reload kept it", () => {
    expect(focusAfterDelete(before, "R-03", before)).toBe("R-02");
    expect(focusAfterDelete(["R-01"], "R-01", ["R-01"])).toBeNull();
  });
});
