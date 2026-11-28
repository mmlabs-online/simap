import Link from "next/link";
import type { ReactNode } from "react";
import type { SeatDto } from "@/lib/seats/types";
import { Button } from "../Button";
import { Card } from "../Card";
import { Pill } from "../Chip";
import { apiErrorMessage } from "../copy/api";
import { portalCopy } from "../copy/portal";
import { PageHeader } from "../PageHeader";
import { SeatCard } from "./SeatCard";

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
    <div className="flex flex-col gap-6">
      <h2 className="sr-only">{t.heading}</h2>

      <div aria-live="polite">
        {notice &&
          (notice.tone === "error" ? (
            <p role="alert" className="text-label font-semibold text-danger">
              {notice.text}
            </p>
          ) : (
            <p role="status" className="text-label font-semibold text-text-primary">
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
          <p role="alert" className="text-label font-semibold text-danger">
            {t.loadFailed} {apiErrorMessage(errorCode ?? "internal")}
          </p>
          <Button variant="tonal" size="sm" onClick={onRetry}>
            {t.retry}
          </Button>
        </Card>
      )}

      {status === "ready" && !empty && (
        <section aria-labelledby="assigned-seats-heading" className="flex flex-col gap-4">
          <PageHeader
            level={3}
            id="assigned-seats-heading"
            title={t.assignedHeading}
            titleAdornment={<Pill tone="neutral" label={String(seats.length)} />}
          />
          {seats.length > 0 ? (
            <ul
              aria-labelledby="assigned-seats-heading"
              className="grid grid-cols-1 gap-4 lg:grid-cols-2"
            >
              {seats.map((seat) => (
                <li key={seat.id} className="min-w-0">
                  <SeatCard seat={seat} busy={busy} onRelease={onRelease} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-label font-normal text-text-secondary">{t.noSeat}</p>
          )}
        </section>
      )}

      {empty && (
        <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <p className="text-label text-text-secondary">{t.empty}</p>
          <Link
            href="/rooms"
            className="inline-flex min-h-control items-center text-label font-semibold text-text-primary hover:underline"
          >
            {t.emptyAction}
          </Link>
        </Card>
      )}

      {requests}
    </div>
  );
}
