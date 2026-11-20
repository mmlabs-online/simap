import { describe, expect, it } from "vitest";
import { TIERS } from "@/lib/tier";
import { navItemsFor } from "@/lib/nav";
import { kitCopy } from "./kit";
import { shellCopy } from "./shell";

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

describe("copy", () => {
  it('every copy string is NFC, non-empty, no U+FFFD or "?"', () => {
    const all = [...strings(shellCopy), ...strings(kitCopy)];
    expect(all.length).toBeGreaterThan(20);
    for (const s of all) {
      expect(s.trim()).not.toBe("");
      expect(s).toBe(s.normalize("NFC"));
      expect(s).not.toContain("�");
      expect(s).not.toContain("?");
    }
  });
  it("labels cover every NavId and Tier", () => {
    for (const item of navItemsFor("admin")) expect(shellCopy.nav[item.id]).toBeTruthy();
    for (const t of TIERS) expect(shellCopy.tiers[t]).toBeTruthy();
  });
});
