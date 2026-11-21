import { describe, expect, it } from "vitest";
import { SECURITY_HEADERS, buildCsp } from "../src/lib/security/headers";
import {
  EXPECTED_STATIC_HEADERS,
  IDENTITY_ORIGIN,
  checkDocumentCsp,
  checkScriptNonces,
  checkStaticHeaders,
  parseCsp,
  runChecks,
} from "./check-headers.mjs";

const NONCE = "bm9uY2U=";
const csp = (nonce = NONCE) => buildCsp({ nonce, identityOrigin: IDENTITY_ORIGIN, dev: false });
const staticHeaders = () => Object.fromEntries(SECURITY_HEADERS.map((h) => [h.key, h.value]));
const page = (nonce = NONCE) =>
  `<html><script nonce="${nonce}">document.documentElement.dataset.theme="x"</script>` +
  `<script src="/_next/static/a.js" nonce="${nonce}"></script></html>`;

function stub(over: Record<string, (path: string, n: number) => Response> = {}) {
  let n = 0;
  return (async (url: URL) => {
    const path = url.pathname;
    n += 1;
    if (over[path]) return over[path](path, n);
    if (path === "/api/healthz" || path.startsWith("/_next/static/")) {
      return new Response("ok", { headers: staticHeaders() });
    }
    const nonce = Buffer.from(`n${n}`).toString("base64");
    return new Response(page(nonce).replace("/_next/static/a.js", "/_next/static/a.js"), {
      status: path === "/sim027-not-found" ? 404 : 200,
      headers: { ...staticHeaders(), "content-security-policy": csp(nonce) },
    });
  }) as unknown as typeof fetch;
}

describe("check-headers", () => {
  it("parseCsp splits directives (case-insensitive, extra spaces)", () => {
    const m = parseCsp("Default-Src  'self' ;  script-src a   b");
    expect(m.get("default-src")).toEqual(["'self'"]);
    expect(m.get("script-src")).toEqual(["a", "b"]);
  });

  it("checkStaticHeaders", () => {
    expect(checkStaticHeaders(new Headers(staticHeaders()))).toEqual([]);
    const missing = staticHeaders();
    delete (missing as Record<string, string>)["X-Frame-Options"];
    expect(checkStaticHeaders(new Headers(missing))).toHaveLength(1);
    expect(
      checkStaticHeaders(new Headers({ ...staticHeaders(), "X-Frame-Options": "SAMEORIGIN" })),
    ).toHaveLength(1);
  });

  it("checkDocumentCsp", () => {
    const h = (v: string, extra: Record<string, string> = {}) =>
      checkDocumentCsp(new Headers({ "content-security-policy": v, ...extra }));
    expect(h(csp())).toEqual({ errors: [], nonce: NONCE });
    expect(h(`${csp()}, ${csp()}`).errors).toHaveLength(1);
    expect(h(csp(), { "content-security-policy-report-only": csp() }).errors).toHaveLength(1);
    expect(h(csp().replace("'strict-dynamic'", "'unsafe-inline'")).errors).toHaveLength(1);
    expect(
      h(csp().replace("frame-src https://challenges.cloudflare.com", "frame-src 'self'")).errors,
    ).toHaveLength(1);
    expect(h(csp().replace(IDENTITY_ORIGIN, "https://x.test")).errors).toHaveLength(1);
    expect(
      h(csp().replace("frame-ancestors 'none'", "frame-ancestors 'self'")).errors,
    ).toHaveLength(1);
    expect(h(csp().replace(`'nonce-${NONCE}'`, "")).errors.length).toBeGreaterThan(0);
  });

  it("checkScriptNonces", () => {
    expect(checkScriptNonces(page(), NONCE)).toEqual([]);
    expect(checkScriptNonces(`${page()}<script src="/x.js"></script>`, NONCE)).toHaveLength(1);
    expect(checkScriptNonces(page("other"), NONCE).length).toBeGreaterThan(0);
    expect(checkScriptNonces(`<script nonce="${NONCE}">1</script>`, NONCE)).toHaveLength(1);
  });

  it("runChecks passes on a valid page set", async () => {
    expect(await runChecks("http://x", stub())).toEqual([]);
  });

  it("runChecks flags a repeated nonce, a CSP on api or asset, and a wrong status", async () => {
    const fixed = () =>
      new Response(page(), { headers: { ...staticHeaders(), "content-security-policy": csp() } });
    expect((await runChecks("http://x", stub({ "/sign-in": fixed }))).join("\n")).toContain(
      "same on two",
    );
    const withCsp = () =>
      new Response("ok", { headers: { ...staticHeaders(), "content-security-policy": csp() } });
    const e = await runChecks("http://x", stub({ "/api/healthz": withCsp }));
    expect(e.join("\n")).toContain("/api/healthz: must not carry");
    const e2 = await runChecks(
      "http://x",
      stub({ "/rooms": () => new Response("x", { status: 500 }) }),
    );
    expect(e2.join("\n")).toContain("/rooms: status 500");
  });

  it("EXPECTED_STATIC_HEADERS equals SECURITY_HEADERS", () => {
    expect(EXPECTED_STATIC_HEADERS).toEqual(SECURITY_HEADERS);
  });
});
