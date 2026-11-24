/** GRP-01 / D34: an unused group or project is deleted directly; a used one only after confirmation (force). */
export type DeleteDecision = "delete" | "clear_and_delete" | "refuse_in_use";

type Impact = { seats: number; members?: number };

export const isInUse = (impact: Impact): boolean => impact.seats > 0 || (impact.members ?? 0) > 0;

export function decideDelete(impact: Impact, force: boolean): DeleteDecision {
  if (!isInUse(impact)) return "delete";
  return force ? "clear_and_delete" : "refuse_in_use";
}
