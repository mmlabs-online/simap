import type { HandoffDto } from "@/lib/devices/types";
import { apiErrorMessage } from "../copy/api";
import { devicesCopy } from "../copy/devices";
import { Button } from "../Button";
import { Card } from "../Card";

const copy = devicesCopy.extensions;

export type PendingExtensionsProps = {
  items: HandoffDto[];
  truncated: boolean;
  errorCode: string | null;
  busyId: string | null;
  onApprove: (item: HandoffDto) => void;
  onReject: (item: HandoffDto) => void;
  onRetry: () => void;
  headingRef?: React.Ref<HTMLHeadingElement>;
};

/** The Manager's pending extension requests. Pure: data and handlers come from props. Renders nothing when empty. */
export function PendingExtensions({
  items,
  truncated,
  errorCode,
  busyId,
  onApprove,
  onReject,
  onRetry,
  headingRef,
}: PendingExtensionsProps) {
  if (items.length === 0 && errorCode === null) return null;
  const busy = busyId !== null;
  return (
    <section aria-labelledby="extensions-heading" className="flex flex-col gap-3">
      <h2
        id="extensions-heading"
        ref={headingRef}
        tabIndex={-1}
        className="text-lg font-extrabold text-on-surface outline-none"
      >
        {copy.heading(items.length)}
      </h2>
      {items.length > 0 && <p className="text-sm text-on-surface-variant">{copy.hint}</p>}

      {errorCode !== null && (
        <div className="flex flex-wrap items-center gap-3">
          <p role="alert" className="text-sm font-semibold text-error">
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
              <Card className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="text-sm text-on-surface">
                    <span className="font-bold">{item.device.name}</span>{" "}
                    {devicesCopy.typeLine(item.device.type, item.device.inventoryNumber)}
                  </p>
                  <p className="text-sm text-on-surface-variant">
                    {copy.owner(item.from.displayName)}
                  </p>
                  <p className="text-sm text-on-surface-variant">
                    {copy.change(item.device.expiresOn ?? copy.noExpiry, item.newExpiresOn ?? "")}
                  </p>
                  {item.note !== null && (
                    <p className="whitespace-pre-line line-clamp-3 text-sm text-on-surface-variant">
                      {item.note}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-2 md:flex-row">
                  {item.canConfirm && (
                    <Button
                      size="sm"
                      data-handoff-confirm={item.id}
                      disabled={busy}
                      aria-label={copy.approveAria(
                        item.device.name,
                        item.device.inventoryNumber,
                        item.from.displayName,
                      )}
                      onClick={() => onApprove(item)}
                    >
                      {copy.approve}
                    </Button>
                  )}
                  {item.canDecline && (
                    <Button
                      size="sm"
                      variant="tonal"
                      disabled={busy}
                      aria-label={copy.rejectAria(
                        item.device.name,
                        item.device.inventoryNumber,
                        item.from.displayName,
                      )}
                      onClick={() => onReject(item)}
                    >
                      {copy.reject}
                    </Button>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {truncated && (
        <p className="text-sm text-on-surface-variant">{copy.truncated(items.length)}</p>
      )}
    </section>
  );
}
