"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readMeResult } from "@/lib/identity/flow";
import { useApiFetch } from "../auth/api-fetch-context";
import { Button } from "../Button";
import { Card } from "../Card";
import { portalCopy } from "../copy/portal";
import { mapPatchResult, profilePatchInit } from "../org/profile-form";
import { useSession } from "../session";
import { profileOutcome, type ProfileOutcomeView } from "./portal-state";
import { ProfilePhoto } from "./ProfilePhoto";
import { ProfileTabView } from "./ProfileTabView";

type Load = { status: "loading" } | { status: "error" } | { status: "ready"; name: string };

/** The Profile tab: reads and saves the caller's own display name through `/api/me`. */
export function ProfileTab() {
  const apiFetch = useApiFetch();
  const session = useSession();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ProfileOutcomeView>({ notice: null, fieldError: null });
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
    try {
      const read = await readMeResult(await apiFetch("/api/me"));
      name = read.network ? undefined : read.me?.member?.displayName;
    } catch {
      name = undefined;
    }
    if (mounted.current)
      setLoad(name === undefined ? { status: "error" } : { status: "ready", name });
  }, [apiFetch]);

  useEffect(() => {
    void read();
  }, [read]);

  const save = async (name: string) => {
    if (saving) return;
    setSaving(true);
    setResult({ notice: null, fieldError: null });
    let r: { res: Response } | { error: unknown };
    try {
      r = { res: await apiFetch("/api/me", profilePatchInit(name)) };
    } catch (error) {
      r = { error };
    }
    const out = profileOutcome(await mapPatchResult(r));
    if (!mounted.current) return;
    setResult(out);
    setSaving(false);
  };

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
    <ProfileTabView
      initialName={load.name}
      email={session.email}
      tier={session.tier}
      saving={saving}
      error={result.fieldError}
      notice={result.notice}
      onSubmit={(name) => void save(name)}
      sections={<ProfilePhoto name={load.name} />}
    />
  );
}
