import Link from "next/link";
import type { DeviceDto } from "@/lib/devices/types";
import { deviceDetailHref, roomDetailHref } from "@/lib/nav";
import { Chip } from "../Chip";
import { CLIP } from "../clip";
import { devicesCopy } from "../copy/devices";
import { detailsText, expiryText, pendingText, placementText } from "./devices-state";

export function DeviceNameLink({ device }: { device: DeviceDto }) {
  return (
    <Link href={deviceDetailHref(device.id)} className="font-semibold text-primary underline">
      {device.name}
    </Link>
  );
}

export function PlacementLabel({
  device,
  inventoryLabel = devicesCopy.inInventory,
}: {
  device: DeviceDto;
  inventoryLabel?: string;
}) {
  const p = device.placement;
  if (!p) return <span className="text-on-surface-variant">{inventoryLabel}</span>;
  const href = roomDetailHref(p.roomCode);
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {href ? (
        <Link href={href} className="font-semibold text-primary underline">
          {placementText(p)}
        </Link>
      ) : (
        <span>{placementText(p)}</span>
      )}
      <Chip label={devicesCopy.roles[p.role]} />
    </span>
  );
}

export function OwnerLabel({
  device,
  clamp = "line-clamp-1",
}: {
  device: DeviceDto;
  clamp?: string;
}) {
  const h = device.holding;
  const pending = pendingText(device);
  return (
    <span className="flex flex-col gap-0.5">
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <span>{device.owner?.displayName ?? devicesCopy.orgInventory}</span>
        {device.mine && <Chip label={devicesCopy.you} />}
        {pending && <Chip label={pending.chip} />}
        {device.overdue && (
          <Chip
            label={devicesCopy.overdueChip}
            color="var(--error-container)"
            onColor="var(--on-error-container)"
          />
        )}
      </span>
      {pending?.to && <span className="text-xs text-on-surface-variant">{pending.to}</span>}
      {h && (
        <>
          <span className="text-xs text-on-surface-variant">{expiryText(h, device.overdue)}</span>
          {h.note && (
            <span
              title={h.note}
              className={`text-xs text-on-surface-variant whitespace-pre-line ${clamp} ${CLIP}`}
            >
              {h.note}
            </span>
          )}
        </>
      )}
    </span>
  );
}

export function Details({ device }: { device: DeviceDto }) {
  const { maker, serial } = detailsText(device);
  if (maker === null && serial === null) return <span>{devicesCopy.details.none}</span>;
  return (
    <span className="flex flex-col gap-0.5">
      {maker && <span className="break-all">{maker}</span>}
      {serial && <span className="break-all text-xs text-on-surface-variant">{serial}</span>}
    </span>
  );
}

export function Mac({ mac }: { mac: string | null }) {
  return mac ? <span className="font-mono">{mac}</span> : <span>{devicesCopy.noMac}</span>;
}
