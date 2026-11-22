import { describe, expect, it } from "vitest";
import { readLinkToken, takeLinkToken } from "./email-link";

const tok = (n: number) => "a".repeat(n);

describe("readLinkToken", () => {
  it("accepts url-safe tokens of 32, 43 and 128 characters", () => {
    for (const n of [32, 43, 128]) expect(readLinkToken(`#token=${tok(n)}`)).toBe(tok(n));
    expect(readLinkToken(`#token=${"Ab-_9".repeat(10)}`)).toBe("Ab-_9".repeat(10));
  });

  it("rejects everything else", () => {
    for (const h of [
      `#token=${tok(31)}`,
      `#token=${tok(129)}`,
      `#token=${tok(31)}+`,
      `#token=${tok(31)}/`,
      `#token=${tok(31)}=`,
      `#token=${tok(31)}%`,
      `#token=${tok(40)}&x=1`,
      `token=${tok(40)}`,
      "#token=",
      `#Token=${tok(40)}`,
      "",
    ]) {
      expect(readLinkToken(h)).toBeNull();
    }
  });
});

function fake(hash: string, search = "") {
  const calls: string[] = [];
  const loc = { hash, search };
  return {
    calls,
    loc,
    deps: {
      location: loc,
      history: {
        replaceState(data: null, unused: string, url: string) {
          calls.push(`replace:${data}:${unused}:${url}`);
          loc.hash = "";
          loc.search = "";
        },
      },
    },
  };
}

describe("takeLinkToken", () => {
  it("returns the token after calling replaceState(null, '', path) once", () => {
    const f = fake(`#token=${tok(43)}`);
    const out = takeLinkToken(f.deps, "/verify-email");
    expect(out).toBe(tok(43));
    expect(f.calls).toEqual(["replace:null::/verify-email"]);
  });

  it("strips an invalid hash and returns null", () => {
    const f = fake("#nope");
    expect(takeLinkToken(f.deps, "/reset-password")).toBeNull();
    expect(f.calls).toEqual(["replace:null::/reset-password"]);
  });

  it("never reads a ?token= query, but strips it", () => {
    const f = fake("", `?token=${tok(43)}`);
    expect(takeLinkToken(f.deps, "/verify-email")).toBeNull();
    expect(f.calls).toHaveLength(1);
  });

  it("does nothing for an empty hash and search", () => {
    const f = fake("");
    expect(takeLinkToken(f.deps, "/verify-email")).toBeNull();
    expect(f.calls).toHaveLength(0);
  });

  it("keeps no state: a second call finds nothing and does not replace again", () => {
    const f = fake(`#token=${tok(43)}`);
    takeLinkToken(f.deps, "/verify-email");
    expect(takeLinkToken(f.deps, "/verify-email")).toBeNull();
    expect(f.calls).toHaveLength(1);
  });

  it("takes a 43-char token and replaces state with /accept-invitation", () => {
    const f = fake(`#token=${tok(43)}`);
    expect(takeLinkToken(f.deps, "/accept-invitation")).toBe(tok(43));
    expect(f.calls).toEqual(["replace:null::/accept-invitation"]);
  });

  it("/accept-invitation?token=... is never read, still cleaned", () => {
    const f = fake("", `?token=${tok(43)}`);
    expect(takeLinkToken(f.deps, "/accept-invitation")).toBeNull();
    expect(f.calls).toEqual(["replace:null::/accept-invitation"]);
  });
});
