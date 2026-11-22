import { acceptOutcome, signInOutcome } from "@/lib/invitations/accept-flow";
import type { AuthError } from "@/lib/identity/types";
import type { IdentityClient } from "./identityClient";
import type { TokenStore } from "./tokenStore";

export type AcceptView =
  | { kind: "checking" }
  | { kind: "invalid" }
  | { kind: "done" }
  | {
      kind: "signIn";
      status: "idle" | "submitting";
      error: AuthError | null;
      needTurnstile: boolean;
    }
  | {
      kind: "ready";
      email: string;
      status: "idle" | "accepting";
      error: AuthError | null;
      offerOtherAccount: boolean;
    };

export type AcceptDeps = {
  takeToken: () => string | null;
  client: Pick<IdentityClient, "acceptInvitation">;
  store: Pick<TokenStore, "accountId" | "accountEmail" | "signIn" | "forget" | "selectOrg">;
  navigate: (path: string) => void;
  onChange: (v: AcceptView) => void;
};

/**
 * Drives the accept-invitation page. The token lives only in this closure: never in a view, an error or a log.
 * It is cleared once Identity consumed it or called it invalid; any other answer keeps it for a retry.
 */
export function createAcceptController(deps: AcceptDeps) {
  const { client, store, navigate, onChange } = deps;
  let token: string | null = null;
  let busy = false;
  let needTurnstile = false;

  const signInView = (error: AuthError | null = null): AcceptView => ({
    kind: "signIn",
    status: "idle",
    error,
    needTurnstile,
  });
  const readyView = (
    email: string,
    error: AuthError | null = null,
    offerOtherAccount = false,
  ): AcceptView => ({ kind: "ready", email, status: "idle", error, offerOtherAccount });
  const email = async (): Promise<string | null> => {
    try {
      return await store.accountEmail();
    } catch {
      return null;
    }
  };
  let lastEmail = "";
  const showReady = (e: string, error: AuthError | null = null, offer = false) => {
    lastEmail = e;
    onChange(readyView(e, error, offer));
  };

  return {
    async start(): Promise<void> {
      token = deps.takeToken();
      if (!token) {
        onChange({ kind: "invalid" });
        return;
      }
      if (store.accountId()) {
        const e = await email();
        if (e) {
          showReady(e);
          return;
        }
      }
      onChange(signInView());
    },

    async signIn(v: {
      email: string;
      password: string;
      turnstileToken?: string;
    }): Promise<{ spendTurnstile: boolean }> {
      onChange({ kind: "signIn", status: "submitting", error: null, needTurnstile });
      let step;
      let wasTurnstile = needTurnstile;
      try {
        await store.signIn(v);
        step = signInOutcome({ ok: true });
      } catch (e) {
        step = signInOutcome({ ok: false, error: e as AuthError });
      }
      if (step.kind === "signIn") {
        if (step.needTurnstile) needTurnstile = true;
        wasTurnstile = wasTurnstile || !!step.needTurnstile;
        onChange(signInView(step.error));
        return { spendTurnstile: wasTurnstile };
      }
      needTurnstile = false;
      showReady((await email()) ?? v.email);
      return { spendTurnstile: wasTurnstile };
    },

    async accept(): Promise<void> {
      if (busy || !token) return;
      const accountId = store.accountId();
      if (!accountId) {
        onChange(signInView());
        return;
      }
      busy = true;
      onChange({
        kind: "ready",
        email: lastEmail,
        status: "accepting",
        error: null,
        offerOtherAccount: false,
      });
      try {
        let out;
        try {
          const { orgId } = await client.acceptInvitation({ accountId, token });
          out = acceptOutcome({ ok: true, orgId });
        } catch (e) {
          out = acceptOutcome({ ok: false, error: e as AuthError });
        }
        if (out.clearToken) token = null;
        switch (out.kind) {
          case "done":
            onChange({ kind: "done" });
            if (out.orgId) {
              try {
                await store.selectOrg(out.orgId);
              } catch {
                // best effort: the gate lists the orgs after the full load
              }
            }
            navigate("/");
            return;
          case "signIn":
            store.forget();
            onChange(signInView(out.error));
            return;
          case "ready":
            onChange(readyView(lastEmail, out.error, out.offerOtherAccount === true));
            return;
          case "invalid":
            onChange({ kind: "invalid" });
            return;
        }
      } finally {
        busy = false;
      }
    },

    useOtherAccount(): void {
      if (busy) return;
      store.forget();
      onChange(signInView());
    },
  };
}
