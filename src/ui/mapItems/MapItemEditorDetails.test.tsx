import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { mapItemsCopy } from "../copy/mapItems";
import { MapItemEditorDetails, ResetMapItemBody, type DetailsProps } from "./MapItemEditorDetails";
import { formFromItem } from "./map-item-form";
import { dto } from "./test-items";

const noop = () => {};
const copy = mapItemsCopy.form;
const ed = mapItemsCopy.editor;
const render = (item: ReturnType<typeof dto>, p: Partial<DetailsProps> = {}) =>
  renderToStaticMarkup(
    <MapItemEditorDetails
      item={item}
      form={formFromItem(item)}
      groups={["table", "Cây"]}
      busy={false}
      dirty={false}
      confirmingReset={false}
      onChange={noop}
      onAskReset={noop}
      onKeepEditing={noop}
      onReset={noop}
      {...p}
    />,
  );

describe("MapItemEditorDetails", () => {
  it("tokens: legend is a 14 px label, checkboxes are 20 px, the reset confirm is pixel", () => {
    const html = render(dto("table.meeting"));
    const legend = /<legend[^>]*class="([^"]*)"/.exec(html)?.[1] ?? "";
    expect(legend).toContain("text-label");
    expect(legend).not.toContain("tracking-[");
    expect(html).toContain("size-5");
    const confirm = render(dto("table.meeting", { name: "Other" }), { confirmingReset: true });
    expect(confirm).toMatch(
      new RegExp(`<button[^>]*data-variant="pixel"[^>]*>${mapItemsCopy.reset.confirm}`),
    );
  });

  it("shows the key note, name and group limits, a group datalist, the palette checkbox and two size selects 1-4", () => {
    const html = render(dto("table.meeting"));
    expect(html).toContain("table.meeting");
    expect(html).toContain(copy.keyNote);
    expect(html).toContain('maxLength="60"');
    expect(html).toContain('maxLength="40"');
    expect(html).toContain("<datalist");
    expect(html).toContain('<option value="Cây"');
    expect(html).toContain("Show in item palette");
    expect(html.match(/<select/g)).toHaveLength(2);
    expect(html).toContain('<option value="4"');
    expect(html).not.toContain('<option value="5"');
    expect(html).toContain("3 × 2");
    expect(html).toContain(copy.rotationHint);
    expect(html).toContain(copy.inUseHint);
  });

  it("no rotation hint for a non-directional item", () => {
    expect(render(dto("elevator"))).not.toContain(copy.rotationHint);
  });

  it("fixed-size item: both selects disabled with its w and h, and the fixed footprint sentence", () => {
    const desk = render(dto("desk.single"));
    expect(desk.match(/<select[^>]*disabled=""/g)).toHaveLength(2);
    expect(desk).toContain('<option value="2" selected="">');
    expect(desk).toContain("2 × 1");
    expect(desk).toContain("This item uses a fixed footprint.");
    expect(desk).not.toContain(copy.inUseHint);
    expect(render(dto("table.meeting"))).not.toContain("fixed footprint");
    expect(render(dto("floor.carpet"))).toContain("1 × 1");
  });

  it("chair: no Show in item palette checkbox, the chair note instead", () => {
    const html = render(dto("chair.office"));
    expect(html).not.toContain("Show in item palette");
    expect(html).toContain(copy.chairNote);
  });

  it("a resize with effects shows the role=note warning and the confirm; an unchanged size does not", () => {
    const none = { sprite: null, hasImage: false, imageVersion: 0 };
    const item = dto("table.meeting", {
      art: { n: none, e: none, w: none, s: { ...none, hasImage: true } },
    });
    const same = render(item);
    expect(same).not.toContain(copy.confirmResize);
    expect(same).not.toContain('role="note"');
    const changed = render(item, { form: { ...formFromItem(item), w: 2 } });
    expect(changed).toContain('role="note"');
    expect(changed).toContain(copy.resizeWarning(1, 0));
    expect(changed).toContain(copy.confirmResize);
  });

  it("Reset button is disabled for a library default and enabled otherwise", () => {
    expect(render(dto("table.meeting"))).toMatch(
      /<button[^>]*disabled=""[^>]*>Reset item to library defaults/,
    );
    expect(render(dto("table.meeting", { name: "Other" }))).not.toMatch(
      /<button[^>]*disabled=""[^>]*>Reset item to library defaults/,
    );
  });

  it("the reset confirm shows the body, the unsaved-changes line only when dirty, Reset item and Keep editing", () => {
    const item = dto("table.meeting", { name: "Other" });
    const html = render(item, { confirmingReset: true });
    expect(html).toContain(mapItemsCopy.reset.intro("Other"));
    expect(html).toContain(mapItemsCopy.reset.confirm);
    expect(html).toContain(ed.reset.keep);
    expect(html).not.toContain(ed.reset.lost);
    expect(html).not.toContain(ed.reset.button);
    expect(render(item, { confirmingReset: true, dirty: true })).toContain(ed.reset.lost);
  });
});

describe("ResetMapItemBody", () => {
  it("lists the library values, the deleted images and cleared sprites; the in-use note only when the size differs", () => {
    const none = { sprite: null, hasImage: false, imageVersion: 0 };
    const item = dto("table.meeting", {
      name: "Bàn",
      w: 2,
      art: { n: { ...none, hasImage: true }, e: none, s: { ...none, hasImage: true }, w: none },
    });
    const html = renderToStaticMarkup(<ResetMapItemBody item={item} />);
    expect(html).toContain("table meeting");
    expect(html).toContain("3 × 2");
    expect(html).toContain(mapItemsCopy.reset.images(2));
    expect(html).toContain(mapItemsCopy.reset.sprites);
    expect(html).toContain(mapItemsCopy.reset.inUseNote);
    const same = renderToStaticMarkup(
      <ResetMapItemBody item={dto("table.meeting", { name: "Bàn" })} />,
    );
    expect(same).not.toContain(mapItemsCopy.reset.inUseNote);
    expect(same).not.toContain("custom image");
  });
});
