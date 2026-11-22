import type { DeactivationImpact, MemberStatus } from "./types";

/** D34: only seats and placed devices need a release; pending requests are always cancelled. */
export function needsRelease(impact: DeactivationImpact): boolean {
  return impact.occupiedSeats > 0 || impact.placedDevices > 0;
}

export type DeactivationDecision =
  | "refuse_self"
  | "noop"
  | "refuse_not_empty"
  | "release"
  | "deactivate";

/** Order matters: self is refused before the already-deactivated no-op. */
export function decideDeactivation(a: {
  impact: DeactivationImpact;
  release: boolean;
  isSelf: boolean;
  status: MemberStatus;
}): DeactivationDecision {
  if (a.isSelf) return "refuse_self";
  if (a.status === "deactivated") return "noop";
  if (!needsRelease(a.impact)) return "deactivate";
  return a.release ? "release" : "refuse_not_empty";
}
