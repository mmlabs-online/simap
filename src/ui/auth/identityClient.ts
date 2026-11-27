import { networkError, toAuthError } from "@/lib/identity/errors";
import type { AuthError, OrgChoice } from "@/lib/identity/types";

type FetchFn = typeof fetch;

export interface IdentityClient {
  login(v: {
    email: string;
    password: string;
    turnstileToken?: string;
  }): Promise<{ accountId: string; email: string }>;
  /** `orgId` is sent only when given; a token without it carries app-scope roles only. 403 `org_access_denied` if the org is refused. */
  token(accountId: string, orgId?: string): Promise<{ accessToken: string; expiresIn: number }>;
  /** The orgs the account may enter for this app (first page). Rejects `unknown` when the body cannot be read. */
  orgs(accountId: string): Promise<OrgChoice[]>;
  logout(accountId: string): Promise<void>;
  signup(v: {
    email: string;
    password: string;
    turnstileToken: string;
  }): Promise<{ email: string }>;
  verifyEmail(token: string): Promise<void>;
  /** Always 202 for any email (no enumeration); Turnstile is always required. */
  forgotPassword(v: { email: string; turnstileToken: string }): Promise<void>;
  /** Public endpoint: the token goes in the POST body only. */
  resetPassword(v: { token: string; newPassword: string }): Promise<void>;
  resendVerification(accountId: string): Promise<void>;
  /** Joins the app as the given account. Call only after the user's click (D8). 200 `member`; 202 `pending` (needs approval). */
  join(accountId: string): Promise<"member" | "pending">;
  accounts(): Promise<{ accountId: string; email: string }[]>;
  /**
   * Invites `email` to the org with a simap role (`POST /auth/orgs/{org_id}/invitations`). Identity always answers 201
   * and never echoes the email; it sends the mail itself. Rejects `unknown` for a body that does not match the request.
   */
  invite(v: {
    accountId: string;
    orgId: string;
    email: string;
    role: string;
  }): Promise<{ id: string; expiresAt: string }>;
  /**
   * Accepts an org invitation as the signed-in account (`POST /auth/invitations/accept`, cookie mode, no bearer).
   * Call only from the Accept click. A 2xx is success whatever the body: `orgId` is null when it cannot be read.
   */
  acceptInvitation(v: { accountId: string; token: string }): Promise<{ orgId: string | null }>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXPIRES_MAX = 86400;
const LOGOUT_TIMEOUT_MS = 5000;
const ACCOUNTS_TIMEOUT_MS = 5000;
const ORGS_TIMEOUT_MS = 5000;
const INVITE_TIMEOUT_MS = 15000;
const ACCEPT_TIMEOUT_MS = 15000;
/** A hung /token would hold the cross-tab renewal lock for every tab. */
const TOKEN_TIMEOUT_MS = 15000;
const unknownError = (): AuthError => ({ code: "unknown" });
const asObject = (v: unknown): Record<string, unknown> =>
  typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};

const firstString = (...vals: unknown[]): string | undefined =>
  vals.find((v): v is string => typeof v === "string" && v.trim() !== "");

/**
 * Reads the `/auth/orgs` body. The shape is not documented (Q18), so this accepts a bare array or the first array
 * under `items` / `orgs` / `organizations` / `data`, and an org either flat or nested under `org` / `organization`.
 * Roles are ignored. `access` (D86) is read from the item or the nested org: missing = `member`; an unknown value
 * drops the org (not openable) and does not count as an unreadable body. A body that cannot be read rejects `unknown`: never an empty list by mistake.
 */
function parseOrgs(json: unknown): OrgChoice[] {
  const body = asObject(json);
  const list = Array.isArray(json)
    ? json
    : ["items", "orgs", "organizations", "data"]
        .map((k) => body[k])
        .find((v): v is unknown[] => Array.isArray(v));
  if (!list) throw unknownError();
  const out: OrgChoice[] = [];
  const seen = new Set<string>();
  let unopenable = 0;
  for (const raw of list) {
    const item = asObject(raw);
    const src =
      typeof item.org === "object" && item.org !== null
        ? asObject(item.org)
        : typeof item.organization === "object" && item.organization !== null
          ? asObject(item.organization)
          : item;
    const id = firstString(src.id, item.org_id, src.org_id, item.organization_id);
    const name = firstString(src.name, src.display_name, item.org_name, src.slug);
    if (!id || !UUID_RE.test(id) || !name) continue;
    const rawAccess = item.access !== undefined ? item.access : src.access;
    if (rawAccess !== undefined && rawAccess !== "member" && rawAccess !== "super_admin") {
      unopenable++;
      continue;
    }
    const key = id.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: key, name: name.trim().normalize("NFC"), access: rawAccess ?? "member" });
  }
  if (list.length > 0 && out.length === 0 && unopenable === 0) throw unknownError();
  return out;
}

/**
 * Credentials mode per call (consumers.md): `cookie` = credentials include + X-MM-App; `app` = credentials omit +
 * X-MM-App (signup, forgot); `public` = omit, no app header (verify-email, reset).
 */
type PostMode = "cookie" | "app" | "public";

/** Calls to mmlabs Identity (consumers.md). Rejections are plain `AuthError` objects. */
export function createIdentityClient({
  baseUrl,
  app,
  fetchFn = (...a) => fetch(...a),
}: {
  baseUrl: string;
  app: string;
  fetchFn?: FetchFn;
}): IdentityClient {
  const post = async (
    path: string,
    body: unknown,
    mode: PostMode,
    signal?: AbortSignal,
  ): Promise<unknown> => {
    let res: Response;
    try {
      res = await fetchFn(baseUrl + path, {
        method: "POST",
        credentials: mode === "cookie" ? "include" : "omit",
        headers: {
          "Content-Type": "application/json",
          ...(mode !== "public" && { "X-MM-App": app }),
        },
        body: JSON.stringify(body),
        cache: "no-store",
        ...(signal && { signal }),
      });
    } catch {
      throw networkError();
    }
    let json: unknown = null;
    if (res.status !== 204) {
      try {
        json = await res.json();
      } catch {
        json = null;
      }
    }
    if (!res.ok) throw toAuthError(res.status, res.headers, json);
    return json;
  };

  const get = async (path: string, signal?: AbortSignal): Promise<unknown> => {
    let res: Response;
    try {
      res = await fetchFn(baseUrl + path, {
        method: "GET",
        credentials: "include",
        headers: { "X-MM-App": app },
        cache: "no-store",
        signal,
      });
    } catch {
      throw networkError();
    }
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    if (!res.ok) throw toAuthError(res.status, res.headers, json);
    return json;
  };

  return {
    async login({ email, password, turnstileToken }) {
      const json = asObject(
        await post(
          "/auth/login",
          { email, password, ...(turnstileToken && { turnstile_token: turnstileToken }) },
          "cookie",
        ),
      );
      const user = asObject(json.user);
      if (typeof json.account_id !== "string" || !UUID_RE.test(json.account_id)) {
        throw unknownError();
      }
      return {
        accountId: json.account_id,
        email: typeof user.email === "string" ? user.email : email,
      };
    },
    async token(accountId, orgId) {
      const json = asObject(
        await post(
          "/auth/token",
          { audience: app, account_id: accountId, ...(orgId && { org_id: orgId }) },
          "cookie",
          AbortSignal.timeout(TOKEN_TIMEOUT_MS),
        ),
      );
      const { access_token: t, token_type, expires_in: exp, audience } = json;
      if (
        typeof t !== "string" ||
        !t ||
        token_type !== "Bearer" ||
        audience !== app ||
        typeof exp !== "number" ||
        !Number.isFinite(exp) ||
        exp < 1 ||
        exp > EXPIRES_MAX
      ) {
        throw unknownError();
      }
      return { accessToken: t, expiresIn: exp };
    },
    async logout(accountId) {
      await post(
        "/auth/logout",
        { account_id: accountId },
        "cookie",
        AbortSignal.timeout(LOGOUT_TIMEOUT_MS),
      );
    },
    async signup({ email, password, turnstileToken }) {
      const json = asObject(
        await post("/auth/signup", { email, password, turnstile_token: turnstileToken }, "app"),
      );
      return { email: typeof json.email === "string" ? json.email : email };
    },
    async verifyEmail(token) {
      await post("/auth/verify-email", { token }, "public");
    },
    async forgotPassword({ email, turnstileToken }) {
      await post("/auth/password/forgot", { email, turnstile_token: turnstileToken }, "app");
    },
    async resetPassword({ token, newPassword }) {
      await post("/auth/password/reset", { token, new_password: newPassword }, "public");
    },
    async resendVerification(accountId) {
      await post("/auth/verify-email/resend", { account_id: accountId }, "cookie");
    },
    async join(accountId) {
      const json = asObject(
        await post(
          `/auth/apps/${encodeURIComponent(app)}/join`,
          { account_id: accountId },
          "cookie",
        ),
      );
      if (json.status !== "member" && json.status !== "pending") throw unknownError();
      return json.status;
    },
    async orgs(accountId) {
      return parseOrgs(
        await get(
          `/auth/orgs?account_id=${encodeURIComponent(accountId)}`,
          AbortSignal.timeout(ORGS_TIMEOUT_MS),
        ),
      );
    },
    async invite({ accountId, orgId, email, role }) {
      if (!UUID_RE.test(accountId) || !UUID_RE.test(orgId)) throw unknownError();
      const json = asObject(
        await post(
          `/auth/orgs/${encodeURIComponent(orgId)}/invitations`,
          { account_id: accountId, email, role },
          "cookie",
          AbortSignal.timeout(INVITE_TIMEOUT_MS),
        ),
      );
      const { id, org_id, expires_at } = json;
      if (
        typeof id !== "string" ||
        !UUID_RE.test(id) ||
        typeof org_id !== "string" ||
        org_id.toLowerCase() !== orgId.toLowerCase() ||
        json.role !== role ||
        typeof expires_at !== "string" ||
        !Number.isFinite(Date.parse(expires_at))
      ) {
        throw unknownError();
      }
      return { id: id.toLowerCase(), expiresAt: new Date(expires_at).toISOString() };
    },
    async acceptInvitation({ accountId, token }) {
      if (!UUID_RE.test(accountId)) throw unknownError();
      const json = asObject(
        await post(
          "/auth/invitations/accept",
          { account_id: accountId, token },
          "cookie",
          AbortSignal.timeout(ACCEPT_TIMEOUT_MS),
        ),
      );
      const orgId = json.org_id;
      return {
        orgId: typeof orgId === "string" && UUID_RE.test(orgId) ? orgId.toLowerCase() : null,
      };
    },
    async accounts() {
      const items = asObject(
        await get("/auth/accounts", AbortSignal.timeout(ACCOUNTS_TIMEOUT_MS)),
      ).items;
      if (!Array.isArray(items)) return [];
      return items.flatMap((raw) => {
        const it = asObject(raw);
        return typeof it.account_id === "string" &&
          UUID_RE.test(it.account_id) &&
          typeof it.email === "string" &&
          it.email
          ? [{ accountId: it.account_id, email: it.email }]
          : [];
      });
    },
  };
}
