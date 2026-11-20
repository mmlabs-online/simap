"use client";

import { useEffect, useRef, useState } from "react";
import { resetOutcome } from "@/lib/identity/email-flows";
import { takeLinkToken } from "@/lib/identity/email-link";
import type { AuthError } from "@/lib/identity/types";
import { LinkCheckingView, ResetPasswordView } from "./account-views";
import { getAuthRuntime, type AuthRuntime } from "./runtime";

type State = "checking" | "ready" | "done" | "invalid";

/** The `/reset-password` page body. Token handling as `VerifyEmailPage`; a weak password keeps the link usable. */
export function ResetPasswordPage() {
  const [rt, setRt] = useState<AuthRuntime | null>(null);
  const [state, setState] = useState<State>("checking");
  const [status, setStatus] = useState<"idle" | "submitting">("idle");
  const [error, setError] = useState<AuthError | null>(null);
  const token = useRef<string | null>(null);
  const taken = useRef(false);
  const busy = useRef(false);

  useEffect(() => {
    if (!taken.current) {
      taken.current = true;
      token.current = takeLinkToken(window, "/reset-password");
      setState(token.current ? "ready" : "invalid");
    }
    setRt(getAuthRuntime());
  }, []);

  if (!rt || state === "checking") return <LinkCheckingView />;

  const submit = async (newPassword: string) => {
    const t = token.current;
    if (busy.current || !t) return;
    busy.current = true;
    setStatus("submitting");
    setError(null);
    let out;
    try {
      await rt.client.resetPassword({ token: t, newPassword });
      out = resetOutcome({ ok: true });
    } catch (e) {
      out = resetOutcome({ ok: false, error: e as AuthError });
    }
    if (out.clearToken) token.current = null;
    if (out.kind === "ready") {
      setError(out.error);
      busy.current = false;
    } else {
      setState(out.kind);
    }
    setStatus("idle");
  };

  return <ResetPasswordView state={state} status={status} error={error} onSubmit={submit} />;
}
