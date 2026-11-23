import type { ReactNode } from "react";
import Link from "next/link";
import { SEAT_LIMITS } from "@/lib/seats/types";
import { apiErrorMessage } from "../copy/api";
import { seatsCopy } from "../copy/seats";
import { Button } from "../Button";
import { Card } from "../Card";
import { Icon } from "../Icon";
import { deviceSummary, statusView, type RoomResolution, type SeatListState } from "./seat-view";

export type SeatsViewProps = {
  roomCode: string;
  resolution: RoomResolution;
  list: SeatListState;
  onRetry: () => void;
  onOpen: (seatCode: string) => void;
  onAdd?: () => void;
  notice?: string | null;
  /** The pixel map card; shown above the table when the room is found. */
  map?: ReactNode;
};

/** Clips untrusted text (the validator allows combining marks) inside its own box. */
export const CLIP = "overflow-hidden [contain:paint] [overflow-wrap:anywhere]";
const TH =
  "px-4 py-2.5 text-left text-[11px] font-extrabold tracking-[0.05em] uppercase text-on-surface-variant";
const TD = "px-4 py-2.5 text-sm font-medium text-on-surface align-top";

function BackLink() {
  return (
    <Link href="/rooms" className="text-sm font-bold text-primary w-fit">
      {seatsCopy.backToRooms}
    </Link>
  );
}

/** The room page body. Pure: data and handlers come from props. */
export function SeatsView({
  roomCode,
  resolution,
  list,
  onRetry,
  onOpen,
  onAdd,
  notice,
  map,
}: SeatsViewProps) {
  const room = resolution.kind === "found" ? resolution.room : null;
  const loading =
    resolution.kind === "loading" ||
    (resolution.kind === "found" && list.status === "loading" && list.seats.length === 0);
  const errorCode =
    resolution.kind === "error"
      ? resolution.code
      : resolution.kind === "found" && list.status === "error"
        ? list.errorCode
        : null;

  return (
    <div className="p-4 lg:p-6 flex flex-col gap-4">
      <BackLink />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-h2 font-extrabold text-on-surface">
          <span>{room ? room.code : roomCode}</span>
          {room && (
            <span className={`block text-sm font-medium ${CLIP} max-h-12`}>{room.name}</span>
          )}
        </h1>
        {room && onAdd && (
          <Button icon="add" data-add-seats onClick={onAdd}>
            {seatsCopy.actions.add}
          </Button>
        )}
      </div>

      {notice && (
        <p role="alert" className="text-sm font-semibold text-error">
          {notice}
        </p>
      )}

      {resolution.kind === "missing" && (
        <Card className="flex flex-col items-center gap-2 px-6 py-12 text-center">
          <Icon name="meeting_room" size={36} className="text-on-surface-variant" />
          <p className="text-base font-extrabold text-on-surface">{seatsCopy.roomNotFoundTitle}</p>
          <p className="text-sm font-medium text-on-surface-variant">
            {seatsCopy.roomNotFoundBody}
          </p>
        </Card>
      )}

      {loading && (
        <Card className="h-48 animate-pulse">
          <div aria-busy="true" />
        </Card>
      )}

      {errorCode !== null && (
        <Card className="flex flex-col items-start gap-3 p-4">
          <p role="alert" className="text-sm font-semibold text-error">
            {apiErrorMessage(errorCode)}
          </p>
          <Button variant="tonal" size="sm" onClick={onRetry}>
            {seatsCopy.retry}
          </Button>
        </Card>
      )}

      {room && list.status === "ready" && list.truncated && (
        <p role="status" className="text-sm font-semibold text-on-surface-variant">
          {seatsCopy.truncated(SEAT_LIMITS.list)}
        </p>
      )}

      {room && map}

      {room && list.status === "ready" && list.seats.length === 0 && (
        <Card className="px-6 py-12 text-center">
          <p className="text-sm font-medium text-on-surface-variant">{seatsCopy.empty}</p>
        </Card>
      )}

      {room && list.seats.length > 0 && (
        <Card className="overflow-hidden">
          <div
            role="region"
            tabIndex={0}
            aria-label={seatsCopy.tableCaption(room.code)}
            className="overflow-x-auto outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <table className="w-full min-w-[34rem] border-collapse">
              <caption className="sr-only">{seatsCopy.tableCaption(room.code)}</caption>
              <thead>
                <tr>
                  <th scope="col" className={TH}>
                    {seatsCopy.columns.seat}
                  </th>
                  <th scope="col" className={TH}>
                    {seatsCopy.columns.status}
                  </th>
                  <th scope="col" className={TH}>
                    {seatsCopy.columns.occupant}
                  </th>
                  <th scope="col" className={TH}>
                    {seatsCopy.columns.devices}
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.seats.map((seat) => {
                  const status = statusView(seat);
                  const devices = deviceSummary(seat);
                  return (
                    <tr key={seat.id} className="border-t border-outline-variant">
                      <td className={TD}>
                        <button
                          type="button"
                          data-seat-code={seat.code}
                          aria-haspopup="dialog"
                          aria-label={seatsCopy.openSeat(seat.code)}
                          onClick={() => onOpen(seat.code)}
                          className="state-layer rounded-md3 px-2 py-1 font-extrabold text-primary cursor-pointer font-[inherit]"
                        >
                          {seat.code}
                        </button>
                      </td>
                      <td className={TD}>
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                          <Icon name={status.icon} size={18} />
                          {seatsCopy.status[status.state]}
                          {status.blocked && (
                            <>
                              <Icon name="block" size={18} className="ml-1" />
                              {seatsCopy.status.cannotSeat}
                            </>
                          )}
                        </span>
                      </td>
                      <td className={TD}>
                        <span className={`block max-w-[14rem] max-h-12 ${CLIP}`}>
                          {seat.occupant ? seat.occupant.displayName : seatsCopy.noOccupant}
                        </span>
                      </td>
                      <td className={TD}>
                        <span
                          data-device-count={seat.deviceCount}
                          className={`block max-w-[18rem] max-h-12 ${CLIP}`}
                        >
                          {devices.names.length === 0 && devices.more === 0
                            ? seatsCopy.noDevices
                            : devices.names.join(", ")}
                          {devices.more > 0 && ` ${seatsCopy.moreDevices(devices.more)}`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
