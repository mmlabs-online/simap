import type { DeviceHistoryEntryDto } from "@/lib/devices/types";
import { formatAuditTime } from "../audit/audit-state";
import { Button } from "../Button";
import { Card } from "../Card";
import { CLIP } from "../clip";
import { apiErrorMessage } from "../copy/api";
import { devicesCopy } from "../copy/devices";
import {
  historyCause,
  historyExpiryText,
  historyFromTo,
  historyKindLabel,
  historyMemberLabel,
} from "./device-history";

const copy = devicesCopy.history;

export type DeviceHistoryProps = {
  status: "loading" | "error" | "ready";
  items: DeviceHistoryEntryDto[];
  hasMore: boolean;
  loadingMore: boolean;
  moreError: boolean;
  errorCode: string | null;
  onRetry: () => void;
  onLoadMore: () => void;
};

function Entry({ e }: { e: DeviceHistoryEntryDto }) {
  const fromTo = historyFromTo(e);
  const expiry = historyExpiryText(e);
  const cause = historyCause(e);
  return (
    <li className="flex flex-col gap-0.5 border-t border-outline-variant py-3 text-sm first:border-t-0">
      <span className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-bold text-on-surface">{historyKindLabel(e.kind)}</span>
        <time dateTime={e.at} className="text-xs text-on-surface-variant">
          {formatAuditTime(e.at)}
        </time>
        <span className="text-xs text-on-surface-variant">
          {copy.byActor(historyMemberLabel(e.actor))}
        </span>
      </span>
      {fromTo && <span className="text-on-surface">{fromTo}</span>}
      {expiry && <span className="text-xs text-on-surface-variant">{expiry}</span>}
      {cause && <span className="text-xs text-on-surface-variant">{cause}</span>}
      {e.confirmedBy && (
        <span className="text-xs text-on-surface-variant">
          {copy.confirmedBy(historyMemberLabel(e.confirmedBy))}
        </span>
      )}
      {e.note && (
        <span className={`text-xs text-on-surface-variant whitespace-pre-line ${CLIP}`}>
          {e.note}
        </span>
      )}
    </li>
  );
}

/** The history card of a device. Pure; it has its own loading, error and empty states. */
export function DeviceHistory({
  status,
  items,
  hasMore,
  loadingMore,
  moreError,
  errorCode,
  onRetry,
  onLoadMore,
}: DeviceHistoryProps) {
  return (
    <section aria-labelledby="device-history-title" className="flex flex-col gap-2">
      <h2 id="device-history-title" className="text-h3 font-extrabold text-on-surface">
        {copy.title}
      </h2>
      {status === "loading" && (
        <div aria-busy="true">
          <Card className="h-24 animate-pulse">{null}</Card>
        </div>
      )}
      {status === "error" && (
        <Card className="flex flex-col items-start gap-3 p-4">
          <p role="alert" className="text-sm font-semibold text-error">
            {apiErrorMessage(errorCode ?? "internal")}
          </p>
          <Button variant="tonal" size="sm" onClick={onRetry}>
            {devicesCopy.retry}
          </Button>
        </Card>
      )}
      {status === "ready" && items.length === 0 && (
        <Card className="px-6 py-8 text-center">
          <p className="text-sm font-medium text-on-surface-variant">{copy.empty}</p>
        </Card>
      )}
      {status === "ready" && items.length > 0 && (
        <Card className="px-4">
          <ol>
            {items.map((e) => (
              <Entry key={e.id} e={e} />
            ))}
          </ol>
        </Card>
      )}
      {status === "ready" && moreError && (
        <p role="alert" className="text-sm font-semibold text-error">
          {copy.loadMoreFailed}
        </p>
      )}
      {status === "ready" && hasMore && (
        <div>
          <Button variant="tonal" size="sm" onClick={onLoadMore} disabled={loadingMore}>
            {copy.loadMore}
          </Button>
        </div>
      )}
    </section>
  );
}
