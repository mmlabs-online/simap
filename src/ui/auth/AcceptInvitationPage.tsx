"use client";

import { useEffect, useRef, useState } from "react";
import { takeLinkToken } from "@/lib/identity/email-link";
import type { Credentials } from "@/lib/identity/types";
import { createAcceptController, type AcceptView } from "./acceptController";
import {
  AcceptDoneView,
  AcceptInvalidView,
  AcceptReadyView,
  AcceptSignInFooter,
  AcceptSignInIntro,
} from "./accept-views";
import { LinkCheckingView } from "./account-views";
import { getAuthRuntime } from "./runtime";
import { TurnstileWidget } from "./TurnstileWidget";
import { SignInView } from "./views";

type Controller = ReturnType<typeof createAcceptController>;

/**
 * The `/accept-invitation` page body. The token is taken from the address bar by the controller and never reaches
 * React state. Accepting is sent only from the Accept button, never on load.
 */
export function AcceptInvitationPage() {
  const [view, setView] = useState<AcceptView>({ kind: "checking" });
  const [tsKey, setTsKey] = useState(0);
  const tsToken = useRef<string | null>(null);
  const controller = useRef<Controller | null>(null);
  const taken = useRef(false);
  const busy = useRef(false);

  useEffect(() => {
    if (taken.current) return;
    taken.current = true;
    const rt = getAuthRuntime();
    const c = createAcceptController({
      takeToken: () => takeLinkToken(window, "/accept-invitation"),
      client: rt.client,
      store: rt.store,
      navigate: (p) => window.location.assign(p),
      onChange: setView,
    });
    controller.current = c;
    void c.start();
  }, []);

  const c = controller.current;
  if (!c || view.kind === "checking") return <LinkCheckingView />;
  if (view.kind === "invalid") return <AcceptInvalidView />;
  if (view.kind === "done") return <AcceptDoneView />;
  if (view.kind === "ready") {
    return (
      <AcceptReadyView
        email={view.email}
        status={view.status}
        error={view.error}
        offerOtherAccount={view.offerOtherAccount}
        onAccept={() => void c.accept()}
        onOtherAccount={() => c.useOtherAccount()}
      />
    );
  }

  const spend = () => {
    tsToken.current = null;
    setTsKey((k) => k + 1);
  };
  const signIn = async (v: Credentials) => {
    if (busy.current) return;
    if (view.needTurnstile && !tsToken.current) {
      setView({ ...view, error: { code: "turnstile_required" } });
      return;
    }
    busy.current = true;
    try {
      const r = await c.signIn({
        ...v,
        turnstileToken: view.needTurnstile ? (tsToken.current ?? undefined) : undefined,
      });
      if (r.spendTurnstile) spend();
    } finally {
      busy.current = false;
    }
  };

  return (
    <SignInView
      status={view.status}
      error={view.error}
      onSignIn={(v) => void signIn(v)}
      intro={<AcceptSignInIntro />}
      footer={<AcceptSignInFooter />}
      turnstileRequired={view.needTurnstile}
      turnstileSlot={
        <TurnstileWidget
          siteKey={getAuthRuntime().turnstileSiteKey}
          resetKey={tsKey}
          onToken={(t) => {
            tsToken.current = t;
          }}
          onExpire={() => {
            tsToken.current = null;
          }}
          onError={() => {
            tsToken.current = null;
            setView({ ...view, error: { code: "turnstile_failed" } });
          }}
        />
      }
    />
  );
}
