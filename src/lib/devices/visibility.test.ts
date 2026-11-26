import { describe, expect, it } from "vitest";
import { deviceVisibility } from "./visibility";

describe("deviceVisibility", () => {
  it("user is held; manager and admin are org", () => {
    expect(deviceVisibility("user")).toBe("held");
    expect(deviceVisibility("manager")).toBe("org");
    expect(deviceVisibility("admin")).toBe("org");
  });
});
