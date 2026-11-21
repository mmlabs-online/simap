import { describe, expect, it } from "vitest";
import { actionLabel } from "../copy/audit";
import { actorLabel, canViewAudit, formatAuditTime, metaEntries, toApiFilter } from "./audit-state";

describe("audit-state", () => {
  it("canViewAudit: admin true; manager, user, null session false", () => {
    expect(canViewAudit("admin")).toBe(true);
    expect(canViewAudit("manager")).toBe(false);
    expect(canViewAudit("user")).toBe(false);
    expect(canViewAudit(null)).toBe(false);
  });
  it("toApiFilter: blank -> absent; days -> UTC instants; limit default", () => {
    expect(toApiFilter({ actor: "", entity: "", fromDay: "", toDay: "" })).toEqual({ limit: 50 });
    expect(
      toApiFilter({ actor: "a", entity: "room", fromDay: "2026-03-05", toDay: "2026-03-05" }),
    ).toEqual({
      actor: "a",
      entity: "room",
      from: "2026-03-04T17:00:00.000Z",
      to: "2026-03-05T17:00:00.000Z",
      limit: 50,
    });
    expect(toApiFilter({ actor: "", entity: "", fromDay: "2026-03-06", toDay: "2026-03-05" })).toBe(
      null,
    );
  });
  it("formatAuditTime: UTC instant shows Asia/Ho_Chi_Minh time", () => {
    expect(formatAuditTime("2026-03-05T17:30:00.123456Z")).toBe("06 Mar 2026, 00:30");
    expect(formatAuditTime("garbage")).toBe("garbage");
  });
  it("actorLabel: name as is; null -> 'Unknown member' + sub.slice(0,8)", () => {
    expect(actorLabel({ sub: "x", displayName: "Nguyễn Văn Á" })).toBe("Nguyễn Văn Á");
    expect(actorLabel({ sub: "12345678-aaaa", displayName: null })).toBe("Unknown member 12345678");
  });
  it("metaEntries: null -> []; object -> strings; nested stringified; long truncated", () => {
    expect(metaEntries(null)).toEqual([]);
    expect(metaEntries({ code: "A1", n: 2, o: { a: 1 } })).toEqual([
      ["code", "A1"],
      ["n", "2"],
      ["o", '{"a":1}'],
    ]);
    const long = metaEntries({ k: "x".repeat(200) })[0][1];
    expect(long.length).toBe(80);
    expect(long.endsWith("…")).toBe(true);
  });
  it("actionLabel: room.create known; unknown 'seat.assign' -> raw string", () => {
    expect(actionLabel("room.create")).toBe("Created a room");
    expect(actionLabel("seat.assign")).toBe("seat.assign");
    expect(actionLabel("constructor")).toBe("constructor");
  });
});
