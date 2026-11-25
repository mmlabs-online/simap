import { isCanonicalUuid } from "@/lib/validate/uuid";
import {
  DEVICE_HISTORY_KINDS,
  type DeviceHistoryEntryDto,
  type DeviceHistoryKind,
  type MemberRef,
} from "./types";

/** One audit row of a device, with the joined actor and the joined handoff fields. */
export type DeviceHistoryRow = {
  id: string;
  action: string;
  at: string;
  actorId: string | null;
  actorName: string | null;
  meta: unknown;
  hNote: string | null;
  hNewExpiresOn: string | null;
};

const DATE_RE = /^\d{4}-\d\d-\d\d$/;

const obj = (v: unknown): Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const date = (v: unknown): string | null => (typeof v === "string" && DATE_RE.test(v) ? v : null);
const uuid = (v: unknown): string | null =>
  typeof v === "string" && isCanonicalUuid(v) ? v : null;

/** The member ids an audit row refers to, for one batched name lookup. */
export function historyMemberIds(meta: unknown): string[] {
  const m = obj(meta);
  const ids = [m.fromMemberId, m.toMemberId, m.memberId, m.ownerId].map(uuid);
  return ids.filter((x): x is string => x !== null);
}

function causeOf(m: Record<string, unknown>): DeviceHistoryEntryDto["cause"] {
  if (m.byTakeBack === true) return "take_back";
  if (m.byDeactivation === true) return "deactivation";
  if (m.byManager === true) return "manager";
  return null;
}

/** Maps one audit row to a history entry; null for an action that is not device history. Never throws. */
export function toHistoryEntry(
  row: DeviceHistoryRow,
  names: ReadonlyMap<string, MemberRef>,
): DeviceHistoryEntryDto | null {
  if (!row.action.startsWith("device.")) return null;
  const kind = row.action.slice("device.".length);
  if (!(DEVICE_HISTORY_KINDS as readonly string[]).includes(kind)) return null;
  const k = kind as DeviceHistoryKind;
  const m = obj(row.meta);
  const ref = (v: unknown): MemberRef | null => {
    const id = uuid(v);
    return id === null ? null : (names.get(id) ?? null);
  };
  const actor: MemberRef | null =
    row.actorId !== null && row.actorName !== null
      ? { id: row.actorId, displayName: row.actorName }
      : null;
  const e: DeviceHistoryEntryDto = {
    id: row.id,
    kind: k,
    at: row.at,
    actor,
    from: null,
    to: null,
    note: null,
    expiresOn: null,
    fromExpiresOn: null,
    confirmedBy: null,
    cause: null,
  };
  const metaNote = str(m.note);
  const pendingNote = metaNote ?? row.hNote;

  switch (k) {
    case "create":
      break;
    case "assign":
      e.to = ref(m.memberId);
      e.note = metaNote;
      e.expiresOn = date(m.expiresOn);
      break;
    case "holding_update": {
      const to = obj(m.to);
      e.to = ref(m.ownerId);
      e.note = str(to.note);
      e.expiresOn = date(to.expiresOn);
      e.fromExpiresOn = date(obj(m.from).expiresOn);
      break;
    }
    case "transfer_start":
    case "transfer_cancel":
    case "transfer_decline":
      e.from = ref(m.fromMemberId);
      e.to = ref(m.toMemberId);
      e.note = pendingNote;
      e.cause = causeOf(m);
      break;
    case "transfer_confirm":
      e.from = ref(m.fromMemberId);
      e.to = ref(m.toMemberId);
      e.note = row.hNote;
      e.expiresOn = date(m.expiresOn);
      e.confirmedBy = actor;
      break;
    case "return_start":
    case "return_cancel":
      e.from = ref(m.fromMemberId);
      e.note = pendingNote;
      e.cause = causeOf(m);
      break;
    case "return_confirm":
      e.from = ref(m.fromMemberId);
      e.note = row.hNote;
      e.confirmedBy = actor;
      break;
    case "return_take_back":
      e.from = ref(m.fromMemberId);
      e.confirmedBy = actor;
      break;
    case "extension_start":
    case "extension_cancel":
    case "extension_decline":
      e.from = ref(m.fromMemberId);
      e.note = pendingNote;
      e.expiresOn = date(m.newExpiresOn) ?? date(row.hNewExpiresOn);
      e.cause = causeOf(m);
      break;
    case "extension_confirm":
      e.from = ref(m.fromMemberId);
      e.note = row.hNote;
      e.expiresOn = date(m.toExpiresOn) ?? date(row.hNewExpiresOn);
      e.fromExpiresOn = date(m.fromExpiresOn);
      e.confirmedBy = actor;
      break;
  }
  return e;
}
