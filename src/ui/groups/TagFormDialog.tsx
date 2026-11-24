"use client";

import { useState } from "react";
import { GROUP_LIMITS, type GroupDto, type ProjectDto } from "@/lib/groups/types";
import { apiErrorMessage } from "../copy/api";
import { groupsCopy } from "../copy/groups";
import { kitCopy } from "../copy/kit";
import { DialogField, EntityFormDialog } from "../EntityFormDialog";
import { codeInput } from "../rooms/room-form";
import {
  emptyGroupForm,
  emptyProjectForm,
  formFromGroup,
  formFromProject,
  toGroupCreate,
  toGroupPatch,
  toProjectCreate,
  toProjectPatch,
  type GroupForm,
  type ProjectForm,
} from "./group-form";
import type { GroupsApi } from "./groups-api";

export type TagTarget =
  | { kind: "group"; item: GroupDto | null }
  | { kind: "project"; item: ProjectDto | null };

type Props = {
  target: TagTarget;
  api: GroupsApi;
  onClose: () => void;
  onDone: () => void;
};

/** Create (`item` null) or edit one group or project. Closes itself through `onDone` after a saved change. */
export function TagFormDialog(props: Props) {
  return <TagFormInner key={`${props.target.kind}:${props.target.item?.id ?? "new"}`} {...props} />;
}

function TagFormInner({ target, api, onClose, onDone }: Props) {
  const [group, setGroup] = useState<GroupForm>(
    target.kind === "group" && target.item ? formFromGroup(target.item) : emptyGroupForm(),
  );
  const [project, setProject] = useState<ProjectForm>(
    target.kind === "project" && target.item ? formFromProject(target.item) : emptyProjectForm(),
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const copy = groupsCopy[target.kind];
  const editing = target.item !== null;

  /** Validates and sends; resolves to the result of the call, or the early outcome. */
  async function send() {
    if (target.kind === "group") {
      if (target.item) {
        const p = toGroupPatch(group, target.item);
        if (p.kind !== "ok") return p;
        setSubmitting(true);
        return api.groups.update(target.item.id, p.body);
      }
      const c = toGroupCreate(group);
      if (c.kind !== "ok") return c;
      setSubmitting(true);
      return api.groups.create(c.body);
    }
    if (target.item) {
      const p = toProjectPatch(project, target.item);
      if (p.kind !== "ok") return p;
      setSubmitting(true);
      return api.projects.update(target.item.id, p.body);
    }
    const c = toProjectCreate(project);
    if (c.kind !== "ok") return c;
    setSubmitting(true);
    return api.projects.create(c.body);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const result = await send();
    if ("kind" in result) {
      if (result.kind === "unchanged") return onClose();
      return setError(result.message);
    }
    setSubmitting(false);
    if (result.ok || result.code === "not_found") return onDone();
    setError(apiErrorMessage(result.code));
  }

  return (
    <EntityFormDialog
      open
      title={editing ? copy.editTitle : copy.createTitle}
      submitLabel={editing ? kitCopy.save : copy.create}
      submitting={submitting}
      error={error}
      onClose={onClose}
      onSubmit={submit}
    >
      {target.kind === "group" ? (
        <>
          <DialogField
            label={groupsCopy.fields.groupName}
            icon="sell"
            value={group.name}
            onChange={(e) => setGroup((f) => ({ ...f, name: e.target.value }))}
            maxLength={GROUP_LIMITS.name}
            autoComplete="off"
            required
          />
          <DialogField
            label={groupsCopy.fields.color}
            icon="palette"
            type="color"
            value={group.color}
            onChange={(e) => setGroup((f) => ({ ...f, color: e.target.value }))}
          />
        </>
      ) : (
        <>
          <DialogField
            label={groupsCopy.fields.code}
            icon="grid_view"
            value={project.code}
            onChange={(e) => setProject((f) => ({ ...f, code: codeInput(e.target.value) }))}
            maxLength={GROUP_LIMITS.projectCode}
            autoCapitalize="characters"
            spellCheck={false}
            autoComplete="off"
            required
          />
          <DialogField
            label={groupsCopy.fields.projectName}
            icon="sell"
            value={project.name}
            onChange={(e) => setProject((f) => ({ ...f, name: e.target.value }))}
            maxLength={GROUP_LIMITS.projectName}
            autoComplete="off"
            required
          />
        </>
      )}
    </EntityFormDialog>
  );
}
