import { describe, expect, it } from "vitest";
import { safeReturnTo } from "./return-to";

describe("safeReturnTo", () => {
  it("keeps same-origin paths", () => {
    expect(safeReturnTo("/rooms")).toBe("/rooms");
    expect(safeReturnTo("/rooms/A1?tab=x")).toBe("/rooms/A1?tab=x");
  });

  it("rejects other origins, schemes, backslashes and control characters", () => {
    for (const bad of [
      "//evil.com",
      "/\\evil.com",
      "https://evil.com",
      "javascript:x",
      "rooms",
      "/a\nb",
    ]) {
      expect(safeReturnTo(bad), bad).toBe("/");
    }
  });

  it("rejects non-strings, empty and over-long values", () => {
    expect(safeReturnTo("")).toBe("/");
    expect(safeReturnTo(undefined)).toBe("/");
    expect(safeReturnTo(["/rooms", "/devices"])).toBe("/");
    expect(safeReturnTo(`/${"a".repeat(2048)}`)).toBe("/");
  });

  it("does not loop back to the sign-in page", () => {
    expect(safeReturnTo("/sign-in")).toBe("/");
    expect(safeReturnTo("/sign-in?returnTo=/rooms")).toBe("/");
    expect(safeReturnTo("/sign-in/x")).toBe("/");
    expect(safeReturnTo("/sign-input")).toBe("/sign-input");
  });
});
