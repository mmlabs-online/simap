import { describe, expect, it } from "vitest";
import type { HandoffDto } from "@/lib/devices/types";
import { apiErrorMessage } from "../copy/api";
import { devicesCopy } from "../copy/devices";
import { seatsCopy } from "../copy/seats";
import { cancelOutcome, settleTransfer, toTransferBody } from "./transfer-device";

const MEMBER = "6f1c2a52-8f3b-4d57-9c1e-2a7d5b8e9f10";
const copy = devicesCopy.transfer;
const handoff = { id: "h1" } as HandoffDto;
const ok = { ok: true as const, value: handoff };
const fail = (code: string) => ({ ok: false as const, code });

describe("toTransferBody", () => {
  it("no member is invalid with the picker message", () => {
    expect(toTransferBody({ note: "" }, null)).toEqual({
      kind: "invalid",
      message: seatsCopy.actions.pickerNone,
    });
  });
  it("builds the 037.3 body; a blank note is null", () => {
    expect(toTransferBody({ note: "hi" }, MEMBER)).toEqual({
      kind: "ok",
      body: { kind: "transfer", toMemberId: MEMBER, note: "hi" },
    });
    expect(toTransferBody({ note: " \r\n " }, MEMBER)).toMatchObject({ body: { note: null } });
  });
  it("normalizes CRLF and NFD to LF and NFC", () => {
    const r = toTransferBody({ note: "Chuyển máy\r\ncho Hương" }, MEMBER);
    expect(r).toMatchObject({ kind: "ok" });
    if (r.kind === "ok") {
      expect(r.body.note).toBe("Chuyển máy\ncho Hương");
      expect(r.body.note).toBe(r.body.note?.normalize("NFC"));
    }
  });
  it("limits the note to 500 code points", () => {
    expect(toTransferBody({ note: "a".repeat(500) }, MEMBER).kind).toBe("ok");
    expect(toTransferBody({ note: "a".repeat(501) }, MEMBER)).toEqual({
      kind: "invalid",
      message: devicesCopy.assign.errors.noteInvalid,
    });
  });
  it("a member id that is not a canonical uuid is invalid", () => {
    expect(toTransferBody({ note: "" }, "nope").kind).toBe("invalid");
  });
});

describe("settleTransfer", () => {
  it("ok and not_found are done", () => {
    expect(settleTransfer(ok)).toEqual({ kind: "done" });
    expect(settleTransfer(fail("not_found"))).toEqual({ kind: "done" });
  });
  it.each(["handoff_pending", "not_allowed", "device_unowned", "invalid_recipient"])(
    "%s shows the message and is stale",
    (code) => {
      expect(settleTransfer(fail(code))).toEqual({
        kind: "error",
        message: apiErrorMessage(code),
        stale: true,
        reloadMembers: false,
      });
    },
  );
  it("member_not_assignable reloads the picker, not the list", () => {
    expect(settleTransfer(fail("member_not_assignable"))).toMatchObject({
      stale: false,
      reloadMembers: true,
    });
  });
  it("invalid_request uses the transfer message", () => {
    expect(settleTransfer(fail("invalid_request"))).toMatchObject({ message: copy.errors.invalid });
  });
  it.each(["unavailable", "internal"])("%s is an error without stale or reload", (code) => {
    expect(settleTransfer(fail(code))).toMatchObject({
      kind: "error",
      stale: false,
      reloadMembers: false,
    });
  });
});

describe("cancelOutcome", () => {
  const device = { name: "Máy trạm", inventoryNumber: "INV-1" };
  it("ok shows the cancelled notice and refreshes", () => {
    expect(cancelOutcome(ok, device, "transfer")).toEqual({
      refresh: true,
      notice: { tone: "status", text: copy.cancelled("Máy trạm", "INV-1") },
    });
  });
  it.each(["handoff_not_pending", "not_found"])(
    "%s shows the gone notice and refreshes",
    (code) => {
      expect(cancelOutcome(fail(code), device, "transfer")).toEqual({
        refresh: true,
        notice: { tone: "status", text: copy.gone },
      });
    },
  );
  it("not_allowed is an error notice and refreshes", () => {
    expect(cancelOutcome(fail("not_allowed"), device, "transfer")).toEqual({
      refresh: true,
      notice: { tone: "error", text: apiErrorMessage("not_allowed") },
    });
  });
  it.each(["unauthenticated", "forbidden", "member_deactivated", "org_required", "unavailable"])(
    "%s is an error notice without a refresh",
    (code) => {
      expect(cancelOutcome(fail(code), device, "transfer")).toEqual({
        refresh: false,
        notice: { tone: "error", text: apiErrorMessage(code) },
      });
    },
  );
  it("return kind: its own cancelled and gone notices", () => {
    const r = devicesCopy.giveBack;
    expect(cancelOutcome(ok, device, "return")).toEqual({
      refresh: true,
      notice: { tone: "status", text: r.cancelled("Máy trạm", "INV-1") },
    });
    expect(cancelOutcome(fail("handoff_not_pending"), device, "return")).toEqual({
      refresh: true,
      notice: { tone: "status", text: r.gone },
    });
    expect(cancelOutcome(fail("not_allowed"), device, "return").notice.tone).toBe("error");
  });
});
