"use client";

import { useState } from "react";
import type { MemberDto } from "@/lib/members/types";
import { Avatar } from "../Avatar";
import { Button } from "../Button";
import { apiErrorMessage } from "../copy/api";
import { membersCopy } from "../copy/members";
import { removePhotoOutcome } from "./member-photos";
import type { MembersApi } from "./members-api";

/** The member card's photo block: the photo (or initials) and, for a member with a photo, "Remove photo". */
export function MemberPhotoSection({
  member,
  photoUrl,
  api,
  onRemoved,
}: {
  member: Pick<MemberDto, "id" | "displayName" | "hasPhoto">;
  photoUrl: string | null;
  api: Pick<MembersApi, "removePhoto">;
  onRemoved: () => void;
}) {
  const [removed, setRemoved] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = membersCopy.photo;
  const shown = member.hasPhoto && !removed;

  async function remove() {
    setBusy(true);
    setError(null);
    const outcome = removePhotoOutcome(await api.removePhoto(member.id));
    setBusy(false);
    if (outcome.kind === "error") return setError(apiErrorMessage(outcome.code));
    setConfirming(false);
    setRemoved(true);
    onRemoved();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <Avatar name={member.displayName} src={shown ? photoUrl : null} size={64} />
        {shown && !confirming && (
          <Button
            type="button"
            variant="tonal"
            size="sm"
            aria-label={copy.removeLabel(member.displayName)}
            onClick={() => setConfirming(true)}
          >
            {copy.remove}
          </Button>
        )}
      </div>
      {shown && confirming && (
        <div className="flex flex-col gap-2">
          <p className="text-label text-text-secondary">{copy.confirmBody}</p>
          <div className="flex gap-2">
            <Button type="button" variant="danger" size="sm" disabled={busy} onClick={remove}>
              {busy ? copy.removing : copy.confirm}
            </Button>
            <Button
              type="button"
              variant="tonal"
              size="sm"
              disabled={busy}
              onClick={() => setConfirming(false)}
            >
              {copy.keep}
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="text-label text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
