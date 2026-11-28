import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { mapItemsCopy } from "../copy/mapItems";
import { MapItemEditorFrame, type EditorFrameProps } from "./MapItemEditor";
import { editorReducer, initEditor, type EditorState } from "./map-item-editor";
import { dto } from "./test-items";

const noop = () => {};
const ed = mapItemsCopy.editor;
const item = dto("table.meeting");
const render = (over: Partial<EditorState> = {}, p: Partial<EditorFrameProps> = {}) =>
  renderToStaticMarkup(
    <MapItemEditorFrame
      item={item}
      state={{ ...initEditor(item), ...over }}
      groups={[]}
      idBase="ed"
      imageUrl={() => null}
      dispatch={noop}
      onUpload={noop}
      onSave={noop}
      onRequestClose={noop}
      onDiscard={noop}
      onReset={noop}
      {...p}
    />,
  );
const dirty = editorReducer(item, initEditor(item), { type: "form", patch: { name: "Other" } });

describe("MapItemEditorFrame", () => {
  it("tokens: Subtitle title, kit icon close button, pixel Save, no legacy sizes", () => {
    const html = render();
    expect(/<h2 id="ed-title"[^>]*class="([^"]*)"/.exec(html)?.[1] ?? "").toContain(
      "text-subtitle",
    );
    const close = /<button[^>]*aria-label="[^"]*"[^>]*>/.exec(html)?.[0] ?? "";
    expect(close).toContain("size-control");
    expect(html).toMatch(/<button[^>]*data-variant="pixel"[^>]*>/);
    for (const bad of ["min-h-11", "text-[", "font-extrabold"]) {
      expect(html, bad).not.toContain(bad);
    }
  });

  it("shell: eyebrow, h2 Edit <name>, key, close button with aria-label, tablist with Appearance selected, both tabpanels (inactive hidden)", () => {
    const html = render();
    expect(html).toContain(ed.eyebrow);
    expect(html).toContain(`<h2 id="ed-title"`);
    expect(html).toContain(ed.title(item.name));
    expect(html).toContain("table.meeting");
    expect(html).toContain(`aria-label="${ed.close}"`);
    expect(html).toContain(`role="tablist"`);
    expect(html).toMatch(
      /id="ed-tab-appearance"[^>]*aria-selected="true"|aria-selected="true"[^>]*id="ed-tab-appearance"/,
    );
    expect(html).toMatch(
      /id="ed-tab-details"[^>]*aria-selected="false"|aria-selected="false"[^>]*id="ed-tab-details"/,
    );
    expect(html.match(/role="tabpanel"/g)).toHaveLength(2);
    expect(html).toMatch(/id="ed-panel-details"[^>]*hidden=""/);
    expect(html).not.toMatch(/id="ed-panel-appearance"[^>]*hidden=""/);
    expect(render({ tab: "details" })).toMatch(/id="ed-panel-appearance"[^>]*hidden=""/);
  });

  it("footer status No unsaved changes when clean, Unsaved changes when dirty (role=status); Save disabled when clean or saving", () => {
    const clean = render();
    expect(clean).toMatch(/role="status"[^>]*>No unsaved changes/);
    expect(clean).toMatch(/<button[^>]*disabled=""[^>]*>Save changes/);
    const d = render(dirty);
    expect(d).toMatch(/role="status"[^>]*>Unsaved changes/);
    expect(d).not.toMatch(/<button[^>]*disabled=""[^>]*>Save changes/);
    const saving = render({ ...dirty, phase: "saving" });
    expect(saving).toContain(ed.status.saving);
    expect(saving).toMatch(/<button[^>]*disabled=""[^>]*>Save changes/);
    expect(render({ notice: ed.status.saved })).toContain(`No unsaved changes ${ed.status.saved}`);
  });

  it("discard confirm bar: Discard changes?, Keep editing, Discard replace Cancel and Save", () => {
    const html = render({ ...dirty, phase: "confirmDiscard" });
    expect(html).toContain(ed.discard.title);
    expect(html).toContain(ed.discard.keep);
    expect(html).toContain(`>${ed.discard.discard}<`);
    expect(html).not.toContain(ed.save);
    const normal = render(dirty);
    expect(normal).toContain(ed.cancel);
    expect(normal).not.toContain(ed.discard.title);
  });

  it("error banner is role=alert with the item_in_use room-count message", () => {
    const html = render({ error: { message: mapItemsCopy.errors.inUse(3), tab: "details" } });
    expect(html).toMatch(/role="alert"[^>]*>This item is placed in 3 rooms/);
    expect(render()).not.toContain('role="alert"');
  });

  it("a tab with pending edits carries the changed chip", () => {
    const html = render({ art: { n: { kind: "library" } } });
    expect(html.split(ed.changed).length - 1).toBeGreaterThanOrEqual(1);
  });
});
