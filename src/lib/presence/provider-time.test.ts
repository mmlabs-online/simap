import { describe, expect, it } from "vitest";
import { providerCheckInAt } from "./provider-time";

// 2026-11-26 10:00 UTC = 17:00 on 2026-11-26 in UTC+7.
const NOW = new Date("2026-11-26T10:00:00.000Z");

describe("providerCheckInAt", () => {
  it("missing at -> now", () => {
    expect(providerCheckInAt(undefined, NOW)).toBe(NOW);
  });
  it("at earlier today (UTC+7) is kept, including 17:00Z of the previous UTC day", () => {
    expect(providerCheckInAt("2026-11-26T08:30:00Z", NOW)?.toISOString()).toBe(
      "2026-11-26T08:30:00.000Z",
    );
    expect(providerCheckInAt("2026-11-25T17:00:00Z", NOW)?.toISOString()).toBe(
      "2026-11-25T17:00:00.000Z",
    );
    expect(providerCheckInAt("2026-11-26T07:15:00+07:00", NOW)?.toISOString()).toBe(
      "2026-11-26T00:15:00.000Z",
    );
  });
  it("a previous UTC+7 date -> null; later than now on the same date -> now; tomorrow -> null", () => {
    expect(providerCheckInAt("2026-11-25T16:59:59Z", NOW)).toBeNull();
    expect(providerCheckInAt("2026-11-26T12:00:00Z", NOW)).toBe(NOW);
    expect(providerCheckInAt("2026-11-26T17:00:00Z", NOW)).toBeNull();
  });
  it("unparsable or offset-less string -> null", () => {
    for (const s of ["", "nope", "2026-11-26T08:00:00", "2026-13-40T00:00:00Z"]) {
      expect(providerCheckInAt(s, NOW)).toBeNull();
    }
  });
});
