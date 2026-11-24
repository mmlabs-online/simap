import { needsRelease } from "@/lib/members/deactivation";
import type { DeactivationImpact } from "@/lib/members/types";
import { apiErrorMessage } from "../copy/api";
import { membersCopy } from "../copy/members";

/** D34: `release` when seats or placed devices need releasing, otherwise `plain`. */
export function deactivateStep(impact: DeactivationImpact): "plain" | "release" {
  return needsRelease(impact) ? "release" : "plain";
}

/** The `release` flag sent to the API for a step. */
export const releaseFor = (step: "plain" | "release"): boolean => step === "release";

/** One line per non-zero count, in the order seats, devices, primaries, pending requests. */
export function impactLines(impact: DeactivationImpact): string[] {
  const d = membersCopy.deactivateDialog;
  const lines: [number, (n: number) => string][] = [
    [impact.occupiedSeats, d.seats],
    [impact.placedDevices, d.devices],
    [impact.primaryDevicesToDemote, d.primaries],
    [impact.pendingRequests, d.requests],
  ];
  return lines.filter(([n]) => n > 0).map(([n, text]) => text(n));
}

export type DeactivateErrorAction =
  | { kind: "reload-impact" }
  | { kind: "done" }
  | { kind: "message"; text: string };

/** A stale dialog (`member_not_empty`) re-fetches the counts; a missing member closes. */
export function deactivateErrorAction(code: string): DeactivateErrorAction {
  if (code === "member_not_empty") return { kind: "reload-impact" };
  if (code === "not_found") return { kind: "done" };
  return { kind: "message", text: apiErrorMessage(code) };
}
