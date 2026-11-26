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
      className="pointer-events-none fixed right-4 z-20 bottom-[calc(68px+env(safe-area-inset-bottom)+1rem)] lg:bottom-6"
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
}: {
  state: CheckinViewState;
  switcher: ReactNode;
  button?: ReactNode;
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
        <p role="alert" className="text-sm font-semibold text-error">
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
        <p className="text-base font-bold text-on-surface">{checkinCopy.noSeatTitle}</p>
        <Link href="/rooms" className="text-sm font-bold text-primary underline">
          {checkinCopy.requestSeat}
        </Link>
      </Card>
    );
  } else {
    body = (
      <>
        <h2 className="text-base font-bold text-on-surface">{state.roomHeading}</h2>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0">{state.map}</div>
          <section aria-labelledby={headingId}>
            <Card className="p-4">
              <h2 id={headingId} className="text-base font-bold text-on-surface">
                {checkinCopy.whosHereTitle}
              </h2>
              <p className="mt-2 text-sm text-on-surface-variant">
                {checkinCopy.whosHerePlaceholder}
              </p>
            </Card>
          </section>
        </div>
      </>
    );
  }
  return (
    <div className="p-4 lg:p-6 flex flex-col gap-4">
      <h1 className="text-xl font-extrabold text-on-surface">{checkinCopy.title}</h1>
      <div className="flex items-center gap-2">{switcher}</div>
      {body}
      <CheckinButtonSlot>{button}</CheckinButtonSlot>
    </div>
  );
}
