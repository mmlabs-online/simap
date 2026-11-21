import { describe, expect, it, vi } from "vitest";
import { ApiAccessError, type ApiFetch } from "@/lib/api/fetch";
import { createSingleFlight, devMeErrorView, devViewForMe, loadDevView } from "./dev-flow";

const me = (needsProfile: boolean) => ({
  status: 200,
  me: { tier: "user" as const, email: "a@b.co", member: { displayName: "A", needsProfile } },
});

describe("devViewForMe", () => {
  it("200 -> ready; needsProfile -> profile", () => {
    expect(devViewForMe(me(false))).toEqual({ kind: "ready", tier: "user", email: "a@b.co" });
    expect(devViewForMe(me(true))).toEqual({
      kind: "profile",
      tier: "user",
      email: "a@b.co",
      displayName: "A",
    });
  });
  it("401 -> token invalid; 403 org_required -> token needOrg", () => {
    expect(devViewForMe({ status: 401 })).toEqual({ kind: "token", reason: "invalid" });
    expect(devViewForMe({ status: 403, code: "org_required" })).toEqual({
      kind: "token",
      reason: "needOrg",
    });
  });
  it("403 forbidden / member_deactivated -> noAccess; 5xx and network -> retry", () => {
    expect(devViewForMe({ status: 403, code: "member_deactivated" })).toEqual({
      kind: "noAccess",
      code: "member_deactivated",
    });
    expect(devViewForMe({ status: 403 }).kind).toBe("noAccess");
    expect(devViewForMe({ status: 503 }).kind).toBe("retry");
    expect(devViewForMe({ network: true }).kind).toBe("retry");
  });
});

describe("devMeErrorView", () => {
  it("maps ApiAccessError codes", () => {
    const v = (code: ConstructorParameters<typeof ApiAccessError>[0]) =>
      devMeErrorView(new ApiAccessError(code));
    expect(v("signed_out")).toEqual({ kind: "token", reason: "invalid" });
    expect(v("unauthenticated")).toEqual({ kind: "token", reason: "invalid" });
    expect(v("org_required")).toEqual({ kind: "token", reason: "needOrg" });
    expect(v("forbidden")).toEqual({ kind: "noAccess", code: "forbidden" });
    expect(v("member_deactivated")).toEqual({ kind: "noAccess", code: "member_deactivated" });
  });
  it("Identity codes and other errors -> retry, never a sign-in, join or org view", () => {
    for (const e of [
      { code: "session_invalid" },
      { code: "not_member" },
      { code: "email_unverified" },
      new TypeError("x"),
    ])
      expect(devMeErrorView(e)).toEqual({ kind: "retry", error: { code: "network" } });
  });
});

describe("loadDevView", () => {
  it("reads /api/me into a view and never rejects", async () => {
    const ok = (async () =>
      new Response(JSON.stringify({ tier: "user", email: "a@b.co" }), {
        status: 200,
      })) as unknown as ApiFetch;
    expect(await loadDevView(ok)).toEqual({ kind: "ready", tier: "user", email: "a@b.co" });
    const bad = (async () => {
      throw new TypeError("x");
    }) as unknown as ApiFetch;
    expect((await loadDevView(bad)).kind).toBe("retry");
  });
});

describe("createSingleFlight", () => {
  it("joins share one run; reset starts a new run; a stale settle keeps the newer flight", async () => {
    const resolvers: ((v: number) => void)[] = [];
    const run = vi.fn(() => new Promise<number>((r) => resolvers.push(r)));
    const f = createSingleFlight(run);
    const a = f.join();
    const b = f.join();
    expect(run).toHaveBeenCalledTimes(1);
    resolvers[0](10);
    expect(await a).toBe(10);
    expect(await b).toBe(10);
    const c = f.join(); // after settle: a second run
    expect(run).toHaveBeenCalledTimes(2);
    f.reset();
    const d = f.join();
    expect(run).toHaveBeenCalledTimes(3);
    resolvers[1](1); // stale c settles: must not clear d
    await c;
    const e = f.join();
    expect(run).toHaveBeenCalledTimes(3);
    resolvers[2](2);
    expect(await e).toBe(2);
    expect(await d).toBe(2);
  });
});
