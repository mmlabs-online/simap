import Link from "next/link";
import type { DeviceDto } from "@/lib/devices/types";
import { formatAuditTime } from "../audit/audit-state";
import { Button } from "../Button";
import { Card } from "../Card";
import { Chip } from "../Chip";
import { apiErrorMessage } from "../copy/api";
import { devicesCopy } from "../copy/devices";
import type { DeviceNotice } from "./device-detail-actions";
import { Mac, OwnerLabel, PlacementLabel } from "./device-labels";
import { pendingText } from "./devices-state";

const copy = devicesCopy.detail;
const LABEL = "text-[11px] font-extrabold tracking-[0.05em] uppercase text-on-surface-variant";

export type DeviceDetailViewProps = {
  status: "loading" | "error" | "notFound" | "ready";
  device: DeviceDto | null;
  errorCode: string | null;
  holderSince: string | null;
  onRetry: () => void;
  headingRef?: React.Ref<HTMLHeadingElement>;
  /** The history card, rendered below the sections. */
  history?: React.ReactNode;
  /** The action bar, shown next to the heading when ready. */
  actions?: React.ReactNode;
  /** The result of the last action; its live region is always mounted. */
  notice?: DeviceNotice | null;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className={LABEL}>{label}</dt>
      <dd className="text-sm font-medium text-on-surface break-all">{children}</dd>
    </div>
  );
}

const orNone = (v: string | null) => v ?? copy.none;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-2 p-4">
      <h2 className="text-h3 font-extrabold text-on-surface">{title}</h2>
      {children}
    </Card>
  );
}

function Pending({ device }: { device: DeviceDto }) {
  const p = device.pendingHandoff;
  const text = pendingText(device);
  if (!p || !text) return null;
  return (
    <Section title={copy.sections.pending}>
      <span className="inline-flex flex-wrap items-center gap-1.5 text-sm text-on-surface">
        <Chip label={text.chip} />
        {text.to && <span>{text.to}</span>}
      </span>
      <span className="text-xs text-on-surface-variant">
        {copy.requestedBy(p.requestedBy.displayName)} · {formatAuditTime(p.createdAt)}
      </span>
    </Section>
  );
}

/** The device detail page body. Pure: data and handlers come from props. */
export function DeviceDetailView({
  status,
  device,
  errorCode,
  holderSince,
  onRetry,
  headingRef,
  history,
  actions,
  notice,
}: DeviceDetailViewProps) {
  const heading = (text: string) => (
    <h1
      ref={headingRef}
      tabIndex={-1}
      className="text-h2 font-extrabold text-on-surface outline-none"
    >
      {text}
    </h1>
  );
  return (
    <div className="p-4 lg:p-6 flex flex-col gap-4">
      <Link href="/devices" className="text-sm font-semibold text-primary hover:underline">
        {copy.back}
      </Link>

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
        <div aria-busy="true" className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="h-12 animate-pulse">
              {null}
            </Card>
          ))}
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

      {status === "notFound" && (
        <Card className="flex flex-col items-start gap-2 p-4">
          {heading(copy.notFoundTitle)}
          <p className="text-sm text-on-surface-variant">{copy.notFoundBody}</p>
        </Card>
      )}

      {status === "ready" && device && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {heading(device.name)}
            {actions}
          </div>
          <Section title={copy.sections.fields}>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={copy.labels.type}>{device.type}</Field>
              <Field label={copy.labels.inventoryNumber}>{device.inventoryNumber}</Field>
              <Field label={copy.labels.mac}>
                <Mac mac={device.mac} />
              </Field>
              <Field label={copy.labels.serial}>{orNone(device.serial)}</Field>
              <Field label={copy.labels.manufacturer}>{orNone(device.manufacturer)}</Field>
              <Field label={copy.labels.brand}>{orNone(device.brand)}</Field>
            </dl>
          </Section>
          <Section title={copy.sections.where}>
            <span className="text-sm text-on-surface">
              <PlacementLabel device={device} />
            </span>
          </Section>
          <Section title={copy.sections.holder}>
            <span className="text-sm text-on-surface">
              <OwnerLabel device={device} clamp="" />
            </span>
            {holderSince && (
              <span className="text-xs text-on-surface-variant">
                {copy.holderSince(formatAuditTime(holderSince))}
              </span>
            )}
          </Section>
          <Pending device={device} />
        </>
      )}

      {status !== "notFound" && history}
    </div>
  );
}
