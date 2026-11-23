import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { draftFromLayout } from "@/lib/layout-editor/draft";
import { apiErrorMessage } from "../copy/api";
import { roomlayoutCopy } from "../copy/roomlayout";
import { EditorInspector } from "./EditorInspector";
import { EditorToolbar } from "./EditorToolbar";
import { EditorGateView, LeaveDialog, SaveErrorBanner } from "./EditorViews";

const copy = roomlayoutCopy.editor;
const noop = () => {};

describe("editor views", () => {
  it("not allowed view shows the copy and a link back to the room", () => {
    const html = renderToStaticMarkup(<EditorGateView gate="not_allowed" backHref="/rooms/C1" />);
    expect(html).toContain(copy.notAllowed.title.replace("'", "&#x27;"));
    expect(html).toContain('href="/rooms/C1"');
  });

  it("truncated read-only view shows the A6 message and no Save button", () => {
    const html = renderToStaticMarkup(<EditorGateView gate="read_only" backHref="/rooms/C1" />);
    expect(html).toContain("can&#x27;t open it");
    expect(html).not.toContain(copy.save);
  });

  it("desktop notice shows the copy and a link to the room", () => {
    const html = renderToStaticMarkup(<EditorGateView gate="desktop" backHref="/rooms/C1" />);
    expect(html).toContain(copy.desktop.title);
    expect(html).toContain('href="/rooms/C1"');
  });

  it("save error banner shows Reload for both 409 codes, Try again for unavailable, no button for a rule code; role=alert", () => {
    const banner = (code: string) =>
      renderToStaticMarkup(
        <SaveErrorBanner code={code} roomHref="/rooms/C1" onReload={noop} onRetry={noop} />,
      );
    for (const code of ["layout_stale", "layout_seats_changed"]) {
      const html = banner(code);
      expect(html).toContain('role="alert"');
      expect(html).toContain(apiErrorMessage(code).replace("'", "&#x27;"));
      expect(html).toContain(copy.reload);
      expect(html).toContain(copy.conflictNote);
      expect(html).not.toContain(copy.tryAgain);
    }
    const retry = banner("unavailable");
    expect(retry).toContain(copy.tryAgain);
    expect(retry).not.toContain(copy.reload);
    const rule = banner("layout_overlap");
    expect(rule).not.toContain("<button");
    expect(rule).not.toContain("<a ");
  });

  it("leave dialog renders Stay and Leave", () => {
    const html = renderToStaticMarkup(<LeaveDialog open onStay={noop} onLeave={noop} />);
    expect(html).toContain(copy.leave.stay);
    expect(html).toContain(copy.leave.leave);
    expect(renderToStaticMarkup(<LeaveDialog open={false} onStay={noop} onLeave={noop} />)).toBe(
      "",
    );
  });

  const toolbar = (over: Partial<Parameters<typeof EditorToolbar>[0]> = {}) =>
    renderToStaticMarkup(
      <EditorToolbar
        dirty={false}
        canUndo={false}
        canSave={false}
        saving={false}
        saveBlock={null}
        zoom={2}
        onBack={noop}
        onUndo={noop}
        onSave={noop}
        onZoom={noop}
        {...over}
      />,
    );

  it("toolbar shows the Save block reason, the dirty indicator, disabled Undo when canUndo is false", () => {
    const html = toolbar({ saveBlock: "unplaced", dirty: true });
    expect(html).toContain(copy.saveBlock.unplaced);
    expect(html).toContain(copy.unsaved);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Undo/);
    expect(toolbar()).not.toContain(copy.unsaved);
    expect(toolbar({ saving: true })).toContain('aria-busy="true"');
  });

  const draft = draftFromLayout(
    {
      w: 12,
      h: 8,
      floors: [],
      seats: [{ id: "s1", code: "Phòng-A-01", sprite: "desk.single", x: 4, y: 7, rotation: 0 }],
      fixtures: [{ id: "", sprite: "cabinet.filing", x: 0, y: 3, rotation: 0 }],
    },
    [],
  );
  const inspector = (selection: string[]) =>
    renderToStaticMarkup(
      <EditorInspector
        draft={draft}
        selection={selection}
        disabled={false}
        onSelect={noop}
        onMove={noop}
        onRotate={noop}
        onDelete={noop}
      />,
    );

  it("inspector disables Delete for a seat with the reason via aria-describedby; Items list names a seat with a diacritic code (Phòng-A-01)", () => {
    const seat = inspector(["s:s1"]);
    expect(seat).toMatch(/<button[^>]*disabled=""[^>]*aria-describedby="editor-delete-reason"/);
    expect(seat).toContain('id="editor-delete-reason"');
    expect(seat).toContain("Desk Phòng-A-01 at 4, 7");
    expect(seat).toContain("cabinet filing at 0, 3");
    const fixture = inspector(["f:0"]);
    expect(fixture).not.toContain("editor-delete-reason");
    expect(inspector([])).toContain(roomlayoutCopy.editor.inspector.none);
  });
});
