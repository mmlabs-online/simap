"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import {
  initialView,
  meErrorView,
  readMeResult,
  viewForMe,
  viewForTokenError,
  type GateView,
  type MeView,
} from "@/lib/identity/flow";
import { resendOutcome } from "@/lib/identity/email-flows";
import { decideOrg, type OrgNotice } from "@/lib/identity/orgs";
import type { AccountChoice, AuthError, Credentials, OrgChoice } from "@/lib/identity/types";
import type { Session } from "@/lib/session";
import { OrgPickerView } from "../org/OrgPickerView";
import { OrgSwitcherDialog, type OrgSwitcherState } from "../org/OrgSwitcherDialog";
import { mapPatchResult, profilePatchInit } from "../org/profile-form";
import { ProfileView, type ProfileError } from "../org/ProfileView";
import { SessionProvider } from "../session";
import { ApiFetchProvider } from "./api-fetch-context";
import { getAuthRuntime, setAuthLostHandler, type AuthRuntime } from "./runtime";
import { TurnstileWidget } from "./TurnstileWidget";
import {
  CheckingView,
  JoinView,
  NoAccessView,
  NoOrgView,
  RetryView,
  SignInView,
  UnverifiedView,
  type SignInNotice,
} from "./views";

type View =
  | { kind: "checking" }
  | { kind: "ready"; generation: number; session: Session; orgs: OrgChoice[] | null }
  | { kind: "orgPicker"; orgs: OrgChoice[]; notice?: OrgNotice; busyId?: string | null }
  | { kind: "profile"; displayName: string; email: string; error?: ProfileError | null }
  | { kind: "signedOut"; error?: AuthError | null; notice?: SignInNotice | null }
  | { kind: "join"; email: string; error?: AuthError | null; pending?: boolean }
  | {
      kind: "unverified";
      email: string | null;
      still?: boolean;
      resend?: "idle" | "sending" | "sent";
      resendError?: AuthError | null;
    }
  | { kind: "retry"; error: AuthError }
  | { kind: "noOrg"; email: string | null; notice?: OrgNotice }
  | { kind: "noAccess"; code: "forbidden" | "member_deactivated" };

const MAX_LISTED_ACCOUNTS = 5;

/**
 * Renders `children` only while signed in and allowed; every other state shows a sign-in screen in place (the URL
 * never changes). The runtime is created in an effect, so server rendering never builds a token store.
 */
export function AuthGate({ children, onReady }: { children: ReactNode; onReady?: () => void }) {
  const [rt, setRt] = useState<AuthRuntime | null>(null);
  useEffect(() => setRt(getAuthRuntime()), []);
  if (!rt) return <CheckingView />;
  return (
    <Gate rt={rt} onReady={onReady}>
      {children}
    </Gate>
  );
}

function Gate({
  rt,
  onReady,
  children,
}: {
  rt: AuthRuntime;
  onReady?: () => void;
  children: ReactNode;
}) {
  const { store, client, apiFetch, turnstileSiteKey } = rt;
  const [view, setView] = useState<View>({ kind: "checking" });
  const [status, setStatus] = useState<"idle" | "submitting">("idle");
  const [accounts, setAccounts] = useState<AccountChoice[] | null>(null);
  const [continuingId, setContinuingId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [needTurnstile, setNeedTurnstile] = useState(false);
  const [tsFailed, setTsFailed] = useState(false);
  const [tsKey, setTsKey] = useState(0);
  const tsToken = useRef<string | null>(null);
  const seq = useRef(0); // epoch: any move to another screen bumps it, and a late answer of an older epoch is dropped
  const listSeq = useRef(0);
  const denied = useRef(new Set<string>()); // org ids refused in this tab: while any is set, no org is auto-entered
  const orgList = useRef<OrgChoice[] | null>(null); // the account's orgs (name and count for the shell); null = not loaded
  const orgListSeq = useRef(0);
  const [switcher, setSwitcher] = useState<OrgSwitcherState | null>(null);
  const generation = useRef(0);
  const lastEmail = useRef<string | null>(null);
  const rechecking = useRef(false);
  const busy = useRef(false); // continueAs / join / signIn in flight
  const viewRef = useRef(view);
  viewRef.current = view;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  const loadAccounts = async () => {
    const s = ++listSeq.current;
    let list: AccountChoice[] = [];
    try {
      list = await client.accounts();
    } catch {
      // any failure: the form alone, no banner
    }
    if (s !== listSeq.current) return;
    const seen = new Set<string>();
    const unique = list.filter((a) => {
      const key = a.accountId.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    setAccounts(unique.length ? unique.slice(0, MAX_LISTED_ACCOUNTS) : null);
  };
  // No list right after a sign-out or "other account": the account just left must not be offered.
  const clearAccounts = () => {
    listSeq.current += 1;
    setAccounts(null);
  };
  const spendTurnstile = () => {
    tsToken.current = null;
    setTsFailed(false);
    setTsKey((k) => k + 1);
  };
  const forgetForm = () => {
    tsToken.current = null;
    setNeedTurnstile(false);
    setEmail("");
    lastEmail.current = null;
    clearAccounts();
  };

  // The account changed (or ended): its org list, this tab's denied orgs and any open switcher are void.
  const resetOrgs = () => {
    denied.current.clear();
    orgList.current = null;
    orgListSeq.current += 1;
    setSwitcher(null);
  };
  const orgNameOf = (orgs: OrgChoice[] | null) => {
    const current = store.orgId();
    return orgs?.find((o) => o.id === current)?.name;
  };
  /** Lists the account's orgs and keeps the shell's name and count current. A newer call drops an older answer. */
  const fetchOrgs = async (): Promise<OrgChoice[] | "failed" | "stale"> => {
    const acct = store.accountId();
    if (!acct) return "failed";
    const my = ++orgListSeq.current;
    let orgs: OrgChoice[];
    try {
      orgs = await client.orgs(acct);
    } catch {
      return my === orgListSeq.current ? "failed" : "stale";
    }
    if (my !== orgListSeq.current) return "stale";
    orgList.current = orgs;
    setView((v) =>
      v.kind === "ready" ? { ...v, orgs, session: { ...v.session, orgName: orgNameOf(orgs) } } : v,
    );
    return orgs;
  };

  /** Lists the orgs and enters one, shows the picker, or shows "no organization". Shared by `needOrg` and `pickOrg`. */
  const enterOrg = async (s: number) => {
    setView({ kind: "checking" });
    const acct = store.accountId();
    if (!acct) {
      await apply({ kind: "signedOut", error: { code: "session_invalid" } }, s);
      return;
    }
    let list: OrgChoice[];
    try {
      list = await client.orgs(acct);
    } catch (e) {
      if (s === seq.current) await apply(meErrorView(e, true), s);
      return;
    }
    if (s !== seq.current) return;
    orgList.current = list;
    const d = decideOrg({
      orgs: list,
      remembered: store.orgId(),
      denied: [...denied.current],
    });
    if (d.kind === "enter") {
      await selectAndCheck(d.org.id, s);
    } else if (d.kind === "pick") {
      setView({ kind: "orgPicker", orgs: d.orgs, notice: d.notice });
    } else {
      let who: string | null = null;
      try {
        who = await store.accountEmail();
      } catch {
        // the message reads fine without the address
      }
      if (s === seq.current) setView({ kind: "noOrg", email: who, notice: d.notice });
    }
  };

  /** Mints a token for the org, then runs the `/api/me` check. Every way into an org ends here (restore aside). */
  const selectAndCheck = async (id: string, s: number) => {
    try {
      await store.selectOrg(id);
    } catch (e) {
      if (s === seq.current) await apply(meErrorView(e, store.accountId() !== null), s);
      return;
    }
    if (s !== seq.current) return;
    denied.current.delete(id.toLowerCase());
    await runCheck(s);
  };

  /** Moves the gate to the screen a decision names. `s`: the epoch the decision was made in. */
  const apply = async (v: GateView | MeView, s: number) => {
    const still = rechecking.current;
    rechecking.current = false;
    const alive = () => s === seq.current;
    if (v.kind !== "ready") setSwitcher(null);
    switch (v.kind) {
      case "ready": {
        clearAccounts();
        const prev = viewRef.current;
        const orgs = orgList.current;
        // A switch passes through `checking`, so it always gets a new generation and remounts all data. Do not optimise.
        setView({
          kind: "ready",
          generation: prev.kind === "ready" ? prev.generation : ++generation.current,
          session: { tier: v.tier, email: v.email, orgName: orgNameOf(orgs) },
          orgs,
        });
        if (orgs === null) void fetchOrgs();
        return;
      }
      case "profile":
        clearAccounts();
        setView({ kind: "profile", displayName: v.displayName, email: v.email });
        return;
      case "needOrg":
        await enterOrg(s);
        return;
      case "pickOrg":
        if (v.error.orgId) denied.current.add(v.error.orgId.toLowerCase());
        await enterOrg(s);
        return;
      case "noAccess":
        setView({ kind: "noAccess", code: v.code });
        return;
      case "signedOut":
        store.forget();
        clearAccounts();
        setView({ kind: "signedOut", error: v.error });
        return;
      case "signIn":
        setView({ kind: "signedOut", error: v.error });
        if (v.relistAccounts) void loadAccounts();
        return;
      case "join": {
        setView({ kind: "checking" });
        let who: string | null = null;
        try {
          who = await store.accountEmail();
        } catch (e) {
          if (alive()) await apply(meErrorView(e, store.accountId() !== null), s);
          return;
        }
        if (!alive()) return;
        if (store.accountId() === null) {
          setView({ kind: "signedOut", error: { code: "session_invalid" } });
          return;
        }
        setView(
          who
            ? { kind: "join", email: who, error: v.error }
            : { kind: "signedOut", error: v.error ?? { code: "not_member" } },
        );
        return;
      }
      case "unverified":
        setView({ kind: "unverified", email: lastEmail.current, still });
        return;
      case "retry":
        setView({ kind: "retry", error: v.error });
        return;
      case "checking":
        setView({ kind: "checking" });
    }
  };

  /** One `/api/me` call: it mints or renews the token itself, so it also covers restore, retry and "check again". */
  const runCheck = async (s: number) => {
    let v: GateView | MeView;
    try {
      v = viewForMe(await readMeResult(await apiFetch("/api/me")));
    } catch (e) {
      v = meErrorView(e, store.accountId() !== null);
    }
    if (s === seq.current) await apply(v, s);
  };
  const check = () => {
    const s = ++seq.current;
    setView({ kind: "checking" });
    void runCheck(s);
  };

  // Cross-tab channel, proactive renewal timer and visibility listener live as long as the gate; then restore.
  useEffect(() => {
    const stop = store.start();
    const s = ++seq.current;
    if (initialView(store.accountId() !== null).kind === "signIn") {
      void loadAccounts().then(() => {
        if (s === seq.current) setView({ kind: "signedOut" });
      });
    } else {
      void runCheck(s);
    }
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Another tab signed out: leave whatever screen this tab is on (the app unmounts first).
  useEffect(
    () =>
      store.onRemoteSignOut(() => {
        seq.current += 1;
        busy.current = false;
        if (viewRef.current.kind === "ready") flushSync(() => setView({ kind: "checking" }));
        setStatus("idle");
        setContinuingId(null);
        resetOrgs();
        forgetForm();
        setView({ kind: "signedOut", notice: "signed_out" });
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store],
  );

  // A background renewal failed while the app is open (session_invalid, not_member, email_unverified).
  useEffect(
    () =>
      store.subscribe((err) => {
        if (viewRef.current.kind !== "ready") return;
        const s = ++seq.current;
        void apply(viewForTokenError(err, store.accountId() !== null), s);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store],
  );

  // simap refused a fresh token (401 after the retry): the session is over.
  useEffect(
    () =>
      setAuthLostHandler(() => {
        if (viewRef.current.kind !== "ready") return;
        const s = ++seq.current;
        void apply({ kind: "signedOut", error: { code: "no_access" } }, s);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    if (view.kind === "ready") onReadyRef.current?.();
  }, [view.kind]);

  const signOut = () => {
    const s = ++seq.current;
    if (viewRef.current.kind === "ready") flushSync(() => setView({ kind: "checking" }));
    // the local session ends at once; /logout is best effort and never awaited here
    void store.signOut().then(({ confirmed }) => {
      if (confirmed || s !== seq.current) return;
      setView((v) =>
        v.kind === "signedOut" && v.notice === "signed_out"
          ? { ...v, notice: "logout_unconfirmed" }
          : v,
      );
    });
    resetOrgs();
    forgetForm();
    setView({ kind: "signedOut", notice: "signed_out" });
  };

  const refreshPermissions = async () => {
    if (viewRef.current.kind !== "ready") return;
    const s = ++seq.current;
    try {
      await store.renewNow();
    } catch (e) {
      if (s === seq.current) await apply(meErrorView(e, store.accountId() !== null), s);
      return;
    }
    if (s === seq.current) await runCheck(s);
  };

  const useOtherAccount = () => {
    seq.current += 1;
    busy.current = false;
    store.forget();
    resetOrgs();
    forgetForm();
    setStatus("idle");
    setView({ kind: "signedOut" });
  };

  // Picker click.
  const pickOrg = async (id: string) => {
    if (busy.current) return;
    busy.current = true;
    const s = ++seq.current;
    setView((v) => (v.kind === "orgPicker" ? { ...v, busyId: id } : v));
    try {
      await selectAndCheck(id, s);
    } finally {
      busy.current = false;
    }
  };

  const openSwitcher = async () => {
    if (viewRef.current.kind !== "ready") return;
    setSwitcher({ status: "loading" });
    const out = await fetchOrgs();
    if (out === "stale") return;
    setSwitcher((cur) =>
      cur ? (out === "failed" ? { status: "failed" } : { status: "ready", orgs: out }) : cur,
    );
  };

  const switchTo = (id: string) => {
    setSwitcher(null);
    if (viewRef.current.kind !== "ready" || id.toLowerCase() === store.orgId()) return;
    const s = ++seq.current;
    // unmount the old org's screens before the new token exists, as signOut does
    flushSync(() => setView({ kind: "checking" }));
    void selectAndCheck(id, s);
  };

  const signIn = async (v: Credentials) => {
    if (busy.current) return;
    if (needTurnstile && !tsToken.current) {
      setView({ kind: "signedOut", error: { code: "turnstile_required" } });
      return;
    }
    busy.current = true;
    const s = ++seq.current;
    setEmail(v.email);
    lastEmail.current = v.email;
    setStatus("submitting");
    const turnstileToken = needTurnstile ? (tsToken.current ?? undefined) : undefined;
    resetOrgs();
    try {
      await store.signIn({ ...v, turnstileToken });
      setNeedTurnstile(false);
      if (s !== seq.current) return;
      setView({ kind: "checking" });
      await runCheck(s);
    } catch (e) {
      const err = e as AuthError;
      if (needTurnstile || err.code === "turnstile_required") spendTurnstile();
      if (err.code === "turnstile_required") setNeedTurnstile(true);
      if (s === seq.current) await apply(viewForTokenError(err, store.accountId() !== null), s);
    } finally {
      busy.current = false;
      setStatus("idle");
    }
  };

  const continueAs = async (a: AccountChoice) => {
    if (busy.current) return;
    busy.current = true;
    const s = ++seq.current;
    lastEmail.current = a.email;
    setContinuingId(a.accountId);
    setStatus("submitting");
    resetOrgs();
    try {
      await store.continueAs(a.accountId, a.email);
      if (s !== seq.current) return;
      setView({ kind: "checking" });
      await runCheck(s);
    } catch (e) {
      if (s === seq.current)
        await apply(viewForTokenError(e as AuthError, store.accountId() !== null), s);
    } finally {
      busy.current = false;
      setContinuingId(null);
      setStatus("idle");
    }
  };

  // Runs only from the button click (AUT-01).
  const join = async () => {
    if (busy.current) return;
    busy.current = true;
    const s = ++seq.current;
    setStatus("submitting");
    try {
      const result = await store.join();
      if (s !== seq.current || result === "stale") return;
      if (result === "pending") {
        setView((v) => (v.kind === "join" ? { ...v, pending: true, error: null } : v));
        return;
      }
      setView({ kind: "checking" });
      await runCheck(s);
    } catch (e) {
      if (s !== seq.current) return;
      const err = e as AuthError;
      if (err.code === "session_invalid") await apply(viewForTokenError(err, false), s);
      else setView((v) => (v.kind === "join" ? { ...v, error: err } : v));
    } finally {
      busy.current = false;
      setStatus("idle");
    }
  };

  // Profile form submit: PATCH /api/me; the answer is the same body as GET, so it goes through the usual decision.
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
      if (out.kind === "saved") {
        await apply(viewForMe(await readMeResult(out.res)), s);
      } else if (out.kind === "access") {
        await apply(meErrorView(out.error, store.accountId() !== null), s);
      } else {
        const error: ProfileError = out.kind === "invalid" ? "invalid" : "retry";
        setView((v) => (v.kind === "profile" ? { ...v, error } : v));
      }
    } finally {
      busy.current = false;
      setStatus("idle");
    }
  };

  const resend = async () => {
    if (busy.current) return;
    const id = store.accountId();
    if (id === null) {
      useOtherAccount();
      return;
    }
    busy.current = true;
    const s = ++seq.current;
    setView((v) => (v.kind === "unverified" ? { ...v, resend: "sending", resendError: null } : v));
    let out;
    try {
      await client.resendVerification(id);
      out = resendOutcome({ ok: true });
    } catch (e) {
      out = resendOutcome({ ok: false, error: e as AuthError });
    } finally {
      busy.current = false;
    }
    if (s !== seq.current) return;
    switch (out.kind) {
      case "sent":
        setView((v) => (v.kind === "unverified" ? { ...v, resend: "sent" } : v));
        return;
      case "recheck":
        rechecking.current = true;
        check();
        return;
      case "signIn":
        await apply(viewForTokenError(out.error, false), s);
        return;
      case "error":
        setView((v) =>
          v.kind === "unverified" ? { ...v, resend: "idle", resendError: out.error } : v,
        );
    }
  };

  switch (view.kind) {
    case "ready":
      return (
        <SessionProvider
          value={view.session}
          actions={{
            signOut,
            refreshPermissions,
            // hidden once the list is known to hold a single org; shown while it is still loading
            switchOrg: view.orgs === null || view.orgs.length > 1 ? openSwitcher : undefined,
          }}
        >
          <ApiFetchProvider value={apiFetch}>
            <Fragment key={view.generation}>{children}</Fragment>
          </ApiFetchProvider>
          {switcher && (
            <OrgSwitcherDialog
              open
              state={switcher}
              currentId={store.orgId()}
              onSwitch={switchTo}
              onRetry={openSwitcher}
              onClose={() => setSwitcher(null)}
            />
          )}
        </SessionProvider>
      );
    case "checking":
      return <CheckingView />;
    case "join":
      return (
        <JoinView
          email={view.email}
          status={status}
          error={view.error}
          pending={view.pending}
          onJoin={join}
          onUseOtherAccount={useOtherAccount}
        />
      );
    case "unverified":
      return (
        <UnverifiedView
          email={view.email}
          still={view.still}
          onCheckAgain={() => {
            rechecking.current = true;
            check();
          }}
          onUseOtherAccount={useOtherAccount}
          onResend={resend}
          resend={view.resend}
          resendError={view.resendError}
        />
      );
    case "retry":
      return <RetryView error={view.error} onRetry={check} />;
    case "orgPicker":
      return (
        <OrgPickerView
          orgs={view.orgs}
          notice={view.notice}
          busyId={view.busyId}
          onPick={pickOrg}
          onSignOut={signOut}
        />
      );
    case "profile":
      return (
        <ProfileView
          initialName={view.displayName}
          email={view.email}
          status={status}
          error={view.error}
          onSubmit={saveProfile}
          onSignOut={signOut}
        />
      );
    case "noOrg":
      return <NoOrgView email={view.email} notice={view.notice} onSignOut={signOut} />;
    case "noAccess":
      return <NoAccessView code={view.code} onSignOut={signOut} />;
    case "signedOut":
      return (
        <SignInView
          status={status}
          error={tsFailed && needTurnstile ? { code: "turnstile_failed" } : view.error}
          notice={view.notice}
          initialEmail={email}
          onSignIn={signIn}
          signUpHref="/sign-up"
          forgotHref="/forgot-password"
          turnstileRequired={needTurnstile}
          turnstileSlot={
            <TurnstileWidget
              siteKey={turnstileSiteKey}
              resetKey={tsKey}
              onToken={(t) => {
                tsToken.current = t;
              }}
              onExpire={() => {
                tsToken.current = null;
              }}
              onError={() => {
                tsToken.current = null;
                setTsFailed(true);
              }}
            />
          }
          accounts={accounts ?? undefined}
          onContinueAs={continueAs}
          continuingId={continuingId}
        />
      );
  }
}
