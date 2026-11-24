"use client";

import { useState } from "react";
import type { MemberDto, MemberGroupRef } from "@/lib/members/types";
import { DISPLAY_NAME_MAX, EMPLOYEE_CODE_MAX } from "@/lib/validate/member";
import { kitCopy } from "../copy/kit";
import { membersCopy } from "../copy/members";
import { DialogField, DialogSelect, EntityFormDialog } from "../EntityFormDialog";
import { formFromMember, submitErrorAction, toPatchBody, type MemberForm } from "./member-form";
import type { MembersApi } from "./members-api";

/** Edit one member's simap fields. Closes itself through `onDone` after a saved change. */
export function EditMemberDialog({
  member,
  groups,
  api,
  onClose,
  onDone,
}: {
  member: MemberDto | null;
  groups: MemberGroupRef[];
  api: MembersApi;
  onClose: () => void;
  onDone: () => void;
}) {
  if (!member) return null;
  return (
    <EditInner
      key={member.id}
      member={member}
      groups={groups}
      api={api}
      onClose={onClose}
      onDone={onDone}
    />
  );
}

function EditInner({
  member,
  groups,
  api,
  onClose,
  onDone,
}: {
  member: MemberDto;
  groups: MemberGroupRef[];
  api: MembersApi;
  onClose: () => void;
  onDone: () => void;
}) {
  const [form, setForm] = useState<MemberForm>(formFromMember(member));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const set = (key: keyof MemberForm, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const fields = membersCopy.editDialog.fields;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const patch = toPatchBody(form, member);
    if (patch.kind === "unchanged") return onClose();
    if (patch.kind === "invalid") return setError(patch.message);
    setSubmitting(true);
    const result = await api.update(member.id, patch.body);
    setSubmitting(false);
    if (result.ok) return onDone();
    const action = submitErrorAction(result.code, patch.body);
    if (action.kind === "close-reload") return onDone();
    setError(action.text);
  }

  return (
    <EntityFormDialog
      open
      title={membersCopy.editDialog.title}
      subtitle={member.email}
      submitLabel={kitCopy.save}
      submitting={submitting}
      error={error}
      onClose={onClose}
      onSubmit={submit}
    >
      <DialogField
        label={fields.displayName}
        icon="person"
        value={form.displayName}
        onChange={(e) => set("displayName", e.target.value)}
        maxLength={DISPLAY_NAME_MAX}
        autoComplete="off"
        required
      />
      <DialogField
        label={fields.employeeCode}
        icon="grid_view"
        value={form.employeeCode}
        onChange={(e) => set("employeeCode", e.target.value)}
        placeholder={membersCopy.editDialog.codeHint}
        maxLength={EMPLOYEE_CODE_MAX}
        autoComplete="off"
        spellCheck={false}
      />
      <DialogSelect
        label={fields.group}
        icon="group"
        value={form.groupId}
        onChange={(e) => set("groupId", e.target.value)}
      >
        <option value="">{membersCopy.noGroup}</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </DialogSelect>
    </EntityFormDialog>
  );
}
