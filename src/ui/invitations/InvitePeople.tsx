"use client";

import { useMemo, useRef, useState } from "react";
import { inviteOutcome, recordOutcome } from "@/lib/invitations/invite-flow";
import { canInviteRole, inviteRoleOptions } from "@/lib/invitations/roles";
import { emailError } from "@/lib/validate/credentials";
import { normalizeInviteEmail, type InvitationRecordValue } from "@/lib/validate/invitation";
import { useApiFetch } from "../auth/api-fetch-context";
import { getAuthRuntime } from "../auth/runtime";
import { authErrorMessage } from "../copy/auth";
import { invitationsCopy } from "../copy/invitations";
import { useSession } from "../session";
import { InviteDialog, type InviteNotice } from "./InviteDialog";
import { createInvitationsApi } from "./invitations-api";

/** The "Invite people" button and dialog. Hidden for the User tier and in dev-token mode (no Identity session). */
export function InvitePeople() {
  const session = useSession();
  const apiFetch = useApiFetch();
  const api = useMemo(() => createInvitationsApi(apiFetch), [apiFetch]);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [field, setField] = useState<"email" | "role" | undefined>();
  const [notice, setNotice] = useState<InviteNotice | null>(null);
  const busy = useRef(false);
  const pending = useRef<InvitationRecordValue | null>(null);

  if (!session || session.devToken) return null;
  const options = inviteRoleOptions(session.tier);
  if (options.length === 0) return null;
  const tier = session.tier;

  const fail = (message: string, f?: "email" | "role") => {
    setError(message);
    setField(f);
  };

  async function record(v: InvitationRecordValue) {
    const out = recordOutcome(await api.record(v));
    if (out.kind === "sent") {
      pending.current = null;
      setNotice({ kind: "sent", text: invitationsCopy.sent(v.email) });
      setEmail("");
    } else {
      pending.current = v;
      setNotice({ kind: "sentNotRecorded" });
    }
  }

  async function submit() {
    if (busy.current) return;
    setError(null);
    setField(undefined);
    setNotice(null);
    const chosen = role || options[0];
    const code = emailError(email);
    if (code)
      return fail(
        invitationsCopy.fieldErrors[code === "required" ? "required" : "invalid"],
        "email",
      );
    if (!canInviteRole(tier, chosen)) return fail(invitationsCopy.fieldErrors.role, "role");
    const rt = getAuthRuntime();
    const accountId = rt.store.accountId();
    const orgId = rt.store.orgId();
    if (!accountId || !orgId) return fail(invitationsCopy.unavailable);
    busy.current = true;
    setSubmitting(true);
    try {
      let made: { id: string; expiresAt: string };
      try {
        made = await rt.client.invite({ accountId, orgId, email: email.trim(), role: chosen });
      } catch (e) {
        const out = inviteOutcome({
          ok: false,
          error: (e as { code?: string })?.code ? (e as never) : { code: "unknown" },
        });
        if (out.kind === "error") fail(authErrorMessage(out.error), out.field);
        return;
      }
      // Identity has the invitation now: from here a failure is a warning, never "not invited".
      await record({
        email: normalizeInviteEmail(email) ?? email.trim().toLowerCase(),
        role: chosen,
        identityInvitationId: made.id,
        expiresAt: made.expiresAt,
      });
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  }

  async function retryRecord() {
    const v = pending.current;
    if (!v || busy.current) return;
    busy.current = true;
    setSubmitting(true);
    try {
      await record(v);
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  }

  const close = () => {
    setOpen(false);
    setError(null);
    setField(undefined);
    setNotice(null);
    pending.current = null;
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="state-layer px-5 py-2.5 rounded-md3 bg-primary text-on-primary font-bold text-sm cursor-pointer font-[inherit]"
      >
        {invitationsCopy.open}
      </button>
      <InviteDialog
        open={open}
        tier={tier}
        email={email}
        role={role || options[0]}
        submitting={submitting}
        error={error}
        field={field}
        notice={notice}
        onEmail={setEmail}
        onRole={setRole}
        onClose={close}
        onSubmit={submit}
        onRetryRecord={retryRecord}
      />
    </>
  );
}
