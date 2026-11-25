import { describe, expect, it } from "vitest";
import { isActive, navItemsFor, roomDetailHref, roomEditorHref } from "./nav";

const ids = (tier: Parameters<typeof navItemsFor>[0]) => navItemsFor(tier).map((i) => i.id);

describe("navItemsFor", () => {
  it("user sees dashboard, search, rooms, devices, members, myRequests only", () => {
    expect(ids("user")).toEqual([
      "dashboard",
      "search",
      "rooms",
      "devices",
      "members",
      "myRequests",
    ]);
  });
  it("manager adds approvals but not the editor", () => {
    expect(ids("manager")).toEqual([
      "dashboard",
      "search",
      "rooms",
      "devices",
      "members",
      "myRequests",
      "approvals",
    ]);
  });
  it("groups is hidden from the nav for every tier (D65)", () => {
    for (const tier of ["user", "manager", "admin"] as const)
      expect(ids(tier)).not.toContain("groups");
  });
  it("admin sees all items incl. roomEditor", () => {
    expect(ids("admin")).toHaveLength(10);
    expect(ids("admin")).toContain("roomEditor");
  });
  it("audit is admin only", () => {
    expect(ids("admin")).toContain("audit");
    expect(ids("manager")).not.toContain("audit");
    expect(ids("user")).not.toContain("audit");
  });
  it("deviceTypes is admin only", () => {
    expect(ids("admin")).toContain("deviceTypes");
    expect(ids("manager")).not.toContain("deviceTypes");
    expect(ids("user")).not.toContain("deviceTypes");
  });
  it("rail items keep seatMGT order", () => {
    const items = navItemsFor("admin");
    expect(items.filter((i) => i.placement === "rail").map((i) => i.id)).toEqual([
      "dashboard",
      "search",
      "rooms",
      "devices",
      "members",
      "myRequests",
      "approvals",
      "audit",
      "deviceTypes",
    ]);
    expect(items.find((i) => i.id === "roomEditor")?.placement).toBe("room");
  });
});

describe("isActive", () => {
  const item = (id: string) => navItemsFor("admin").find((i) => i.id === id)!;
  it("matches by path prefix, dashboard only exactly", () => {
    expect(isActive(item("dashboard"), "/")).toBe(true);
    expect(isActive(item("dashboard"), "/rooms")).toBe(false);
    for (const p of ["/rooms", "/rooms/A1", "/rooms/A1/edit", "/rooms/"]) {
      expect(isActive(item("rooms"), p)).toBe(true);
    }
    expect(isActive(item("rooms"), "/roomsx")).toBe(false);
  });
  it("isActive: /requests and /requests/x are active for myRequests; /approvals and /requestsx are not", () => {
    expect(isActive(item("myRequests"), "/requests")).toBe(true);
    expect(isActive(item("myRequests"), "/requests/x")).toBe(true);
    expect(isActive(item("myRequests"), "/approvals")).toBe(false);
    expect(isActive(item("myRequests"), "/requestsx")).toBe(false);
  });
  it("isActive: /search and /search/x active, /searchx not", () => {
    expect(isActive(item("search"), "/search")).toBe(true);
    expect(isActive(item("search"), "/search/x")).toBe(true);
    expect(isActive(item("search"), "/searchx")).toBe(false);
  });
});

describe("roomEditorHref", () => {
  it("encodes the code", () => {
    expect(roomEditorHref("A 1")).toBe("/rooms/A%201/edit");
    expect(roomEditorHref("Phòng")).toBe(`/rooms/${encodeURIComponent("Phòng")}/edit`);
    expect(roomEditorHref("Phòng")).not.toContain("ò");
  });
});

describe("roomDetailHref", () => {
  it("encodes the code", () => {
    expect(roomDetailHref("C302")).toBe("/rooms/C302");
    expect(roomDetailHref("A 1")).toBe("/rooms/A%201");
  });
  it("returns null for dot segments and keeps A..B", () => {
    expect(roomDetailHref(".")).toBeNull();
    expect(roomDetailHref("..")).toBeNull();
    expect(roomDetailHref("A..B")).toBe("/rooms/A..B");
  });
});
