"use client";

import { useState } from "react";
import type { RoomDto } from "@/lib/rooms/types";
import type { DeviceDto, DeviceRole } from "@/lib/devices/types";
import { SEAT_LIMITS, type SeatDto } from "@/lib/seats/types";
import { devicesCopy } from "../copy/devices";
import { DialogSelect, EntityFormDialog } from "../EntityFormDialog";
import type { RoomsApi } from "../rooms/rooms-api";
import type { SeatsApi } from "../seats/seats-api";
import type { DevicesApi } from "./devices-api";
import {
  offeredRoles,
  placeModes,
  placeVerb,
  planSubmit,
  settle,
  type PlaceMode,
} from "./place-device";
import { usePlaceTargets, type PlaceSeats } from "./usePlaceTargets";

const copy = devicesCopy.place;
const HINT = "text-on-surface-variant";

type RoomsState = { status: "loading" | "error" | "ready"; rooms: RoomDto[] };

/** Props only: the room select, the seat list and the role choice (or the return confirmation). */
export function PlaceDeviceFields({
  device,
  mode,
  rooms,
  roomId,
  seats,
  seatId,
  role,
  onRoom,
  onSeat,
  onRole,
  onRetryRooms,
  onRetrySeats,
}: {
  device: DeviceDto;
  mode: PlaceMode;
  rooms: RoomsState;
  roomId: string | null;
  seats: PlaceSeats;
  seatId: string | null;
  role: DeviceRole;
  onRoom: (id: string | null) => void;
  onSeat: (id: string) => void;
  onRole: (role: DeviceRole) => void;
  onRetryRooms: () => void;
  onRetrySeats: () => void;
}) {
  if (mode === "return") {
    return (
      <p className="text-sm text-on-surface">
        {copy.returnConfirm(device.inventoryNumber, device.placement?.seatCode ?? "")}
      </p>
    );
  }
  const seat = seats.seats.find((s) => s.id === seatId) ?? null;
  const roles: DeviceRole[] = seat ? offeredRoles(device, seat) : ["secondary"];
  const verb = placeVerb(device, seat);
  return (
    <>
      <DialogSelect
        label={copy.room}
        icon="meeting_room"
        value={roomId ?? ""}
        onChange={(e) => onRoom(e.target.value || null)}
        disabled={rooms.status !== "ready"}
      >
        <option value="">{copy.pickRoom}</option>
        {rooms.rooms.map((r) => (
          <option key={r.id} value={r.id}>
            {r.code} · {r.name}
          </option>
        ))}
      </DialogSelect>
      {rooms.status === "loading" && <p className={`text-sm ${HINT}`}>{copy.roomsLoading}</p>}
      {rooms.status === "ready" && rooms.rooms.length === 0 && (
        <p className={`text-sm ${HINT}`}>{copy.roomsEmpty}</p>
      )}
      {rooms.status === "error" && (
        <div role="alert" className="text-sm font-semibold text-error">
          {copy.roomsError}{" "}
          <button type="button" className="underline cursor-pointer" onClick={onRetryRooms}>
            {devicesCopy.retry}
          </button>
        </div>
      )}

      {roomId !== null && (
        <div
          role="radiogroup"
          aria-label={copy.seats}
          aria-busy={seats.status === "loading"}
          className="max-h-[35dvh] overflow-y-auto flex flex-col gap-1"
        >
          {seats.seats.map((s) => (
            <label
              key={s.id}
              className="flex items-center gap-3 rounded-md3 px-2 py-1.5 text-sm font-medium text-on-surface"
            >
              <input
                type="radio"
                name="seat"
                value={s.id}
                checked={s.id === seatId}
                onChange={() => onSeat(s.id)}
              />
              <span className="min-w-0">
                {s.code} · {s.occupant?.displayName ?? copy.emptySeat}
                {s.id === device.placement?.seatId && (
                  <span className={HINT}> ({copy.current})</span>
                )}
                {s.devices.some((x) => x.role === "primary" && x.id !== device.id) && (
                  <span className={HINT}> ({copy.hasPrimary})</span>
                )}
                {s.cannotSeat && <span className={HINT}> ({copy.cannotSeat})</span>}
              </span>
            </label>
          ))}
          {seats.status === "loading" && <p className={`text-sm ${HINT}`}>{copy.seatsLoading}</p>}
          {seats.status === "ready" && seats.seats.length === 0 && (
            <p className={`text-sm ${HINT}`}>{copy.seatsEmpty}</p>
          )}
          {seats.status === "error" && (
            <div role="alert" className="text-sm font-semibold text-error">
              {copy.seatsError}{" "}
              <button type="button" className="underline cursor-pointer" onClick={onRetrySeats}>
                {devicesCopy.retry}
              </button>
            </div>
          )}
          {seats.truncated && (
            <p className={`text-sm ${HINT}`}>{copy.seatsTruncated(SEAT_LIMITS.list)}</p>
          )}
        </div>
      )}

      <div role="radiogroup" aria-label={copy.role} className="flex flex-col gap-1">
        {(["secondary", "primary"] as const)
          .filter((r) => roles.includes(r))
          .map((r) => (
            <label key={r} className="flex items-center gap-3 text-sm font-medium text-on-surface">
              <input
                type="radio"
                name="role"
                value={r}
                checked={role === r}
                onChange={() => onRole(r)}
              />
              {devicesCopy.roles[r]}
            </label>
          ))}
        {seat && !roles.includes("primary") && (
          <p className={`text-sm ${HINT}`}>{copy.primaryUnavailable}</p>
        )}
        {seat?.occupant && verb === "lend" && (
          <p className={`text-sm ${HINT}`}>{copy.lendHint(seat.occupant.displayName)}</p>
        )}
      </div>
    </>
  );
}

type DialogProps = {
  mode: PlaceMode;
  devicesApi: DevicesApi;
  roomsApi: RoomsApi;
  seatsApi: SeatsApi;
  onClose: () => void;
  onStale: () => void;
  onDone: () => void;
};

/** Place, lend, move or return one device. Mounted only while open; keyed by device and mode. */
export function PlaceDeviceDialog({
  open,
  device,
  ...rest
}: DialogProps & { open: boolean; device: DeviceDto | null }) {
  if (!open || !device) return null;
  return <PlaceDeviceInner key={`${device.id}:${rest.mode}`} device={device} {...rest} />;
}

function PlaceDeviceInner({
  device,
  mode,
  devicesApi,
  roomsApi,
  seatsApi,
  onClose,
  onStale,
  onDone,
}: DialogProps & { device: DeviceDto }) {
  const [current, setCurrent] = useState(device);
  const [seatId, setSeatId] = useState<string | null>(null);
  const [role, setRole] = useState<DeviceRole>("secondary");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const targets = usePlaceTargets(roomsApi, seatsApi, device.placement?.roomId ?? null);
  const seat: SeatDto | null = targets.seats.seats.find((s) => s.id === seatId) ?? null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const plan = planSubmit(current, mode, seat, role);
    if (plan.kind === "invalid") return setError(plan.message);
    if (plan.kind === "noop") return onClose();
    setSubmitting(true);
    const outcome = settle(await devicesApi.place(current.id, plan.body));
    if (outcome.kind === "done") return onDone();
    setError(outcome.message);
    if (outcome.kind === "refetch") {
      const fresh = await devicesApi.get(current.id);
      if (!fresh.ok || !placeModes(fresh.value).includes(mode)) return onDone();
      setCurrent(fresh.value);
      onStale();
    }
    setSubmitting(false);
  }

  const verb = mode === "return" ? "return" : placeVerb(current, seat);
  return (
    <EntityFormDialog
      open
      title={copy.titles[mode]}
      subtitle={devicesCopy.typeLine(current.name, current.inventoryNumber)}
      submitLabel={copy.submit[verb]}
      submitting={submitting}
      error={error}
      onClose={onClose}
      onSubmit={submit}
    >
      <PlaceDeviceFields
        device={current}
        mode={mode}
        rooms={targets.rooms}
        roomId={targets.roomId}
        seats={targets.seats}
        seatId={seatId}
        role={role}
        onRoom={(id) => {
          targets.setRoomId(id);
          setSeatId(null);
          setRole("secondary");
        }}
        onSeat={(id) => {
          setSeatId(id);
          setRole("secondary");
        }}
        onRole={setRole}
        onRetryRooms={() => void targets.rooms.reload()}
        onRetrySeats={() => void targets.retrySeats()}
      />
    </EntityFormDialog>
  );
}
