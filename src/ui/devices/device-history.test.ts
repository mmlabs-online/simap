import { describe, expect, it } from "vitest";
import { DEVICE_HISTORY_KINDS, type DeviceHistoryEntryDto } from "@/lib/devices/types";
import { devicesCopy } from "../copy/devices";
import {
  historyCause,
  historyExpiryText,
  historyFromTo,
  historyKindLabel,
  historyMemberLabel,
} from "./device-history";

const a = { id: "a", displayName: "Nguyễn Văn Ánh" };
const b = { id: "b", displayName: "Bea" };
const e = (p: Partial<DeviceHistoryEntryDto>): DeviceHistoryEntryDto => ({
  id: "1",
  kind: "transfer_start",
  at: "2026-03-05T17:30:00.000000Z",
  actor: null,
  from: null,
  to: null,
  note: null,
  expiresOn: null,
  fromExpiresOn: null,
  confirmedBy: null,
  cause: null,
  ...p,
});

describe("device history helpers", () => {
  it("kind labels exist for every DeviceHistoryKind; fromTo uses org inventory for null; unknown member label; expiry text", () => {
    for (const k of DEVICE_HISTORY_KINDS) expect(historyKindLabel(k).length).toBeGreaterThan(0);
    const unknown = devicesCopy.history.unknownMember;
    expect(historyMemberLabel(null)).toBe(unknown);
    expect(historyMemberLabel(a)).toBe("Nguyễn Văn Ánh");
    expect(historyFromTo(e({ kind: "assign", to: a }))).toBe("Org inventory → Nguyễn Văn Ánh");
    expect(historyFromTo(e({ kind: "return_confirm", from: a }))).toBe(
      "Nguyễn Văn Ánh → Org inventory",
    );
    expect(historyFromTo(e({ kind: "transfer_start", from: a, to: b }))).toBe(
      "Nguyễn Văn Ánh → Bea",
    );
    expect(historyFromTo(e({ kind: "transfer_start", from: a }))).toBe(
      `Nguyễn Văn Ánh → ${unknown}`,
    );
    expect(historyFromTo(e({ kind: "create" }))).toBeNull();
    expect(historyFromTo(e({ kind: "extension_start", from: a }))).toBe("Nguyễn Văn Ánh");
    expect(historyFromTo(e({ kind: "holding_update", to: b }))).toBe("Bea");
    expect(historyExpiryText(e({}))).toBeNull();
    expect(historyExpiryText(e({ expiresOn: "2026-12-31" }))).toBe("Expires 2026-12-31");
    expect(historyExpiryText(e({ expiresOn: "2026-02-02", fromExpiresOn: "2026-01-01" }))).toBe(
      "Expiry 2026-01-01 → 2026-02-02",
    );
    expect(historyExpiryText(e({ fromExpiresOn: "2026-01-01" }))).toBe(
      "Expiry 2026-01-01 → no expiry",
    );
  });

  it("cause text", () => {
    expect(historyCause(e({}))).toBeNull();
    expect(historyCause(e({ cause: "deactivation" }))).toBe(
      devicesCopy.history.causes.deactivation,
    );
  });
});
