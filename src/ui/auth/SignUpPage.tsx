"use client";

import { useEffect, useRef, useState } from "react";
import { signUpOutcome } from "@/lib/identity/email-flows";
import type { AuthError } from "@/lib/identity/types";
import { LinkCheckingView, SignUpView } from "./account-views";
import { getAuthRuntime, type AuthRuntime } from "./runtime";
import { TurnstileWidget } from "./TurnstileWidget";

/** The `/sign-up` page body. The Turnstile token is single-use, so every attempt spends it. */
export function SignUpPage() {
  const [rt, setRt] = useState<AuthRuntime | null>(null);
  useEffect(() => setRt(getAuthRuntime()), []);
  const [status, setStatus] = useState<"idle" | "submitting">("idle");
  const [error, setError] = useState<AuthError | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [tsKey, setTsKey] = useState(0);
  const tsToken = useRef<string | null>(null);
  const busy = useRef(false);

  if (!rt) return <LinkCheckingView />;
  const { client, turnstileSiteKey } = rt;

  const spend = () => {
    tsToken.current = null;
    setTsKey((k) => k + 1);
  };

  const submit = async (v: { email: string; password: string }) => {
    if (busy.current) return;
    const turnstileToken = tsToken.current;
    if (!turnstileToken) {
      setError({ code: "turnstile_required" });
      return;
    }
    busy.current = true;
    setStatus("submitting");
    setError(null);
    try {
      await client.signup({ ...v, turnstileToken });
      const out = signUpOutcome({ ok: true });
      if (out.kind === "sent") setSentTo(v.email);
    } catch (e) {
      const out = signUpOutcome({ ok: false, error: e as AuthError });
      if (out.kind === "error") setError(out.error);
    } finally {
      spend();
      busy.current = false;
      setStatus("idle");
    }
  };

  return (
    <SignUpView
      status={status}
      error={error}
      sentTo={sentTo}
      onSubmit={submit}
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
            setError({ code: "turnstile_failed" });
          }}
        />
      }
    />
  );
}
