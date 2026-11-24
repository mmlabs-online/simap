import type { GroupDto, ProjectDto } from "@/lib/groups/types";
import {
  validateGroupCreate,
  validateGroupPatch,
  validateProjectCreate,
  validateProjectPatch,
  type GroupCreateValue,
  type GroupPatchValue,
  type ProjectCreateValue,
  type ProjectPatchValue,
} from "@/lib/validate/group";
import { groupsCopy } from "../copy/groups";

export type GroupForm = { name: string; color: string };
export type ProjectForm = { code: string; name: string };
export type TagKind = "group" | "project";

/** A mid-blue that reads on both themes; the native color input needs a valid `#rrggbb`. */
export const DEFAULT_GROUP_COLOR = "#3b82f6";

export const emptyGroupForm = (): GroupForm => ({ name: "", color: DEFAULT_GROUP_COLOR });
export const emptyProjectForm = (): ProjectForm => ({ code: "", name: "" });

/** The color input only accepts lowercase `#rrggbb`, so a stored `#AABBCC` is shown lowercased. */
export const formFromGroup = (g: GroupDto): GroupForm => ({
  name: g.name,
  color: g.color.toLowerCase(),
});
export const formFromProject = (p: ProjectDto): ProjectForm => ({ code: p.code, name: p.name });

/** The validators report `name` for both kinds, so the kind picks the message. */
export function fieldMessage(kind: TagKind, field: string): string {
  const e = groupsCopy.fieldErrors;
  if (field === "name") return kind === "group" ? e.groupName : e.projectName;
  if (field === "color") return e.color;
  if (field === "code") return e.code;
  return e.body;
}

export type CreateResult<T> = { kind: "ok"; body: T } | { kind: "invalid"; message: string };
export type PatchResult<T> =
  | { kind: "ok"; body: T }
  | { kind: "unchanged" }
  | { kind: "invalid"; message: string };

export function toGroupCreate(form: GroupForm): CreateResult<GroupCreateValue> {
  const v = validateGroupCreate(form);
  return v.ok
    ? { kind: "ok", body: v.value }
    : { kind: "invalid", message: fieldMessage("group", v.field) };
}

export function toProjectCreate(form: ProjectForm): CreateResult<ProjectCreateValue> {
  const v = validateProjectCreate(form);
  return v.ok
    ? { kind: "ok", body: v.value }
    : { kind: "invalid", message: fieldMessage("project", v.field) };
}

const sameText = (a: string, b: string) => a.normalize("NFC").trim() === b.normalize("NFC").trim();

/** Sends only the changed fields; a name that differs only by spaces or a color only by case is unchanged. */
export function toGroupPatch(form: GroupForm, group: GroupDto): PatchResult<GroupPatchValue> {
  const changed: Partial<GroupForm> = {};
  if (!sameText(form.name, group.name)) changed.name = form.name;
  if (form.color.toLowerCase() !== group.color.toLowerCase()) changed.color = form.color;
  if (Object.keys(changed).length === 0) return { kind: "unchanged" };
  const v = validateGroupPatch(changed);
  return v.ok
    ? { kind: "ok", body: v.value }
    : { kind: "invalid", message: fieldMessage("group", v.field) };
}

export function toProjectPatch(
  form: ProjectForm,
  project: ProjectDto,
): PatchResult<ProjectPatchValue> {
  const changed: Partial<ProjectForm> = {};
  if (form.code.trim().toUpperCase() !== project.code) changed.code = form.code;
  if (!sameText(form.name, project.name)) changed.name = form.name;
  if (Object.keys(changed).length === 0) return { kind: "unchanged" };
  const v = validateProjectPatch(changed);
  return v.ok
    ? { kind: "ok", body: v.value }
    : { kind: "invalid", message: fieldMessage("project", v.field) };
}
