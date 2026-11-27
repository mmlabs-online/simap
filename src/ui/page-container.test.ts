import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const scan = (dir: string) =>
  readdirSync(new URL(`../${dir}/`, import.meta.url), { recursive: true, encoding: "utf8" })
    .map((f) => `${dir}/${f.replaceAll("\\", "/")}`)
    .filter((f) => f.endsWith(".tsx") && !f.endsWith(".test.tsx"));

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
    const files = [...scan("ui"), ...scan("app")];
    expect(files.length).toBeGreaterThan(100);
    for (const f of files) expect(read(f), f).not.toContain("p-4 lg:p-6");
  });
  it("library pages use page-library, the rest page-content", () => {
    for (const f of LIBRARY) {
      expect(read(f), f).toContain("page-library");
      expect(read(f), f).not.toContain("page-content");
    }
    for (const f of CONTENT) expect(read(f), f).toContain("page-content");
  });
});
