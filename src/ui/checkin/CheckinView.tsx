import { useId, type ReactNode } from "react";
import Link from "next/link";
import { Button } from "../Button";
import { Card } from "../Card";
import { apiErrorMessage } from "../copy/api";
import { checkinCopy } from "../copy/checkin";

export type CheckinViewState =
  | { kind: "loading" }
  | { kind: "error"; code: string; onRetry: () => void }
  | { kind: "noSeat" }
  | { kind: "room"; roomHeading: string; map: ReactNode };

/** The slot for the floating Check in / Check out button (filled by `CheckinButton`, SIM-059). */
export function CheckinButtonSlot({ children }: { children?: ReactNode }) {
  return (
    <div
      data-slot="checkin-button"
      className="pointer-events-none fixed right-4 z-20 bottom-[calc(--spacing(20)+env(safe-area-inset-bottom))] lg:bottom-6"
    >
      {children}
    </div>
  );
}

/** The check-in room view. Pure: state and slots come from props. */
export function CheckinView({
  state,
  switcher,
  button,
  whosHere,
}: {
  state: CheckinViewState;
  switcher: ReactNode;
  button?: ReactNode;
  /** The "Who's here" list (SIM-060); without it the card shows the placeholder. */
  whosHere?: ReactNode;
}) {
  const headingId = useId();
  let body: ReactNode;
  if (state.kind === "loading") {
    body = (
      <Card className="h-48 animate-pulse">
        <div aria-busy="true" aria-label={checkinCopy.loading} />
      </Card>
    );
  } else if (state.kind === "error") {
    body = (
      <Card className="flex flex-col items-start gap-3 p-4">
        <p role="alert" className="text-label font-semibold text-danger">
          {apiErrorMessage(state.code)}
        </p>
        <Button variant="tonal" size="sm" onClick={state.onRetry}>
          {checkinCopy.retry}
        </Button>
      </Card>
    );
  } else if (state.kind === "noSeat") {
    body = (
      <Card className="flex flex-col items-start gap-3 p-4">
        <p className="text-body font-semibold text-text-primary">{checkinCopy.noSeatTitle}</p>
        <Link
          href="/rooms"
          className="inline-flex min-h-control items-center text-label font-semibold text-text-primary underline"
        >
          {checkinCopy.requestSeat}
        </Link>
      </Card>
    );
  } else {
    body = (
      <>
        <h2 className="text-subtitle text-text-primary">{state.roomHeading}</h2>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_--spacing(75)]">
          <div className="min-w-0">{state.map}</div>
          <section aria-labelledby={headingId}>
            <Card className="p-4">
              <h2 id={headingId} className="text-subtitle text-text-primary">
                {checkinCopy.whosHereTitle}
              </h2>
              {whosHere ?? (
                <p className="mt-2 text-label font-normal text-text-secondary">
                  {checkinCopy.whosHerePlaceholder}
                </p>
              )}
            </Card>
          </section>
        </div>
      </>
    );
  }
  return (
    <div className="page-content flex flex-col gap-4">
      <h1 className="text-display text-text-primary">{checkinCopy.title}</h1>
      <div className="flex items-center gap-2">{switcher}</div>
      {body}
      <CheckinButtonSlot>{button}</CheckinButtonSlot>
    </div>
  );
}
