import { describe, expect, it } from "vitest";
import { isCanonicalUuid } from "./uuid";

describe("isCanonicalUuid", () => {
  it("accepts canonical lowercase v4/v7 UUIDs", () => {
    expect(isCanonicalUuid("11111111-1111-4111-8111-111111111111")).toBe(true);
    expect(isCanonicalUuid("0190a5e8-7c3a-7b2e-9d4f-1a2b3c4d5e6f")).toBe(true);
  });

  it("rejects uppercase, padded, nil, braces, no dashes, non-strings", () => {
    const bad: unknown[] = [
      "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA",
      " 11111111-1111-4111-8111-111111111111",
      "11111111-1111-4111-8111-111111111111\n",
      "00000000-0000-0000-0000-000000000000",
      "{11111111-1111-4111-8111-111111111111}",
      "11111111111141118111111111111111",
      "",
      7,
      null,
      undefined,
      ["11111111-1111-4111-8111-111111111111"],
    ];
    for (const v of bad) expect(isCanonicalUuid(v)).toBe(false);
  });
});
