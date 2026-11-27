import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TABLE_CELL, TABLE_HEAD, TABLE_REFS, TABLE_ROW } from "./table";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

/** Management screens already on the kit tokens (slice 7 replaces this test). */
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
  "ui/devices/DevicesView.tsx",
  "ui/devices/DeviceTable.tsx",
  "ui/devices/device-labels.tsx",
  "ui/devices/DeviceRowActions.tsx",
  "ui/devices/OverdueBanner.tsx",
  "ui/devices/IncomingTransfers.tsx",
  "ui/devices/PendingReturns.tsx",
  "ui/devices/PendingExtensions.tsx",
  "ui/devices/DeviceDetailView.tsx",
  "ui/devices/DeviceHistory.tsx",
  "ui/devices/NoteField.tsx",
  "ui/devices/AssignDeviceDialog.tsx",
  "ui/devices/ExtendDeviceDialog.tsx",
  "ui/devices/TransferDeviceDialog.tsx",
  "ui/devices/ReturnDeviceDialog.tsx",
  "ui/devices/DeviceFormDialog.tsx",
  "ui/devices/PlaceDeviceDialog.tsx",
  "ui/devices/DeleteDeviceDialog.tsx",
  "ui/devices/TakeBackDeviceDialog.tsx",
  "ui/deviceTypes/DeviceTypesView.tsx",
  "ui/deviceTypes/DeviceTypeFormDialog.tsx",
  "ui/deviceTypes/DeviceTypeImageField.tsx",
  "ui/deviceTypes/DeviceTypeSpriteField.tsx",
  "ui/deviceTypes/DeviceTypeThumb.tsx",
  "ui/deviceTypes/DeskSlotDiagram.tsx",
  "ui/deviceTypes/DeleteDeviceTypeDialog.tsx",
  "ui/dashboard/DashboardView.tsx",
  "ui/dashboard/ExportCard.tsx",
  "ui/dashboard/StatTile.tsx",
  "ui/rooms/RoomCard.tsx",
  "ui/rooms/OccupancyRing.tsx",
  "ui/rooms/RoomsView.tsx",
  "ui/rooms/DeleteRoomDialog.tsx",
  "ui/rooms/RoomFormDialog.tsx",
  "ui/search/SearchView.tsx",
  "ui/search/SearchPage.tsx",
  "ui/seats/SeatsView.tsx",
  "ui/seats/SeatDetailPanel.tsx",
  "ui/seats/MemberPickerDialog.tsx",
  "ui/seats/SeatActions.tsx",
  "ui/seats/ConfirmSeatDialog.tsx",
  "ui/seats/SeatTagsDialog.tsx",
  "ui/seats/AddSeatsDialog.tsx",
  "ui/seats/CannotSeatDialog.tsx",
  "ui/auth/AuthLayout.tsx",
  "ui/auth/DevGate.tsx",
  "ui/auth/accept-views.tsx",
  "ui/auth/account-views.tsx",
  "ui/auth/views.tsx",
  "ui/auth/fields.tsx",
  "ui/auth/SignInScene.tsx",
  "ui/auth/SmallWorld.tsx",
  "ui/checkin/CheckinButton.tsx",
  "ui/checkin/CheckinPopup.tsx",
  "ui/checkin/CheckinView.tsx",
  "ui/checkin/CheckinPage.tsx",
  "ui/checkin/WhosHere.tsx",
  "ui/checkin/PixelHead.tsx",
];

const LEGACY =
  /(?<![\w-])(?:bg|text|border|divide|outline|ring|fill|stroke|placeholder)-(?:primary|on-primary|on-surface(?:-variant)?|on-background|background|surface-(?:high|highest|low|lowest|container[\w-]*)|outline(?:-variant)?|error|secondary[\w-]*|tertiary[\w-]*|accent-orange[\w-]*|[\w-]*-container|status-(?:online|warn|alert)|inverse[\w-]*)(?![\w-])|var\(--(?:primary|on-|surface|outline|error|secondary|tertiary|accent-|status-|inverse-|card-shadow|field-focus)|rounded-md3/;
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
    for (const f of [
      "ui/invitations/InvitePeople.tsx",
      "ui/invitations/InviteDialog.tsx",
      "ui/devices/PlaceDeviceDialog.tsx",
      "ui/deviceTypes/DeviceTypeImageField.tsx",
      "ui/seats/SeatsView.tsx",
      "ui/seats/MemberPickerDialog.tsx",
      "ui/checkin/CheckinPopup.tsx",
      "ui/checkin/CheckinButton.tsx",
      "ui/checkin/CheckinView.tsx",
    ]) {
      expect(read(f), f).not.toContain("<button");
    }
  });

  it("check-in pixel chrome uses tokens and the kit pixel button", () => {
    for (const f of [
      "ui/checkin/CheckinPopup.tsx",
      "ui/checkin/CheckinButton.tsx",
      "ui/checkin/CheckinView.tsx",
      "ui/checkin/WhosHere.tsx",
    ]) {
      expect(read(f), f).not.toMatch(
        /px-(card|outline|wall|floor|accent)|--px-|rounded-none|border-\[|opacity-\d/,
      );
    }
    for (const f of ["ui/checkin/CheckinPopup.tsx", "ui/checkin/CheckinButton.tsx"]) {
      expect(read(f), f).toContain('variant="pixel"');
      expect(read(f), f).not.toContain('variant="filled"');
    }
  });

  it("device lists switch layout at lg", () => {
    for (const n of [
      "DeviceTable",
      "IncomingTransfers",
      "PendingReturns",
      "PendingExtensions",
      "OverdueBanner",
    ]) {
      const text = read(`ui/devices/${n}.tsx`);
      expect(text, n).not.toMatch(/(?<![\w-])md:/);
      expect(text, n).toContain("lg:");
    }
  });

  it("DeviceTable and SeatsView use the shared table classes", () => {
    for (const f of ["ui/devices/DeviceTable.tsx", "ui/seats/SeatsView.tsx"]) {
      const text = read(f);
      expect(text, f).toContain("TABLE_HEAD");
      expect(text, f).toContain("TABLE_CELL");
      expect(text, f).not.toMatch(/const (CELL|HEAD|TH|TD)\b/);
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
