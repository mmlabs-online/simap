import { isInUse } from "@/lib/groups/delete-impact";
import type { GroupImpact, ProjectImpact } from "@/lib/groups/types";
import { apiErrorMessage } from "../copy/api";
import { groupsCopy } from "../copy/groups";
import type { GroupsResult } from "./groups-api";

/** GRP-01 / D34: `plain` when nothing is tagged, otherwise `forced` (explicit confirm, then tags are cleared). */
export function deleteStep(impact: GroupImpact | ProjectImpact): "plain" | "forced" {
  return isInUse(impact) ? "forced" : "plain";
}

/** One line per non-zero count: seats, then members (groups only). */
export function impactLines(impact: GroupImpact | ProjectImpact): string[] {
  const lines: string[] = [];
  if (impact.seats > 0) lines.push(groupsCopy.impactSeats(impact.seats));
  if ("members" in impact && impact.members > 0) {
    lines.push(groupsCopy.impactMembers(impact.members));
  }
  return lines;
}

/**
 * What the delete dialog does with a result. `in_use` means the tags changed after the counts were loaded,
 * so the impact is loaded again before anything is forced; `not_found` means it is already gone.
 */
export function removeOutcome(result: GroupsResult<null>): "done" | "reload" | { error: string } {
  if (result.ok || result.code === "not_found") return "done";
  if (result.code === "in_use") return "reload";
  return { error: apiErrorMessage(result.code) };
}
