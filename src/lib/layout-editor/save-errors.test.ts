import { describe, expect, it } from "vitest";
import { saveErrorKind } from "./save-errors";

describe("saveErrorKind", () => {
  it("layout_stale and layout_seats_changed are conflict", () => {
    expect(saveErrorKind("layout_stale")).toBe("conflict");
    expect(saveErrorKind("layout_seats_changed")).toBe("conflict");
  });

  it("unauthenticated, forbidden, member_deactivated, org_required are access; not_found is gone", () => {
    for (const c of ["unauthenticated", "forbidden", "member_deactivated", "org_required"]) {
      expect(saveErrorKind(c)).toBe("access");
    }
    expect(saveErrorKind("not_found")).toBe("gone");
  });

  it("rule codes and invalid_request are invalid; unavailable, internal and unknown codes are retry", () => {
    for (const c of [
      "layout_out_of_bounds",
      "layout_overlap",
      "layout_bad_rotation",
      "layout_unknown_sprite",
      "layout_too_many_seats",
      "invalid_request",
    ]) {
      expect(saveErrorKind(c)).toBe("invalid");
    }
    for (const c of ["unavailable", "internal", "something_new"]) {
      expect(saveErrorKind(c)).toBe("retry");
    }
  });
});
