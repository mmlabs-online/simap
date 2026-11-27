import type { HandoffDto } from "@/lib/devices/types";
import { apiErrorMessage } from "../copy/api";
import { devicesCopy } from "../copy/devices";
import { Button } from "../Button";
import { Card } from "../Card";

const copy = devicesCopy.incoming;

export type IncomingTransfersProps = {
  items: HandoffDto[];
  truncated: boolean;
  errorCode: string | null;
  busyId: string | null;
  onConfirm: (item: HandoffDto) => void;
  onDecline: (item: HandoffDto) => void;
  onRetry: () => void;
  headingRef?: React.Ref<HTMLHeadingElement>;
};

/** The recipient's pending transfers. Pure: data and handlers come from props. Renders nothing when empty. */
export function IncomingTransfers({
  items,
  truncated,
  errorCode,
  busyId,
  onConfirm,
  onDecline,
  onRetry,
  headingRef,
}: IncomingTransfersProps) {
  if (items.length === 0 && errorCode === null) return null;
  const busy = busyId !== null;
  return (
    <section aria-labelledby="incoming-heading" className="flex flex-col gap-3">
      <h2
        id="incoming-heading"
        ref={headingRef}
        tabIndex={-1}
        className="text-subtitle text-text-primary outline-none"
      >
        {copy.heading(items.length)}
      </h2>
      {items.length > 0 && (
        <p className="text-label font-normal text-text-secondary">{copy.hint}</p>
      )}

      {errorCode !== null && (
        <div className="flex flex-wrap items-center gap-3">
          <p role="alert" className="text-label font-semibold text-danger">
            {apiErrorMessage(errorCode)}
          </p>
          <Button variant="tonal" size="sm" onClick={onRetry}>
            {devicesCopy.retry}
          </Button>
        </div>
      )}

      {items.length > 0 && (
        <ul role="list" className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id}>
              <Card className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="text-label font-normal text-text-primary">
                    <span className="font-semibold">{item.device.name}</span>{" "}
                    {devicesCopy.typeLine(item.device.type, item.device.inventoryNumber)}
                  </p>
                  <p className="text-label font-normal text-text-secondary">
                    {copy.from(item.from.displayName)}
                  </p>
                  {item.note !== null && (
                    <p className="whitespace-pre-line line-clamp-3 text-label font-normal text-text-secondary">
                      {item.note}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-2 lg:flex-row">
                  {item.canConfirm && (
                    <Button
                      size="sm"
                      data-handoff-confirm={item.id}
                      disabled={busy}
                      aria-label={copy.confirmAria(
                        item.device.name,
                        item.device.inventoryNumber,
                        item.from.displayName,
                      )}
                      onClick={() => onConfirm(item)}
                    >
                      {copy.confirm}
                    </Button>
                  )}
                  {item.canDecline && (
                    <Button
                      size="sm"
                      variant="tonal"
                      disabled={busy}
                      aria-label={copy.declineAria(
                        item.device.name,
                        item.device.inventoryNumber,
                        item.from.displayName,
                      )}
                      onClick={() => onDecline(item)}
                    >
                      {copy.decline}
                    </Button>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {truncated && (
        <p className="text-label font-normal text-text-secondary">{copy.truncated(items.length)}</p>
      )}
    </section>
  );
}
