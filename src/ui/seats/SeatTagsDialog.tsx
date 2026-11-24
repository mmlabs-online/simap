"use client";

import { useState } from "react";
import type { GroupDto, ProjectDto } from "@/lib/groups/types";
import type { SeatDto } from "@/lib/seats/types";
import { seatsCopy } from "../copy/seats";
import { DialogSelect, EntityFormDialog } from "../EntityFormDialog";
import { useList } from "../groups/useList";
import {
  initialSelection,
  tagOptions,
  tagsPatch,
  type ListLoader,
  type TagSelection,
} from "./seat-tags";

type Props = {
  seat: SeatDto | null;
  submitting: boolean;
  loadGroups: ListLoader<GroupDto>;
  loadProjects: ListLoader<ProjectDto>;
  onClose: () => void;
  onSubmit: (patch: { groupId?: string | null; projectId?: string | null }) => void;
};

/** Group and project selects for one seat. `seat` null means closed; the inner part mounts per open, so the lists load fresh. */
export function SeatTagsDialog({ seat, ...rest }: Props) {
  if (seat === null) return null;
  return <SeatTagsInner seat={seat} {...rest} />;
}

function SeatTagsInner({
  seat,
  submitting,
  loadGroups,
  loadProjects,
  onClose,
  onSubmit,
}: Props & { seat: SeatDto }) {
  const groups = useList(loadGroups);
  const projects = useList(loadProjects);
  const [sel, setSel] = useState<TagSelection>(() => initialSelection(seat));
  const loading = groups.status === "loading" || projects.status === "loading";
  const failed = groups.status === "error" || projects.status === "error";
  const copy = seatsCopy.actions;

  return (
    <EntityFormDialog
      open
      title={copy.tagsTitle(seat.code)}
      submitLabel={copy.tagsSubmit}
      submitting={submitting}
      error={failed ? copy.tagsLoadFailed : null}
      onClose={onClose}
      onSubmit={(e) => {
        e.preventDefault();
        const patch = tagsPatch(seat, sel);
        if (patch === null) onClose();
        else onSubmit(patch);
      }}
    >
      <DialogSelect
        label={copy.tagsGroup}
        icon="group"
        value={sel.groupId ?? ""}
        disabled={loading || failed}
        onChange={(e) => setSel({ ...sel, groupId: e.target.value || null })}
      >
        <option value="">{copy.tagsNoGroup}</option>
        {tagOptions(groups.items, seat.group).map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </DialogSelect>
      <DialogSelect
        label={copy.tagsProject}
        icon="sell"
        value={sel.projectId ?? ""}
        disabled={loading || failed}
        onChange={(e) => setSel({ ...sel, projectId: e.target.value || null })}
      >
        <option value="">{copy.tagsNoProject}</option>
        {tagOptions(projects.items, seat.project).map((p) => (
          <option key={p.id} value={p.id}>
            {p.code} · {p.name}
          </option>
        ))}
      </DialogSelect>
      {loading && <p className="text-sm text-on-surface-variant">{copy.tagsLoading}</p>}
    </EntityFormDialog>
  );
}
