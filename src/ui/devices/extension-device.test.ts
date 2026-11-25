import { describe, expect, it } from "vitest";
import type { HandoffDto } from "@/lib/devices/types";
import { apiErrorMessage } from "../copy/api";
import { devicesCopy } from "../copy/devices";
import { approveExtensionOutcome, rejectExtensionOutcome } from "./extension-device";

const item = {
  device: { id: "d1", name: "Máy trạm", type: "PC", inventoryNumber: "INV-1", expiresOn: null },
  newExpiresOn: "2026-12-25",
} satisfies Pick<HandoffDto, "device" | "newExpiresOn">;
const ok = { ok: true as const, value: {} as HandoffDto };
const err = (code: string) => ({ ok: false as const, code });

describe("approveExtensionOutcome", () => {
  it("ok: status notice with name, inventory number and the new date; refresh", () => {
    const out = approveExtensionOutcome(ok, item);
    expect(out.refresh).toBe(true);
    expect(out.notice.tone).toBe("status");
    expect(out.notice.text).toBe(
      devicesCopy.extensions.approved("Máy trạm", "INV-1", "2026-12-25"),
    );
    expect(out.notice.text).toContain("2026-12-25");
  });
  it("handoff_not_pending and not_found: extension 'gone' wording, refresh", () => {
    for (const code of ["handoff_not_pending", "not_found"]) {
      expect(approveExtensionOutcome(err(code), item)).toEqual({
        refresh: true,
        notice: { tone: "status", text: devicesCopy.extend.gone },
      });
    }
  });
  it("not_allowed and unknown codes: error notice", () => {
    expect(approveExtensionOutcome(err("not_allowed"), item).notice).toEqual({
      tone: "error",
      text: apiErrorMessage("not_allowed"),
    });
    expect(approveExtensionOutcome(err("whatever"), item).notice.tone).toBe("error");
  });
});

describe("rejectExtensionOutcome", () => {
  it("ok: status notice with name and inventory number; refresh", () => {
    expect(rejectExtensionOutcome(ok, item)).toEqual({
      refresh: true,
      notice: { tone: "status", text: devicesCopy.extensions.rejected("Máy trạm", "INV-1") },
    });
  });
  it("handoff_not_pending: 'gone' wording; not_allowed: error notice", () => {
    expect(rejectExtensionOutcome(err("handoff_not_pending"), item).notice.text).toBe(
      devicesCopy.extend.gone,
    );
    expect(rejectExtensionOutcome(err("not_allowed"), item).notice.tone).toBe("error");
  });
});
