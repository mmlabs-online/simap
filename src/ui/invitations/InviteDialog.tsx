"use client";

import type { Tier } from "@/lib/auth/tier";
import { inviteRoleOptions } from "@/lib/invitations/roles";
import { invitationsCopy } from "../copy/invitations";
import { Button } from "../Button";
import { DialogField, DialogSelect, EntityFormDialog } from "../EntityFormDialog";

export type InviteNotice = { kind: "sent"; text: string } | { kind: "sentNotRecorded" };

export type InviteDialogProps = {
  open: boolean;
  tier: Tier;
  email: string;
  role: string;
  submitting: boolean;
  /** Already-translated message of the last failure, with the field it belongs to. */
  error: string | null;
  field?: "email" | "role";
  notice: InviteNotice | null;
  onEmail: (v: string) => void;
  onRole: (v: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  onRetryRecord: () => void;
};

/** Pure view of the invite form: the role list never offers more than the inviter's tier holds. */
export function InviteDialog(p: InviteDialogProps) {
  const options = inviteRoleOptions(p.tier);
  if (options.length === 0) return null;
  return (
    <EntityFormDialog
      open={p.open}
      title={invitationsCopy.title}
      subtitle={invitationsCopy.subtitle}
      submitLabel={invitationsCopy.submit}
      cancelLabel={invitationsCopy.close}
      submitting={p.submitting}
      error={p.error}
      onClose={p.onClose}
      onSubmit={(e) => {
        e.preventDefault();
        p.onSubmit();
      }}
    >
      {p.notice?.kind === "sent" && (
        <div role="status" className="text-label font-semibold text-text-primary px-1">
          {p.notice.text}
        </div>
      )}
      {p.notice?.kind === "sentNotRecorded" && (
        <div role="status" className="flex flex-col items-start gap-2 px-1">
          <span className="text-label font-semibold text-text-primary">
            {invitationsCopy.sentNotRecorded}
          </span>
          <Button variant="outlined" size="sm" onClick={p.onRetryRecord}>
            {invitationsCopy.retryRecord}
          </Button>
        </div>
      )}
      <DialogField
        label={invitationsCopy.fields.email}
        icon="mail"
        type="email"
        value={p.email}
        onChange={(e) => p.onEmail(e.target.value)}
        aria-invalid={p.field === "email" || undefined}
        autoComplete="off"
        spellCheck={false}
        required
      />
      <DialogSelect
        label={invitationsCopy.fields.role}
        icon="group"
        value={p.role}
        onChange={(e) => p.onRole(e.target.value)}
        aria-invalid={p.field === "role" || undefined}
      >
        {options.map((r) => (
          <option key={r} value={r}>
            {invitationsCopy.roles[r]}
          </option>
        ))}
      </DialogSelect>
    </EntityFormDialog>
  );
}
