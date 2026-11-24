import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { RoomDto } from "@/lib/rooms/types";
import { apiCopy } from "../copy/api";
import { roomsCopy } from "../copy/rooms";
import { shellCopy } from "../copy/shell";
import { RoomsView, type RoomsViewProps } from "./RoomsView";

const noop = () => {};
const rooms: RoomDto[] = [
  {
    id: "1",
    code: "C302",
    name: "Phòng họp",
    description: null,
    floor: "3",
    seatCount: 4,
    occupiedCount: 1,
  },
  {
    id: "2",
    code: "C400",
    name: "Kho",
    description: null,
    floor: null,
    seatCount: 0,
    occupiedCount: 0,
  },
];
const render = (p: Partial<RoomsViewProps> = {}) =>
  renderToStaticMarkup(
    <RoomsView
      status="ready"
      rooms={rooms}
      errorCode={null}
      canManage={false}
      onRetry={noop}
      onNew={noop}
      onEdit={noop}
      onDelete={noop}
      {...p}
    />,
  );

describe("RoomsView", () => {
  it("loading shows aria-busy skeletons and no rooms", () => {
    const html = render({ status: "loading", rooms: [] });
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain("C302");
  });
  it("ready with no rooms shows the empty text", () => {
    expect(render({ rooms: [] })).toContain(shellCopy.pages.rooms.empty);
  });
  it("error shows an alert with the message and Retry", () => {
    const html = render({ status: "error", rooms: [], errorCode: "unavailable" });
    expect(html).toContain('role="alert"');
    expect(html).toContain(apiCopy.errors.unavailable);
    expect(html).toContain(roomsCopy.retry);
  });
  it("ready renders a card and ring per room, 0-seat safe", () => {
    const html = render();
    for (const r of rooms) {
      expect(html).toContain(r.code);
      expect(html).toContain(r.name);
    }
    expect(html.match(/role="img"/g)).toHaveLength(2);
    expect(html).toContain(roomsCopy.occupancyLabel(1, 4));
    expect(html).toContain(roomsCopy.percent(25));
    expect(html).toContain(roomsCopy.percent(0));
  });
  it("the card code links to the room detail page", () => {
    const html = render();
    expect(html).toContain('href="/rooms/C302"');
    expect(html).toContain('href="/rooms/C400"');
  });
  it("hides New room, Edit and Delete unless canManage", () => {
    const hidden = render({ canManage: false });
    expect(hidden).not.toContain(roomsCopy.newRoom);
    expect(hidden).not.toContain(roomsCopy.editLabel("C302"));
    expect(hidden).not.toContain(roomsCopy.deleteLabel("C302"));
    const shown = render({ canManage: true });
    expect(shown).toContain(roomsCopy.newRoom);
    for (const r of rooms) {
      expect(shown).toContain(roomsCopy.editLabel(r.code));
      expect(shown).toContain(roomsCopy.deleteLabel(r.code));
    }
  });
});
