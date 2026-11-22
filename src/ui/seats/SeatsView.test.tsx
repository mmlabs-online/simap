import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { RoomDto } from "@/lib/rooms/types";
import type { SeatDto } from "@/lib/seats/types";
import { apiCopy } from "../copy/api";
import { seatsCopy } from "../copy/seats";
import type { SeatListState } from "./seat-view";
import { SeatsView, type SeatsViewProps } from "./SeatsView";

const room: RoomDto = {
  id: "r1",
  code: "C302",
  name: "Phòng họp",
  description: null,
  floor: null,
  seatCount: 3,
  occupiedCount: 1,
};
const seat = (over: Partial<SeatDto>): SeatDto => ({
  id: "s1",
  code: "C302-01",
  seq: 1,
  roomId: "r1",
  roomCode: "C302",
  status: "empty",
  cannotSeat: false,
  cannotSeatReason: null,
  occupant: null,
  mine: false,
  group: null,
  project: null,
  deviceCount: 0,
  devices: [],
  ...over,
});
const seats: SeatDto[] = [
  seat({
    id: "s1",
    code: "C302-01",
    status: "occupied",
    occupant: { id: "m1", displayName: "Nguyễn Văn Ân" },
    deviceCount: 25,
    devices: [
      {
        id: "d1",
        name: "Laptop",
        type: "laptop",
        inventoryNumber: "I1",
        role: "primary",
        owner: { id: "m1", displayName: "Nguyễn Văn Ân" },
      },
    ],
  }),
  seat({ id: "s2", code: "C302-02" }),
  seat({ id: "s3", code: "C302-03", cannotSeat: true, cannotSeatReason: "Broken" }),
];
const ready = (over: Partial<SeatListState> = {}): SeatListState => ({
  status: "ready",
  seats,
  truncated: false,
  errorCode: null,
  ...over,
});
const noop = () => {};
const render = (p: Partial<SeatsViewProps> = {}) =>
  renderToStaticMarkup(
    <SeatsView
      roomCode="C302"
      resolution={{ kind: "found", room }}
      list={ready()}
      onRetry={noop}
      onOpen={noop}
      {...p}
    />,
  );

describe("SeatsView", () => {
  it("loading shows a busy skeleton and no rows", () => {
    const html = render({
      resolution: { kind: "loading" },
      list: ready({ status: "loading", seats: [] }),
    });
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain("<table");
  });
  it("empty room shows the empty text", () => {
    expect(render({ list: ready({ seats: [] }) })).toContain(seatsCopy.empty);
  });
  it("error shows an alert and retry", () => {
    const html = render({ list: ready({ status: "error", seats: [], errorCode: "unavailable" }) });
    expect(html).toContain('role="alert"');
    expect(html).toContain(apiCopy.errors.unavailable);
    expect(html).toContain(seatsCopy.retry);
  });
  it("a failed room load shows the error, not not-found", () => {
    const html = render({ resolution: { kind: "error", code: "unavailable" } });
    expect(html).toContain(apiCopy.errors.unavailable);
    expect(html).not.toContain(seatsCopy.roomNotFoundTitle);
  });
  it("not-found state", () => {
    const html = render({ resolution: { kind: "missing" }, list: ready({ seats: [] }) });
    expect(html).toContain(seatsCopy.roomNotFoundTitle);
    expect(html).not.toContain("<table");
  });
  it("a deleted room (missing, list not_found) shows only not-found, no alert or retry", () => {
    const html = render({
      resolution: { kind: "missing" },
      list: ready({ status: "error", seats: [], errorCode: "not_found" }),
    });
    expect(html).toContain(seatsCopy.roomNotFoundTitle);
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain(seatsCopy.retry);
  });
  it("truncated notice", () => {
    expect(render({ list: ready({ truncated: true }) })).toContain(seatsCopy.truncated(500));
    expect(render()).not.toContain(seatsCopy.truncated(500));
  });
  it("renders a row per seat; the row button carries data-seat-code", () => {
    const html = render();
    expect(html.match(/<tr /g)).toHaveLength(3);
    for (const s of seats) expect(html).toContain(`data-seat-code="${s.code}"`);
  });
  it("shows deviceCount, not devices.length", () => {
    const html = render();
    expect(html).toContain('data-device-count="25"');
    expect(html).toContain(seatsCopy.moreDevices(24));
  });
  it("status has text for each state", () => {
    const html = render();
    expect(html).toContain(seatsCopy.status.occupied);
    expect(html).toContain(seatsCopy.status.empty);
    expect(html).toContain(seatsCopy.status.cannotSeat);
  });
  it("keeps Vietnamese names intact", () => {
    const html = render();
    expect(html).toContain("Nguyễn Văn Ân");
    expect(html).toContain("Phòng họp");
  });
  it("Add shows only with onAdd, also in an empty room, never without the room", () => {
    expect(render()).not.toContain("data-add-seats");
    expect(render({ onAdd: noop })).toContain("data-add-seats");
    expect(render({ onAdd: noop, list: ready({ seats: [] }) })).toContain(seatsCopy.actions.add);
    expect(render({ onAdd: noop, resolution: { kind: "missing" } })).not.toContain(
      "data-add-seats",
    );
  });
  it("notice renders as an alert", () => {
    const html = render({ notice: "Seat gone" });
    expect(html).toMatch(/role="alert"[^>]*>Seat gone</);
  });
});
