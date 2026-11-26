import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CREDITS } from "./credits";

const rows = (() => {
  const text = readFileSync("assets/art/CREDITS.md", "utf8");
  const end = text.indexOf("Rejected");
  return text
    .slice(0, end)
    .split("\n")
    .filter((l) => l.startsWith("|"))
    .slice(2) // header and separator
    .map((l) =>
      l
        .split(/(?<!\\)\|/)
        .slice(1, -1)
        .map((c) => c.trim()),
    );
})();

describe("CREDITS", () => {
  it("every CREDITS.md table row has an entry with the same pack, author, URL and verbatim attribution, and the reverse", () => {
    expect(rows.length).toBeGreaterThan(0);
    expect(CREDITS.length).toBe(rows.length);
    for (const r of rows) {
      const e = CREDITS.find((c) => c.pack === r[0]);
      expect(e, r[0]).toBeDefined();
      expect(e!.author).toBe(r[1]);
      expect(e!.url).toBe(r[2]);
      expect(e!.attribution).toBe(r[6]);
    }
  });

  it("Imersa entry has the exact attribution string; URLs are https; no field empty; comshadow not listed", () => {
    const imersa = CREDITS.find((c) => c.author === "Imersa Studios");
    expect(imersa?.attribution).toBe(
      "Office Pixel Art by Imersa Studios (https://imersastudios.itch.io/office-pixel-art)",
    );
    for (const c of CREDITS) {
      expect(c.url.startsWith("https://")).toBe(true);
      for (const v of Object.values(c)) expect(v.trim()).not.toBe("");
    }
    expect(JSON.stringify(CREDITS).toLowerCase()).not.toContain("comshadow");
  });
});
