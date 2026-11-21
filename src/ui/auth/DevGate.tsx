"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { createDevApiFetch } from "@/lib/api/dev-fetch";
import {
  createSingleFlight,
  devMeErrorView,
  devViewForMe,
  loadDevView,
  type DevView,
} from "@/lib/identity/dev-flow";
import { readMeResult } from "@/lib/identity/flow";
import type { DevBadge, Session } from "@/lib/session";
import { devTokenCopy } from "../copy/dev-token";
import { mapPatchResult, profilePatchInit } from "../org/profile-form";
import { ProfileView, type ProfileError } from "../org/ProfileView";
import { SessionProvider } from "../session";
import { AuthLayout } from "./AuthLayout";
import { ApiFetchProvider } from "./api-fetch-context";
import { Notice } from "./fields";
import { Button } from "../Button";
import { CheckingView, NoAccessView, RetryView } from "./views";

type State = { view: { kind: "checking" } | DevView; generation: number; session: Session | null };

/** Dev-token screen: the token is missing or unusable, or has no org. `Check again` re-asks the server. */
export function DevTokenView({
  reason,
  onCheckAgain,
}: {
  reason: "invalid" | "needOrg";
  onCheckAgain: () => void;
}) {
  const invalid = reason === "invalid";
  return (
    <AuthLayout title={invalid ? devTokenCopy.invalidTitle : devTokenCopy.needOrgTitle}>
      <Notice kind="error">{invalid ? devTokenCopy.invalidBody : devTokenCopy.needOrgBody}</Notice>
      <Button size="lg" fullWidth onClick={onCheckAgain}>
        {devTokenCopy.checkAgain}
      </Button>
    </AuthLayout>
  );
}

// The same literal guard as AuthGate: the flag only picks the badge and grants no access.
const prodData =
  process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_SIMAP_DEV_PROD === "1";

/** The shell badge: amber "Dev token", or the red "Production data" variant under `pnpm dev:prod`. */
export const devBadge = (prod: boolean): DevBadge =>
  prod ? { ...devTokenCopy.prodBadge, prod: true } : devTokenCopy.badge;

/** Persistent red notice on every screen outside the shell (e.g. the first-visit profile form) under `pnpm dev:prod`. */
function ProdNotice() {
  return (
    <div
      role="alert"
      title={devTokenCopy.prodBadge.tooltip}
      className="fixed inset-x-0 top-0 z-50 border-b border-red-700 bg-red-600 px-3 py-2 text-center text-xs font-extrabold uppercase tracking-[0.06em] text-white"
    >
      {devTokenCopy.prodBadge.label}: {devTokenCopy.prodBadge.tooltip}
    </div>
  );
}

const withNotice = (node: ReactNode) =>
  prodData ? (
    <>
      <ProdNotice />
      {node}
    </>
  ) : (
    node
  );

/**
 * Gate for `pnpm dev` (SIM-028.1): the server adds the bearer, so the browser never calls Identity. Loaded lazily by
 * `AuthGate` and only in development.
 */
export default function DevGate({
  children,
  onReady,
}: {
  children: ReactNode;
  onReady?: () => void;
}) {
  const [state, setState] = useState<State>({
    view: { kind: "checking" },
    generation: 0,
    session: null,
  });
  const [status, setStatus] = useState<"idle" | "submitting">("idle");
  const [profileError, setProfileError] = useState<ProfileError | null>(null);
  const seq = useRef(0);
  const generation = useRef(0);
  const busy = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  const [{ apiFetch, flight }] = useState(() => {
    const onAuthLost = (code: "unauthenticated" | "org_required") => {
      if (stateRef.current.view.kind !== "ready") return;
      seq.current += 1;
      flight.reset();
      const next: State = {
        view: { kind: "token", reason: code === "org_required" ? "needOrg" : "invalid" },
        generation: stateRef.current.generation,
        session: null,
      };
      stateRef.current = next;
      setState(next);
    };
    const apiFetch = createDevApiFetch({ onAuthLost });
    const flight = createSingleFlight(() => loadDevView(apiFetch));
    return { apiFetch, flight };
  });

  const apply = (v: DevView) => {
    setProfileError(null);
    setState((prev) => {
      if (v.kind !== "ready") return { view: v, generation: prev.generation, session: null };
      const wasReady = prev.view.kind === "ready";
      if (!wasReady) generation.current += 1;
      return {
        view: v,
        generation: wasReady ? prev.generation : generation.current,
        session: {
          tier: v.tier,
          email: v.email,
          devToken: devBadge(prodData),
        },
      };
    });
  };

  const load = () => {
    const s = ++seq.current;
    void flight.join().then((v) => {
      if (s === seq.current) apply(v);
    });
  };

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (state.view.kind === "ready") onReadyRef.current?.();
  }, [state.view.kind]);

  const check = () => {
    flight.reset();
    setState((prev) => ({ ...prev, view: { kind: "checking" }, session: null }));
    load();
  };

  const refreshPermissions = () => {
    if (stateRef.current.view.kind !== "ready") return;
    flight.reset();
    load();
  };

  const saveProfile = async (name: string) => {
    if (busy.current) return;
    busy.current = true;
    const s = ++seq.current;
    setStatus("submitting");
    try {
      let r: { res: Response } | { error: unknown };
      try {
        r = { res: await apiFetch("/api/me", profilePatchInit(name)) };
      } catch (error) {
        r = { error };
      }
      const out = await mapPatchResult(r);
      if (s !== seq.current) return;
      if (out.kind === "saved") apply(devViewForMe(await readMeResult(out.res)));
      else if (out.kind === "access") apply(devMeErrorView(out.error));
      else setProfileError(out.kind === "invalid" ? "invalid" : "retry");
    } finally {
      busy.current = false;
      setStatus("idle");
    }
  };

  const { view, session } = state;
  switch (view.kind) {
    case "ready":
      return (
        <SessionProvider value={session} actions={{ refreshPermissions }}>
          <ApiFetchProvider value={apiFetch}>
            <Fragment key={state.generation}>{children}</Fragment>
          </ApiFetchProvider>
        </SessionProvider>
      );
    case "profile":
      return withNotice(
        <ProfileView
          initialName={view.displayName}
          email={view.email}
          status={status}
          error={profileError}
          onSubmit={saveProfile}
        />,
      );
    case "token":
      return withNotice(<DevTokenView reason={view.reason} onCheckAgain={check} />);
    case "noAccess":
      return withNotice(<NoAccessView code={view.code} />);
    case "retry":
      return withNotice(<RetryView error={view.error} onRetry={check} />);
    case "checking":
      return withNotice(<CheckingView />);
  }
}
