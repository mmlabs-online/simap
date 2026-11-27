"use client";

import { useCallback, useEffect, useState } from "react";
import type { GroupDto, GroupImpact, ProjectDto, ProjectImpact } from "@/lib/groups/types";
import { apiErrorMessage } from "../copy/api";
import { groupsCopy } from "../copy/groups";
import { EntityFormDialog } from "../EntityFormDialog";
import { deleteStep, impactLines, removeOutcome } from "./delete-flow";
import type { GroupsApi, GroupsResult } from "./groups-api";

export type DeleteTarget =
  | { kind: "group"; item: GroupDto }
  | { kind: "project"; item: ProjectDto };

type Props = {
  target: DeleteTarget;
  api: GroupsApi;
  onClose: () => void;
  onDone: () => void;
};

/** What the dialog says once the impact is known: the plain question, or the counts and the cleared-tags note. */
export function DeleteImpactBody({
  kind,
  label,
  impact,
}: {
  kind: "group" | "project";
  label: string;
  impact: GroupImpact | ProjectImpact;
}) {
  const copy = groupsCopy[kind];
  if (deleteStep(impact) === "plain") {
    return (
      <div className="text-label text-text-primary">
        <p>{copy.deleteBody(label)}</p>
      </div>
    );
  }
  return (
    <div className="text-label text-text-primary">
      <p>{copy.forceDeleteIntro(label)}</p>
      <ul className="list-disc pl-5 mt-1">
        {impactLines(impact).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="mt-2 text-text-secondary">{copy.forceDeleteNote}</p>
    </div>
  );
}

/** Shows what deleting a group or project untags, then deletes (forced only after the forced confirm). */
export function DeleteDialog(props: Props) {
  return <DeleteInner key={`${props.target.kind}:${props.target.item.id}`} {...props} />;
}

function DeleteInner({ target, api, onClose, onDone }: Props) {
  const [impact, setImpact] = useState<GroupImpact | ProjectImpact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const copy = groupsCopy[target.kind];
  const label = target.kind === "group" ? target.item.name : target.item.code;
  const id = target.item.id;

  const loadImpact = useCallback(async () => {
    const r: GroupsResult<GroupImpact | ProjectImpact> =
      target.kind === "group" ? await api.groups.impact(id) : await api.projects.impact(id);
    if (r.ok) return setImpact(r.value);
    if (r.code === "not_found") return onDone();
    setError(apiErrorMessage(r.code));
  }, [api, target.kind, id, onDone]);

  useEffect(() => {
    void loadImpact();
  }, [loadImpact]);

  const step = impact ? deleteStep(impact) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!step) return;
    setError(null);
    setSubmitting(true);
    const force = step === "forced";
    const r =
      target.kind === "group"
        ? await api.groups.remove(id, force)
        : await api.projects.remove(id, force);
    setSubmitting(false);
    const outcome = removeOutcome(r);
    if (outcome === "done") return onDone();
    if (outcome === "reload") return void loadImpact();
    setError(outcome.error);
  }

  return (
    <EntityFormDialog
      open
      title={copy.deleteTitle}
      submitLabel={step === "forced" ? copy.forceDeleteSubmit : copy.deleteSubmit}
      submitting={submitting || !impact}
      error={error}
      onClose={onClose}
      onSubmit={submit}
    >
      {impact && <DeleteImpactBody kind={target.kind} label={label} impact={impact} />}
    </EntityFormDialog>
  );
}
