import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DeviceDto } from "@/lib/devices/types";
import type { RoomDto } from "@/lib/rooms/types";
import { SEAT_LIMITS, type SeatDto } from "@/lib/seats/types";
import { apiErrorMessage } from "../copy/api";
import { devicesCopy } from "../copy/devices";
import { EntityFormDialog } from "../EntityFormDialog";
import { PlaceDeviceFields } from "./PlaceDeviceDialog";
import { settle } from "./place-device";
import type { PlaceSeats } from "./usePlaceTargets";

const noop = () => {};
const copy = devicesCopy.place;
const owner = { id: "u1", displayName: "Ha", hasPhoto: false, photoVersion: 0 };
const device: DeviceDto = {
  id: "d1",
  name: "Laptop",
  type: "PC",
  inventoryNumber: "INV-1",
  mac: null,
  owner,
  placement: null,
  mine: true,
  canEdit: true,
  canPlace: true,
  canDelete: false,
  serial: null,
  manufacturer: null,
  brand: null,
  holding: null,
  canAssign: false,
  canEditHolding: false,
  canTransfer: false,
  canReturn: false,
  canTakeBack: false,
  overdue: false,
  pendingHandoff: null,
};
const placedDevice: DeviceDto = {
  ...device,
  placement: { seatId: "s9", seatCode: "C-09", roomId: "r1", roomCode: "C", role: "secondary" },
};
const room = (id: string, code: string): RoomDto => ({
  id,
  code,
  name: `Room ${code}`,
  description: null,
  floor: null,
  seatCount: 1,
  occupiedCount: 0,
});
const seat = (over: Partial<SeatDto>): SeatDto => ({
  id: "s1",
  code: "C-01",
  seq: 1,
  roomId: "r1",
  roomCode: "C",
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
const ready = (seats: SeatDto[], truncated = false): PlaceSeats => ({
  status: "ready",
  seats,
  truncated,
  errorCode: null,
});

type Props = Partial<Parameters<typeof PlaceDeviceFields>[0]>;
const render = (p: Props = {}) =>
  renderToStaticMarkup(
    <PlaceDeviceFields
      device={device}
      mode="place"
      tier="manager"
      rooms={{ status: "ready", rooms: [room("r1", "C302"), room("r2", "C303")] }}
      roomId="r1"
      seats={ready([seat({})])}
      seatId={null}
      role="secondary"
      onRoom={noop}
      onSeat={noop}
      onRole={noop}
      onRetryRooms={noop}
      onRetrySeats={noop}
      {...p}
    />,
  );

describe("PlaceDeviceFields picker", () => {
  it("user sees only own seats, message when none (D72)", () => {
    const mine = seat({ id: "s1", code: "C-01", occupant: owner });
    const theirs = seat({
      id: "s2",
      code: "C-02",
      occupant: { id: "u2", displayName: "Binh", hasPhoto: false, photoVersion: 0 },
    });
    const empty = seat({ id: "s3", code: "C-03" });
    const html = render({ tier: "user", seats: ready([mine, theirs, empty]) });
    expect(html).toContain("C-01 · Ha");
    expect(html).not.toContain("C-02");
    expect(html).not.toContain("C-03");
    expect(html).not.toContain(copy.noOwnSeats);
    const none = render({ tier: "user", seats: ready([theirs, empty]) });
    expect(none).toContain(copy.noOwnSeats.replace("'", "&#x27;"));
    expect(render({ tier: "manager", seats: ready([theirs, empty]) })).toContain("C-02 · Binh");
  });

  it("user moving a device lent before D72 sees its current seat and the hint", () => {
    const lent = seat({
      id: "s9",
      code: "C-09",
      occupant: { id: "u2", displayName: "Nguyễn Bình" },
    });
    const html = render({ tier: "user", mode: "move", device: placedDevice, seats: ready([lent]) });
    expect(html).toContain(copy.lentCurrent("C-09", "Nguyễn Bình"));
    expect(html).toContain(copy.lentMoveHint);
    const manager = render({ tier: "manager", device: placedDevice, seats: ready([lent]) });
    expect(manager).not.toContain(copy.lentMoveHint);
    const own = seat({ id: "s9", code: "C-09", occupant: owner });
    expect(render({ tier: "user", device: placedDevice, seats: ready([own]) })).not.toContain(
      copy.lentMoveHint,
    );
  });

  it("room select lists rooms; seats show code, occupant or Empty, and hints", () => {
    const html = render({
      device: placedDevice,
      seats: ready([
        seat({ id: "s9", code: "C-09" }),
        seat({
          id: "s2",
          code: "C-02",
          occupant: owner,
          cannotSeat: true,
          devices: [
            {
              id: "d7",
              name: "x",
              type: "PC",
              inventoryNumber: "I",
              role: "primary",
              owner,
            },
          ],
        }),
      ]),
    });
    expect(html).toContain("C302 · Room C302");
    expect(html).toContain("C303 · Room C303");
    expect(html).toContain(copy.pickRoom);
    expect(html).toContain(`C-09 · ${copy.emptySeat}`);
    expect(html).toContain(`(${copy.current})`);
    expect(html).toContain("C-02 · Ha");
    expect(html).toContain(`(${copy.hasPrimary})`);
    expect(html).toContain(`(${copy.cannotSeat})`);
    expect(html).toContain(`aria-label="${copy.seats}"`);
  });

  it("primary radio only when offered; secondary checked by default; hint otherwise", () => {
    const empty = seat({});
    const noPrimary = render({ seats: ready([empty]), seatId: "s1" });
    expect(noPrimary).not.toContain('value="primary"');
    expect(noPrimary).toContain('name="role" checked="" value="secondary"');
    expect(noPrimary).toContain(copy.primaryUnavailable);
    const own = seat({ occupant: owner });
    const offered = render({ seats: ready([own]), seatId: "s1" });
    expect(offered).toContain('value="primary"');
    expect(offered).not.toContain(copy.primaryUnavailable);
  });

  it("lend label when the chosen seat's occupant is not the owner", () => {
    const html = render({
      seats: ready([
        seat({ occupant: { id: "u2", displayName: "Binh", hasPhoto: false, photoVersion: 0 } }),
      ]),
      seatId: "s1",
    });
    expect(html).toContain("Lent to Binh&#x27;s seat as secondary.");
    const own = render({ seats: ready([seat({ occupant: owner })]), seatId: "s1" });
    expect(own).not.toContain("Lent to");
  });

  it("return mode shows the confirm sentence with the seat code and no picker", () => {
    const html = render({ device: placedDevice, mode: "return" });
    expect(html).toContain(copy.returnConfirm("INV-1", "C-09"));
    expect(html).not.toContain("radiogroup");
    expect(html).not.toContain("<select");
  });

  it("loading, error with retry, empty and truncated states", () => {
    expect(
      render({ seats: { status: "loading", seats: [], truncated: false, errorCode: null } }),
    ).toContain(copy.seatsLoading);
    const err = render({ seats: { status: "error", seats: [], truncated: false, errorCode: "x" } });
    expect(err).toContain(copy.seatsError);
    expect(err).toContain(devicesCopy.retry);
    expect(render({ seats: ready([]) })).toContain(copy.seatsEmpty);
    expect(render({ seats: ready([seat({})], true) })).toContain(
      copy.seatsTruncated(SEAT_LIMITS.list),
    );
    expect(render({ rooms: { status: "loading", rooms: [] } })).toContain(copy.roomsLoading);
    expect(render({ rooms: { status: "error", rooms: [] } })).toContain(copy.roomsError);
    expect(render({ rooms: { status: "ready", rooms: [] } })).toContain(copy.roomsEmpty);
    expect(render({ roomId: null })).not.toContain('role="radiogroup" aria-label="Seat"');
  });
});

describe("refusals in the dialog alert", () => {
  it("shows the refusal message in the alert (each placement code)", () => {
    for (const code of [
      "seat_has_no_occupant",
      "owner_not_occupant",
      "seat_has_primary",
      "placement_changed",
      "not_allowed",
    ]) {
      const outcome = settle({ ok: false, code });
      if (outcome.kind === "done") throw new Error("expected a message");
      const html = renderToStaticMarkup(
        <EntityFormDialog
          open
          title="t"
          submitLabel="s"
          error={outcome.message}
          onClose={noop}
          onSubmit={noop}
        >
          {null}
        </EntityFormDialog>,
      );
      expect(html).toContain('role="alert"');
      expect(html).toContain(apiErrorMessage(code).replace(/'/g, "&#x27;"));
    }
  });
});
