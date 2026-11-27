"use client";

import { useState } from "react";
import type { MemberDto } from "@/lib/members/types";
import { apiErrorMessage } from "../copy/api";
import { membersCopy } from "../copy/members";
import { EntityFormDialog } from "../EntityFormDialog";
import type { MembersApi } from "./members-api";

/** Confirms reactivating a deactivated member (D34). */
export function ReactivateMemberDialog({
  member,
  api,
  onClose,
  onDone,
}: {
  member: MemberDto | null;
  api: MembersApi;
  onClose: () => void;
  onDone: () => void;
}) {
  if (!member) return null;
  return (
    <ReactivateInner key={member.id} member={member} api={api} onClose={onClose} onDone={onDone} />
  );
}

function ReactivateInner({
  member,
  api,
  onClose,
  onDone,
}: {
  member: MemberDto;
  api: MembersApi;
  onClose: () => void;
  onDone: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const d = membersCopy.reactivateDialog;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const r = await api.reactivate(member.id);
    setSubmitting(false);
    if (r.ok || r.code === "not_found") return onDone();
    setError(apiErrorMessage(r.code));
  }

  return (
    <EntityFormDialog
      open
      title={d.title}
      submitLabel={d.submit}
      submitting={submitting}
      error={error}
      onClose={onClose}
      onSubmit={submit}
    >
      <p className="text-label text-text-primary">{d.body(member.displayName)}</p>
    </EntityFormDialog>
  );
}
