import { describe, expect, it } from "vitest";
import { allowedDirs, allowedRotations, nextRotation, rotationAllowed } from "./rotations";

const NS = ["clock.wall", "screen.projector"];
const FOUR = ["bin.trash", "chart.flip", "cooler.water", "lamp.desk"];

describe("rotations rule", () => {
  it("allowedRotations is 0/180 for clock.wall and screen.projector, all four for others", () => {
    for (const k of NS) expect(allowedRotations(k)).toEqual([0, 180]);
    for (const k of FOUR) expect(allowedRotations(k)).toEqual([0, 90, 180, 270]);
    expect(rotationAllowed("clock.wall", 90)).toBe(false);
    expect(rotationAllowed("clock.wall", 180)).toBe(true);
  });

  it("nextRotation toggles 0<->180 for n/s-only, cycles four for others", () => {
    for (const k of NS) {
      expect(nextRotation(k, 0)).toBe(180);
      expect(nextRotation(k, 180)).toBe(0);
    }
    expect([0, 90, 180, 270].map((r) => nextRotation("bin.trash", r as 0))).toEqual([
      90, 180, 270, 0,
    ]);
  });

  it("allowedDirs is n,s for the two keys, n,e,s,w otherwise", () => {
    for (const k of NS) expect(allowedDirs(k)).toEqual(["n", "s"]);
    for (const k of FOUR) expect(allowedDirs(k)).toEqual(["n", "e", "s", "w"]);
  });
});
