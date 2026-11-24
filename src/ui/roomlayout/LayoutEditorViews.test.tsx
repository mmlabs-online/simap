import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { draftFromLayout } from "@/lib/layout-editor/draft";
import { apiErrorMessage } from "../copy/api";
import { roomlayoutCopy } from "../copy/roomlayout";
import { editorPalette } from "@/lib/layout-editor/palette";
import { FIXTURE_GROUPS } from "@/lib/validate/layout";
import { EditorInspector } from "./EditorInspector";
import { Palette, PlacePanel } from "./Palette";
import { EditorToolbar } from "./EditorToolbar";
import { GestureOverlay } from "./GestureOverlay";
import { ShortcutList } from "./ShortcutList";
import { SHORTCUTS } from "@/lib/layout-editor/shortcuts";
import { EditorGateView, EditorStatusLine, LeaveDialog, SaveErrorBanner } from "./EditorViews";

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
        tool={null}
        resizeRefused={false}
        onArmTray={noop}
        onResize={noop}
        onSelect={noop}
        onMove={noop}
        onRotate={noop}
        onDelete={noop}
      />,
    );

  it("inspector enables Delete for a seat with the save note; new desk is named New desk in the Items list; Items list names a seat with a diacritic code (Phòng-A-01)", () => {
    const seat = inspector(["s:s1"]);
    const del = seat.match(/<button[^>]*>Delete<\/button>/)?.[0] ?? "";
    expect(del).toContain('aria-describedby="editor-delete-note"');
    expect(del).not.toContain('disabled=""');
    expect(seat).toContain(copy.inspector.deleteSeatNote);
    expect(seat).toContain("Desk Phòng-A-01 at 4, 7");
    expect(seat).toContain("cabinet filing at 0, 3");
    const fixture = inspector(["f:0"]);
    expect(fixture).not.toContain("editor-delete-note");
    expect(inspector([])).toContain(roomlayoutCopy.editor.inspector.none);
  });

  const trayDraft = draftFromLayout({ w: 12, h: 8, floors: [], seats: [], fixtures: [] }, [
    { id: "t1", code: "Phòng-A-03" },
  ]);
  const inspectorWith = (over: Partial<Parameters<typeof EditorInspector>[0]>) =>
    renderToStaticMarkup(
      <EditorInspector
        draft={trayDraft}
        selection={[]}
        disabled={false}
        tool={null}
        resizeRefused={false}
        onArmTray={noop}
        onResize={noop}
        onSelect={noop}
        onMove={noop}
        onRotate={noop}
        onDelete={noop}
        {...over}
      />,
    );

  it("palette renders the Desks group first with New desk; pressed when the desk tool is armed; every group has a heading; all buttons disabled when disabled", () => {
    const groups = editorPalette();
    const first = groups[1].entries[0].sprite;
    const html = renderToStaticMarkup(
      <Palette groups={groups} armed={first} disabled={false} onArm={noop} />,
    );
    expect(html.match(/<h3/g)).toHaveLength(groups.length);
    expect(html).toContain('aria-pressed="true"');
    expect(html.indexOf(copy.palette.groups.desk)).toBeLessThan(html.indexOf("<li"));
    expect(html).toContain("New desk");
    const desk = renderToStaticMarkup(
      <Palette groups={groups} armed="desk.single" disabled={false} onArm={noop} />,
    );
    expect(desk).toMatch(/aria-pressed="true"[^>]*>New desk/);
    const off = renderToStaticMarkup(
      <Palette groups={groups} armed={null} disabled onArm={noop} />,
    );
    const buttons = off.match(/<button[^>]*>/g) ?? [];
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.every((b) => b.includes('disabled=""'))).toBe(true);
  });

  it("every FIXTURE_GROUPS entry and the desk group have a palette heading in the copy", () => {
    expect(copy.palette.groups.desk).toBe("Desks");
    for (const g of FIXTURE_GROUPS) expect(copy.palette.groups[g]).toBeTruthy();
  });

  it("place panel shows the armed item name, labelled X and Y inputs, Place and Done placing; renders nothing without a tool", () => {
    const html = renderToStaticMarkup(
      <PlacePanel toolName="plant large" disabled={false} onPlace={noop} onDone={noop} />,
    );
    expect(html).toContain("Placing plant large.");
    expect(html).toContain('role="status"');
    expect(html).toContain(copy.palette.place);
    expect(html).toContain(copy.palette.done);
    expect(html.match(/<label/g)).toHaveLength(2);
    expect(
      renderToStaticMarkup(
        <PlacePanel toolName={null} disabled={false} onPlace={noop} onDone={noop} />,
      ),
    ).toBe("");
  });

  it("inspector tray rows are Place buttons named with the seat code (Phòng-A-03); the armed one is pressed; disabled when disabled", () => {
    expect(inspectorWith({})).toContain("Place Phòng-A-03");
    expect(inspectorWith({})).toContain('aria-pressed="false"');
    expect(inspectorWith({ tool: { kind: "tray", seatId: "t1" } })).toContain(
      'aria-pressed="true"',
    );
    expect(inspectorWith({ disabled: true })).toMatch(/<button[^>]*disabled=""[^>]*>Place Phòng/);
  });

  it("room size form shows labelled W and H inputs with the draft size and Apply; resizeRefused shows the inline message referenced by aria-describedby", () => {
    const html = inspectorWith({});
    expect(html).toContain(copy.inspector.sizeW);
    expect(html).toContain(copy.inspector.sizeH);
    expect(html).toContain('value="12"');
    expect(html).toContain('value="8"');
    expect(html).toContain(copy.inspector.sizeApply);
    expect(html).not.toContain("size-refused");
    const refused = inspectorWith({ resizeRefused: true });
    expect(refused).toContain('aria-describedby="size-refused"');
    expect(refused).toContain('id="size-refused"');
    expect(refused).toContain(copy.refused.resize_cut);
  });

  it("EditorStatusLine shows placed, resized, fixture_limit and resize_cut copy", () => {
    const line = (notice: Parameters<typeof EditorStatusLine>[0]["notice"]) =>
      renderToStaticMarkup(<EditorStatusLine notice={notice} />);
    expect(line({ kind: "done", what: "placed" })).toContain(copy.done.placed);
    expect(line({ kind: "done", what: "resized" })).toContain(copy.done.resized);
    expect(line({ kind: "refused", code: "fixture_limit" })).toContain(copy.refused.fixture_limit);
    expect(line({ kind: "refused", code: "resize_cut" })).toContain(copy.refused.resize_cut);
  });

  it("shortcut list: a details with the summary, a row with <kbd> keys for every SHORTCUTS id, and the mouse rows", () => {
    const html = renderToStaticMarkup(<ShortcutList />);
    expect(html).toMatch(/^<details/);
    expect(html).not.toContain(" open");
    expect(html).toContain(copy.shortcuts.summary);
    for (const id of SHORTCUTS) {
      expect(html).toContain(`data-testid="shortcut-${id}"`);
      for (const k of copy.shortcuts.rows[id].keys) expect(html).toContain(`${k}</kbd>`);
      expect(html).toContain(copy.shortcuts.rows[id].action);
    }
    for (const m of copy.shortcuts.mouse) expect(html).toContain(m.action);
  });

  it("Undo and Save (toolbar) and Rotate and Delete (inspector) carry aria-keyshortcuts", () => {
    const bar = toolbar();
    expect(bar).toContain('aria-keyshortcuts="Control+Z Meta+Z"');
    expect(bar).toContain('aria-keyshortcuts="Control+S Meta+S"');
    const side = inspector([]);
    expect(side).toContain('aria-keyshortcuts="R"');
    expect(side).toContain('aria-keyshortcuts="Delete Backspace"');
  });

  it("GestureOverlay: an ok drag ghost is solid primary, a refused one is dashed error, a marquee is a dashed rect with outlines for its items, nothing for an idle gesture", () => {
    const bounds = { x: 0, y: 0, w: 384, h: 256 };
    const render = (
      drag: Parameters<typeof GestureOverlay>[0]["drag"],
      marquee: Parameters<typeof GestureOverlay>[0]["marquee"] = null,
    ) =>
      renderToStaticMarkup(
        <GestureOverlay bounds={bounds} zoom={2} drag={drag} marquee={marquee} />,
      );
    const box = { x: 1, y: 2, w: 2, h: 1 };
    const ok = render({ ok: true, boxes: [box] });
    expect(ok).toContain('data-testid="drag-ghost"');
    expect(ok).toContain("border-primary");
    expect(ok).not.toContain("border-dashed");
    expect(ok).toContain("left:64px;top:128px;width:128px;height:64px");
    const refused = render({ ok: false, boxes: [box] });
    expect(refused).toContain("border-dashed border-error");
    const m = render(null, {
      box: { x: 0, y: 0, w: 3, h: 2 },
      items: [box],
    });
    expect(m).toContain('data-testid="marquee"');
    expect(m).toContain("border-dashed border-primary");
    expect(m.match(/marquee-item/g)).toHaveLength(1);
    expect(render(null)).toBe("");
  });

  it("new desk is named New desk in the Items list and the tool name", () => {
    const withNew = {
      ...draft,
      items: [
        ...draft.items,
        {
          key: "n:5",
          kind: "seat" as const,
          sprite: "desk.single",
          x: 1,
          y: 1,
          rotation: 0 as const,
          seatId: null,
          code: null,
        },
      ],
    };
    const html = renderToStaticMarkup(
      <EditorInspector
        draft={withNew}
        selection={["n:5"]}
        disabled={false}
        tool={null}
        resizeRefused={false}
        onArmTray={noop}
        onResize={noop}
        onSelect={noop}
        onMove={noop}
        onRotate={noop}
        onDelete={noop}
      />,
    );
    expect(html).toContain("New desk at 1, 1");
    expect(html).not.toContain("editor-delete-note");
  });

  it("save error banner for seat_not_empty shows the SEA-01 message, the seat code (Phòng-A-02) and where the desk is back, and no button; seats_unmatched shows Reload; a put detail names the created count", () => {
    const banner = (code: string, detail?: Parameters<typeof SaveErrorBanner>[0]["detail"]) =>
      renderToStaticMarkup(
        <SaveErrorBanner
          code={code}
          detail={detail}
          roomHref="/rooms/C1"
          onReload={noop}
          onRetry={noop}
        />,
      );
    const refused = banner("seat_not_empty", {
      stage: "delete",
      deleted: 1,
      created: 0,
      seat: "Phòng-A-02",
      restored: "map",
    });
    expect(refused).toContain(apiErrorMessage("seat_not_empty"));
    expect(refused).toContain("Desk Phòng-A-02 was not deleted and is back on the map.");
    expect(refused).toContain("1 seat was deleted.");
    expect(refused).not.toContain("<button");
    const tray = banner("seat_not_empty", {
      stage: "delete",
      deleted: 0,
      created: 0,
      seat: "Phòng-A-02",
      restored: "tray",
    });
    expect(tray).toContain("is back in Seats not placed.");
    const unmatched = banner("seats_unmatched");
    expect(unmatched).toContain(copy.saveErrors.seats_unmatched.replace("'", "&#x27;"));
    expect(unmatched).toContain(copy.reload);
    const put = banner("unavailable", {
      stage: "put",
      deleted: 0,
      created: 2,
      seat: null,
      restored: null,
    });
    expect(put).toContain("2 new seats were created, but the layout was not saved.");
    expect(put).toContain(copy.tryAgain);
  });

  it("EditorStatusLine shows seat_limit copy", () => {
    const html = renderToStaticMarkup(
      <EditorStatusLine notice={{ kind: "refused", code: "seat_limit" }} />,
    );
    expect(html).toContain(copy.refused.seat_limit);
  });
});
