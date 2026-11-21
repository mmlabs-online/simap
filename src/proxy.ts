import { NextResponse, type NextRequest } from "next/server";
import { identityBaseFrom } from "@/lib/identity/config";
import { buildCsp, identityOriginFrom } from "@/lib/security/headers";

/** Per-request nonce CSP. The same value goes on the request (Next stamps its scripts) and the response. */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const dev = process.env.NODE_ENV !== "production";
  const identityOrigin = identityOriginFrom(
    identityBaseFrom(process.env.NEXT_PUBLIC_MM_IDENTITY_BASE, !dev),
  );
  const csp = buildCsp({ nonce, identityOrigin, dev });

  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("content-security-policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api/|_next/static/|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
