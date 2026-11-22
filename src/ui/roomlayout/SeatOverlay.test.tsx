import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { RoomLayout, SeatView } from "@/lib/sprites/layout";
import { buildDrawList } from "@/lib/sprites/placement";
import type { SpriteManifest } from "@/lib/sprites/types";
import { SeatOverlay } from "./SeatOverlay";

const manifest = JSON.parse(
  readFileSync(new URL("../../../public/sprites/office.json", import.meta.url), "utf8"),
) as SpriteManifest;

const seat = (id: string, code: string, x: number, y: number) => ({
  id,
  code,
  sprite: "desk.single",
  x,
  y,
  rotation: 0 as const,
});
const layout: RoomLayout = {
  w: 12,
  h: 8,
  floors: [],
  fixtures: [],
  seats: [seat("c", "B2", 6, 4), seat("a", "A1", 2, 1), seat("b", "A2", 6, 1)],
};
const views: Record<string, SeatView> = {
  a: { state: "occupied", avatarSeed: "u", name: "Nguyễn Thị Ánh" },
  b: { state: "mine", avatarSeed: "v", name: "Lee" },
};
const render = (m: SpriteManifest = manifest, zoom = 3) =>
  renderToStaticMarkup(
    <SeatOverlay list={buildDrawList(layout, views, m)} views={views} zoom={zoom} />,
  );

describe("SeatOverlay", () => {
  it("one button per seat in row, column order", () => {
    const labels = [...render().matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]);
    expect(labels).toHaveLength(3);
    expect(labels.map((l) => l.split(",")[0])).toEqual(["Seat A1", "Seat A2", "Seat B2"]);
  });

  it("tag is hidden at rest and shown only by group-hover or group-focus-visible", () => {
    const tag = /<span aria-hidden="true" class="([^"]*)"/.exec(render())?.[1] ?? "";
    expect(tag.split(" ")).toEqual(
      expect.arrayContaining(["hidden", "group-hover:flex", "group-focus-visible:flex"]),
    );
    expect(tag).not.toMatch(/(^| )flex( |$)/);
    expect(render()).not.toContain("group-focus:");
  });

  it("tag is aria-hidden and not focusable", () => {
    const html = render();
    expect((html.match(/<button/g) ?? []).length).toBe(3);
    expect(html).not.toContain("tabindex");
    expect(html).toContain('<span aria-hidden="true"');
  });

  it("aria-label carries code, state and name, with Vietnamese diacritics intact", () => {
    const html = render();
    expect(html).toContain('aria-label="Seat A1, occupied, Nguyễn Thị Ánh"');
    expect(html).toContain('aria-label="Seat A2, your seat, Lee"');
    expect(html).toContain('aria-label="Seat B2, empty"');
  });

  it("overlay position includes the bounds offset", () => {
    const m = structuredClone(manifest);
    m.frames["desk.single.s"].anchor = [0, -48];
    // Desk A1 is at tile (2, 1). Without the overhang, bounds start at y = 0 and top = 32 * 3.
    expect(render(manifest, 3)).toContain("top:96px");
    // The desk art now starts 16 px above the room, so bounds.y = -16 and top = (32 + 16) * 3.
    const html = render(m, 3);
    expect(html).toContain("left:192px");
    expect(html).toContain("top:144px");
  });
});
