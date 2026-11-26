import { describe, expect, it } from "vitest";
import type { DeviceDto } from "@/lib/devices/types";
import { shellCopy } from "../copy/shell";
import { portalCopy } from "../copy/portal";
import { rowActions } from "../devices/device-actions";
import {
  devicesPageRedirect,
  marksDecisionsSeen,
  nextTabIndex,
  parsePortalTab,
  portalBadgeTotal,
  portalHandlers,
  portalTabHref,
  profileOutcome,
  requestsPageRedirect,
} from "./portal-state";
import { ApiAccessError } from "@/lib/api/fetch";

const noop = () => {};
const all = {
  onAssign: noop,
  onEditHolding: noop,
  onPlace: noop,
  onEdit: noop,
  onDelete: noop,
  onTransfer: noop,
  onReturn: noop,
  onExtend: noop,
  onTakeBack: noop,
  onCancelHandoff: noop,
};
const device = (over: Partial<DeviceDto> = {}): DeviceDto =>
  ({
    id: "d1",
    name: "Máy Đỗ",
    type: "PC",
    inventoryNumber: "INV-1",
    mine: true,
    overdue: false,
    canAssign: true,
    canEditHolding: true,
    canEdit: true,
    canDelete: true,
    canTakeBack: true,
    canTransfer: true,
    canReturn: true,
    holding: null,
    placement: null,
    pendingHandoff: null,
    ...over,
  }) as DeviceDto;
const keys = (d: DeviceDto) => rowActions(d, portalHandlers(all)).map((a) => a.key);

describe("parsePortalTab", () => {
  it("[] and unknown values are the default; one known value wins; repeats are the default", () => {
    expect(parsePortalTab([])).toBe("seat");
    expect(parsePortalTab(["seat"])).toBe("seat");
    expect(parsePortalTab(["profile"])).toBe("profile");
    expect(parsePortalTab(["devices"])).toBe("devices");
    for (const v of ["x", "", "Profile"]) expect(parsePortalTab([v])).toBe("seat");
    expect(parsePortalTab(["profile", "profile"])).toBe("seat");
    expect(parsePortalTab(["profile", "devices"])).toBe("seat");
  });
});

describe("portalTabHref", () => {
  it("the default tab keeps the bare path", () => {
    expect(portalTabHref("/portal", "seat")).toBe("/portal");
    expect(portalTabHref("/portal", "devices")).toBe("/portal?tab=devices");
    expect(portalTabHref("/portal", "profile")).toBe("/portal?tab=profile");
  });
});

describe("nextTabIndex", () => {
  it("arrows wrap, Home and End jump, other keys do nothing", () => {
    expect(nextTabIndex("ArrowRight", 0, 3)).toBe(1);
    expect(nextTabIndex("ArrowRight", 2, 3)).toBe(0);
    expect(nextTabIndex("ArrowLeft", 0, 3)).toBe(2);
    expect(nextTabIndex("ArrowLeft", 2, 3)).toBe(1);
    expect(nextTabIndex("Home", 2, 3)).toBe(0);
    expect(nextTabIndex("End", 0, 3)).toBe(2);
    expect(nextTabIndex("Enter", 0, 3)).toBeNull();
    expect(nextTabIndex("ArrowRight", 0, 1)).toBe(0);
  });
});

describe("portalHandlers", () => {
  it("keeps only the owner actions", () => {
    expect(Object.keys(portalHandlers(all)).sort()).toEqual(
      ["onCancelHandoff", "onExtend", "onPlace", "onReturn", "onTransfer"].sort(),
    );
  });
  it("no edit, delete, take back, assign or edit holding even with every flag true", () => {
    const k = keys(device());
    for (const bad of ["edit", "delete", "takeBack", "assign", "editHolding"]) {
      expect(k).not.toContain(bad);
    }
    expect(k).toContain("transfer");
    expect(k).toContain("giveBack");
  });
  it("a pending transfer started by me offers only cancel; not cancellable offers nothing", () => {
    const pending = {
      id: "h",
      kind: "transfer" as const,
      to: { id: "u", displayName: "Hà" },
      requestedBy: { id: "m", displayName: "Tôi" },
      newExpiresOn: null,
      createdAt: "2026-11-25T00:00:00Z",
    };
    const cancellable = device({
      canTransfer: false,
      canReturn: false,
      pendingHandoff: { ...pending, canCancel: true } as DeviceDto["pendingHandoff"],
    });
    expect(keys(cancellable)).toEqual(["cancelTransfer"]);
    const locked = device({
      canTransfer: false,
      canReturn: false,
      pendingHandoff: { ...pending, canCancel: false } as DeviceDto["pendingHandoff"],
    });
    expect(keys(locked)).toEqual([]);
  });
  it("overdue mine, no pending: extend and give back present", () => {
    const k = keys(device({ overdue: true }));
    expect(k).toContain("extend");
    expect(k).toContain("giveBack");
  });
});

describe("portalBadgeTotal", () => {
  it("is incoming + overdue + decisions; returns and extensions are ignored", () => {
    expect(portalBadgeTotal({ incoming: 2, returns: 5, extensions: 4, overdue: 3 }, 4)).toBe(9);
    expect(portalBadgeTotal({ incoming: 0, returns: 0, extensions: 0, overdue: 0 }, 0)).toBe(0);
    expect(portalBadgeTotal({ incoming: 0, returns: 7, extensions: 7, overdue: 0 }, 3)).toBe(3);
  });
});

describe("marksDecisionsSeen", () => {
  it("only the My seat tab marks decisions seen; landing on /portal is My seat", () => {
    expect(marksDecisionsSeen("seat")).toBe(true);
    expect(marksDecisionsSeen("devices")).toBe(false);
    expect(marksDecisionsSeen("profile")).toBe(false);
    expect(marksDecisionsSeen(parsePortalTab([]))).toBe(true);
  });
});

describe("requestsPageRedirect", () => {
  it("sends /requests to My seat", () => {
    expect(requestsPageRedirect).toBe("/portal?tab=seat");
  });
});

describe("portalBreakdown", () => {
  it("0, only incoming, only overdue, both", () => {
    const c = (incoming: number, overdue: number, decisions = 0) =>
      shellCopy.badge.portalBreakdown({ incoming, returns: 9, extensions: 9, overdue }, decisions);
    expect(c(0, 0)).toBe("0 incoming transfers");
    expect(c(1, 0)).toBe("1 incoming transfer");
    expect(c(0, 2)).toBe("2 overdue devices");
    expect(c(2, 1)).toBe("3 pending items: 2 incoming transfers, 1 overdue device");
    expect(c(0, 0, 1)).toBe("1 new decision");
    expect(c(0, 0, 3)).toBe("3 new decisions");
    expect(c(2, 1, 4)).toBe(
      "7 pending items: 2 incoming transfers, 1 overdue device, 4 new decisions",
    );
  });
});

describe("devicesPageRedirect", () => {
  it("only a User is redirected", () => {
    expect(devicesPageRedirect("user")).toBe("/portal?tab=devices");
    expect(devicesPageRedirect("manager")).toBeNull();
    expect(devicesPageRedirect("admin")).toBeNull();
    expect(devicesPageRedirect(undefined)).toBeNull();
  });
});

describe("profileOutcome", () => {
  it("saved, invalid, retry and access", () => {
    expect(profileOutcome({ kind: "saved", res: new Response() })).toEqual({
      notice: { tone: "status", text: portalCopy.profile.saved },
      fieldError: null,
    });
    expect(profileOutcome({ kind: "invalid" })).toEqual({ notice: null, fieldError: "invalid" });
    expect(profileOutcome({ kind: "retry" }).notice?.tone).toBe("error");
    const access = profileOutcome({
      kind: "access",
      error: new ApiAccessError("forbidden"),
    });
    expect(access.notice?.tone).toBe("error");
    expect(access.fieldError).toBeNull();
  });
});
