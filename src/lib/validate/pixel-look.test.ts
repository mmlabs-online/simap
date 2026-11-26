import { describe, expect, it } from "vitest";
import { validatePixelLook } from "./pixel-look";

const OK = { skin: 3, hair: 5, style: 3, shirt: 6 };

describe("validatePixelLook", () => {
  it("a valid body is ok with the same values", () => {
    expect(validatePixelLook(OK)).toEqual({ ok: true, value: OK });
    expect(validatePixelLook({ skin: 0, hair: 0, style: 1, shirt: 0 }).ok).toBe(true);
  });

  it("a non-object has field body", () => {
    for (const v of [null, undefined, [], "x", 3]) {
      expect(validatePixelLook(v)).toEqual({ ok: false, field: "body" });
    }
  });

  it("a bad value names its key; a missing key names that key; an extra key names the extra", () => {
    expect(validatePixelLook({ ...OK, skin: 4 })).toEqual({ ok: false, field: "skin" });
    expect(validatePixelLook({ ...OK, hair: 1.5 })).toEqual({ ok: false, field: "hair" });
    expect(validatePixelLook({ ...OK, style: 0 })).toEqual({ ok: false, field: "style" });
    expect(validatePixelLook({ ...OK, shirt: "2" })).toEqual({ ok: false, field: "shirt" });
    expect(validatePixelLook({ skin: 0, hair: 0, style: 1 })).toEqual({
      ok: false,
      field: "shirt",
    });
    expect(validatePixelLook({ ...OK, color: "#fff" })).toEqual({ ok: false, field: "color" });
    expect(validatePixelLook({})).toEqual({ ok: false, field: "skin" });
  });
});
