import { describe, expect, it } from "vitest";
import { memberConflict } from "./pg-error";

describe("memberConflict", () => {
  it("23505 members_org_employee_code_key -> employee_code_taken; 23503 members_group_fkey -> invalid_group", () => {
    expect(memberConflict({ code: "23505", constraint: "members_org_employee_code_key" })).toBe(
      "employee_code_taken",
    );
    expect(memberConflict({ code: "23503", constraint: "members_group_fkey" })).toBe(
      "invalid_group",
    );
  });
  it("other constraints, codes and non-errors -> null", () => {
    expect(memberConflict({ code: "23505", constraint: "members_org_sub_key" })).toBeNull();
    expect(
      memberConflict({ code: "23503", constraint: "members_org_employee_code_key" }),
    ).toBeNull();
    expect(memberConflict({ code: "23505", constraint: "members_group_fkey" })).toBeNull();
    expect(memberConflict(null)).toBeNull();
    expect(memberConflict(new Error("x"))).toBeNull();
  });
});
