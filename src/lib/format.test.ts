import { describe, expect, it } from "vitest";
import { initials, waitText } from "./format";

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

describe("waitText", () => {
  it("uses seconds, minutes and hours, rounded up", () => {
    expect(waitText(1)).toBe("1 second");
    expect(waitText(30)).toBe("30 seconds");
    expect(waitText(59.2)).toBe("60 seconds");
    expect(waitText(60)).toBe("1 minute");
    expect(waitText(61)).toBe("2 minutes");
    expect(waitText(3600)).toBe("1 hour");
    expect(waitText(3601)).toBe("2 hours");
  });
  it("falls back for NaN, zero and negative", () => {
    for (const n of [NaN, 0, -5, Infinity]) expect(waitText(n)).toBe("a few minutes");
  });
});
