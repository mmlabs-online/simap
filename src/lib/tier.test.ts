import { describe, expect, it } from "vitest";
import { TIERS, atLeastTier } from "./tier";

describe("atLeastTier", () => {
  it("ranks admin > manager > user", () => {
    const expected: Record<string, boolean[]> = {
      user: [true, false, false],
      manager: [true, true, false],
      admin: [true, true, true],
    };
    for (const tier of TIERS) {
      expect(TIERS.map((min) => atLeastTier(tier, min))).toEqual(expected[tier]);
    }
  });
});
