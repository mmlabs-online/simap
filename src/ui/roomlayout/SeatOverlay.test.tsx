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
  a: { state: "occupied", avatarSeed: "u", name: "Nguyễn Thị Ánh", look: null },
  b: { state: "mine", avatarSeed: "v", name: "Lee", look: null },
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

  it("button keeps a visible hover and focus outline (no outline-none)", () => {
    const cls = /<button[^>]*class="([^"]*)"/.exec(render())?.[1].split(" ") ?? [];
    expect(cls).toContain("hover:outline-2");
    expect(cls).toContain("focus-visible:outline-2");
    expect(cls).not.toContain("outline-none");
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

  it("seat buttons are real buttons with data-map-seat and aria-haspopup=dialog, and no data-seat-code", () => {
    const html = render();
    expect(html).toContain('data-map-seat="A1"');
    expect((html.match(/aria-haspopup="dialog"/g) ?? []).length).toBe(3);
    expect(html).not.toContain("data-seat-code");
  });

  it("tag classes are the same at zoom 2, 3 and 4", () => {
    const classes = (zoom: number) =>
      (/<span aria-hidden="true" class="([^"]*)"/.exec(render(manifest, zoom))?.[1] ?? "")
        .split(" ")
        .filter((c) => !/^(left|right|top|bottom)/.test(c) && !/translate/.test(c))
        .sort();
    expect(classes(2)).toEqual(classes(3));
    expect(classes(3)).toEqual(classes(4));
    expect(classes(4)).toEqual(
      expect.arrayContaining(["hidden", "group-hover:flex", "group-focus-visible:flex"]),
    );
  });
});

describe("SeatOverlay presence view (D80, D77)", () => {
  const row: Record<string, SeatView> = {
    a: { state: "occupied", avatarSeed: "u", name: "Nguyễn Thị Ánh", look: null },
    b: { state: "mine", avatarSeed: "v", name: "Lee", look: null },
  };
  const renderAlways = (
    extra: Partial<Parameters<typeof SeatOverlay>[0]> = {},
    presence: Record<string, "present" | "away"> | null = { a: "away", b: "present" },
  ) =>
    renderToStaticMarkup(
      <SeatOverlay
        list={buildDrawList(layout, row, manifest)}
        views={row}
        zoom={3}
        tags="always"
        presence={presence ?? undefined}
        {...extra}
      />,
    );
  const visibleTags = (html: string) =>
    [...html.matchAll(/<span aria-hidden="true"( data-presence="[^"]*")? class="([^"]*)"/g)]
      .map((m) => m[2])
      .filter((c) => !c.includes("hidden"));

  it("default mode (no tags prop): no always-visible tag, no open tag (D50)", () => {
    const html = render();
    expect(visibleTags(html)).toEqual([]);
    expect(html).not.toContain("data-open-tag");
    expect(html).not.toContain("data-presence");
  });

  it("always mode: one visible tag per occupied seat, aria-hidden and pointer-events-none; empty seats keep only the hover tag", () => {
    const html = renderAlways();
    const tags = visibleTags(html);
    expect(tags).toHaveLength(2);
    for (const c of tags) expect(c).toContain("pointer-events-none");
    expect((html.match(/<span aria-hidden="true"/g) ?? []).length).toBe(5);
    expect(html).toContain("Nguyễn Thị Ánh");
  });

  it("always mode: away tag has data-presence=away, the ring marker and the grey style; present has the filled dot; labels end here/away", () => {
    const html = renderAlways();
    const away =
      /<span aria-hidden="true" data-presence="away" class="([^"]*)"[^>]*><span data-marker="ring"/.exec(
        html,
      );
    expect(away?.[1]).toContain("bg-surface-container-high");
    expect(html).toMatch(/data-presence="present"[^>]*><span data-marker="dot"/);
    expect(html).toContain('aria-label="Seat A1, occupied, Nguyễn Thị Ánh, away"');
    expect(html).toContain('aria-label="Seat A2, your seat, Lee, here"');
    expect(html).toContain('aria-label="Seat B2, empty"');
  });

  it("always mode: the hover and focus tag holds the code and the full name without truncate", () => {
    const hover = [
      ...renderAlways().matchAll(
        /<span aria-hidden="true" class="([^"]*)"[^>]*>(.*?)<\/span><\/button>/g,
      ),
    ];
    expect(hover.length).toBe(3);
    for (const m of hover) {
      expect(m[1]).toContain("group-hover:flex");
      expect(m[1]).not.toContain("max-w-40");
      expect(m[0]).not.toContain("truncate");
    }
  });

  it("open tags: one real button per open seat, a sibling of the seat buttons, disabled while busy", () => {
    const html = renderAlways({ openTags: ["c"], onOpenTag: () => {} });
    expect(html).toMatch(/<button[^>]*data-open-tag="B2"[^>]*aria-label="Move here, seat B2"/);
    expect((html.match(/<button/g) ?? []).length).toBe(4);
    expect(html).not.toMatch(/<button(?:(?!<\/button>)[\s\S])*<button/);
    expect(html).not.toMatch(/data-open-tag="B2"[^>]*disabled=""/);
    expect(renderAlways({ openTags: ["c"], openTagsBusy: true })).toMatch(
      /data-open-tag="B2"[^>]*disabled=""/,
    );
  });

  it("before the first presence answer the tags show without a present/away split", () => {
    const html = renderAlways({}, null);
    expect(html).not.toContain("data-presence");
    expect(html).not.toContain('data-marker="dot"');
    expect(html).not.toContain('data-marker="ring"');
    expect(html).not.toContain("bg-emerald-400");
    expect(visibleTags(html)).toHaveLength(2);
  });
});
