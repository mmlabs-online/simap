import { describe, expect, it } from "vitest";
import type { RoomDto } from "@/lib/rooms/types";
import type { SeatDeviceDto, SeatDto } from "@/lib/seats/types";
import {
  deviceSummary,
  isOutsideRect,
  panelView,
  retryTarget,
  type RoomResolution,
  parseSeatParam,
  resolveRoom,
  seatHref,
  splitDevices,
  statusView,
  type SeatDetailState,
  type SeatListState,
} from "./seat-view";

const device = (id: string, role: "primary" | "secondary"): SeatDeviceDto => ({
  id,
  name: `Máy ${id}`,
  type: "laptop",
  inventoryNumber: `INV-${id}`,
  role,
  owner: { id: "m1", displayName: "Nguyễn An" },
});
const seat = (over: Partial<SeatDto> = {}): SeatDto => ({
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
const list = (over: Partial<SeatListState> = {}): SeatListState => ({
  status: "ready",
  seats: [seat()],
  truncated: false,
  errorCode: null,
  ...over,
});
const detail = (over: Partial<SeatDetailState> = {}): SeatDetailState => ({
  seatId: "s1",
  status: "ready",
  seat: seat(),
  errorCode: null,
  ...over,
});
const found: RoomResolution = { kind: "found", room: {} as RoomDto };
const open = { kind: "code", code: "C302-01" } as const;

describe("parseSeatParam", () => {
  it("absent and blank are none", () => {
    expect(parseSeatParam([])).toEqual({ kind: "none" });
    expect(parseSeatParam(["  "])).toEqual({ kind: "none" });
    expect(parseSeatParam([""])).toEqual({ kind: "none" });
  });
  it("accepts a valid code, a 3-digit sequence and a room code with a dash", () => {
    expect(parseSeatParam(["C302-01"])).toEqual({ kind: "code", code: "C302-01" });
    expect(parseSeatParam(["C302-123"])).toEqual({ kind: "code", code: "C302-123" });
    expect(parseSeatParam(["A-B-01"])).toEqual({ kind: "code", code: "A-B-01" });
  });
  it("lowercase, over-long, bad charset and repeated values are invalid", () => {
    expect(parseSeatParam(["c302-01"])).toEqual({ kind: "invalid" });
    expect(parseSeatParam([`${"A".repeat(33)}-01`])).toEqual({ kind: "invalid" });
    expect(parseSeatParam(["C302-01<script>"])).toEqual({ kind: "invalid" });
    expect(parseSeatParam(["C302-1"])).toEqual({ kind: "invalid" });
    expect(parseSeatParam(["C302-01", "C302-02"])).toEqual({ kind: "invalid" });
  });
});

describe("seatHref", () => {
  it("encodes the code and keeps the path", () => {
    expect(seatHref("/rooms/C302", "C302-01")).toBe("/rooms/C302?seat=C302-01");
    expect(seatHref("/rooms/C302", "A B")).toBe("/rooms/C302?seat=A%20B");
    expect(seatHref("/rooms/C302", null)).toBe("/rooms/C302");
  });
});

describe("resolveRoom", () => {
  const rooms: RoomDto[] = [
    {
      id: "r1",
      code: "C302",
      name: "N",
      description: null,
      floor: null,
      seatCount: 0,
      occupiedCount: 0,
    },
  ];
  it("loading, error, found, missing", () => {
    expect(resolveRoom({ status: "loading", rooms: [], errorCode: null }, "C302")).toEqual({
      kind: "loading",
    });
    expect(resolveRoom({ status: "error", rooms: [], errorCode: "unavailable" }, "C302")).toEqual({
      kind: "error",
      code: "unavailable",
    });
    expect(resolveRoom({ status: "ready", rooms, errorCode: null }, "C302")).toEqual({
      kind: "found",
      room: rooms[0],
    });
    expect(resolveRoom({ status: "ready", rooms, errorCode: null }, "NOPE")).toEqual({
      kind: "missing",
    });
  });
  it("matches the code exactly", () => {
    expect(resolveRoom({ status: "ready", rooms, errorCode: null }, "c302").kind).toBe("missing");
  });
});

describe("statusView", () => {
  it.each([
    ["empty", false, "event_seat", false],
    ["occupied", false, "person", false],
    ["empty", true, "event_seat", true],
    ["occupied", true, "person", true],
  ] as const)("%s, cannotSeat %s", (status, cannotSeat, icon, blocked) => {
    expect(statusView({ status, cannotSeat })).toEqual({ state: status, icon, blocked });
  });
});

describe("deviceSummary", () => {
  it("0 devices", () => {
    expect(deviceSummary(seat())).toEqual({ names: [], more: 0 });
  });
  it("n devices", () => {
    const devices = [device("1", "primary"), device("2", "secondary")];
    expect(deviceSummary(seat({ deviceCount: 2, devices }))).toEqual({
      names: ["Máy 1", "Máy 2"],
      more: 0,
    });
  });
  it("deviceCount above devices.length gives more", () => {
    expect(deviceSummary(seat({ deviceCount: 25, devices: [device("1", "primary")] })).more).toBe(
      24,
    );
  });
});

describe("splitDevices", () => {
  it("separates primary and secondary", () => {
    const r = splitDevices([device("2", "secondary"), device("1", "primary")]);
    expect(r.primary?.id).toBe("1");
    expect(r.secondary.map((d) => d.id)).toEqual(["2"]);
  });
  it("none", () => {
    expect(splitDevices([])).toEqual({ primary: null, secondary: [] });
  });
});

describe("panelView", () => {
  it("closed with no seat param", () => {
    expect(panelView({ kind: "none" }, found, list(), detail()).kind).toBe("closed");
  });
  it("invalid param is not found", () => {
    expect(panelView({ kind: "invalid" }, found, list(), detail())).toEqual({
      kind: "notFound",
      truncated: false,
    });
  });
  it("list loading shows loading; list error shows the error", () => {
    expect(panelView(open, found, list({ status: "loading", seats: [] }), detail()).kind).toBe(
      "loading",
    );
    expect(
      panelView(
        open,
        found,
        list({ status: "error", seats: [], errorCode: "unavailable" }),
        detail(),
      ),
    ).toEqual({
      kind: "error",
      code: "unavailable",
    });
  });
  it("code not in list", () => {
    expect(panelView({ kind: "code", code: "C302-09" }, found, list(), detail())).toEqual({
      kind: "notFound",
      truncated: false,
    });
  });
  it("code not in a truncated list uses the truncation wording flag", () => {
    expect(
      panelView({ kind: "code", code: "C302-09" }, found, list({ truncated: true }), detail()),
    ).toEqual({
      kind: "notFound",
      truncated: true,
    });
  });
  it("detail loading", () => {
    expect(panelView(open, found, list(), detail({ status: "loading", seat: null })).kind).toBe(
      "loading",
    );
  });
  it("detail for another seat is never shown", () => {
    expect(
      panelView(open, found, list(), detail({ seatId: "other", seat: seat({ id: "other" }) })).kind,
    ).toBe("loading");
    expect(panelView(open, found, list(), detail({ seat: seat({ id: "other" }) })).kind).toBe(
      "loading",
    );
  });
  it("detail 404 is not found; other errors are errors", () => {
    expect(
      panelView(
        open,
        found,
        list(),
        detail({ status: "error", seat: null, errorCode: "not_found" }),
      ),
    ).toEqual({ kind: "notFound", truncated: false });
    expect(
      panelView(
        open,
        found,
        list(),
        detail({ status: "error", seat: null, errorCode: "unavailable" }),
      ),
    ).toEqual({ kind: "error", code: "unavailable" });
  });
  it("ready", () => {
    const s = seat({ status: "occupied" });
    expect(panelView(open, found, list(), detail({ seat: s }))).toEqual({ kind: "ready", seat: s });
  });
});

describe("panelView with the room resolution", () => {
  const loadingList = list({ status: "loading", seats: [] });
  it("a missing room is not found without waiting for seats", () => {
    expect(panelView(open, { kind: "missing" }, loadingList, detail())).toEqual({
      kind: "notFound",
      truncated: false,
    });
  });
  it("a failed room load shows that error", () => {
    expect(panelView(open, { kind: "error", code: "unavailable" }, loadingList, detail())).toEqual({
      kind: "error",
      code: "unavailable",
    });
  });
  it("a loading room shows loading", () => {
    expect(panelView(open, { kind: "loading" }, loadingList, detail())).toEqual({
      kind: "loading",
    });
  });
});

describe("retryTarget", () => {
  it("a room list failure retries rooms", () => {
    expect(retryTarget({ kind: "error", code: "x" }, { status: "loading" })).toBe("rooms");
  });
  it("a seat list failure retries seats", () => {
    expect(retryTarget(found, { status: "error" })).toBe("seats");
  });
  it("otherwise retries the detail", () => {
    expect(retryTarget(found, { status: "ready" })).toBe("detail");
  });
});

describe("isOutsideRect", () => {
  const rect = { left: 100, right: 500, top: 0, bottom: 300 };
  it("inside and on the edge is not outside", () => {
    expect(isOutsideRect(rect, 200, 100)).toBe(false);
    expect(isOutsideRect(rect, 100, 300)).toBe(false);
  });
  it("left of or below the rect is outside", () => {
    expect(isOutsideRect(rect, 50, 100)).toBe(true);
    expect(isOutsideRect(rect, 200, 400)).toBe(true);
  });
});
