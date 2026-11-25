"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import type { SeatDeviceDto, SeatDto } from "@/lib/seats/types";
import { apiErrorMessage } from "../copy/api";
import { seatsCopy } from "../copy/seats";
import { Button, IconButton } from "../Button";
import { Icon } from "../Icon";
import { isOutsideRect, splitDevices, statusView, type PanelView } from "./seat-view";
import { CLIP } from "./SeatsView";

const LABEL = "text-[11px] font-extrabold tracking-[0.05em] uppercase text-on-surface-variant";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className={LABEL}>{label}</dt>
      <dd className="text-sm font-medium text-on-surface">{children}</dd>
    </div>
  );
}

function Device({ device }: { device: SeatDeviceDto }) {
  return (
    <li className={`max-h-24 ${CLIP}`}>
      <span className="font-bold">{device.name}</span>
      <span className="text-on-surface-variant">
        {` · ${device.type} · ${device.inventoryNumber}`}
      </span>
      {device.owner && (
        <span className="block text-on-surface-variant">
          {seatsCopy.panel.owner(device.owner.displayName)}
        </span>
      )}
    </li>
  );
}

function SeatBody({ seat }: { seat: SeatDto }) {
  const status = statusView(seat);
  const { primary, secondary } = splitDevices(seat.devices);
  const hidden = Math.max(0, seat.deviceCount - seat.devices.length);
  return (
    <dl className="flex flex-col gap-4">
      <Field label={seatsCopy.panel.room}>{seat.roomCode}</Field>
      <Field label={seatsCopy.panel.status}>
        <span className="inline-flex items-center gap-1.5">
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
        <span className={`block max-h-12 ${CLIP}`}>
          {seat.occupant ? seat.occupant.displayName : seatsCopy.noOccupant}
        </span>
      </Field>
      <Field label={seatsCopy.panel.primaryDevice}>
        {primary ? (
          <ul>
            <Device device={primary} />
          </ul>
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
}: {
  view: PanelView;
  seatCode: string | null;
  onClose: () => void;
  onRetry: () => void;
  actions?: ReactNode;
  focusSignal?: number;
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
      className="m-0 ml-auto h-dvh max-h-dvh w-full max-w-full sm:max-w-[440px] p-0 bg-surface-high text-on-surface overflow-y-auto shadow-[0_12px_40px_var(--shadow)]"
    >
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <h2
            ref={headingRef}
            tabIndex={-1}
            id={titleId}
            className={`text-[20px] font-extrabold text-on-surface max-h-14 outline-none ${CLIP}`}
          >
            {title}
          </h2>
          <IconButton icon="close" label={seatsCopy.panel.close} onClick={onClose} />
        </div>

        {view.kind === "loading" && (
          <p aria-busy="true" className="text-sm font-medium text-on-surface-variant">
            {seatsCopy.panel.loading}
          </p>
        )}
        {view.kind === "notFound" && (
          <div className="flex flex-col gap-1">
            <p className="text-base font-extrabold text-on-surface">
              {seatsCopy.panel.notFoundTitle}
            </p>
            <p className="text-sm font-medium text-on-surface-variant">
              {view.truncated ? seatsCopy.panel.notFoundTruncated : seatsCopy.panel.notFoundBody}
            </p>
          </div>
        )}
        {view.kind === "error" && (
          <div className="flex flex-col items-start gap-3">
            <p role="alert" className="text-sm font-semibold text-error">
              {apiErrorMessage(view.code)}
            </p>
            <Button variant="tonal" size="sm" onClick={onRetry}>
              {seatsCopy.retry}
            </Button>
          </div>
        )}
        {view.kind === "ready" && <SeatBody seat={view.seat} />}
        {actions}
      </div>
    </dialog>
  );
}
