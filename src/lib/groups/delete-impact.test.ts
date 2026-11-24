import { describe, expect, it } from "vitest";
import { decideDelete, isInUse } from "./delete-impact";

describe("decideDelete", () => {
  it("unused -> delete, with or without force", () => {
    expect(decideDelete({ seats: 0, members: 0 }, false)).toBe("delete");
    expect(decideDelete({ seats: 0 }, true)).toBe("delete");
  });
  it("used without force -> refuse_in_use (seats only, members only, both)", () => {
    expect(decideDelete({ seats: 2, members: 0 }, false)).toBe("refuse_in_use");
    expect(decideDelete({ seats: 0, members: 1 }, false)).toBe("refuse_in_use");
    expect(decideDelete({ seats: 1, members: 1 }, false)).toBe("refuse_in_use");
    expect(decideDelete({ seats: 3 }, false)).toBe("refuse_in_use");
  });
  it("used with force -> clear_and_delete", () => {
    expect(decideDelete({ seats: 2, members: 0 }, true)).toBe("clear_and_delete");
    expect(decideDelete({ seats: 0, members: 4 }, true)).toBe("clear_and_delete");
    expect(decideDelete({ seats: 1 }, true)).toBe("clear_and_delete");
  });
  it("isInUse", () => {
    expect(isInUse({ seats: 0, members: 0 })).toBe(false);
    expect(isInUse({ seats: 0, members: 1 })).toBe(true);
  });
});
