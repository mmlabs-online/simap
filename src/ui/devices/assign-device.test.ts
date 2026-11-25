import { describe, expect, it } from "vitest";
import type { DeviceDto } from "@/lib/devices/types";
import { apiErrorMessage } from "../copy/api";
import { devicesCopy } from "../copy/devices";
import { seatsCopy } from "../copy/seats";
import {
  emptyAssignForm,
  expiryMin,
  holdingForm,
  noteLength,
  settleAssign,
  toAssignBody,
  toHoldingBody,
  type AssignForm,
} from "./assign-device";

const UUID = "11111111-1111-4111-8111-111111111111";
const TODAY = "2026-11-25";
const err = devicesCopy.assign.errors;
const form = (over: Partial<AssignForm> = {}): AssignForm => ({ ...emptyAssignForm(), ...over });
const owned = (holding: DeviceDto["holding"]) => ({ holding }) as DeviceDto;

describe("emptyAssignForm / holdingForm", () => {
  it("assign starts with No expiry checked and no date", () => {
    expect(emptyAssignForm()).toEqual({ note: "", noExpiry: true, expiresOn: "" });
  });
  it("edit follows the holding", () => {
    expect(holdingForm(owned({ note: null, expiresOn: null }))).toEqual({
      note: "",
      noExpiry: true,
      expiresOn: "",
    });
    expect(holdingForm(owned({ note: "Máy mượn", expiresOn: "2026-12-31" }))).toEqual({
      note: "Máy mượn",
      noExpiry: false,
      expiresOn: "2026-12-31",
    });
  });
});

describe("expiryMin", () => {
  it("assign is today", () => {
    expect(expiryMin("assign", null, TODAY)).toBe(TODAY);
  });
  it("edit of an overdue holding keeps its own date; a future or no expiry gives today", () => {
    expect(expiryMin("edit", { expiresOn: "2026-11-01" }, TODAY)).toBe("2026-11-01");
    expect(expiryMin("edit", { expiresOn: "2026-12-31" }, TODAY)).toBe(TODAY);
    expect(expiryMin("edit", { expiresOn: null }, TODAY)).toBe(TODAY);
  });
});

describe("toAssignBody", () => {
  it("needs a member", () => {
    expect(toAssignBody(form(), null, TODAY)).toEqual({
      kind: "invalid",
      message: seatsCopy.actions.pickerNone,
    });
  });
  it("No expiry sends null; a date is sent as given; today is allowed", () => {
    expect(toAssignBody(form(), UUID, TODAY)).toEqual({
      kind: "ok",
      body: { memberId: UUID, note: null, expiresOn: null },
    });
    expect(
      toAssignBody(form({ noExpiry: false, expiresOn: "2026-12-31" }), UUID, TODAY),
    ).toMatchObject({ kind: "ok", body: { expiresOn: "2026-12-31" } });
    expect(toAssignBody(form({ noExpiry: false, expiresOn: TODAY }), UUID, TODAY)).toMatchObject({
      kind: "ok",
    });
  });
  it("unchecked without a date, or a day before today, is refused", () => {
    expect(toAssignBody(form({ noExpiry: false }), UUID, TODAY)).toEqual({
      kind: "invalid",
      message: err.expiryMissing,
    });
    expect(toAssignBody(form({ noExpiry: false, expiresOn: "2026-11-24" }), UUID, TODAY)).toEqual({
      kind: "invalid",
      message: err.expiryPast,
    });
  });
  it("cleans the note: blank is null, NFD becomes NFC, CRLF becomes LF", () => {
    const note = (n: string) => {
      const r = toAssignBody(form({ note: n }), UUID, TODAY);
      if (r.kind !== "ok") throw new Error("expected ok");
      return r.body.note;
    };
    expect(note("   ")).toBeNull();
    expect(note("Nguyễn")).toBe("Nguyễn");
    expect(note("a\r\nb")).toBe("a\nb");
    expect(note("a".repeat(500))).toHaveLength(500);
  });
  it("501 code points and control characters are refused", () => {
    expect(toAssignBody(form({ note: "a".repeat(501) }), UUID, TODAY)).toEqual({
      kind: "invalid",
      message: err.noteInvalid,
    });
    expect(toAssignBody(form({ note: "\u0007" }), UUID, TODAY)).toEqual({
      kind: "invalid",
      message: err.noteInvalid,
    });
  });
});

describe("toHoldingBody", () => {
  const dev = owned({ note: "Máy mượn", expiresOn: "2026-12-31" });
  const same = holdingForm(dev);
  it("nothing changed, or only whitespace or NFD, is unchanged", () => {
    expect(toHoldingBody(same, dev, TODAY)).toEqual({ kind: "unchanged" });
    expect(toHoldingBody({ ...same, note: " Máy mượn " }, dev, TODAY)).toEqual({
      kind: "unchanged",
    });
    expect(toHoldingBody({ ...same, note: "Máy mượn" }, dev, TODAY)).toEqual({
      kind: "unchanged",
    });
  });
  it("sends only the changed keys", () => {
    expect(toHoldingBody({ ...same, note: "Mới" }, dev, TODAY)).toEqual({
      kind: "ok",
      body: { note: "Mới" },
    });
    expect(toHoldingBody({ ...same, note: "" }, dev, TODAY)).toEqual({
      kind: "ok",
      body: { note: null },
    });
    expect(toHoldingBody({ ...same, noExpiry: true, expiresOn: "" }, dev, TODAY)).toEqual({
      kind: "ok",
      body: { expiresOn: null },
    });
  });
  it("an overdue holding stays editable; another past date is refused", () => {
    const overdue = owned({ note: "x", expiresOn: "2026-11-01" });
    expect(toHoldingBody({ ...holdingForm(overdue), note: "y" }, overdue, TODAY)).toEqual({
      kind: "ok",
      body: { note: "y" },
    });
    expect(
      toHoldingBody({ ...holdingForm(overdue), expiresOn: "2026-10-01" }, overdue, TODAY),
    ).toEqual({ kind: "invalid", message: err.expiryPast });
  });
  it("unchecked without a date is refused", () => {
    expect(toHoldingBody({ ...same, expiresOn: "" }, dev, TODAY)).toEqual({
      kind: "invalid",
      message: err.expiryMissing,
    });
  });
});

describe("settleAssign", () => {
  const fail = (code: string) => settleAssign({ ok: false, code });
  it("ok and not_found are done", () => {
    expect(settleAssign({ ok: true, value: {} as DeviceDto })).toEqual({ kind: "done" });
    expect(fail("not_found")).toEqual({ kind: "done" });
  });
  it("stale refusals ask for a refresh", () => {
    for (const code of ["device_owned", "not_assigned", "not_allowed", "handoff_pending"]) {
      expect(fail(code)).toEqual({
        kind: "error",
        message: apiErrorMessage(code),
        stale: true,
        reloadMembers: false,
      });
    }
  });
  it("member_not_assignable reloads the members", () => {
    expect(fail("member_not_assignable")).toMatchObject({ stale: false, reloadMembers: true });
  });
  it("invalid_request has its own message; unavailable is not stale", () => {
    expect(fail("invalid_request")).toMatchObject({ message: err.invalid, stale: false });
    expect(fail("unavailable")).toEqual({
      kind: "error",
      message: apiErrorMessage("unavailable"),
      stale: false,
      reloadMembers: false,
    });
  });
});

describe("noteLength", () => {
  it("counts code points", () => {
    expect(noteLength("ab")).toBe(2);
    expect(noteLength("😀")).toBe(1);
  });
});
