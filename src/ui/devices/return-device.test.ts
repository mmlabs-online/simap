import { describe, expect, it } from "vitest";
import type { DeviceDto, HandoffDto } from "@/lib/devices/types";
import { apiErrorMessage } from "../copy/api";
import { devicesCopy } from "../copy/devices";
import {
  confirmReturnOutcome,
  settleReturn,
  settleTakeBack,
  takeBackBody,
  takeBackDone,
  toReturnBody,
} from "./return-device";

const fail = (code: string) => ({ ok: false as const, code });
const okHandoff = { ok: true as const, value: { id: "h1" } as HandoffDto };
const okDevice = { ok: true as const, value: { id: "d1" } as DeviceDto };
const item = { device: { name: "Máy trạm", inventoryNumber: "INV-1" } } as Pick<
  HandoffDto,
  "device"
>;

describe("toReturnBody", () => {
  it("NFC and trim; a blank note is null", () => {
    const decomposed = "  Trà máy  ";
    expect(toReturnBody({ note: decomposed })).toEqual({
      kind: "ok",
      body: { kind: "return", note: "Trà máy" },
    });
    expect(toReturnBody({ note: "   " })).toEqual({
      kind: "ok",
      body: { kind: "return", note: null },
    });
  });
  it("more than 500 characters is noteInvalid", () => {
    expect(toReturnBody({ note: "a".repeat(501) })).toEqual({
      kind: "invalid",
      message: devicesCopy.assign.errors.noteInvalid,
    });
  });
});

describe("settleReturn", () => {
  it("ok and not_found are done", () => {
    expect(settleReturn(okHandoff)).toEqual({ kind: "done" });
    expect(settleReturn(fail("not_found"))).toEqual({ kind: "done" });
  });
  it.each(["handoff_pending", "not_allowed"])("%s is a stale error", (code) => {
    expect(settleReturn(fail(code))).toEqual({
      kind: "error",
      message: apiErrorMessage(code),
      stale: true,
    });
  });
  it("device_unowned is a stale error with its own text, not the placement text", () => {
    const r = settleReturn(fail("device_unowned"));
    expect(r).toEqual({
      kind: "error",
      message: devicesCopy.giveBack.errors.alreadyUnowned,
      stale: true,
    });
    expect(r.kind === "error" && r.message).not.toBe(apiErrorMessage("device_unowned"));
  });
  it("invalid_request uses the invalid text; unavailable is not stale", () => {
    expect(settleReturn(fail("invalid_request"))).toEqual({
      kind: "error",
      message: devicesCopy.giveBack.errors.invalid,
      stale: false,
    });
    expect(settleReturn(fail("unavailable"))).toMatchObject({ kind: "error", stale: false });
  });
});

describe("confirmReturnOutcome", () => {
  const base = devicesCopy.returns.confirmed("Máy trạm", "INV-1");
  it("ok: notice; the hint only under placed", () => {
    expect(confirmReturnOutcome(okHandoff, item, "all")).toEqual({
      refresh: true,
      notice: { tone: "status", text: base },
    });
    expect(confirmReturnOutcome(okHandoff, item, "placed").notice.text).toBe(
      `${base} ${devicesCopy.returns.filterHint}`,
    );
    expect(confirmReturnOutcome(okHandoff, item, "unowned").notice.text).toBe(base);
  });
  it.each(["handoff_not_pending", "not_found"])("%s is gone and refreshes", (code) => {
    expect(confirmReturnOutcome(fail(code), item, "all")).toEqual({
      refresh: true,
      notice: { tone: "status", text: devicesCopy.giveBack.gone },
    });
  });
  it.each(["unauthenticated", "forbidden", "unavailable"])("%s does not refresh", (code) => {
    expect(confirmReturnOutcome(fail(code), item, "all")).toEqual({
      refresh: false,
      notice: { tone: "error", text: apiErrorMessage(code) },
    });
  });
  it("placement_changed is an error and refreshes", () => {
    expect(confirmReturnOutcome(fail("placement_changed"), item, "all")).toEqual({
      refresh: true,
      notice: { tone: "error", text: apiErrorMessage("placement_changed") },
    });
  });
});

describe("settleTakeBack", () => {
  it("ok and not_found are done", () => {
    expect(settleTakeBack(okDevice)).toEqual({ kind: "done" });
    expect(settleTakeBack(fail("not_found"))).toEqual({ kind: "done" });
  });
  it.each(["handoff_pending", "placement_changed", "not_allowed"])(
    "%s is a stale error",
    (code) => {
      expect(settleTakeBack(fail(code))).toEqual({
        kind: "error",
        message: apiErrorMessage(code),
        stale: true,
      });
    },
  );
  it("device_unowned uses takeBack.errors.alreadyUnowned and is stale", () => {
    expect(settleTakeBack(fail("device_unowned"))).toEqual({
      kind: "error",
      message: devicesCopy.takeBack.errors.alreadyUnowned,
      stale: true,
    });
  });
  it("unavailable is not stale", () => {
    expect(settleTakeBack(fail("unavailable"))).toMatchObject({ kind: "error", stale: false });
  });
});

describe("takeBackDone", () => {
  it("names the device and inventory number; the hint only under placed", () => {
    const d = { name: "Máy trạm", inventoryNumber: "INV-1" };
    const text = devicesCopy.takeBack.done("Máy trạm", "INV-1");
    expect(text).toContain("Máy trạm");
    expect(text).toContain("INV-1");
    expect(takeBackDone(d, "all")).toBe(text);
    expect(takeBackDone(d, "placed")).toBe(`${text} ${devicesCopy.returns.filterHint}`);
  });
});

describe("takeBackBody", () => {
  it("owner, seat or null, and whether a transfer is cancelled", () => {
    const d = {
      owner: { id: "m", displayName: "Hà" },
      placement: { seatCode: "A-01" },
      pendingHandoff: { kind: "transfer" },
    } as DeviceDto;
    expect(takeBackBody(d)).toEqual({ owner: "Hà", seat: "A-01", cancelsTransfer: true });
    expect(takeBackBody({ ...d, placement: null, pendingHandoff: null })).toEqual({
      owner: "Hà",
      seat: null,
      cancelsTransfer: false,
    });
  });
});
