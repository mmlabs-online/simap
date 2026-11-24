import { decidePlacement, type PlacementRefusalCode } from "@/lib/devices/rules";
import type { DeviceDto, DeviceRole } from "@/lib/devices/types";
import type { SeatDto } from "@/lib/seats/types";
import { apiErrorMessage } from "../copy/api";
import { devicesCopy } from "../copy/devices";
import type { DevicesResult } from "./devices-api";

export type PlaceMode = "place" | "move" | "return";

export type PlacementBody =
  | { seatId: string; role: DeviceRole; expectedSeatId: string | null }
  | { seatId: null; expectedSeatId: string | null };

/** Which dialogs a row offers: none without `canPlace`, place when unplaced, move and return when placed. */
export function placeModes(d: DeviceDto): PlaceMode[] {
  if (!d.canPlace) return [];
  return d.placement ? ["move", "return"] : ["place"];
}

/** The server orders a seat's devices primary first, so the primary is found even past the list cap. */
export function seatTarget(seat: SeatDto) {
  return {
    seatId: seat.id,
    occupantId: seat.occupant?.id ?? null,
    primaryId: seat.devices.find((x) => x.role === "primary")?.id ?? null,
  };
}

/** Why the device cannot be primary on this seat, or null. One rule (lib); the server stays the guard. */
export function primaryRefusal(d: DeviceDto, seat: SeatDto): PlacementRefusalCode | null {
  const decision = decidePlacement({
    // Permission is the server's `canPlace`, already true when the dialog opens.
    tier: "user",
    isOwner: true,
    deviceId: d.id,
    ownerId: d.owner.id,
    current: { seatId: d.placement?.seatId ?? null, role: d.placement?.role ?? "secondary" },
    expectedSeatId: d.placement?.seatId ?? null,
    target: seatTarget(seat),
    role: "primary",
  });
  return decision.kind === "refuse" ? decision.code : null;
}

export function offeredRoles(d: DeviceDto, seat: SeatDto): DeviceRole[] {
  return primaryRefusal(d, seat) === null ? ["secondary", "primary"] : ["secondary"];
}

export function placeVerb(d: DeviceDto, seat: SeatDto | null): "place" | "move" | "lend" {
  if (seat?.occupant && seat.occupant.id !== d.owner.id) return "lend";
  return d.placement ? "move" : "place";
}

export function toPlacementBody(
  d: DeviceDto,
  target: { seatId: string; role: DeviceRole } | null,
): PlacementBody {
  const expectedSeatId = d.placement?.seatId ?? null;
  return target
    ? { seatId: target.seatId, role: target.role, expectedSeatId }
    : { seatId: null, expectedSeatId };
}

export type SubmitPlan =
  | { kind: "invalid"; message: string }
  | { kind: "noop" }
  | { kind: "send"; body: PlacementBody };

export function planSubmit(
  d: DeviceDto,
  mode: PlaceMode,
  seat: SeatDto | null,
  role: DeviceRole,
): SubmitPlan {
  if (mode === "return") return { kind: "send", body: toPlacementBody(d, null) };
  if (!seat) return { kind: "invalid", message: devicesCopy.place.pickSeat };
  const chosen = offeredRoles(d, seat).includes(role) ? role : "secondary";
  const decision = decidePlacement({
    tier: "user",
    isOwner: true,
    deviceId: d.id,
    ownerId: d.owner.id,
    current: { seatId: d.placement?.seatId ?? null, role: d.placement?.role ?? "secondary" },
    expectedSeatId: d.placement?.seatId ?? null,
    target: seatTarget(seat),
    role: chosen,
  });
  if (decision.kind === "noop") return { kind: "noop" };
  return { kind: "send", body: toPlacementBody(d, { seatId: seat.id, role: chosen }) };
}

export type Settled =
  | { kind: "done" }
  | { kind: "refetch"; message: string }
  | { kind: "error"; message: string };

/** A deleted device counts as done; a stale view asks for a refetch; other codes show their message. */
export function settle(result: DevicesResult<DeviceDto>): Settled {
  if (result.ok || result.code === "not_found") return { kind: "done" };
  const message = apiErrorMessage(result.code);
  return result.code === "placement_changed"
    ? { kind: "refetch", message }
    : { kind: "error", message };
}
