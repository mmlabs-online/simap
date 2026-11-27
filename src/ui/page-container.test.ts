import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const LIBRARY = [
  "ui/deviceTypes/DeviceTypesView.tsx",
  "ui/mapItems/MapItemsView.tsx",
  "ui/seats/SeatsPage.tsx",
  "ui/seats/SeatsView.tsx",
  "ui/roomlayout/LayoutEditorPage.tsx",
];
const CONTENT = [
  "ui/AppShellView.tsx",
  "ui/PageSkeleton.tsx",
  "app/dev/shell/KitGallery.tsx",
  "ui/audit/AuditView.tsx",
  "ui/checkin/CheckinPage.tsx",
  "ui/checkin/CheckinView.tsx",
  "ui/credits/CreditsPage.tsx",
  "ui/dashboard/DashboardView.tsx",
  "ui/devices/DeviceDetailView.tsx",
  "ui/devices/DevicesView.tsx",
  "ui/groups/GroupsView.tsx",
  "ui/members/MembersView.tsx",
  "ui/portal/PortalPage.tsx",
  "ui/requests/ApprovalsPage.tsx",
  "ui/requests/ApprovalsView.tsx",
  "ui/rooms/RoomsView.tsx",
  "ui/search/SearchPage.tsx",
  "ui/search/SearchView.tsx",
];

describe("page container", () => {
  it("no page wrapper keeps the old padding", () => {
    for (const f of [...LIBRARY, ...CONTENT]) expect(read(f), f).not.toContain("p-4 lg:p-6");
  });
  it("library pages use page-library, the rest page-content", () => {
    for (const f of LIBRARY) {
      expect(read(f), f).toContain("page-library");
      expect(read(f), f).not.toContain("page-content");
    }
    for (const f of CONTENT) expect(read(f), f).toContain("page-content");
  });
});
