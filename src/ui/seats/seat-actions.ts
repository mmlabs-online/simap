import type { SeatDto } from "@/lib/seats/types";
import type { Tier } from "@/lib/tier";
import { atLeastTier } from "@/lib/tier";
import { validateSeatAdd } from "@/lib/validate/seat";
import { apiErrorMessage } from "../copy/api";
import { seatsCopy } from "../copy/seats";

export type SeatAction = "add" | "delete" | "release";
export type ActionResult = { ok: true } | { ok: false; code: string };

const AUTH_CODES = ["unauthenticated", "forbidden", "member_deactivated", "org_required"];

/** Add and Delete are for an Admin only. The server enforces it too. */
export function canManageSeats(tier: Tier | null | undefined): boolean {
  return tier != null && atLeastTier(tier, "admin");
}

/** Release is offered on the occupant's own seat, whatever their tier (D22). */
export function canRelease(seat: Pick<SeatDto, "mine">): boolean {
  return seat.mine;
}

/** Reads the count field. ASCII digits only: `Number()` would accept `1e1` and `0x5`. */
export function parseAddCount(raw: string): { ok: true; count: number } | { ok: false } {
  const text = raw.trim();
  if (!/^[0-9]+$/.test(text)) return { ok: false };
  const checked = validateSeatAdd({ count: Number(text) });
  return checked.ok ? { ok: true, count: checked.value.count } : { ok: false };
}

/** Why a seat cannot be deleted. The list carries at most 20 devices, so `deviceCount` decides. */
export function deleteBlock(
  seat: Pick<SeatDto, "occupant" | "deviceCount" | "devices">,
): string | null {
  const occupant = seat.occupant !== null;
  const devices = seat.deviceCount > 0 || seat.devices.length > 0;
  if (occupant && devices) return seatsCopy.actions.deleteBlockedBoth;
  if (occupant) return seatsCopy.actions.deleteBlockedOccupant;
  if (devices) return seatsCopy.actions.deleteBlockedDevices;
  return null;
}

export type Outcome = { reload: boolean; closePanel: boolean; message: string | null };

/**
 * What the page does after a write, from `result.code` only (never the HTTP status). Auth codes and
 * `invalid_request` mean nothing changed, so no reload. Any other failure reloads.
 */
export function actionOutcome(action: SeatAction, result: ActionResult): Outcome {
  if (result.ok) {
    return { reload: true, closePanel: action === "delete", message: null };
  }
  const { code } = result;
  if (AUTH_CODES.includes(code) || code === "invalid_request") {
    return { reload: false, closePanel: false, message: apiErrorMessage(code) };
  }
  if (action === "add") {
    const unknown = code === "unavailable" || code === "internal";
    return {
      reload: true,
      closePanel: false,
      message: unknown ? seatsCopy.actions.addCheckFirst : apiErrorMessage(code),
    };
  }
  if (action === "delete") {
    if (code === "not_found") {
      return { reload: true, closePanel: true, message: seatsCopy.actions.deleteGone };
    }
    return {
      reload: true,
      closePanel: false,
      message: code === "seat_not_empty" ? seatsCopy.actions.deleteChanged : apiErrorMessage(code),
    };
  }
  return {
    reload: true,
    closePanel: false,
    message: code === "not_allowed" ? seatsCopy.actions.releaseChanged : apiErrorMessage(code),
  };
}

/** After a delete finishes: leave the URL only if the page is still mounted and still shows that seat. */
export function shouldReplaceAfterDelete(
  mounted: boolean,
  currentCode: string | null,
  deletedCode: string,
): boolean {
  return mounted && currentCode === deletedCode;
}

/**
 * Where a seat notice shows: in the open panel if there is one, else on the page. A notice about
 * another seat than the open one names its seat code.
 */
export function routeNotice(
  notice: { seatCode: string | null; text: string } | null,
  openCode: string | null,
): { panel: string | null; page: string | null } {
  if (!notice) return { panel: null, page: null };
  const text =
    notice.seatCode !== null && notice.seatCode !== openCode
      ? seatsCopy.actions.noticeForSeat(notice.seatCode, notice.text)
      : notice.text;
  return openCode !== null ? { panel: text, page: null } : { panel: null, page: text };
}

/** A transient failure keeps the rows on screen; auth and not-found do not. */
export function keepRowsOnError(code: string): boolean {
  return code === "unavailable" || code === "internal";
}

/** The seat to focus after a delete: the next row, else the previous one, never the deleted seat. */
export function focusAfterDelete(
  codesBefore: string[],
  deleted: string,
  codesNow: string[],
): string | null {
  const i = codesBefore.indexOf(deleted);
  if (i < 0) return null;
  const alive = (c: string) => c !== deleted && codesNow.includes(c);
  const next = codesBefore.slice(i + 1).find(alive);
  if (next !== undefined) return next;
  return codesBefore.slice(0, i).reverse().find(alive) ?? null;
}
