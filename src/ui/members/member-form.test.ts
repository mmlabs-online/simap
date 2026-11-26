import { describe, expect, it } from "vitest";
import type { MemberDto } from "@/lib/members/types";
import { apiErrorMessage } from "../copy/api";
import { membersCopy } from "../copy/members";
import { formFromMember, submitErrorAction, toPatchBody } from "./member-form";

const member: MemberDto = {
  id: "m1",
  displayName: "Nguyễn Thị Ánh",
  email: "anh@example.com",
  employeeCode: "E1",
  group: { id: "11111111-1111-4111-8111-111111111111", name: "Dev", color: "#fff" },
  status: "active",
  hasPhoto: false,
  photoVersion: 0,
  seatCount: 0,
  deviceCount: 0,
  seats: [],
  devices: [],
};
const form = () => formFromMember(member);

describe("toPatchBody", () => {
  it("unchanged form (or code differing only by case) sends nothing", () => {
    expect(toPatchBody(form(), member)).toEqual({ kind: "unchanged" });
    expect(toPatchBody({ ...form(), employeeCode: " e1 " }, member)).toEqual({
      kind: "unchanged",
    });
  });

  it("sends only changed keys and keeps Vietnamese names as is", () => {
    expect(toPatchBody({ ...form(), displayName: "Trần Văn Bình" }, member)).toEqual({
      kind: "ok",
      body: { displayName: "Trần Văn Bình" },
    });
  });

  it("rejects a blank name and a bad code", () => {
    expect(toPatchBody({ ...form(), displayName: "  " }, member)).toEqual({
      kind: "invalid",
      message: membersCopy.fieldErrors.displayName,
    });
    expect(toPatchBody({ ...form(), employeeCode: "a b" }, member)).toEqual({
      kind: "invalid",
      message: membersCopy.fieldErrors.employeeCode,
    });
  });

  it("uppercases the code and clears it with null", () => {
    expect(toPatchBody({ ...form(), employeeCode: "ab.c-1" }, member)).toEqual({
      kind: "ok",
      body: { employeeCode: "AB.C-1" },
    });
    expect(toPatchBody({ ...form(), employeeCode: "" }, member)).toEqual({
      kind: "ok",
      body: { employeeCode: null },
    });
  });

  it("changes and clears the group", () => {
    const id = "22222222-2222-4222-8222-222222222222";
    expect(toPatchBody({ ...form(), groupId: id }, member)).toEqual({
      kind: "ok",
      body: { groupId: id },
    });
    expect(toPatchBody({ ...form(), groupId: "" }, member)).toEqual({
      kind: "ok",
      body: { groupId: null },
    });
  });
});

describe("submitErrorAction", () => {
  it("maps the edit errors", () => {
    expect(submitErrorAction("employee_code_taken", { employeeCode: "E2" })).toEqual({
      kind: "message",
      text: membersCopy.fieldErrors.employeeCodeTaken,
    });
    expect(submitErrorAction("invalid_request", { displayName: "x" })).toEqual({
      kind: "message",
      text: membersCopy.fieldErrors.invalidRequest,
    });
    expect(submitErrorAction("invalid_request", { groupId: "g" })).toEqual({
      kind: "message",
      text: membersCopy.fieldErrors.group,
    });
    expect(submitErrorAction("not_found", {})).toEqual({ kind: "close-reload" });
    expect(submitErrorAction("forbidden", {})).toEqual({
      kind: "message",
      text: apiErrorMessage("forbidden"),
    });
  });
});
