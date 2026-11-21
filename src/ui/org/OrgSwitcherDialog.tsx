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
            <legend className="mb-1 text-sm font-semibold">{orgCopy.switcher.legend}</legend>
            {state.orgs.map((o) => (
              <label key={o.id} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="org"
                  value={o.id}
                  checked={selected === o.id}
                  onChange={() => setChosen(o.id)}
                />
                <span className="min-w-0 break-words">{o.name}</span>
                {o.id === currentId && (
                  <span className="text-xs text-on-surface-variant">
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
