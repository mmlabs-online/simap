import { describe, expect, it } from "vitest";
import { membersCopy } from "../copy/members";
import {
  appendUnique,
  formatInviteDate,
  invitationRoleLabel,
  listQuery,
  moreCount,
} from "./members-state";

describe("members-state", () => {
  it("listQuery trims q, sets status and the default limit", () => {
    expect(listQuery("  Ánh ", "deactivated")).toEqual({
      q: "Ánh",
      status: "deactivated",
      limit: 50,
    });
    expect(listQuery("   ", "active").q).toBe("");
  });

  it("appendUnique keeps order and drops repeated ids", () => {
    expect(appendUnique([{ id: "a" }, { id: "b" }], [{ id: "b" }, { id: "c" }])).toEqual([
      { id: "a" },
      { id: "b" },
      { id: "c" },
    ]);
  });

  it("moreCount is never negative", () => {
    expect(moreCount(5, 3)).toBe(2);
    expect(moreCount(2, 2)).toBe(0);
    expect(moreCount(1, 3)).toBe(0);
  });

  it("invitationRoleLabel falls back to the raw role", () => {
    expect(invitationRoleLabel("simap:manager")).toBe("Manager");
    expect(invitationRoleLabel("simap:other")).toBe("simap:other");
  });

  it("formatInviteDate shows UTC+7 dates", () => {
    expect(formatInviteDate("2026-03-05T17:30:00Z")).toBe("06 Mar 2026");
    expect(formatInviteDate("not a date")).toBe("not a date");
    expect(formatInviteDate(null)).toBe(membersCopy.invitations.noExpiry);
  });
});
