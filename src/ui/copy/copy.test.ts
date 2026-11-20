import { describe, expect, it } from "vitest";
import { TIERS } from "@/lib/tier";
import { navItemsFor } from "@/lib/nav";
import { shellCopy } from "./shell";

const modules = import.meta.glob<Record<string, unknown>>(["./*.ts", "!./*.test.ts"], {
  eager: true,
});
const copies = Object.values(modules).flatMap((mod) => Object.values(mod));

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

describe("copy", () => {
  it('every copy string is NFC, non-empty, no U+FFFD or "??"', () => {
    const all = copies.flatMap(strings);
    expect(all.length).toBeGreaterThan(20);
    for (const s of all) {
      expect(s.trim()).not.toBe("");
      expect(s).toBe(s.normalize("NFC"));
      expect(s).not.toContain("�");
      expect(s).not.toContain("??");
    }
  });
  it("labels cover every NavId and Tier", () => {
    for (const item of navItemsFor("admin")) expect(shellCopy.nav[item.id]).toBeTruthy();
    for (const t of TIERS) expect(shellCopy.tiers[t]).toBeTruthy();
  });
});
