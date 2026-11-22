import { describe, expect, it } from "vitest";
import { changedFields } from "./profile";

const cur = { displayName: "Nguyễn Văn A", employeeCode: "E1", groupId: null };

describe("changedFields", () => {
  it("none when equal", () => {
    expect(
      changedFields(cur, { displayName: "Nguyễn Văn A", employeeCode: "E1", groupId: null }),
    ).toEqual([]);
  });
  it("detects each field", () => {
    expect(changedFields(cur, { displayName: "B" })).toEqual(["displayName"]);
    expect(changedFields(cur, { employeeCode: "E2" })).toEqual(["employeeCode"]);
    expect(changedFields(cur, { groupId: "g" })).toEqual(["groupId"]);
  });
  it("null vs value", () => {
    expect(changedFields(cur, { employeeCode: null })).toEqual(["employeeCode"]);
    expect(changedFields(cur, { groupId: null })).toEqual([]);
  });
  it("undefined keys are ignored", () => {
    expect(changedFields(cur, { displayName: undefined, groupId: undefined })).toEqual([]);
  });
});
