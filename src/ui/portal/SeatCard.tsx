import Link from "next/link";
import type { SeatDto } from "@/lib/seats/types";
import { Button } from "../Button";
import { Card } from "../Card";
import { Pill } from "../Chip";
import { portalCopy } from "../copy/portal";
import { Icon } from "../Icon";
import { seatResultHref } from "../search/search-state";

/** One assigned seat: code, room, tags, View on map and Release. Pure: handlers come from props. */
export function SeatCard({
  seat,
  busy,
  onRelease,
}: {
  seat: SeatDto;
  busy: boolean;
  onRelease: (seat: SeatDto) => void;
}) {
  const t = portalCopy.seat;
  const href = seatResultHref(seat);
  return (
    <Card as="article" className="flex min-w-0 flex-col break-words">
      <div className="p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-canvas text-workspace-primary">
            <Icon name="chair" size={24} />
          </span>
          <div className="min-w-0 flex-1">
            <h4 className="text-body font-semibold text-text-primary">{seat.code}</h4>
            <p className="flex items-center gap-1 text-label font-normal text-text-secondary">
              <Icon name="meeting_room" size={16} />
              {t.roomLine(seat.roomCode)}
            </p>
          </div>
          <Pill tone="success" label={t.assigned} />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-4 rounded-xl bg-canvas p-4 text-label font-normal">
          <div>
            <dt className="text-text-secondary">{t.group}</dt>
            <dd className="font-semibold text-text-primary">{seat.group?.name ?? t.noTag}</dd>
          </div>
          <div>
            <dt className="text-text-secondary">{t.project}</dt>
            <dd className="font-semibold text-text-primary">{seat.project?.name ?? t.noTag}</dd>
          </div>
        </dl>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-divider px-4 py-3 sm:px-5">
        {href !== null ? (
          <Link
            href={href}
            className="inline-flex min-h-control items-center gap-1 text-label font-semibold text-text-primary hover:underline"
          >
            <Icon name="grid_view" size={18} />
            {t.viewOnMap}
            <Icon name="arrow_forward" size={18} />
          </Link>
        ) : (
          <span />
        )}
        <Button variant="outlined" size="sm" disabled={busy} onClick={() => onRelease(seat)}>
          {t.release}
        </Button>
      </div>
    </Card>
  );
}
