import { emailError } from "./credentials";
import { INVITABLE_ROLES } from "@/lib/invitations/roles";
import type { Validated } from "./room";
import { isCanonicalUuid } from "./uuid";

const KEYS = ["email", "role", "identityInvitationId", "expiresAt"];
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
const SKEW_MS = 60_000;
const MAX_AHEAD_MS = 31 * 86_400_000;

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Trimmed and lowercased (matches the pending-per-address index). null = not a valid address. */
export function normalizeInviteEmail(v: unknown): string | null {
  if (typeof v !== "string" || emailError(v) !== null) return null;
  return v.trim().toLowerCase();
}

export type InvitationRecordValue = {
  email: string;
  role: (typeof INVITABLE_ROLES)[number];
  identityInvitationId: string;
  expiresAt: string;
};

/** Exact keys. `expiresAt` must carry a timezone and lie within [now - 60 s, now + 31 d]; returned as UTC ISO. */
export function validateInvitationRecord(
  body: unknown,
  nowMs: number,
): Validated<InvitationRecordValue> {
  if (!isPlainObject(body)) return { ok: false, field: "body" };
  const extra = Object.keys(body).find((k) => !KEYS.includes(k));
  if (extra !== undefined) return { ok: false, field: extra };
  const email = normalizeInviteEmail(body.email);
  if (email === null) return { ok: false, field: "email" };
  const role = INVITABLE_ROLES.find((r) => r === body.role);
  if (!role) return { ok: false, field: "role" };
  const id = body.identityInvitationId;
  if (!isCanonicalUuid(id)) return { ok: false, field: "identityInvitationId" };
  const raw = body.expiresAt;
  if (typeof raw !== "string" || !ISO_RE.test(raw)) return { ok: false, field: "expiresAt" };
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms) || ms < nowMs - SKEW_MS || ms > nowMs + MAX_AHEAD_MS) {
    return { ok: false, field: "expiresAt" };
  }
  return {
    ok: true,
    value: { email, role, identityInvitationId: id, expiresAt: new Date(ms).toISOString() },
  };
}
