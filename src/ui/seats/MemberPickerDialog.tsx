"use client";

import { useState } from "react";
import type { SeatDto } from "@/lib/seats/types";
import { seatsCopy } from "../copy/seats";
import { DialogField, EntityFormDialog } from "../EntityFormDialog";
import {
  blocksSearchEnter,
  canLoadMore,
  selectedMember,
  type PickerMember,
  type LoadPage,
  type PickerState,
} from "./member-picker";
import { CLIP } from "../clip";
import { useMemberPicker } from "./useMemberPicker";

const copy = seatsCopy.actions;

/** Search box and radio list. Props only, so the markup can be tested without effects. */
export function MemberPickerFields({
  state,
  query,
  occupantId,
  canMore,
  onQuery,
  onSelect,
  onMore,
  onRetry,
  occupantLabel = copy.pickerSitsHere,
  listLabel = copy.pickerList,
}: {
  state: PickerState;
  query: string;
  occupantId: string | null;
  /** Suffix of the disabled occupant option; defaults to the seat wording. */
  occupantLabel?: string;
  /** Accessible name of the radio list. */
  listLabel?: string;
  canMore: boolean;
  onQuery: (q: string) => void;
  onSelect: (id: string) => void;
  onMore: () => void;
  onRetry: () => void;
}) {
  return (
    <>
      <DialogField
        label={copy.pickerSearch}
        icon="search"
        type="text"
        autoComplete="off"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        onKeyDown={(e) => {
          if (blocksSearchEnter(e.key, e.nativeEvent.isComposing)) e.preventDefault();
        }}
      />
      <div
        role="radiogroup"
        aria-label={listLabel}
        aria-busy={state.status === "loading"}
        className="max-h-[35dvh] overflow-y-auto flex flex-col gap-1"
      >
        {state.items.map((m) => {
          const here = m.id === occupantId;
          return (
            <label
              key={m.id}
              className="flex items-center gap-3 rounded-md3 px-2 py-1.5 text-sm font-medium text-on-surface"
            >
              <input
                type="radio"
                name="member"
                value={m.id}
                checked={state.selectedId === m.id}
                disabled={here}
                onChange={() => onSelect(m.id)}
              />
              <span className={`min-w-0 ${CLIP}`}>
                {m.displayName}
                {m.employeeCode !== null && (
                  <span className="text-on-surface-variant"> {m.employeeCode}</span>
                )}
                {here && <span className="text-on-surface-variant"> ({occupantLabel})</span>}
              </span>
            </label>
          );
        })}
        {state.status === "loading" && (
          <p className="text-sm text-on-surface-variant">{copy.pickerLoading}</p>
        )}
        {state.status === "ready" && state.items.length === 0 && (
          <p className="text-sm text-on-surface-variant">{copy.pickerEmpty}</p>
        )}
        {state.status === "error" && (
          <div role="alert" className="text-sm font-semibold text-error">
            {copy.pickerError}{" "}
            <button type="button" className="underline cursor-pointer" onClick={onRetry}>
              {seatsCopy.retry}
            </button>
          </div>
        )}
        {state.moreFailed && (
          <p role="alert" className="text-sm font-semibold text-error">
            {copy.pickerMoreFailed}
          </p>
        )}
        {(canMore || state.moreId !== null) && (
          <button
            type="button"
            disabled={!canMore}
            onClick={onMore}
            className="self-start text-sm font-bold text-primary cursor-pointer disabled:opacity-40"
          >
            {copy.pickerLoadMore}
          </button>
        )}
      </div>
    </>
  );
}

/** Pick a member for a seat. Mounted only while open, so each opening starts with a fresh list. */
export function MemberPickerDialog(props: {
  open: boolean;
  seat: SeatDto;
  loadPage: LoadPage;
  reloadToken: number;
  error: string | null;
  submitting: boolean;
  onClose: () => void;
  onPick: (member: PickerMember) => void;
}) {
  if (!props.open) return null;
  return <PickerInner {...props} />;
}

function PickerInner({
  seat,
  loadPage,
  reloadToken,
  error,
  submitting,
  onClose,
  onPick,
}: Parameters<typeof MemberPickerDialog>[0]) {
  const picker = useMemberPicker(loadPage, reloadToken);
  const [none, setNone] = useState(false);
  const occupantId = seat.occupant?.id ?? null;
  const { state } = picker;
  const canMore = canLoadMore(state);

  return (
    <EntityFormDialog
      open
      title={copy.assignTitle(seat.code)}
      submitLabel={occupantId === null ? copy.assign : copy.replace}
      submitting={submitting}
      error={error ?? (none ? copy.pickerNone : null)}
      onClose={onClose}
      onSubmit={(e) => {
        e.preventDefault();
        const member = selectedMember(state, occupantId);
        setNone(member === null);
        if (member) onPick(member);
      }}
    >
      <MemberPickerFields
        state={state}
        query={picker.query}
        occupantId={occupantId}
        canMore={canMore}
        onQuery={picker.setQuery}
        onSelect={(id) => {
          setNone(false);
          picker.select(id);
        }}
        onMore={() => void picker.loadMore()}
        onRetry={picker.retry}
      />
    </EntityFormDialog>
  );
}
