"use client";

import { useEffect, useRef, useState } from "react";
import { forgotOutcome } from "@/lib/identity/email-flows";
import type { AuthError } from "@/lib/identity/types";
import { ForgotPasswordView, LinkCheckingView } from "./account-views";
import { getAuthRuntime, type AuthRuntime } from "./runtime";
import { TurnstileWidget } from "./TurnstileWidget";

/** The `/forgot-password` page body. Always ends on the neutral answer: it never says whether the address exists. */
export function ForgotPasswordPage() {
  const [rt, setRt] = useState<AuthRuntime | null>(null);
  useEffect(() => setRt(getAuthRuntime()), []);
  const [status, setStatus] = useState<"idle" | "submitting">("idle");
  const [error, setError] = useState<AuthError | null>(null);
  const [sent, setSent] = useState(false);
  const [tsKey, setTsKey] = useState(0);
  const tsToken = useRef<string | null>(null);
  const busy = useRef(false);

  if (!rt) return <LinkCheckingView />;
  const { client, turnstileSiteKey } = rt;

  const submit = async (email: string) => {
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
      await client.forgotPassword({ email, turnstileToken });
      if (forgotOutcome({ ok: true }).kind === "sent") setSent(true);
    } catch (e) {
      const out = forgotOutcome({ ok: false, error: e as AuthError });
      if (out.kind === "error") setError(out.error);
    } finally {
      tsToken.current = null;
      setTsKey((k) => k + 1);
      busy.current = false;
      setStatus("idle");
    }
  };

  return (
    <ForgotPasswordView
      status={status}
      error={error}
      sent={sent}
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
