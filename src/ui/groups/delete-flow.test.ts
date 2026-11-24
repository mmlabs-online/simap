import { describe, expect, it } from "vitest";
import { apiErrorMessage } from "../copy/api";
import { deleteStep, impactLines, removeOutcome } from "./delete-flow";

describe("deleteStep", () => {
  it("groups: plain when unused, forced for seats or members", () => {
    expect(deleteStep({ seats: 0, members: 0 })).toBe("plain");
    expect(deleteStep({ seats: 1, members: 0 })).toBe("forced");
    expect(deleteStep({ seats: 0, members: 2 })).toBe("forced");
  });
  it("projects: plain when unused, forced for seats", () => {
    expect(deleteStep({ seats: 0 })).toBe("plain");
    expect(deleteStep({ seats: 3 })).toBe("forced");
  });
});

describe("impactLines", () => {
  it("omits zero lines and pluralizes", () => {
    expect(impactLines({ seats: 1, members: 0 })).toEqual(["1 seat"]);
    expect(impactLines({ seats: 2, members: 1 })).toEqual(["2 seats", "1 member"]);
    expect(impactLines({ seats: 0, members: 3 })).toEqual(["3 members"]);
    expect(impactLines({ seats: 5 })).toEqual(["5 seats"]);
  });
});

describe("removeOutcome", () => {
  it("ok and not_found are done", () => {
    expect(removeOutcome({ ok: true, value: null })).toBe("done");
    expect(removeOutcome({ ok: false, code: "not_found" })).toBe("done");
  });
  it("in_use reloads the impact", () => {
    expect(removeOutcome({ ok: false, code: "in_use" })).toBe("reload");
  });
  it("other codes are an error message", () => {
    expect(removeOutcome({ ok: false, code: "forbidden" })).toEqual({
      error: apiErrorMessage("forbidden"),
    });
  });
});
