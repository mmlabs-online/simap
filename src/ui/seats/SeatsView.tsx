import type { ReactNode } from "react";
import Link from "next/link";
import { SEAT_LIMITS } from "@/lib/seats/types";
import { apiErrorMessage } from "../copy/api";
import { seatsCopy } from "../copy/seats";
import { Button } from "../Button";
import { Card } from "../Card";
import { CLIP } from "../clip";
import { Icon } from "../Icon";
import { TABLE_CELL, TABLE_HEAD, TABLE_ROW } from "../table";
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

function BackLink() {
  return (
    <Link
      href="/rooms"
      className="inline-flex min-h-control items-center self-start text-label font-semibold text-text-primary hover:underline"
    >
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
    <div className="page-library flex flex-col gap-4">
      <BackLink />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-display text-text-primary">
          <span>{room ? room.code : roomCode}</span>
          {room && <span className={`block text-label ${CLIP} max-h-12`}>{room.name}</span>}
        </h1>
        {room && onAdd && (
          <Button icon="add" data-add-seats onClick={onAdd}>
            {seatsCopy.actions.add}
          </Button>
        )}
      </div>

      {notice && (
        <p role="alert" className="text-label font-semibold text-danger">
          {notice}
        </p>
      )}

      {resolution.kind === "missing" && (
        <Card className="flex flex-col items-center gap-2 px-6 py-12 text-center">
          <Icon name="meeting_room" size={36} className="text-text-secondary" />
          <p className="text-body font-semibold text-text-primary">{seatsCopy.roomNotFoundTitle}</p>
          <p className="text-label text-text-secondary">{seatsCopy.roomNotFoundBody}</p>
        </Card>
      )}

      {loading && (
        <Card className="h-48 animate-pulse">
          <div aria-busy="true" />
        </Card>
      )}

      {errorCode !== null && (
        <Card className="flex flex-col items-start gap-3 p-4">
          <p role="alert" className="text-label font-semibold text-danger">
            {apiErrorMessage(errorCode)}
          </p>
          <Button variant="tonal" size="sm" onClick={onRetry}>
            {seatsCopy.retry}
          </Button>
        </Card>
      )}

      {room && list.status === "ready" && list.truncated && (
        <p role="status" className="text-label font-semibold text-text-secondary">
          {seatsCopy.truncated(SEAT_LIMITS.list)}
        </p>
      )}

      {room && map}

      {room && list.status === "ready" && list.seats.length === 0 && (
        <Card className="px-6 py-12 text-center">
          <p className="text-label text-text-secondary">{seatsCopy.empty}</p>
        </Card>
      )}

      {room && list.seats.length > 0 && (
        <Card>
          <div
            role="region"
            tabIndex={0}
            aria-label={seatsCopy.tableCaption(room.code)}
            className="overflow-x-auto rounded-xl"
          >
            <table className="w-full min-w-136 border-collapse">
              <caption className="sr-only">{seatsCopy.tableCaption(room.code)}</caption>
              <thead className="border-b border-divider">
                <tr>
                  <th scope="col" className={TABLE_HEAD}>
                    {seatsCopy.columns.seat}
                  </th>
                  <th scope="col" className={TABLE_HEAD}>
                    {seatsCopy.columns.status}
                  </th>
                  <th scope="col" className={TABLE_HEAD}>
                    {seatsCopy.columns.occupant}
                  </th>
                  <th scope="col" className={TABLE_HEAD}>
                    {seatsCopy.columns.devices}
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.seats.map((seat) => {
                  const status = statusView(seat);
                  const devices = deviceSummary(seat);
                  return (
                    <tr key={seat.id} className={TABLE_ROW}>
                      <td className={TABLE_CELL}>
                        <Button
                          variant="text"
                          size="sm"
                          className="font-semibold"
                          data-seat-code={seat.code}
                          aria-haspopup="dialog"
                          aria-label={seatsCopy.openSeat(seat.code)}
                          onClick={() => onOpen(seat.code)}
                        >
                          {seat.code}
                        </Button>
                      </td>
                      <td className={TABLE_CELL}>
                        <span className="inline-flex items-center gap-1 whitespace-nowrap">
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
                      <td className={TABLE_CELL}>
                        <span className={`block max-w-56 max-h-12 ${CLIP}`}>
                          {seat.occupant ? seat.occupant.displayName : seatsCopy.noOccupant}
                        </span>
                      </td>
                      <td className={TABLE_CELL}>
                        <span
                          data-device-count={seat.deviceCount}
                          className={`block max-w-72 max-h-12 ${CLIP}`}
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
