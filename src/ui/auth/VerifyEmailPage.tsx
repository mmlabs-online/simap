"use client";

import { useEffect, useRef, useState } from "react";
import { takeLinkToken } from "@/lib/identity/email-link";
import { verifyOutcome } from "@/lib/identity/email-flows";
import type { AuthError } from "@/lib/identity/types";
import { LinkCheckingView, VerifyEmailView } from "./account-views";
import { getAuthRuntime, type AuthRuntime } from "./runtime";

type State = "checking" | "ready" | "verified" | "invalid";

/**
 * The `/verify-email` page body. The mount effect only takes the token out of the address bar; the request is sent
 * by the button, never on load. The token lives in a ref: never in state, a URL, a log or an error.
 */
export function VerifyEmailPage() {
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
      token.current = takeLinkToken(window, "/verify-email");
      setState(token.current ? "ready" : "invalid");
    }
    setRt(getAuthRuntime());
  }, []);

  if (!rt || state === "checking") return <LinkCheckingView />;

  const verify = async () => {
    const t = token.current;
    if (busy.current || !t) return;
    busy.current = true;
    setStatus("submitting");
    setError(null);
    let out;
    try {
      await rt.client.verifyEmail(t);
      out = verifyOutcome({ ok: true });
    } catch (e) {
      out = verifyOutcome({ ok: false, error: e as AuthError });
    }
    if (out.clearToken) token.current = null;
    if (out.kind === "ready") {
      setError(out.error);
      busy.current = false; // the link is still usable: the user may retry
    } else {
      setState(out.kind);
    }
    setStatus("idle");
  };

  return <VerifyEmailView state={state} status={status} error={error} onVerify={verify} />;
}
