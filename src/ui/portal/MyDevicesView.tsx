import type { DeviceDto } from "@/lib/devices/types";
import { Button } from "../Button";
import { Card } from "../Card";
import { apiErrorMessage } from "../copy/api";
import { portalCopy } from "../copy/portal";
import type { DeviceRowHandlers } from "../devices/device-actions";
import { DeviceTable } from "../devices/DeviceTable";

export type MyDevicesViewProps = {
  status: "loading" | "error" | "ready";
  devices: DeviceDto[];
  hasMore: boolean;
  loadingMore: boolean;
  errorCode: string | null;
  actions: DeviceRowHandlers;
  busyId: string | null;
  notice: { tone: "status" | "error"; text: string } | null;
  headingRef?: React.Ref<HTMLHeadingElement>;
  /** The overdue banner, rendered above the incoming transfers. */
  banner?: React.ReactNode;
  /** The "Waiting for my confirmation" section. */
  incoming?: React.ReactNode;
  onRetry: () => void;
  onLoadMore: () => void;
};

/** The My devices tab body. Pure: data and handlers come from props. */
export function MyDevicesView({
  status,
  devices,
  hasMore,
  loadingMore,
  errorCode,
  actions,
  busyId,
  notice,
  headingRef,
  banner,
  incoming,
  onRetry,
  onLoadMore,
}: MyDevicesViewProps) {
  return (
    <div className="flex flex-col gap-4">
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-lg font-extrabold text-on-surface outline-none"
      >
        {portalCopy.devices.heading}
      </h2>

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

      {banner}
      {incoming}

      {status === "loading" && (
        <div aria-busy="true" className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="h-12 animate-pulse">
              {null}
            </Card>
          ))}
        </div>
      )}

      {status === "error" && devices.length === 0 && (
        <Card className="flex flex-col items-start gap-3 p-4">
          <p role="alert" className="text-sm font-semibold text-error">
            {apiErrorMessage(errorCode ?? "internal")}
          </p>
          <Button variant="tonal" size="sm" onClick={onRetry}>
            {portalCopy.devices.retry}
          </Button>
        </Card>
      )}

      {status === "ready" && devices.length === 0 && (
        <Card className="px-6 py-12 text-center">
          <p className="text-sm font-medium text-on-surface-variant">{portalCopy.devices.empty}</p>
        </Card>
      )}

      {devices.length > 0 && status !== "loading" && (
        <DeviceTable devices={devices} actions={actions} busyId={busyId} />
      )}

      {status === "ready" && errorCode !== null && devices.length > 0 && (
        <p role="alert" className="text-sm font-semibold text-error">
          {portalCopy.devices.loadMoreFailed} {apiErrorMessage(errorCode)}
        </p>
      )}

      {status === "ready" && hasMore && (
        <div>
          <Button variant="tonal" size="sm" disabled={loadingMore} onClick={onLoadMore}>
            {portalCopy.devices.loadMore}
          </Button>
        </div>
      )}
    </div>
  );
}
