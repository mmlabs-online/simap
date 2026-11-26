import { describe, expect, it } from "vitest";
import { deviceDetailHref, isActive, navItemsFor, roomDetailHref, roomEditorHref } from "./nav";

const ids = (tier: Parameters<typeof navItemsFor>[0]) => navItemsFor(tier).map((i) => i.id);

describe("navItemsFor", () => {
  it("user sees dashboard, search, rooms, members, portal (no devices)", () => {
    expect(ids("user")).toEqual(["dashboard", "search", "rooms", "members", "portal"]);
  });
  it("manager adds approvals but not the editor", () => {
    expect(ids("manager")).toEqual([
      "dashboard",
      "search",
      "rooms",
      "devices",
      "members",
      "portal",
      "approvals",
    ]);
  });
  it("groups is hidden from the nav for every tier (D65)", () => {
    for (const tier of ["user", "manager", "admin"] as const)
      expect(ids(tier)).not.toContain("groups");
  });
  it("admin sees all items incl. roomEditor", () => {
    expect(ids("admin")).toHaveLength(11);
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
  it("mapItems is admin only", () => {
    expect(ids("admin")).toContain("mapItems");
    expect(ids("manager")).not.toContain("mapItems");
    expect(ids("user")).not.toContain("mapItems");
  });
  it("rail items keep seatMGT order", () => {
    const items = navItemsFor("admin");
    expect(items.filter((i) => i.placement === "rail").map((i) => i.id)).toEqual([
      "dashboard",
      "search",
      "rooms",
      "devices",
      "members",
      "portal",
      "approvals",
      "audit",
      "deviceTypes",
      "mapItems",
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
  it("there is no My requests entry for any tier (REG-02, D74)", () => {
    for (const tier of ["user", "manager", "admin"] as const)
      expect(navItemsFor(tier).some((i) => i.href === "/requests")).toBe(false);
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

describe("deviceDetailHref", () => {
  it("deviceDetailHref encodes the id; isActive marks Devices on /devices/<id>", () => {
    expect(deviceDetailHref("abc")).toBe("/devices/abc");
    expect(deviceDetailHref("a/b c")).toBe("/devices/a%2Fb%20c");
    const devices = navItemsFor("manager").find((i) => i.id === "devices")!;
    expect(isActive(devices, "/devices/abc")).toBe(true);
  });
  it("every tier has portal; isActive on /portal", () => {
    for (const tier of ["user", "manager", "admin"] as const) expect(ids(tier)).toContain("portal");
    const portal = navItemsFor("user").find((i) => i.id === "portal")!;
    expect(isActive(portal, "/portal")).toBe(true);
    expect(isActive(portal, "/requests")).toBe(false);
  });
});
