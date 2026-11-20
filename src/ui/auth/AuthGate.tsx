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
import type { AccountChoice, AuthError, Credentials } from "@/lib/identity/types";
import type { Session } from "@/lib/session";
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
  | { kind: "ready"; generation: number; session: Session }
  | { kind: "signedOut"; error?: AuthError | null; notice?: SignInNotice | null }
  | { kind: "join"; email: string; error?: AuthError | null; pending?: boolean }
  | { kind: "unverified"; email: string | null; still?: boolean }
  | { kind: "retry"; error: AuthError }
  | { kind: "noOrg"; email: string | null }
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

  /** Moves the gate to the screen a decision names. `s`: the epoch the decision was made in. */
  const apply = async (v: GateView | MeView, s: number) => {
    const still = rechecking.current;
    rechecking.current = false;
    const alive = () => s === seq.current;
    switch (v.kind) {
      case "ready": {
        clearAccounts();
        const prev = viewRef.current;
        setView({
          kind: "ready",
          generation: prev.kind === "ready" ? prev.generation : ++generation.current,
          session: { tier: v.tier, email: v.email },
        });
        return;
      }
      case "noOrg": {
        let who: string | null = null;
        try {
          who = await store.accountEmail();
        } catch {
          // the message reads fine without the address
        }
        if (alive()) setView({ kind: "noOrg", email: who });
        return;
      }
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
    forgetForm();
    setStatus("idle");
    setView({ kind: "signedOut" });
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

  switch (view.kind) {
    case "ready":
      return (
        <SessionProvider value={view.session} actions={{ signOut, refreshPermissions }}>
          <ApiFetchProvider value={apiFetch}>
            <Fragment key={view.generation}>{children}</Fragment>
          </ApiFetchProvider>
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
        />
      );
    case "retry":
      return <RetryView error={view.error} onRetry={check} />;
    case "noOrg":
      return <NoOrgView email={view.email} onSignOut={signOut} />;
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
