import { useState } from "react";
import type { DeviceDto } from "@/lib/devices/types";
import { Button } from "../Button";
import { Card } from "../Card";
import { apiErrorMessage } from "../copy/api";
import { portalCopy } from "../copy/portal";
import type { DeviceRowHandlers } from "../devices/device-actions";
import { PageHeader } from "../PageHeader";
import { MyDevicesTable } from "./MyDevicesTable";
import { MyDevicesTiles } from "./MyDevicesTiles";

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
  const [query, setQuery] = useState("");
  const [typeKey, setTypeKey] = useState("");
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={portalCopy.devices.heading}
        subtitle={portalCopy.devices.subtitle}
        headingRef={headingRef}
      />

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
          <p role="alert" className="text-label font-semibold text-danger">
            {apiErrorMessage(errorCode ?? "internal")}
          </p>
          <Button variant="tonal" size="sm" onClick={onRetry}>
            {portalCopy.devices.retry}
          </Button>
        </Card>
      )}

      {status === "ready" && devices.length === 0 && (
        <Card className="px-6 py-12 text-center">
          <p className="text-label text-text-secondary">{portalCopy.devices.empty}</p>
        </Card>
      )}

      {devices.length > 0 && status !== "loading" && (
        <>
          <MyDevicesTiles devices={devices} hasMore={status === "ready" && hasMore} />
          <MyDevicesTable
            devices={devices}
            hasMore={status === "ready" && hasMore}
            loadingMore={loadingMore}
            errorCode={status === "ready" ? errorCode : null}
            actions={actions}
            busyId={busyId}
            query={query}
            typeKey={typeKey}
            onQueryChange={setQuery}
            onTypeChange={setTypeKey}
            onClear={() => {
              setQuery("");
              setTypeKey("");
            }}
            onLoadMore={onLoadMore}
          />
        </>
      )}
    </div>
  );
}
