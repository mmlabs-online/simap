"use client";

import { useEffect, useId, useRef } from "react";
import Link from "next/link";
import type { PopupLockedRoom, PopupSeatRoom } from "@/lib/checkin-popup";
import { roomDetailHref } from "@/lib/nav";
import type { RoomThumb } from "@/lib/sprites/room-thumb";
import { formatAuditTime } from "../audit/audit-state";
import { Button } from "../Button";
import { apiErrorMessage } from "../copy/api";
import { checkinCopy } from "../copy/checkin";
import { checkinPopupCopy as copy } from "../copy/checkin-popup";
import { RoomThumbView } from "./RoomThumb";

export type CheckinPopupProps = {
  open: boolean;
  seatRooms: readonly PopupSeatRoom[];
  locked: readonly PopupLockedRoom[];
  /** Thumbnail per room id; missing or null = placeholder. */
  thumbs: Readonly<Record<string, RoomThumb | null>>;
  selectedCode: string | null;
  busy: boolean;
  errorCode: string | null;
  onSelect: (code: string) => void;
  onCheckIn: (roomId: string) => void;
  onJustLook: () => void;
};

const WRAP = { overflowWrap: "anywhere" } as const;

/**
 * The check-in popup (PRE-02) on a native modal `<dialog>`: focus trap and inert page from `showModal()`,
 * Escape = "Just look". Pixel frame and 3D buttons only; body text stays in the normal font (D52).
 */
export function CheckinPopup(props: CheckinPopupProps) {
  const { open, seatRooms, locked, thumbs, selectedCode, busy, errorCode } = props;
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!open || !el) return;
    el.showModal();
    el.querySelector<HTMLElement>("input[type=radio]:checked")?.focus();
    return () => {
      el.close();
      const target =
        document.querySelector<HTMLElement>('[data-slot="checkin-button"] button') ??
        document.getElementById("main");
      target?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  const selected = seatRooms.find((r) => r.code === selectedCode) ?? null;

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={descId}
      onCancel={(e) => {
        e.preventDefault();
        props.onJustLook();
      }}
      className="px-frame m-auto w-[min(32rem,calc(100vw-1.5rem))] max-h-[90dvh] overflow-hidden p-0 bg-surface text-on-surface"
    >
      <div className="flex max-h-[90dvh] flex-col">
        <div className="flex-none border-b-4 border-px-outline bg-px-wall px-4 py-3 text-on-surface">
          <h2
            id={titleId}
            style={WRAP}
            className="text-sm font-extrabold uppercase tracking-[0.12em]"
          >
            {copy.title}
          </h2>
        </div>
        <div className="px-card flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-auto overscroll-contain p-4">
            <p id={descId} className="text-sm text-on-surface-variant">
              {copy.intro}
            </p>
            <fieldset className="mt-3 min-w-0 border-0 p-0">
              <legend className="mb-2 text-sm font-bold text-on-surface">
                {copy.seatRoomsLegend}
              </legend>
              <ul className="flex flex-col gap-2">
                {seatRooms.map((r) => {
                  const isSelected = r.code === selectedCode;
                  return (
                    <li key={r.roomId}>
                      <label
                        className={`flex min-h-11 cursor-pointer items-center gap-3 bg-surface p-2 ${
                          isSelected
                            ? "border-[3px] border-px-outline"
                            : "border-[3px] border-transparent"
                        }`}
                      >
                        <input
                          type="radio"
                          name="checkin-room"
                          value={r.code}
                          checked={isSelected}
                          onChange={() => props.onSelect(r.code)}
                          className="size-4 flex-none accent-primary"
                        />
                        <RoomThumbView thumb={thumbs[r.roomId] ?? null} />
                        <span className="flex min-w-0 flex-1 flex-col text-sm">
                          <span style={WRAP} className="font-bold text-on-surface">
                            {checkinCopy.roomHeading(r.code, r.name)}
                            {isSelected && <span className="sr-only"> {copy.selected}</span>}
                          </span>
                          <span className="text-on-surface-variant">
                            {copy.yourSeat(r.seatCode)}
                          </span>
                          <span className="text-on-surface-variant">{copy.count(r.count)}</span>
                          <span className="text-on-surface-variant">
                            {copy.lastCheckin(
                              r.lastCheckedInAt === null
                                ? null
                                : formatAuditTime(r.lastCheckedInAt),
                            )}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
            {locked.length > 0 && (
              <section className="mt-4">
                <h3 className="mb-2 text-sm font-bold text-on-surface">{copy.lockedHeading}</h3>
                <ul className="flex flex-col gap-2">
                  {locked.map((r) => {
                    const href = roomDetailHref(r.code);
                    return (
                      <li
                        key={r.roomId}
                        className="flex min-h-11 items-center gap-3 p-2 opacity-90"
                      >
                        <RoomThumbView thumb={null} />
                        <span className="flex min-w-0 flex-1 flex-col text-sm">
                          <span style={WRAP} className="font-bold text-on-surface">
                            {checkinCopy.roomHeading(r.code, r.name)}
                          </span>
                          <span className="text-on-surface-variant">{copy.locked}</span>
                          {href && (
                            <Link href={href} className="font-bold text-primary underline">
                              {checkinCopy.requestSeat}
                            </Link>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </div>
          <div className="flex-none border-t-4 border-px-outline p-4">
            {errorCode !== null && (
              <p role="alert" className="mb-3 text-sm font-semibold text-error">
                {apiErrorMessage(errorCode)}
              </p>
            )}
            <div className="flex flex-col gap-3 sm:flex-row-reverse sm:justify-start">
              <Button
                variant="filled"
                className="min-h-11 w-full sm:w-auto"
                disabled={busy || selected === null}
                aria-busy={busy}
                onClick={() => selected && props.onCheckIn(selected.roomId)}
              >
                {selected ? copy.checkInTo(selected.code) : copy.title}
              </Button>
              <Button
                variant="tonal"
                className="min-h-11 w-full rounded-none border-[3px] border-px-outline shadow-[0_4px_0_0_var(--px-shadow)] sm:w-auto"
                onClick={props.onJustLook}
              >
                {copy.justLook}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </dialog>
  );
}
