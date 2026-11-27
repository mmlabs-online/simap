"use client";

import { useState } from "react";
import type { OrgChoice } from "@/lib/identity/types";
import { Notice } from "../auth/fields";
import { Button } from "../Button";
import { orgCopy } from "../copy/org";
import { EntityFormDialog } from "../EntityFormDialog";

export type OrgSwitcherState =
  | { status: "loading" }
  | { status: "failed" }
  | { status: "ready"; orgs: readonly OrgChoice[] };

/** The org switcher: a radio per org, the current one preselected and marked in text. Props only. */
export function OrgSwitcherDialog({
  open,
  state,
  currentId,
  onSwitch,
  onRetry,
  onClose,
}: {
  open: boolean;
  state: OrgSwitcherState;
  currentId: string | null;
  onSwitch: (id: string) => void;
  onRetry: () => void;
  onClose: () => void;
}) {
  const [chosen, setChosen] = useState<string | null>(null);
  const selected = chosen ?? currentId;
  return (
    <EntityFormDialog
      open={open}
      title={orgCopy.switcher.title}
      submitLabel={orgCopy.switcher.submit}
      onClose={onClose}
      onSubmit={(e) => {
        e.preventDefault();
        if (state.status === "ready" && selected) onSwitch(selected);
      }}
      submitting={false}
    >
      {state.status === "loading" && (
        <Notice kind="info" busy>
          {orgCopy.switcher.loading}
        </Notice>
      )}
      {state.status === "failed" && (
        <>
          <Notice kind="error">{orgCopy.switcher.loadFailed}</Notice>
          <Button variant="tonal" onClick={onRetry}>
            {orgCopy.switcher.retry}
          </Button>
        </>
      )}
      {state.status === "ready" &&
        (state.orgs.length <= 1 ? (
          <Notice kind="info">{orgCopy.switcher.only}</Notice>
        ) : (
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-1 text-label font-semibold text-text-primary">
              {orgCopy.switcher.legend}
            </legend>
            {state.orgs.map((o) => (
              <label
                key={o.id}
                className="flex min-h-control cursor-pointer items-center gap-2 text-label font-normal text-text-primary"
              >
                <input
                  type="radio"
                  className="size-5 flex-none"
                  name="org"
                  value={o.id}
                  checked={selected === o.id}
                  onChange={() => setChosen(o.id)}
                />
                <span className="min-w-0 break-words">{o.name}</span>
                {o.access === "super_admin" && (
                  <span className="text-caption text-text-secondary">
                    {orgCopy.badge.supportAccess}
                  </span>
                )}
                {o.id === currentId && (
                  <span className="text-caption text-text-secondary">
                    {orgCopy.switcher.current}
                  </span>
                )}
              </label>
            ))}
          </fieldset>
        ))}
    </EntityFormDialog>
  );
}
