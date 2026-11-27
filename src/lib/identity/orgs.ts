import type { OrgChoice } from "./types";

export type OrgNotice = "org_denied";
export type OrgDecision =
  | { kind: "enter"; org: OrgChoice }
  | { kind: "pick"; orgs: OrgChoice[]; notice?: OrgNotice }
  | { kind: "none"; notice?: OrgNotice };

const collator = new Intl.Collator("vi", { sensitivity: "base" });

/** Sorted by name (Vietnamese collation, NFC), ties by id. Does not mutate the input. */
export function sortOrgs(orgs: readonly OrgChoice[]): OrgChoice[] {
  return [...orgs].sort(
    (a, b) =>
      collator.compare(a.name.normalize("NFC"), b.name.normalize("NFC")) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

/**
 * What to do after listing the account's orgs. `denied`: org ids denied in this tab; once any is set the result is
 * never `enter`, so a denial cannot loop on auto-enter.
 */
export function decideOrg({
  orgs,
  remembered,
  denied,
}: {
  orgs: readonly OrgChoice[];
  remembered: string | null;
  denied: readonly string[];
}): OrgDecision {
  const gone = new Set(denied.map((d) => d.toLowerCase()));
  const seen = new Set<string>();
  const list: OrgChoice[] = [];
  for (const o of orgs) {
    const id = o.id.toLowerCase();
    if (seen.has(id) || gone.has(id)) continue;
    seen.add(id);
    list.push({ id, name: o.name, ...(o.access && { access: o.access }) });
  }
  if (gone.size > 0) {
    return list.length === 0
      ? { kind: "none", notice: "org_denied" }
      : { kind: "pick", orgs: sortOrgs(list), notice: "org_denied" };
  }
  if (list.length === 0) return { kind: "none" };
  if (list.length === 1) return { kind: "enter", org: list[0]! };
  const mine = remembered?.toLowerCase();
  const hit = mine ? list.find((o) => o.id === mine) : undefined;
  return hit ? { kind: "enter", org: hit } : { kind: "pick", orgs: sortOrgs(list) };
}
