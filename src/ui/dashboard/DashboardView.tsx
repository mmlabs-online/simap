import Link from "next/link";
import type { DashboardDto } from "@/lib/dashboard/types";
import type { ExportKind } from "@/lib/export/csv";
import { roomDetailHref } from "@/lib/nav";
import { occupancyPercent } from "@/lib/rooms/occupancy";
import { apiErrorMessage } from "../copy/api";
import { dashboardCopy as copy } from "../copy/dashboard";
import { shellCopy } from "../copy/shell";
import { Button } from "../Button";
import { Card } from "../Card";
import { Icon } from "../Icon";
import { RoomCard } from "../rooms/RoomCard";
import { ExportCard } from "./ExportCard";
import { StatTile } from "./StatTile";

export type DashboardViewProps = {
  status: "loading" | "error" | "ready";
  data: DashboardDto | null;
  errorCode: string | null;
  onRetry: () => void;
  canExport?: boolean;
  exporting?: ExportKind | null;
  exportError?: string | null;
  exportNotice?: string | null;
  onExport?: (kind: ExportKind) => void;
};

const TILES = "grid gap-4 grid-cols-2 lg:grid-cols-3";
const GRID = "grid gap-4 sm:grid-cols-2 xl:grid-cols-3";

function HoldersWarning({ holders }: { holders: NonNullable<DashboardDto["deactivatedHolders"]> }) {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2 text-danger">
        <Icon name="block" />
        <h2 className="text-label font-semibold">{copy.holders.title(holders.total)}</h2>
      </div>
      <p className="text-label text-text-secondary">{copy.holders.hint}</p>
      <ul className="flex flex-col gap-2">
        {holders.items.map((h) => (
          <li
            key={h.member.id}
            className="flex flex-wrap items-center gap-x-2 gap-y-1 text-label font-normal"
          >
            <span className="font-semibold text-text-primary">{h.member.displayName}</span>
            <span className="text-text-secondary">{copy.holders.seatCount(h.seatCount)}</span>
            {h.seats.map((s) => {
              const href = roomDetailHref(s.roomCode);
              return href ? (
                <Link
                  key={s.id}
                  href={href}
                  className="font-medium text-text-primary hover:underline"
                >
                  {s.code}
                </Link>
              ) : (
                <span key={s.id}>{s.code}</span>
              );
            })}
            {h.seatCount > h.seats.length && (
              <span className="text-text-secondary">
                {copy.holders.moreSeats(h.seatCount - h.seats.length)}
              </span>
            )}
          </li>
        ))}
      </ul>
      {holders.total > holders.items.length && (
        <p className="text-label text-text-secondary">
          {copy.holders.moreMembers(holders.total - holders.items.length)}
        </p>
      )}
    </Card>
  );
}

/** The Dashboard page body. Pure: data and handlers come from props. */
export function DashboardView({
  status,
  data,
  errorCode,
  onRetry,
  canExport = false,
  exporting = null,
  exportError = null,
  exportNotice = null,
  onExport = () => {},
}: DashboardViewProps) {
  return (
    <div className="page-content flex flex-col gap-4">
      <h1 className="text-display text-text-primary">{shellCopy.pages.dashboard.title}</h1>

      {status === "loading" && (
        <div aria-busy="true" className={TILES}>
          {[0, 1, 2].map((i) => (
            <Card key={i} className="h-24 animate-pulse">
              {null}
            </Card>
          ))}
        </div>
      )}

      {status === "error" && (
        <Card className="flex flex-col items-start gap-3 p-4">
          <p role="alert" className="text-label font-semibold text-danger">
            {apiErrorMessage(errorCode ?? "internal")}
          </p>
          <Button variant="tonal" size="sm" onClick={onRetry}>
            {copy.retry}
          </Button>
        </Card>
      )}

      {status === "ready" && data && (
        <>
          <div className={TILES}>
            <StatTile icon="meeting_room" label={copy.tiles.rooms} value={`${data.totals.rooms}`} />
            <StatTile icon="event_seat" label={copy.tiles.seats} value={`${data.totals.seats}`} />
            <StatTile icon="person" label={copy.tiles.occupied} value={`${data.totals.occupied}`} />
            <StatTile
              icon="space_dashboard"
              label={copy.tiles.rate}
              value={copy.percent(occupancyPercent(data.totals.occupied, data.totals.seats))}
            />
            <StatTile
              icon="lan"
              label={copy.tiles.devicesPlaced}
              value={`${data.totals.devicesPlaced}`}
            />
            <StatTile
              icon="inbox"
              label={copy.tiles.devicesInventory}
              value={`${data.totals.devicesInventory}`}
            />
          </div>

          {data.deactivatedHolders && data.deactivatedHolders.total > 0 && (
            <HoldersWarning holders={data.deactivatedHolders} />
          )}

          <h2 className="text-subtitle text-text-primary">{copy.roomsHeading}</h2>
          {data.rooms.length === 0 ? (
            <Card className="px-6 py-12 text-center">
              <p className="text-label text-text-secondary">{copy.noRooms}</p>
            </Card>
          ) : (
            <div className={GRID}>
              {data.rooms.map((room) => (
                <RoomCard key={room.id} room={room} />
              ))}
            </div>
          )}
          {data.roomsTruncated && (
            <p className="text-label text-text-secondary">
              {copy.roomsTruncated(data.rooms.length, data.totals.rooms)}
            </p>
          )}
          {canExport && (
            <ExportCard
              exporting={exporting}
              error={exportError ? apiErrorMessage(exportError) : null}
              notice={exportNotice}
              onExport={onExport}
            />
          )}
        </>
      )}
    </div>
  );
}
