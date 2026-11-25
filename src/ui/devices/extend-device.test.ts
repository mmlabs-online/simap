import { describe, expect, it } from "vitest";
import type { HandoffDto } from "@/lib/devices/types";
import { apiErrorMessage } from "../copy/api";
import { devicesCopy } from "../copy/devices";
import { emptyExtendForm, nextDay, settleExtend, toExtendBody } from "./extend-device";

const copy = devicesCopy.extend;
const ok = { ok: true as const, value: { id: "h1" } as HandoffDto };
const fail = (code: string) => ({ ok: false as const, code });
const TODAY = "2026-11-25";

describe("nextDay", () => {
  it("handles month end, year end and a leap day", () => {
    expect(nextDay("2026-11-25")).toBe("2026-11-26");
    expect(nextDay("2026-11-30")).toBe("2026-12-01");
    expect(nextDay("2026-12-31")).toBe("2027-01-01");
    expect(nextDay("2028-02-28")).toBe("2028-02-29");
    expect(nextDay("2027-02-28")).toBe("2027-03-01");
  });
});

describe("toExtendBody", () => {
  const form = (newExpiresOn: string, note = "") => ({ ...emptyExtendForm(), newExpiresOn, note });
  it("an empty date, today or yesterday is invalid with the date message", () => {
    for (const day of ["", TODAY, "2026-11-24"]) {
      expect(toExtendBody(form(day), TODAY)).toEqual({
        kind: "invalid",
        message: copy.errors.dateInvalid,
      });
    }
  });
  it("tomorrow is ok; a blank note becomes null and a note is trimmed", () => {
    expect(toExtendBody(form("2026-11-26"), TODAY)).toEqual({
      kind: "ok",
      body: { kind: "extension", newExpiresOn: "2026-11-26", note: null },
    });
    expect(toExtendBody(form("2026-11-26", "  Dự án  "), TODAY)).toEqual({
      kind: "ok",
      body: { kind: "extension", newExpiresOn: "2026-11-26", note: "Dự án" },
    });
  });
  it("a 501-character note is invalid with the note message", () => {
    expect(toExtendBody(form("2026-11-26", "a".repeat(501)), TODAY)).toEqual({
      kind: "invalid",
      message: devicesCopy.assign.errors.noteInvalid,
    });
  });
});

describe("settleExtend", () => {
  it("ok and not_found are done", () => {
    expect(settleExtend(ok)).toEqual({ kind: "done" });
    expect(settleExtend(fail("not_found"))).toEqual({ kind: "done" });
  });
  it.each(["handoff_pending", "not_allowed", "device_unowned"])("%s is stale", (code) => {
    expect(settleExtend(fail(code))).toEqual({
      kind: "error",
      message: apiErrorMessage(code),
      stale: true,
    });
  });
  it("invalid_request uses the extension message; other codes are not stale", () => {
    expect(settleExtend(fail("invalid_request"))).toEqual({
      kind: "error",
      message: copy.errors.invalid,
      stale: false,
    });
    expect(settleExtend(fail("unavailable"))).toEqual({
      kind: "error",
      message: apiErrorMessage("unavailable"),
      stale: false,
    });
  });
});
