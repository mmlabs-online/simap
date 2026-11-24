import type { MemberDto } from "@/lib/members/types";
import {
  normalizeDisplayName,
  normalizeEmployeeCode,
  type MemberPatchValue,
} from "@/lib/validate/member";
import { apiErrorMessage } from "../copy/api";
import { membersCopy } from "../copy/members";

/** Strings only: `""` code = none, `""` group = no group. */
export type MemberForm = { displayName: string; employeeCode: string; groupId: string };

export const formFromMember = (m: MemberDto): MemberForm => ({
  displayName: m.displayName,
  employeeCode: m.employeeCode ?? "",
  groupId: m.group?.id ?? "",
});

export type PatchResult =
  | { kind: "ok"; body: MemberPatchValue }
  | { kind: "unchanged" }
  | { kind: "invalid"; message: string };

/** Sends only the fields that changed; a code that differs only by case or spaces is unchanged. */
export function toPatchBody(form: MemberForm, member: MemberDto): PatchResult {
  const body: MemberPatchValue = {};

  const name = normalizeDisplayName(form.displayName);
  if (name === null) return { kind: "invalid", message: membersCopy.fieldErrors.displayName };
  if (name !== member.displayName) body.displayName = name;

  let code: string | null = null;
  if (form.employeeCode.trim() !== "") {
    code = normalizeEmployeeCode(form.employeeCode);
    if (code === null) return { kind: "invalid", message: membersCopy.fieldErrors.employeeCode };
  }
  if (code !== member.employeeCode) body.employeeCode = code;

  const groupId = form.groupId === "" ? null : form.groupId;
  if (groupId !== (member.group?.id ?? null)) body.groupId = groupId;

  return Object.keys(body).length === 0 ? { kind: "unchanged" } : { kind: "ok", body };
}

export type SubmitErrorAction = { kind: "message"; text: string } | { kind: "close-reload" };

/** Where an edit error goes: inline message, or close and reload when the member is gone. */
export function submitErrorAction(code: string, body: MemberPatchValue): SubmitErrorAction {
  if (code === "not_found") return { kind: "close-reload" };
  if (code === "employee_code_taken") {
    return { kind: "message", text: membersCopy.fieldErrors.employeeCodeTaken };
  }
  if (code === "invalid_request") {
    const onlyGroup = Object.keys(body).length === 1 && "groupId" in body;
    return {
      kind: "message",
      text: onlyGroup ? membersCopy.fieldErrors.group : membersCopy.fieldErrors.invalidRequest,
    };
  }
  return { kind: "message", text: apiErrorMessage(code) };
}
