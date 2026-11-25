import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { mapItemsCopy } from "../copy/mapItems";
import { ResetMapItemBody } from "./ResetMapItemDialog";
import { dto } from "./test-items";

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
