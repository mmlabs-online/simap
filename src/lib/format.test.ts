import { describe, expect, it } from "vitest";
import { initials } from "./format";

describe("initials", () => {
  it("uses the first and last name part", () => {
    expect(initials("Nguyễn Văn An")).toBe("NA");
    expect(initials("an.nguyen")).toBe("AN");
    expect(initials("đặng")).toBe("Đ");
    expect(initials("Lê (cũ)")).toBe("L");
  });
  it("normalises to NFC", () => {
    const nfd = "Nguyễn Văn An".normalize("NFD");
    expect(initials(nfd)).toBe("NA");
    expect(initials("ế".normalize("NFD"))).toBe("Ế".normalize("NFC"));
  });
  it("falls back to ?", () => {
    expect(initials("")).toBe("?");
    expect(initials("   ")).toBe("?");
  });
});
