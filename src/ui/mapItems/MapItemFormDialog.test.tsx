import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { mapItemsCopy } from "../copy/mapItems";
import { MapItemFormFields } from "./MapItemFormDialog";
import { formFromItem } from "./map-item-form";
import { dto } from "./test-items";

const noop = () => {};
const render = (item: ReturnType<typeof dto>, form = formFromItem(item)) =>
  renderToStaticMarkup(
    <MapItemFormFields
      item={item}
      form={form}
      groups={["table", "Cây"]}
      onChange={noop}
      onReset={noop}
    />,
  );
const copy = mapItemsCopy.form;

describe("MapItemFormFields", () => {
  it("shows the key, name and group limits, a group datalist, the checkbox and two size selects", () => {
    const html = render(dto("table.meeting"));
    expect(html).toContain("table.meeting");
    expect(html).toContain('maxLength="60"');
    expect(html).toContain('maxLength="40"');
    expect(html).toContain("<datalist");
    expect(html).toContain('<option value="Cây"');
    expect(html).toContain(copy.shown);
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

  it("fixed-size item: no selects, read-only size and its reason", () => {
    const desk = render(dto("desk.single"));
    expect(desk).not.toContain("<select");
    expect(desk).toContain("2 × 1");
    expect(desk).toContain(copy.fixedReason.seat);
    const floor = render(dto("floor.carpet"));
    expect(floor).toContain("1 × 1");
    expect(floor).toContain(copy.fixedReason.floor);
  });

  it("chair: no show-in-palette checkbox, the chair note instead", () => {
    const html = render(dto("chair.office"));
    expect(html).not.toContain(copy.shown);
    expect(html).toContain(copy.chairNote);
  });

  it("a resize with effects shows the warning and the confirm; unchanged size does not", () => {
    const art = (s: { sprite: string | null; hasImage: boolean }) => {
      const none = { sprite: null, hasImage: false, imageVersion: 0 };
      return { n: none, e: none, w: none, s: { ...s, imageVersion: 1 } };
    };
    const item = dto("table.meeting", { art: art({ sprite: null, hasImage: true }) });
    const same = render(item);
    expect(same).not.toContain(copy.confirmResize);
    const changed = render(item, { ...formFromItem(item), w: 2 });
    expect(changed).toContain(copy.resizeWarning(1, 0));
    expect(changed).toContain(copy.confirmResize);
  });

  it("the Reset button is disabled for a library default and enabled otherwise", () => {
    const off = render(dto("table.meeting"));
    expect(off).toMatch(/<button[^>]*disabled=""[^>]*>[^]*Reset to library defaults/);
    const on = render(dto("table.meeting", { name: "Other" }));
    expect(on).not.toMatch(/disabled=""[^>]*>[^<]*(<[^>]*>)*Reset to library/);
  });
});
