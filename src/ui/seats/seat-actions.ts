import type { RequestCreateResult } from "@/lib/requests/types";
import type { SeatDto } from "@/lib/seats/types";
import type { Tier } from "@/lib/tier";
import { atLeastTier } from "@/lib/tier";
import { validateCannotSeat, validateSeatAdd } from "@/lib/validate/seat";
import { apiErrorMessage } from "../copy/api";
import { seatsCopy } from "../copy/seats";
import type { RequestsResult } from "../requests/requests-api";

export type SeatAction =
  | "add"
  | "delete"
  | "release"
  | "assign"
  | "removeOccupant"
  | "setCannotSeat"
  | "clearCannotSeat"
  | "setTags"
  | "request";
export type ActionResult = { ok: true; duplicate?: true } | { ok: false; code: string };

const AUTH_CODES = ["unauthenticated", "forbidden", "member_deactivated", "org_required"];

/** What the user was shown when they were asked to confirm: one snapshot of the occupant and the choice. */
export type OccupantConfirm = {
  expectedOccupantId: string | null;
  occupantName: string | null;
  memberId: string;
  memberName: string;
};
export type AssignDialog = {
  kind: "assign";
  seat: SeatDto;
  confirm: OccupantConfirm | null;
  /** Bumped on every re-ask, so the confirm dialog remounts and focus returns to Cancel. */
  revision: number;
  error: string | null;
  /** Bumped to make the picker reload its list. */
  reloadToken: number;
};

/** Assign and Replace are for a Manager or Admin. The server enforces it too. */
export function canAssign(tier: Tier | null | undefined): boolean {
  return tier != null && atLeastTier(tier, "manager");
}

export type SeatButtons = {
  assign: "assign" | "replace" | null;
  assignDisabled: boolean;
  release: boolean;
  removeOccupant: boolean;
  setCannotSeat: boolean;
  clearCannotSeat: boolean;
  tags: boolean;
  deleteSeat: boolean;
  /** Users only: Managers and Admins assign directly (REG-02). */
  request: boolean;
};

/** Which panel buttons show. Assign and Replace are one button; a cannot-seat seat disables it. */
export function seatButtons(tier: Tier | null | undefined, seat: SeatDto): SeatButtons {
  return {
    assign: canAssign(tier) ? (seat.occupant ? "replace" : "assign") : null,
    assignDisabled: seat.cannotSeat,
    release: canRelease(seat),
    removeOccupant: canAssign(tier) && seat.occupant !== null && !seat.mine,
    setCannotSeat: canAssign(tier) && !seat.cannotSeat,
    clearCannotSeat: canAssign(tier) && seat.cannotSeat,
    tags: canAssign(tier),
    deleteSeat: canManageSeats(tier),
    request: tier === "user" && seat.occupant === null && !seat.cannotSeat,
  };
}

/** A created request and a duplicate of a pending one both succeed; the HTTP status is read in the api layer only. */
export function requestResult(r: RequestsResult<RequestCreateResult>): ActionResult {
  if (!r.ok) return { ok: false, code: r.code };
  return r.value.created ? { ok: true } : { ok: true, duplicate: true };
}

/** Remove asks first. The occupant id and name are the ones shown when the dialog opened. */
export type RemoveDialog = {
  kind: "remove";
  seat: SeatDto;
  expectedOccupantId: string;
  occupantName: string;
};
export type CannotSeatDialog = { kind: "cannotSeat"; seat: SeatDto };
export type ClearCannotSeatDialog = { kind: "clearCannotSeat"; seat: SeatDto };
export type TagsDialog = { kind: "tags"; seat: SeatDto };

export function removeDialog(seat: SeatDto): RemoveDialog | null {
  if (seat.occupant === null) return null;
  return {
    kind: "remove",
    seat,
    expectedOccupantId: seat.occupant.id,
    occupantName: seat.occupant.displayName,
  };
}

/** The reason is checked by the server's own validator; its value is what is sent. */
export function parseCannotSeatReason(raw: string): { ok: true; reason: string } | { ok: false } {
  const checked = validateCannotSeat({ cannotSeat: true, reason: raw });
  if (!checked.ok || !checked.value.cannotSeat) return { ok: false };
  return { ok: true, reason: checked.value.reason };
}

export type PickStep =
  | { kind: "none" }
  | { kind: "send"; memberId: string; memberName: string; expectedOccupantId: null }
  | { kind: "confirm"; confirm: OccupantConfirm };

/** An empty seat is assigned at once; an occupied one asks first; the same person changes nothing. */
export function pickStep(
  seat: Pick<SeatDto, "occupant">,
  member: { id: string; displayName: string },
): PickStep {
  if (seat.occupant === null) {
    return {
      kind: "send",
      memberId: member.id,
      memberName: member.displayName,
      expectedOccupantId: null,
    };
  }
  if (seat.occupant.id === member.id) return { kind: "none" };
  return {
    kind: "confirm",
    confirm: {
      expectedOccupantId: seat.occupant.id,
      occupantName: seat.occupant.displayName,
      memberId: member.id,
      memberName: member.displayName,
    },
  };
}

export function confirmText(c: OccupantConfirm): string {
  return c.occupantName === null
    ? seatsCopy.actions.assignConfirmBody(c.memberName)
    : seatsCopy.actions.replaceBody(c.occupantName, c.memberName);
}

export type Reask =
  | { kind: "error"; code: string }
  | { kind: "done" }
  | { kind: "cannotSeat" }
  | { kind: "ask"; seat: SeatDto; confirm: OccupantConfirm };

/** After `occupant_changed`: what to do with the refetched seat. Nothing here ever sends a write. */
export function decideReask(
  fresh: { ok: true; value: SeatDto } | { ok: false; code: string },
  member: { id: string; name: string },
): Reask {
  if (!fresh.ok) return { kind: "error", code: fresh.code };
  const seat = fresh.value;
  if (seat.occupant?.id === member.id) return { kind: "done" };
  if (seat.cannotSeat) return { kind: "cannotSeat" };
  return {
    kind: "ask",
    seat,
    confirm: {
      expectedOccupantId: seat.occupant?.id ?? null,
      occupantName: seat.occupant?.displayName ?? null,
      memberId: member.id,
      memberName: member.name,
    },
  };
}

export function reaskDialog(
  d: AssignDialog,
  seat: SeatDto,
  confirm: OccupantConfirm,
): AssignDialog {
  return { ...d, seat, confirm, revision: d.revision + 1, error: null };
}

/** The member cannot be assigned any more: drop the confirm, show why, reload the picker's list. */
export function refusedDialog(d: AssignDialog, error: string): AssignDialog {
  return { ...d, confirm: null, error, reloadToken: d.reloadToken + 1 };
}

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

export type Outcome = {
  reload: boolean;
  closePanel: boolean;
  message: string | null;
  /** Assign only: the member was refused, so the picker stays open. */
  keepDialog?: true;
  /** Request only: a non-error line for the panel. */
  info?: string;
};

/**
 * What the page does after a write, from `result.code` only (never the HTTP status). Auth codes and
 * `invalid_request` mean nothing changed, so no reload. Any other failure reloads.
 */
export function actionOutcome(action: SeatAction, result: ActionResult): Outcome {
  if (result.ok) {
    if (action === "request") {
      // The seat is unchanged, so there is nothing to reload.
      return {
        reload: false,
        closePanel: false,
        message: null,
        info: result.duplicate ? seatsCopy.actions.requestDuplicate : seatsCopy.actions.requestSent,
      };
    }
    return { reload: true, closePanel: action === "delete", message: null };
  }
  const { code } = result;
  if (AUTH_CODES.includes(code) || code === "invalid_request") {
    return { reload: false, closePanel: false, message: apiErrorMessage(code) };
  }
  if (action === "request") {
    if (code === "not_found") {
      return { reload: true, closePanel: true, message: seatsCopy.actions.deleteGone };
    }
    return {
      reload: code !== "no_linked_member" && code !== "member_not_assignable",
      closePanel: false,
      message: apiErrorMessage(code),
    };
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
  if (action === "assign") {
    if (code === "member_not_assignable") {
      return {
        reload: true,
        closePanel: false,
        message: seatsCopy.actions.memberGone,
        keepDialog: true,
      };
    }
    if (code === "not_found") {
      return { reload: true, closePanel: true, message: seatsCopy.actions.deleteGone };
    }
    return {
      reload: true,
      closePanel: false,
      message:
        code === "occupant_changed" ? seatsCopy.actions.assignChanged : apiErrorMessage(code),
    };
  }
  if (
    action === "removeOccupant" ||
    action === "setCannotSeat" ||
    action === "clearCannotSeat" ||
    action === "setTags"
  ) {
    if (code === "not_found") {
      return { reload: true, closePanel: true, message: seatsCopy.actions.deleteGone };
    }
    return {
      reload: true,
      closePanel: false,
      message:
        action === "removeOccupant" && code === "occupant_changed"
          ? seatsCopy.actions.removeChanged
          : apiErrorMessage(code),
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
  let text = notice.text;
  if (notice.seatCode === null) {
    if (openCode !== null) text = seatsCopy.actions.noticeForAdd(notice.text);
  } else if (notice.seatCode !== openCode) {
    text = seatsCopy.actions.noticeForSeat(notice.seatCode, notice.text);
  }
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
