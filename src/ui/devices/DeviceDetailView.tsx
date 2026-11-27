import Link from "next/link";
import type { DeviceDto } from "@/lib/devices/types";
import { formatAuditTime } from "../audit/audit-state";
import { Button } from "../Button";
import { Card } from "../Card";
import { Pill } from "../Chip";
import { apiErrorMessage } from "../copy/api";
import { devicesCopy } from "../copy/devices";
import { Mac, OwnerLabel, PlacementLabel } from "./device-labels";
import { pendingText } from "./devices-state";

const copy = devicesCopy.detail;
const LABEL = "text-caption font-semibold uppercase tracking-wide text-text-secondary";

export type DeviceDetailViewProps = {
  status: "loading" | "error" | "notFound" | "ready";
  device: DeviceDto | null;
  errorCode: string | null;
  holderSince: string | null;
  onRetry: () => void;
  headingRef?: React.Ref<HTMLHeadingElement>;
  /** The history card, rendered below the sections. */
  history?: React.ReactNode;
  /** Result of the last action; the region is always mounted so a screen reader announces changes. */
  notice?: { tone: "status" | "error"; text: string } | null;
  /** The action buttons, rendered under the heading when the device is shown. */
  actions?: React.ReactNode;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className={LABEL}>{label}</dt>
      <dd className="break-all text-label text-text-primary">{children}</dd>
    </div>
  );
}

const orNone = (v: string | null) => v ?? copy.none;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-2 p-4">
      <h2 className="text-subtitle text-text-primary">{title}</h2>
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
      <span className="inline-flex flex-wrap items-center gap-1 text-label font-normal text-text-primary">
        <Pill dot tone="warning" label={text.chip} />
        {text.to && <span>{text.to}</span>}
      </span>
      <span className="text-caption text-text-secondary">
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
  notice,
  actions,
}: DeviceDetailViewProps) {
  const heading = (text: string) => (
    <h1 ref={headingRef} tabIndex={-1} className="text-display text-text-primary outline-none">
      {text}
    </h1>
  );
  return (
    <div className="page-content flex flex-col gap-4">
      <Link
        href="/devices"
        className="inline-flex min-h-control items-center self-start text-label font-semibold text-text-primary hover:underline"
      >
        {copy.back}
      </Link>

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
          <p role="alert" className="text-label font-semibold text-danger">
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
          <p className="text-label font-normal text-text-secondary">{copy.notFoundBody}</p>
        </Card>
      )}

      {status === "ready" && device && (
        <>
          {heading(device.name)}
          {actions}
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
            <span className="text-label font-normal text-text-primary">
              <PlacementLabel device={device} />
            </span>
          </Section>
          <Section title={copy.sections.holder}>
            <span className="text-label font-normal text-text-primary">
              <OwnerLabel device={device} clamp="" />
            </span>
            {holderSince && (
              <span className="text-caption text-text-secondary">
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
