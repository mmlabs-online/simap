import "server-only";
import {
  parseMemberRef,
  parseProviderRoomCode,
  type ProviderCheckInInput,
} from "@/lib/validate/provider-checkin";
import { isCanonicalUuid } from "@/lib/validate/uuid";

export class ProviderConfigError extends Error {}

export type ProviderConfig = { kind: "off" } | { kind: "mock"; entries: ProviderCheckInInput[] };

const MAX_MOCK_ENTRIES = 200;

/**
 * SIMAP_PRESENCE_PROVIDER: unset or empty = off, `mock` = the dev mock (refused when NODE_ENV or SIMAP_DB_TARGET is
 * `production`, so fake check-ins never reach real orgs, including a dev server pointed at production data). SIMAP_PRESENCE_PROVIDER_MOCK: comma-separated `<email or member sub>=<ROOM_CODE>`.
 * Messages never carry a value or an entry (R3).
 */
export function loadProviderConfig(env: Record<string, string | undefined>): ProviderConfig {
  const kind = env.SIMAP_PRESENCE_PROVIDER;
  if (kind === undefined || kind === "") return { kind: "off" };
  if (kind !== "mock") throw new ProviderConfigError("SIMAP_PRESENCE_PROVIDER is invalid");
  if (env.NODE_ENV === "production" || env.SIMAP_DB_TARGET === "production") {
    throw new ProviderConfigError("SIMAP_PRESENCE_PROVIDER=mock is not allowed in production");
  }
  const raw = env.SIMAP_PRESENCE_PROVIDER_MOCK ?? "";
  const parts = raw.trim() === "" ? [] : raw.split(",");
  if (parts.length > MAX_MOCK_ENTRIES) {
    throw new ProviderConfigError("SIMAP_PRESENCE_PROVIDER_MOCK has too many entries");
  }
  const entries = parts.map((part): ProviderCheckInInput => {
    const i = part.lastIndexOf("=");
    const ref = i < 0 ? null : part.slice(0, i).trim();
    const member =
      ref === null ? null : parseMemberRef(isCanonicalUuid(ref) ? "sub" : "email", ref);
    const roomCode = parseProviderRoomCode(part.slice(i + 1));
    if (i < 0 || !member || !roomCode) {
      throw new ProviderConfigError("SIMAP_PRESENCE_PROVIDER_MOCK has a malformed entry");
    }
    return { member, roomCode };
  });
  return { kind: "mock", entries };
}
