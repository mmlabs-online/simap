import { describe, expect, it, vi } from "vitest";
import type { AuthError } from "@/lib/identity/types";
import { createAcceptController, type AcceptView } from "./acceptController";

const TOKEN = "T".repeat(43);
const ACC = "11111111-1111-4111-8111-111111111111";
const ORG = "22222222-2222-4222-8222-222222222222";
const err = (code: AuthError["code"]): AuthError => ({ code });

function setup(
  o: {
    token?: string | null;
    accountId?: string | null;
    email?: string | null | Error;
    accept?: () => Promise<{ orgId: string | null }>;
    signIn?: () => Promise<void>;
    selectOrg?: () => Promise<void>;
  } = {},
) {
  const calls: string[] = [];
  const views: AcceptView[] = [];
  let accountId = o.accountId === undefined ? ACC : o.accountId;
  const acceptInvitation = vi.fn(async (v: { accountId: string; token: string }) => {
    calls.push("accept");
    return (o.accept ?? (async () => ({ orgId: ORG })))();
  });
  const store = {
    accountId: vi.fn(() => {
      calls.push("accountId");
      return accountId;
    }),
    accountEmail: vi.fn(async () => {
      calls.push("accountEmail");
      if (o.email instanceof Error) throw o.email;
      return o.email === undefined ? "a@b.co" : o.email;
    }),
    signIn: vi.fn(async () => {
      calls.push("signIn");
      await (o.signIn ?? (async () => {}))();
      accountId = ACC;
    }),
    forget: vi.fn(() => {
      calls.push("forget");
      accountId = null;
    }),
    selectOrg: vi.fn(async (_id: string) => {
      calls.push("selectOrg");
      await (o.selectOrg ?? (async () => {}))();
    }),
  };
  const navigate = vi.fn((_p: string) => {
    calls.push("navigate");
  });
  const c = createAcceptController({
    takeToken: () => {
      calls.push("take");
      return o.token === undefined ? TOKEN : o.token;
    },
    client: { acceptInvitation },
    store,
    navigate,
    onChange: (v) => views.push(v),
  });
  const last = () => views[views.length - 1];
  return { c, calls, views, last, acceptInvitation, store, navigate };
}

describe("start", () => {
  it("no token -> invalid, no store or client call", async () => {
    const t = setup({ token: null });
    await t.c.start();
    expect(t.last()).toEqual({ kind: "invalid" });
    expect(t.calls).toEqual(["take"]);
  });

  it("start takes the token before any store or client call", async () => {
    const t = setup();
    await t.c.start();
    expect(t.calls[0]).toBe("take");
  });

  it("known account with email -> ready(email); accountEmail null or throws -> signIn", async () => {
    const a = setup();
    await a.c.start();
    expect(a.last()).toMatchObject({ kind: "ready", email: "a@b.co", status: "idle" });
    for (const email of [null, new Error("x")]) {
      const t = setup({ email });
      await t.c.start();
      expect(t.last()).toMatchObject({ kind: "signIn" });
    }
    const none = setup({ accountId: null });
    await none.c.start();
    expect(none.last()).toMatchObject({ kind: "signIn" });
  });
});

describe("signIn", () => {
  const cred = { email: "typed@b.co", password: "pw" };

  it("not_member / email_unverified -> ready with the account email", async () => {
    for (const code of ["not_member", "email_unverified"] as const) {
      const t = setup({ accountId: null, signIn: async () => Promise.reject(err(code)) });
      await t.c.start();
      await t.c.signIn(cred);
      expect(t.last()).toMatchObject({ kind: "ready", email: "a@b.co" });
    }
  });

  it("falls back to the typed email when the account email is unknown", async () => {
    const t = setup({ accountId: null, email: null });
    await t.c.start();
    await t.c.signIn(cred);
    expect(t.last()).toMatchObject({ kind: "ready", email: "typed@b.co" });
  });

  it("invalid_credentials stays on signIn; turnstile_required sets needTurnstile and asks to spend", async () => {
    const bad = setup({
      accountId: null,
      signIn: async () => Promise.reject(err("invalid_credentials")),
    });
    await bad.c.start();
    expect(await bad.c.signIn(cred)).toEqual({ spendTurnstile: false });
    expect(bad.last()).toMatchObject({ kind: "signIn", error: { code: "invalid_credentials" } });

    const ts = setup({
      accountId: null,
      signIn: async () => Promise.reject(err("turnstile_required")),
    });
    await ts.c.start();
    expect(await ts.c.signIn(cred)).toEqual({ spendTurnstile: true });
    expect(ts.last()).toMatchObject({ kind: "signIn", needTurnstile: true });
  });
});

describe("accept", () => {
  it("mismatch keeps the token: use another account (forget called), sign in, accept sends the same token", async () => {
    let n = 0;
    const t = setup({
      accept: async () => {
        if (n++ === 0) throw err("invitation_email_mismatch");
        return { orgId: ORG };
      },
    });
    await t.c.start();
    await t.c.accept();
    expect(t.last()).toMatchObject({
      kind: "ready",
      error: { code: "invitation_email_mismatch" },
      offerOtherAccount: true,
    });
    t.c.useOtherAccount();
    expect(t.store.forget).toHaveBeenCalledTimes(1);
    expect(t.last()).toMatchObject({ kind: "signIn" });
    await t.c.signIn({ email: "b@b.co", password: "pw" });
    await t.c.accept();
    expect(t.acceptInvitation).toHaveBeenCalledTimes(2);
    expect(t.acceptInvitation.mock.calls[0][0].token).toBe(TOKEN);
    expect(t.acceptInvitation.mock.calls[1][0].token).toBe(TOKEN);
  });

  it("session_invalid on accept -> forget, signIn view, token kept; next accept sends it", async () => {
    let n = 0;
    const t = setup({
      accept: async () => {
        if (n++ === 0) throw err("session_invalid");
        return { orgId: null };
      },
    });
    await t.c.start();
    await t.c.accept();
    expect(t.store.forget).toHaveBeenCalledTimes(1);
    expect(t.last()).toMatchObject({ kind: "signIn", error: { code: "session_invalid" } });
    await t.c.signIn({ email: "b@b.co", password: "pw" });
    await t.c.accept();
    expect(t.acceptInvitation).toHaveBeenCalledTimes(2);
    expect(t.acceptInvitation.mock.calls[1][0].token).toBe(TOKEN);
  });

  it("ok -> selectOrg(orgId) then navigate('/'); token cleared (second accept() sends nothing)", async () => {
    const t = setup();
    await t.c.start();
    await t.c.accept();
    expect(t.store.selectOrg).toHaveBeenCalledWith(ORG);
    expect(t.navigate).toHaveBeenCalledWith("/");
    expect(t.calls.slice(-3)).toEqual(["accept", "selectOrg", "navigate"]);
    await t.c.accept();
    expect(t.acceptInvitation).toHaveBeenCalledTimes(1);
  });

  it("selectOrg rejects -> still navigates to '/'", async () => {
    const t = setup({ selectOrg: async () => Promise.reject(err("org_access_denied")) });
    await t.c.start();
    await t.c.accept();
    expect(t.navigate).toHaveBeenCalledWith("/");
  });

  it("ok with orgId null -> no selectOrg, navigates", async () => {
    const t = setup({ accept: async () => ({ orgId: null }) });
    await t.c.start();
    await t.c.accept();
    expect(t.store.selectOrg).not.toHaveBeenCalled();
    expect(t.navigate).toHaveBeenCalledWith("/");
  });

  it("token_invalid -> invalid view, token cleared", async () => {
    const t = setup({ accept: async () => Promise.reject(err("token_invalid")) });
    await t.c.start();
    await t.c.accept();
    expect(t.last()).toEqual({ kind: "invalid" });
    await t.c.accept();
    expect(t.acceptInvitation).toHaveBeenCalledTimes(1);
  });

  it("double accept() while in flight sends one request; useOtherAccount ignored while accepting", async () => {
    let release: (v: { orgId: string | null }) => void = () => {};
    const t = setup({ accept: () => new Promise((r) => (release = r)) });
    await t.c.start();
    const first = t.c.accept();
    void t.c.accept();
    t.c.useOtherAccount();
    expect(t.acceptInvitation).toHaveBeenCalledTimes(1);
    expect(t.store.forget).not.toHaveBeenCalled();
    release({ orgId: null });
    await first;
    expect(t.navigate).toHaveBeenCalledTimes(1);
  });
});
