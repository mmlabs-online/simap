"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Tier } from "@/lib/tier";
import { readMeResult } from "@/lib/identity/flow";
import { useApiFetch } from "../auth/api-fetch-context";
import { Button } from "../Button";
import { Card } from "../Card";
import { portalCopy } from "../copy/portal";
import { mapPatchResult, profilePatchInit, validateProfileName } from "../org/profile-form";
import { useSession } from "../session";
import { canReset, isDerived, lookDirty } from "./pixel-look-state";
import { PixelLookPicker } from "./PixelLookPicker";
import { profileOutcome } from "./portal-state";
import { footerStatus, nameDirty } from "./profile-draft";
import { ProfilePhoto } from "./ProfilePhoto";
import { ProfileTabView } from "./ProfileTabView";
import { usePixelLook } from "./usePixelLook";

type Load =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; name: string; memberId: string | null };

/** The Profile tab: reads the caller's own profile through `/api/me`, then shows the editable form. */
export function ProfileTab() {
  const apiFetch = useApiFetch();
  const session = useSession();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const read = useCallback(async () => {
    setLoad({ status: "loading" });
    let name: string | undefined;
    let memberId: string | null = null;
    try {
      const read = await readMeResult(await apiFetch("/api/me"));
      name = read.network ? undefined : read.me?.member?.displayName;
      memberId = read.network ? null : (read.me?.member?.id ?? null);
    } catch {
      name = undefined;
    }
    if (mounted.current)
      setLoad(name === undefined ? { status: "error" } : { status: "ready", name, memberId });
  }, [apiFetch]);

  useEffect(() => {
    void read();
  }, [read]);

  if (session === null) return null;
  if (load.status === "loading") {
    return (
      <Card className="h-48 animate-pulse">
        <div aria-busy="true" />
      </Card>
    );
  }
  if (load.status === "error") {
    return (
      <Card className="flex flex-col items-start gap-3 p-4">
        <p role="alert" className="text-sm font-semibold text-error">
          {portalCopy.profile.loadFailed}
        </p>
        <Button variant="tonal" size="sm" onClick={() => void read()}>
          {portalCopy.profile.retry}
        </Button>
      </Card>
    );
  }
  return (
    <ProfileForm
      initialName={load.name}
      memberId={load.memberId}
      email={session.email}
      tier={session.tier}
      orgName={session.orgName}
    />
  );
}

/** Owns the name draft, the character draft, and the single Save changes / Cancel. */
function ProfileForm({
  initialName,
  memberId,
  email,
  tier,
  orgName,
}: {
  initialName: string;
  memberId: string | null;
  email: string;
  tier: Tier;
  orgName?: string;
}) {
  const apiFetch = useApiFetch();
  const look = usePixelLook(memberId);
  const [savedName, setSavedName] = useState(initialName);
  const [draftName, setDraftName] = useState(initialName);
  const [nameError, setNameError] = useState<"required" | "invalid" | null>(null);
  const [nameNotice, setNameNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const hasLook = memberId !== null;
  const dirty = nameDirty(draftName, savedName) || (hasLook && lookDirty(look.state));

  const saveName = async (value: string) => {
    let r: { res: Response } | { error: unknown };
    try {
      r = { res: await apiFetch("/api/me", profilePatchInit(value)) };
    } catch (error) {
      r = { error };
    }
    return profileOutcome(await mapPatchResult(r));
  };

  const saveAll = async () => {
    if (busy || !dirty) return;
    const nameIsDirty = nameDirty(draftName, savedName);
    const check = nameIsDirty ? validateProfileName(draftName) : null;
    if (check && !check.ok) {
      setNameError(check.error);
      return;
    }
    setBusy(true);
    setNameError(null);
    setNameNotice(null);
    const [nameOut] = await Promise.all([
      check ? saveName(check.value) : Promise.resolve(null),
      look.persist(),
    ]);
    if (!mounted.current) return;
    if (nameOut) {
      if (nameOut.fieldError) setNameError(nameOut.fieldError);
      else if (nameOut.notice?.tone === "error") setNameNotice(nameOut.notice.text);
      else if (check?.ok) {
        setSavedName(check.value);
        setDraftName(check.value);
      }
    }
    setBusy(false);
  };

  const cancel = () => {
    setDraftName(savedName);
    setNameError(null);
    setNameNotice(null);
    look.discard();
  };

  const lookNotice = look.state.notice;
  const errors = [
    nameError ? portalCopy.profile.footer.fixName : null,
    nameNotice,
    hasLook &&
    lookNotice?.tone === "error" &&
    lookNotice.text !== portalCopy.profile.character.loadFailed
      ? lookNotice.text
      : null,
  ].filter((e): e is string => e !== null);

  const locked = busy || look.state.busy !== null || look.state.status === "loading";

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void saveAll();
      }}
    >
      <ProfileTabView
        name={draftName}
        email={email}
        tier={tier}
        orgName={orgName}
        nameError={nameError}
        onNameChange={(v) => {
          setDraftName(v);
          setNameError(null);
        }}
        busy={busy}
        photo={<ProfilePhoto name={savedName} />}
        character={
          hasLook ? (
            <PixelLookPicker
              draft={look.state.draft}
              isDerived={isDerived(look.state)}
              status={look.state.status}
              locked={locked}
              canReset={canReset(look.state)}
              atlas={look.atlas}
              atlasFailed={look.atlasFailed}
              onChoose={look.choose}
              onReset={look.resetDraft}
            />
          ) : null
        }
        footer={{
          status: footerStatus({ busy, dirty, errors }),
          canSave: dirty,
          canCancel: dirty,
        }}
        onCancel={cancel}
      />
    </form>
  );
}
