import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { config, proxy } from "./proxy";

const call = () => proxy(new NextRequest("http://localhost:3000/sign-in"));
const nonceOf = (res: Response) =>
  /'nonce-([A-Za-z0-9+/=]+)'/.exec(res.headers.get("content-security-policy") ?? "")?.[1];

describe("proxy", () => {
  it("sets one CSP on the response with a nonce", () => {
    const res = call();
    expect(res.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(nonceOf(res)).toBeTruthy();
  });

  it("gives a different nonce per call", () => {
    expect(nonceOf(call())).not.toBe(nonceOf(call()));
  });

  it("matcher excludes api, static, image and favicon but matches pages", () => {
    const re = new RegExp(`^${config.matcher[0].source}$`);
    for (const p of ["/api/x", "/_next/static/x.js", "/_next/image", "/favicon.ico"]) {
      expect(re.test(p)).toBe(false);
    }
    for (const p of ["/", "/sign-in", "/rooms/abc"]) expect(re.test(p)).toBe(true);
  });
});
