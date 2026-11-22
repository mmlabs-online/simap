import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { avatarFor } from "@/lib/sprites/avatar";
import { buildDrawList, resolveFrameKey } from "@/lib/sprites/placement";
import type { SpriteManifest } from "@/lib/sprites/types";
import { checkLayoutRules } from "@/lib/validate/layout";
import { DEMO_FIXTURE_MARKER, DEMO_LAYOUT, DEMO_VIEWS } from "./fixture";

const manifest = JSON.parse(
  readFileSync(new URL("../../../../public/sprites/office.json", import.meta.url), "utf8"),
) as SpriteManifest;

describe("demo fixture", () => {
  it("every sprite resolves in the committed manifest", () => {
    const placements = [...DEMO_LAYOUT.floors, ...DEMO_LAYOUT.fixtures, ...DEMO_LAYOUT.seats];
    for (const p of placements) {
      const key = resolveFrameKey(p.sprite, "rotation" in p ? p.rotation : 0);
      expect(key, p.sprite).not.toBeNull();
      expect(manifest.frames[key as string], p.sprite).toBeDefined();
    }
    expect(buildDrawList(DEMO_LAYOUT, DEMO_VIEWS, manifest).unknown).toEqual([]);
  });

  it("DEMO_LAYOUT passes the layout rules", () => {
    expect(checkLayoutRules(DEMO_LAYOUT)).toEqual({ ok: true });
  });

  it("covers every seat state", () => {
    expect(new Set(Object.values(DEMO_VIEWS).map((v) => v.state))).toEqual(
      new Set(["empty", "occupied", "mine", "pending", "cannot"]),
    );
    for (const s of DEMO_LAYOUT.seats) expect(DEMO_VIEWS[s.id], s.id).toBeDefined();
  });

  it("sample subs have pairwise different looks", () => {
    const looks = Object.values(DEMO_VIEWS).flatMap((v) =>
      v.avatarSeed ? [JSON.stringify(avatarFor(v.avatarSeed))] : [],
    );
    expect(looks.length).toBeGreaterThanOrEqual(3);
    expect(new Set(looks).size).toBe(looks.length);
  });

  it("contains no desk.pair seat", () => {
    expect(DEMO_LAYOUT.seats.some((s) => s.sprite.startsWith("desk.pair"))).toBe(false);
  });

  it("has a tall plant, a Vietnamese name and a prop on the top tile of a 1x2 desk", () => {
    expect(DEMO_LAYOUT.fixtures.some((f) => f.sprite === "plant.large")).toBe(true);
    expect(Object.values(DEMO_VIEWS).some((v) => v.name === "Nguyễn Thị Ánh")).toBe(true);
    const mug = DEMO_LAYOUT.fixtures.find((f) => f.sprite === "prop.mug");
    const desk = DEMO_LAYOUT.seats.find((s) => s.x === mug?.x && s.y === mug?.y);
    expect(desk?.rotation).toBe(90);
  });

  it("the marker is a stable, non-route string", () => {
    expect(DEMO_FIXTURE_MARKER).toBe("simap-roommap-fixture-9c41");
    expect(DEMO_FIXTURE_MARKER).not.toContain("/");
  });
});
