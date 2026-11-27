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
    <li className="flex flex-col gap-1 border-t border-divider py-3 text-label font-normal first:border-t-0">
      <span className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-semibold text-text-primary">{historyKindLabel(e.kind)}</span>
        <time dateTime={e.at} className="text-caption text-text-secondary">
          {formatAuditTime(e.at)}
        </time>
        <span className="text-caption text-text-secondary">
          {copy.byActor(historyMemberLabel(e.actor))}
        </span>
      </span>
      {fromTo && <span className="text-text-primary">{fromTo}</span>}
      {expiry && <span className="text-caption text-text-secondary">{expiry}</span>}
      {cause && <span className="text-caption text-text-secondary">{cause}</span>}
      {e.confirmedBy && (
        <span className="text-caption text-text-secondary">
          {copy.confirmedBy(historyMemberLabel(e.confirmedBy))}
        </span>
      )}
      {e.note && (
        <span className={`text-caption text-text-secondary whitespace-pre-line ${CLIP}`}>
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
      <h2 id="device-history-title" className="text-subtitle text-text-primary">
        {copy.title}
      </h2>
      {status === "loading" && (
        <div aria-busy="true">
          <Card className="h-24 animate-pulse">{null}</Card>
        </div>
      )}
      {status === "error" && (
        <Card className="flex flex-col items-start gap-3 p-4">
          <p role="alert" className="text-label font-semibold text-danger">
            {apiErrorMessage(errorCode ?? "internal")}
          </p>
          <Button variant="tonal" size="sm" onClick={onRetry}>
            {devicesCopy.retry}
          </Button>
        </Card>
      )}
      {status === "ready" && items.length === 0 && (
        <Card className="px-6 py-8 text-center">
          <p className="text-label text-text-secondary">{copy.empty}</p>
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
        <p role="alert" className="text-label font-semibold text-danger">
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
