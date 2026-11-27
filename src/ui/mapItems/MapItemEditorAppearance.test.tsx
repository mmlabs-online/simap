import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MapItemDto } from "@/lib/map-items/types";
import type { Direction } from "@/lib/sprites/types";
import { mapItemsCopy } from "../copy/mapItems";
import { MapItemEditorAppearance, type AppearanceProps } from "./MapItemEditorAppearance";
import { initEditor, type EditorState } from "./map-item-editor";
import type { Atlas } from "../roomlayout/loadAtlas";
import { dto } from "./test-items";

const noop = () => {};
const copy = mapItemsCopy.art;
const ed = mapItemsCopy.editor;
const render = (
  item: MapItemDto = dto("desk.single"),
  over: Partial<EditorState> = {},
  p: Partial<AppearanceProps> = {},
) =>
  renderToStaticMarkup(
    <MapItemEditorAppearance
      item={item}
      state={{ ...initEditor(item), ...over }}
      busy={false}
      imageUrl={() => null}
      onDir={noop}
      onSource={noop}
      onPick={noop}
      onQuery={noop}
      onAllTypes={noop}
      onUpload={noop}
      onRestore={noop}
      {...p}
    />,
  );
const withArt = (key: string, dir: Direction, sprite: string | null, hasImage: boolean) => {
  const d = dto(key);
  return { ...d, art: { ...d.art, [dir]: { sprite, hasImage, imageVersion: 1 } } };
};
const count = (html: string, text: string) => html.split(text).length - 1;
const frame = { x: 0, y: 0, w: 32, h: 32, anchor: [0, 0], tiles: [1, 1], blocks: false };
const atlas = (keys: string[]) =>
  ({
    manifest: { frames: Object.fromEntries(keys.map((k) => [k, frame])) },
    image: {},
  }) as unknown as Atlas;
const radios = (html: string, label: string) => {
  const group = html.split(`aria-label="${label}"`)[1]!.split("</div>")[0]!;
  return [
    ...group.matchAll(
      /<button[^>]*role="radio"[^>]*aria-checked="(true|false)"[^>]*>([^]*?)<\/button>/g,
    ),
  ].map((m) => ({
    checked: m[1] === "true",
    text: m[2]!
      .replace(/<[^>]*>/g, "")
      .replace(/^✓ /, "")
      .trim(),
  }));
};

describe("MapItemEditorAppearance", () => {
  it("directional item: radiogroup North, East, South, West with North checked, and Never auto-rotated", () => {
    const html = render();
    expect(radios(html, ed.dirsLabel)).toEqual([
      { checked: true, text: "North" },
      { checked: false, text: "East" },
      { checked: false, text: "South" },
      { checked: false, text: "West" },
    ]);
    expect(html).toContain(ed.neverRotated);
  });

  it("an n/s item has North and South only; a non-directional item has no direction group and says Same image in every direction", () => {
    expect(radios(render(dto("clock.wall")), ed.dirsLabel).map((r) => r.text)).toEqual([
      "North",
      "South",
    ]);
    const single = render(dto("plant.large"));
    expect(single).not.toContain(`aria-label="${ed.dirsLabel}"`);
    expect(single).toContain("Same image in every direction");
    expect(single).not.toContain(ed.neverRotated);
  });

  it("preview: two canvases for library or sprite with an atlas; two pixelated imgs (w×1, w×2) for an image URL; Preview not available without URL", () => {
    const plant = dto("plant.large");
    const previews = (html: string) => [
      count(html, "plant.large at 1×"),
      count(html, "plant.large at 2×"),
    ];
    expect(
      previews(render(plant, { source: "upload" }, { atlas: atlas(["plant.large"]) })),
    ).toEqual([1, 1]);
    const sprite = withArt("plant.large", "s", "plant.large", false);
    expect(
      previews(render(sprite, { source: "upload" }, { atlas: atlas(["plant.large"]) })),
    ).toEqual([1, 1]);
    const img = withArt("plant.large", "s", null, true);
    const html = render(img, {}, { imageUrl: () => "blob:x" });
    expect(count(html, "<img")).toBe(2);
    expect(html).toContain("image-rendering:pixelated");
    expect(html).toContain("width:32px");
    expect(html).toContain("width:64px");
    expect(render(img)).toContain(copy.previewNA);
    expect(render(plant, {}, { atlas: atlas([]) })).toContain(copy.previewNA);
    expect(render(plant, { source: "upload" })).not.toContain("<canvas");
  });

  it("the preview shows the staged art and its source label", () => {
    const lib = render(dto("plant.large"));
    expect(lib).toContain(copy.source.library);
    const staged = render(dto("plant.large"), {
      art: { s: { kind: "sprite", key: "plant.large" } },
    });
    expect(staged).toContain(copy.source.sprite("plant.large"));
    const image = render(dto("plant.large"), {
      art: {
        s: {
          kind: "image",
          bytes: new Uint8Array(1),
          url: "blob:staged",
          px: { width: 32, height: 32 },
        },
      },
    });
    expect(image).toContain(copy.source.image);
    expect(image).toContain('src="blob:staged"');
    expect(image).toContain('aria-hidden="true"');
    expect(image).toContain(ed.previewCaption("South"));
  });

  it("a pending resize with a saved image shows the removed-on-save note; none otherwise", () => {
    const item = withArt("table.meeting", "n", null, true);
    const state = initEditor(item);
    const resized = render(item, { form: { ...state.form, w: 2 } });
    expect(resized).toContain(ed.removedOnSave);
    expect(render(item)).not.toContain(ed.removedOnSave);
  });

  it("Sprite library shows the browser; Upload image shows the size rule and the PNG file input", () => {
    const lib = render();
    expect(radios(lib, ed.sourceLabel)).toEqual([
      { checked: true, text: ed.sourceLibrary },
      { checked: false, text: ed.sourceUpload },
    ]);
    expect(lib).toContain('role="radiogroup" aria-label="Package sprites for North"');
    expect(lib).not.toContain('type="file"');
    const up = render(dto("desk.single"), { source: "upload" });
    expect(up).toContain('accept="image/png"');
    expect(up).toContain(copy.size(64, 32, 64));
    expect(up).not.toContain("Package sprites for");
  });

  it("shows Only updates the north view and Restore default (disabled when the effective art is library and nothing is staged)", () => {
    const html = render();
    expect(html).toContain(ed.onlyUpdates("North"));
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Restore default/);
    const sprite = withArt("desk.single", "n", "desk.single.n", false);
    expect(render(sprite)).not.toMatch(/<button[^>]*disabled=""[^>]*>Restore default/);
    const staged = render(dto("desk.single"), {
      art: { n: { kind: "sprite", key: "desk.single.n" } },
    });
    expect(staged).not.toMatch(/<button[^>]*disabled=""[^>]*>Restore default/);
  });

  it("a direction note is role=alert; busy disables directions, switch, tiles, upload and restore; the atlas-failed note shows", () => {
    expect(count(render(dto("desk.single"), { dirNotes: { n: "Too big" } }), 'role="alert"')).toBe(
      1,
    );
    expect(render(dto("desk.single"), { dirNotes: { n: "Too big" } })).toContain("Too big");
    const busy = render(withArt("desk.single", "n", "desk.single.n", false), {}, { busy: true });
    const buttons = busy.match(/<button[^>]*>/g)!;
    expect(buttons.every((b) => b.includes('disabled=""'))).toBe(true);
    expect(busy.match(/type="radio"[^>]*>/g)!.every((r) => r.includes('disabled=""'))).toBe(true);
    const upload = render(dto("desk.single"), { source: "upload" }, { busy: true });
    expect(upload).toMatch(
      /<input[^>]*type="file"[^>]*disabled=""|<input[^>]*disabled=""[^>]*type="file"/,
    );
    const failed = render(dto("desk.single"), {}, { atlasFailed: true });
    expect(failed).toContain(copy.atlasFailed);
    expect(failed).not.toContain("<canvas");
  });

  it("a staged direction carries a changed marker", () => {
    const html = render(dto("desk.single"), { art: { e: { kind: "library" } } });
    expect(count(html, `> ${ed.changed}<`)).toBe(1);
  });
});
