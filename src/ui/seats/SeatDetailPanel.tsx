"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import Link from "next/link";
import { deviceDetailHref } from "@/lib/nav";
import type { SeatDeviceDto, SeatDto } from "@/lib/seats/types";
import { apiErrorMessage } from "../copy/api";
import { seatsCopy } from "../copy/seats";
import { Avatar } from "../Avatar";
import { Button, IconButton } from "../Button";
import { Icon } from "../Icon";
import { isOutsideRect, splitDevices, statusView, type PanelView } from "./seat-view";
import { CLIP } from "../clip";

const LABEL = "text-caption font-semibold uppercase tracking-wide text-text-secondary";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className={LABEL}>{label}</dt>
      <dd className="text-label text-text-primary">{children}</dd>
    </div>
  );
}

function Device({ device }: { device: SeatDeviceDto }) {
  return (
    <li className={`max-h-24 ${CLIP}`}>
      <Link
        href={deviceDetailHref(device.id)}
        className="font-semibold text-text-primary underline"
      >
        {device.name}
      </Link>
      <span className="text-text-secondary">{` · ${device.type} · ${device.inventoryNumber}`}</span>
      {device.owner && (
        <span className="block text-text-secondary">
          {seatsCopy.panel.owner(device.owner.displayName)}
        </span>
      )}
    </li>
  );
}

function SeatBody({ seat, occupantPhoto }: { seat: SeatDto; occupantPhoto: string | null }) {
  const status = statusView(seat);
  const { primary, secondary } = splitDevices(seat.devices);
  const hidden = Math.max(0, seat.deviceCount - seat.devices.length);
  return (
    <dl className="flex flex-col gap-4">
      <Field label={seatsCopy.panel.room}>{seat.roomCode}</Field>
      <Field label={seatsCopy.panel.status}>
        <span className="inline-flex items-center gap-1">
          <Icon name={status.icon} size={18} />
          {seatsCopy.status[status.state]}
          {status.blocked && (
            <>
              <Icon name="block" size={18} className="ml-1" />
              {seatsCopy.status.cannotSeat}
            </>
          )}
        </span>
      </Field>
      {seat.cannotSeat && seat.cannotSeatReason && (
        <Field label={seatsCopy.panel.reason}>
          <p data-reason className={`max-h-32 ${CLIP}`}>
            {seat.cannotSeatReason}
          </p>
        </Field>
      )}
      <Field label={seatsCopy.panel.occupant}>
        {seat.occupant ? (
          <span className="flex items-center gap-2">
            <Avatar name={seat.occupant.displayName} src={occupantPhoto} size={32} />
            <span className={`block max-h-12 min-w-0 ${CLIP}`}>{seat.occupant.displayName}</span>
          </span>
        ) : (
          <span className={`block max-h-12 ${CLIP}`}>{seatsCopy.noOccupant}</span>
        )}
      </Field>
      <Field label={seatsCopy.panel.primaryDevice}>
        {primary ? (
          <ul>
            <Device device={primary} />
          </ul>
        ) : hidden > 0 ? (
          seatsCopy.panel.noneShown
        ) : (
          seatsCopy.panel.noPrimary
        )}
      </Field>
      <Field label={seatsCopy.panel.secondaryDevices}>
        {secondary.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {secondary.map((d) => (
              <Device key={d.id} device={d} />
            ))}
          </ul>
        ) : hidden > 0 ? (
          seatsCopy.panel.noneShown
        ) : (
          seatsCopy.panel.noSecondary
        )}
        {hidden > 0 && <p className="mt-1">{seatsCopy.panel.moreDevices(hidden)}</p>}
      </Field>
      <Field label={seatsCopy.panel.group}>
        <span className={`block max-h-12 ${CLIP}`}>
          {seat.group ? seat.group.name : seatsCopy.panel.noTag}
        </span>
      </Field>
      <Field label={seatsCopy.panel.project}>
        <span className={`block max-h-12 ${CLIP}`}>
          {seat.project ? `${seat.project.code} · ${seat.project.name}` : seatsCopy.panel.noTag}
        </span>
      </Field>
    </dl>
  );
}

type Focusable = { isConnected: boolean; hasAttribute(name: string): boolean };

/** Where focus goes on close: a connected map seat opener, else the table row, else the opener, else null. */
export function returnFocusTarget<T extends Focusable>(
  row: T | null,
  previous: (T & object) | null,
  body?: unknown,
): T | null {
  const usable = previous !== null && previous.isConnected && previous !== body;
  if (usable && previous.hasAttribute("data-map-seat")) return previous;
  return row ?? (usable ? previous : null);
}

/**
 * Seat detail on a native `<dialog>` (focus trap, Esc, inert background). Props-driven: the page owns
 * the URL. On close, focus goes to the row of that seat if it still exists, else the opener, else `main`.
 * `focusSignal` (bumped after a write that keeps the panel open) moves focus to the heading, but only
 * when focus was lost to `body`, so a control the user is on keeps it.
 */
export function SeatDetailPanel({
  view,
  seatCode,
  onClose,
  onRetry,
  actions,
  focusSignal = 0,
  occupantPhoto = null,
}: {
  view: PanelView;
  seatCode: string | null;
  onClose: () => void;
  onRetry: () => void;
  actions?: ReactNode;
  focusSignal?: number;
  /** Blob URL of the occupant's loaded photo, or null (initials). */
  occupantPhoto?: string | null;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const pressedOnScrim = useRef(false);
  const codeRef = useRef<string | null>(seatCode);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const open = view.kind !== "closed";

  useEffect(() => {
    codeRef.current = seatCode;
  }, [seatCode]);

  useEffect(() => {
    if (focusSignal === 0) return;
    const active = document.activeElement;
    if (!active || active === document.body) headingRef.current?.focus();
  }, [focusSignal]);

  useEffect(() => {
    const el = ref.current;
    if (!open || !el) return;
    const previous = document.activeElement as HTMLElement | null;
    el.showModal();
    return () => {
      el.close();
      const row = codeRef.current
        ? document.querySelector<HTMLElement>(`[data-seat-code="${CSS.escape(codeRef.current)}"]`)
        : null;
      const target = returnFocusTarget(row, previous, document.body);
      (target ?? document.getElementById("main"))?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const title =
    view.kind === "ready" ? view.seat.code : (seatCode ?? seatsCopy.panel.notFoundTitle);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onPointerDown={(e) => {
        pressedOnScrim.current =
          e.target === e.currentTarget &&
          isOutsideRect(e.currentTarget.getBoundingClientRect(), e.clientX, e.clientY);
      }}
      onPointerUp={(e) => {
        if (
          pressedOnScrim.current &&
          e.target === e.currentTarget &&
          isOutsideRect(e.currentTarget.getBoundingClientRect(), e.clientX, e.clientY)
        ) {
          onClose();
        }
        pressedOnScrim.current = false;
      }}
      className="m-0 ml-auto h-dvh max-h-dvh w-full max-w-full sm:max-w-110 p-0 bg-surface text-text-primary overflow-y-auto shadow-dialog"
    >
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <h2
            ref={headingRef}
            tabIndex={-1}
            id={titleId}
            className={`text-subtitle text-text-primary max-h-14 outline-none ${CLIP}`}
          >
            {title}
          </h2>
          <IconButton icon="close" label={seatsCopy.panel.close} onClick={onClose} />
        </div>

        {view.kind === "loading" && (
          <p aria-busy="true" className="text-label text-text-secondary">
            {seatsCopy.panel.loading}
          </p>
        )}
        {view.kind === "notFound" && (
          <div className="flex flex-col gap-1">
            <p className="text-body font-semibold text-text-primary">
              {seatsCopy.panel.notFoundTitle}
            </p>
            <p className="text-label text-text-secondary">
              {view.truncated ? seatsCopy.panel.notFoundTruncated : seatsCopy.panel.notFoundBody}
            </p>
          </div>
        )}
        {view.kind === "error" && (
          <div className="flex flex-col items-start gap-3">
            <p role="alert" className="text-label font-semibold text-danger">
              {apiErrorMessage(view.code)}
            </p>
            <Button variant="tonal" size="sm" onClick={onRetry}>
              {seatsCopy.retry}
            </Button>
          </div>
        )}
        {view.kind === "ready" && <SeatBody seat={view.seat} occupantPhoto={occupantPhoto} />}
        {actions}
      </div>
    </dialog>
  );
}
