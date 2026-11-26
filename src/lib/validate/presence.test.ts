import { describe, expect, it } from "vitest";
import { validateCheckIn, validateMove } from "./presence";

const id = "5b0c9a4e-1f3d-4c6a-9d2e-7a8b1c2d3e4f";

describe("presence validators", () => {
  it("accept the single uuid key", () => {
    expect(validateCheckIn({ roomId: id })).toEqual({ ok: true, value: { roomId: id } });
    expect(validateMove({ seatId: id })).toEqual({ ok: true, value: { seatId: id } });
  });
  it("refuse non-uuid, missing, non-object and array", () => {
    expect(validateCheckIn({ roomId: "x" }).ok).toBe(false);
    expect(validateCheckIn({}).ok).toBe(false);
    expect(validateMove({ roomId: id }).ok).toBe(false);
    expect(validateCheckIn(null).ok).toBe(false);
    expect(validateCheckIn("x").ok).toBe(false);
    expect(validateMove([id]).ok).toBe(false);
  });
  it("a time or any extra key is refused", () => {
    expect(validateCheckIn({ roomId: id, checkedInAt: "2026-01-01T00:00:00Z" })).toEqual({
      ok: false,
      field: "checkedInAt",
    });
    expect(validateMove({ seatId: id, x: 1 }).ok).toBe(false);
  });
});
