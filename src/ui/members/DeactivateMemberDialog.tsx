"use client";

import { useCallback, useEffect, useState } from "react";
import type { DeactivationImpact, MemberDto } from "@/lib/members/types";
import { apiErrorMessage } from "../copy/api";
import { membersCopy } from "../copy/members";
import { EntityFormDialog } from "../EntityFormDialog";
import { deactivateErrorAction, deactivateStep, impactLines, releaseFor } from "./deactivate-flow";
import type { MembersApi } from "./members-api";

/** Shows what deactivating a member affects, then deactivates (releasing seats and devices on confirm). */
export function DeactivateMemberDialog({
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
    <DeactivateInner key={member.id} member={member} api={api} onClose={onClose} onDone={onDone} />
  );
}

function DeactivateInner({
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
  const [impact, setImpact] = useState<DeactivationImpact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const d = membersCopy.deactivateDialog;

  const loadImpact = useCallback(async () => {
    const r = await api.impact(member.id);
    if (r.ok) return setImpact(r.value);
    if (r.code === "not_found") return onDone();
    setError(apiErrorMessage(r.code));
  }, [api, member.id, onDone]);

  useEffect(() => {
    void loadImpact();
  }, [loadImpact]);

  const step = impact ? deactivateStep(impact) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!step) return;
    setError(null);
    setSubmitting(true);
    const r = await api.deactivate(member.id, releaseFor(step));
    setSubmitting(false);
    if (r.ok) return onDone();
    const action = deactivateErrorAction(r.code);
    if (action.kind === "done") return onDone();
    if (action.kind === "reload-impact") {
      setImpact(null);
      return void loadImpact();
    }
    setError(action.text);
  }

  return (
    <EntityFormDialog
      open
      title={d.title}
      submitLabel={step === "release" ? d.submitRelease : d.submit}
      submitting={submitting || !impact}
      error={error}
      onClose={onClose}
      onSubmit={submit}
    >
      {impact && (
        <div className="text-sm font-medium text-on-surface">
          {step === "release" ? (
            <>
              <p>{d.releaseIntro(member.displayName)}</p>
              <ul className="list-disc pl-5 mt-1">
                {impactLines(impact).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p className="mt-2">{d.releaseBody}</p>
            </>
          ) : (
            <>
              <p>{d.plainBody(member.displayName)}</p>
              {impact.pendingRequests > 0 && <p className="mt-1">{d.plainRequests}</p>}
            </>
          )}
        </div>
      )}
    </EntityFormDialog>
  );
}
