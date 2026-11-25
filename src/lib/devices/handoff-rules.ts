import { atLeast, type Tier } from "@/lib/auth/tier";
import type { HandoffKind, HandoffStatus } from "./types";

/** DEV-08: the owner, or a Manager+, starts a transfer. */
export const canStartTransfer = (tier: Tier, isOwner: boolean): boolean =>
  isOwner || atLeast(tier, "manager");

/** DEV-09: the owner, or a Manager+, starts a return (same rule as a transfer). */
export const canStartReturn = canStartTransfer;

/** DEV-09: an Admin takes an owned device back; a pending transfer is cancelled, a pending return is confirmed instead. */
export const canTakeBack = (
  tier: Tier,
  ownerId: string | null,
  pendingKind: HandoffKind | null,
): boolean => tier === "admin" && ownerId !== null && pendingKind !== "return";

/** DEV-08: the sender (the `from` member), or a Manager+, cancels a pending handoff. */
export const canCancelHandoff = (tier: Tier, isFrom: boolean): boolean =>
  isFrom || atLeast(tier, "manager");

export type TransferStartRefusalCode =
  | "not_allowed"
  | "device_unowned"
  | "invalid_recipient"
  | "member_not_assignable"
  | "handoff_pending";

export type TransferStartDecision =
  | { kind: "ok" }
  | { kind: "refuse"; status: 409 | 422; code: TransferStartRefusalCode };

/** DEV-08 start. Permission first (R7 order), then the device, the recipient, the pending check. */
export function decideTransferStart(a: {
  tier: Tier;
  actorMemberId: string | null;
  ownerId: string | null;
  toMemberId: string;
  recipientActive: boolean;
  pending: boolean;
}): TransferStartDecision {
  const isOwner = a.ownerId !== null && a.actorMemberId === a.ownerId;
  if (a.actorMemberId === null || !canStartTransfer(a.tier, isOwner)) {
    return { kind: "refuse", status: 422, code: "not_allowed" };
  }
  if (a.ownerId === null) return { kind: "refuse", status: 422, code: "device_unowned" };
  if (a.toMemberId === a.ownerId) return { kind: "refuse", status: 422, code: "invalid_recipient" };
  if (!a.recipientActive) return { kind: "refuse", status: 422, code: "member_not_assignable" };
  if (a.pending) return { kind: "refuse", status: 409, code: "handoff_pending" };
  return { kind: "ok" };
}

export type ReturnStartRefusalCode = "not_allowed" | "device_unowned" | "handoff_pending";

export type ReturnStartDecision =
  | { kind: "ok" }
  | { kind: "refuse"; status: 409 | 422; code: ReturnStartRefusalCode };

/** DEV-09 start. Permission first (R7 order), then the device, then the pending check. */
export function decideReturnStart(a: {
  tier: Tier;
  actorMemberId: string | null;
  ownerId: string | null;
  pending: boolean;
}): ReturnStartDecision {
  const isOwner = a.ownerId !== null && a.actorMemberId === a.ownerId;
  if (a.actorMemberId === null || !canStartReturn(a.tier, isOwner)) {
    return { kind: "refuse", status: 422, code: "not_allowed" };
  }
  if (a.ownerId === null) return { kind: "refuse", status: 422, code: "device_unowned" };
  if (a.pending) return { kind: "refuse", status: 409, code: "handoff_pending" };
  return { kind: "ok" };
}

export type ExtensionStartRefusalCode = "not_allowed" | "device_unowned" | "handoff_pending";

export type ExtensionStartDecision =
  | { kind: "ok" }
  | { kind: "refuse"; status: 409 | 422; code: ExtensionStartRefusalCode };

/** DEV-10 start: the owner only. Permission first (R7 order), then the device, then the pending check. */
export function decideExtensionStart(a: {
  actorMemberId: string | null;
  ownerId: string | null;
  pending: boolean;
}): ExtensionStartDecision {
  if (a.actorMemberId === null) return { kind: "refuse", status: 422, code: "not_allowed" };
  if (a.ownerId === null) return { kind: "refuse", status: 422, code: "device_unowned" };
  if (a.actorMemberId !== a.ownerId) return { kind: "refuse", status: 422, code: "not_allowed" };
  if (a.pending) return { kind: "refuse", status: 409, code: "handoff_pending" };
  return { kind: "ok" };
}

export type HandoffAction = "confirm" | "decline" | "cancel";

export type HandoffActionDecision =
  | { kind: "ok" }
  | { kind: "refuse"; status: 409 | 422; code: "not_allowed" | "handoff_not_pending" };

/**
 * Transfer: confirm and decline by the recipient only. Return: confirm by an Admin only, never declined.
 * Extension: confirm (approve) and decline (reject) by a Manager+ only.
 * Cancel (every kind): the sender or a Manager+.
 * Permission before status.
 */
export function decideHandoffAction(a: {
  kind: HandoffKind;
  action: HandoffAction;
  tier: Tier;
  actorMemberId: string | null;
  fromId: string;
  toId: string | null;
  status: HandoffStatus;
}): HandoffActionDecision {
  const decide = (): boolean => {
    if (a.actorMemberId === null) return false;
    if (a.action === "cancel") return canCancelHandoff(a.tier, a.actorMemberId === a.fromId);
    if (a.kind === "extension") return atLeast(a.tier, "manager");
    if (a.kind === "return") return a.action === "confirm" && a.tier === "admin";
    return a.toId !== null && a.actorMemberId === a.toId;
  };
  const allowed = decide();
  if (!allowed) return { kind: "refuse", status: 422, code: "not_allowed" };
  if (a.status !== "pending") return { kind: "refuse", status: 409, code: "handoff_not_pending" };
  return { kind: "ok" };
}

/** What the caller may do with a handoff; all false unless it is pending. */
export function handoffFlags(a: {
  kind: HandoffKind;
  tier: Tier;
  actorMemberId: string | null;
  fromId: string;
  toId: string | null;
  status: HandoffStatus;
}): { canCancel: boolean; canConfirm: boolean; canDecline: boolean } {
  const ok = (action: HandoffAction) => decideHandoffAction({ ...a, action }).kind === "ok";
  return { canCancel: ok("cancel"), canConfirm: ok("confirm"), canDecline: ok("decline") };
}
