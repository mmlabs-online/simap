import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TABLE_CELL, TABLE_HEAD, TABLE_REFS, TABLE_ROW } from "./table";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

/** Management screens already on the kit tokens (5b and 5c append theirs; slice 7 replaces this test). */
const MIGRATED = [
  "ui/table.ts",
  "ui/members/MembersView.tsx",
  "ui/members/PendingInvitations.tsx",
  "ui/members/MemberPhotoSection.tsx",
  "ui/members/DeactivateMemberDialog.tsx",
  "ui/members/ReactivateMemberDialog.tsx",
  "ui/invitations/InvitePeople.tsx",
  "ui/invitations/InviteDialog.tsx",
  "ui/groups/GroupsView.tsx",
  "ui/groups/ListSection.tsx",
  "ui/groups/DeleteDialog.tsx",
  "ui/requests/ApprovalsView.tsx",
  "ui/requests/RequestRowActions.tsx",
  "ui/requests/DecisionDialog.tsx",
  "ui/audit/AuditView.tsx",
  "ui/credits/CreditsPage.tsx",
  "ui/org/ProfileView.tsx",
  "ui/org/OrgPickerView.tsx",
  "ui/org/OrgSwitcherDialog.tsx",
];

const LEGACY =
  /(?<![\w-])(?:bg|text|border|divide|outline|ring|fill|stroke|placeholder)-(?:primary|on-primary|on-surface(?:-variant)?|on-background|background|surface-(?:high|highest|low|lowest|container)|outline(?:-variant)?|error|secondary[\w-]*|tertiary[\w-]*|accent-orange[\w-]*|[\w-]*-container|status-(?:online|warn|alert)|inverse[\w-]*)(?![\w-])|var\(--(?:primary|on-|surface|outline|error|secondary|tertiary|accent-|status-|inverse-|card-shadow|field-focus)|rounded-md3/;
const RAW_TYPE =
  /(?<![\w-])(?:text-(?:xs|sm|base|lg|xl|[2-9]xl|h[1-3])|font-(?:bold|extrabold|black|heading))(?![\w-])/;
const LOW_TARGET = /(?<![\w-])(?:min-h-11|h-11|size-11|h-8|h-9)(?![\w-])/;
const PALETTE =
  /(?<![\w-])(?:bg|text|border)-(?:red|amber|orange|yellow|green|blue|gray|slate|zinc|neutral|stone)-\d{2,3}(?![\w-])/;
const OTHER = /opacity-60|focus-visible:|focus-within:/;

describe("migrated management screens", () => {
  it("every file exists and matches no legacy class, raw size, low target or palette colour", () => {
    for (const f of MIGRATED) {
      expect(existsSync(new URL(`../${f}`, import.meta.url)), f).toBe(true);
      const text = read(f);
      for (const re of [LEGACY, RAW_TYPE, LOW_TARGET, PALETTE, OTHER]) {
        expect(text.match(re)?.[0], `${f} ${re.source.slice(0, 20)}`).toBeUndefined();
      }
    }
  });

  it("no migrated file is still on the pending list", () => {
    const path = new URL("../../scripts/check-tokens.pending.json", import.meta.url);
    const pending: Record<string, number> = existsSync(path)
      ? JSON.parse(readFileSync(path, "utf8"))
      : {};
    for (const f of MIGRATED) expect(pending, f).not.toHaveProperty([`src/${f}`]);
  });

  it("the invitation entry points use the kit Button only", () => {
    for (const f of ["ui/invitations/InvitePeople.tsx", "ui/invitations/InviteDialog.tsx"]) {
      expect(read(f), f).not.toContain("<button");
    }
  });

  it("table.ts exposes the shared table classes", () => {
    for (const c of ["text-caption", "font-semibold", "uppercase", "text-text-secondary"]) {
      expect(TABLE_HEAD).toContain(c);
    }
    for (const c of ["text-label", "font-normal", "text-text-primary"]) {
      expect(TABLE_CELL).toContain(c);
    }
    expect(TABLE_ROW).toContain("border-divider");
    expect(TABLE_REFS).toContain("text-caption");
  });
});
