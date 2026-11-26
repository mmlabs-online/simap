// AC4 guard (POR-05, LAY-06): the room map never draws a member photo. Text scan, like no-literals.test.ts.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const PHOTO = /photo/i;
const AVATAR_IMPORT = /["'](?:@\/ui|\.\.?(?:\/\.\.)*)\/Avatar["']/;

const flags = (source: string): boolean => PHOTO.test(source) || AVATAR_IMPORT.test(source);

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

describe("no photo on the room map", () => {
  it("matcher flags samples ('/api/me/photo', 'hasPhoto', an Avatar import) and passes a clean sample", () => {
    expect(flags('fetch("/api/me/photo")')).toBe(true);
    expect(flags("if (m.hasPhoto) draw()")).toBe(true);
    expect(flags('import { Avatar } from "@/ui/Avatar";')).toBe(true);
    expect(flags('import { Avatar } from "../Avatar";')).toBe(true);
    expect(flags('import { drawAvatar } from "@/lib/sprites/avatar";')).toBe(false);
    expect(flags("const x = 1;")).toBe(false);
  });

  it("roomlayout and sprites never reference a photo or the Avatar", () => {
    const files = [
      ...walk(join(ROOT, "src/ui/roomlayout")),
      ...walk(join(ROOT, "src/lib/sprites")),
    ];
    expect(files.length).toBeGreaterThan(5);
    const offenders = files.filter((f) => flags(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
