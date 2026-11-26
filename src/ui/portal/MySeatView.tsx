import Link from "next/link";
import type { ReactNode } from "react";
import type { SeatDto } from "@/lib/seats/types";
import { Button } from "../Button";
import { Card } from "../Card";
import { apiErrorMessage } from "../copy/api";
import { portalCopy } from "../copy/portal";
import { seatResultHref } from "../search/search-state";

export type MySeatViewProps = {
  status: "loading" | "ready" | "error";
  seats: SeatDto[];
  errorCode: string | null;
  empty: boolean;
  busy: boolean;
  notice: { tone: "status" | "error"; text: string } | null;
  /** The requests section. */
  requests?: ReactNode;
  onRetry: () => void;
  onRelease: (seat: SeatDto) => void;
};

/** The My seat tab body. Pure: data and handlers come from props. */
export function MySeatView({
  status,
  seats,
  errorCode,
  empty,
  busy,
  notice,
  requests,
  onRetry,
  onRelease,
}: MySeatViewProps) {
  const t = portalCopy.seat;
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-extrabold text-on-surface">{t.heading}</h2>

      <div aria-live="polite">
        {notice &&
          (notice.tone === "error" ? (
            <p role="alert" className="text-sm font-semibold text-error">
              {notice.text}
            </p>
          ) : (
            <p role="status" className="text-sm font-semibold text-on-surface">
              {notice.text}
            </p>
          ))}
      </div>

      {status === "loading" && (
        <Card className="h-32 animate-pulse">
          <div aria-busy="true" className="h-full" />
        </Card>
      )}

      {status === "error" && (
        <Card className="flex flex-col items-start gap-3 p-4">
          <p role="alert" className="text-sm font-semibold text-error">
            {t.loadFailed} {apiErrorMessage(errorCode ?? "internal")}
          </p>
          <Button variant="tonal" size="sm" onClick={onRetry}>
            {t.retry}
          </Button>
        </Card>
      )}

      {status === "ready" && seats.length > 0 && (
        <ul aria-label={t.heading} className="grid gap-3">
          {seats.map((seat) => {
            const href = seatResultHref(seat);
            return (
              <li key={seat.id}>
                <Card className="flex min-w-0 flex-col gap-2 break-words p-4">
                  <span className="text-sm font-bold text-on-surface">{seat.code}</span>
                  <dl className="grid gap-1 text-xs text-on-surface-variant">
                    <div>
                      <dt className="inline font-semibold">{t.room}: </dt>
                      <dd className="inline">{seat.roomCode}</dd>
                    </div>
                    <div>
                      <dt className="inline font-semibold">{t.group}: </dt>
                      <dd className="inline">{seat.group?.name ?? t.noTag}</dd>
                    </div>
                    <div>
                      <dt className="inline font-semibold">{t.project}: </dt>
                      <dd className="inline">{seat.project?.name ?? t.noTag}</dd>
                    </div>
                  </dl>
                  <div className="flex flex-wrap items-center gap-3">
                    {href !== null && (
                      <Link href={href} className="font-semibold text-primary hover:underline">
                        {t.viewOnMap}
                      </Link>
                    )}
                    <Button
                      variant="tonal"
                      size="sm"
                      className="min-h-11"
                      disabled={busy}
                      onClick={() => onRelease(seat)}
                    >
                      {t.release}
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {status === "ready" && seats.length === 0 && !empty && (
        <p className="text-sm text-on-surface-variant">{t.noSeat}</p>
      )}

      {empty && (
        <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <p className="text-sm font-medium text-on-surface-variant">{t.empty}</p>
          <Link href="/rooms" className="font-semibold text-primary hover:underline">
            {t.emptyAction}
          </Link>
        </Card>
      )}

      {requests}
    </div>
  );
}
