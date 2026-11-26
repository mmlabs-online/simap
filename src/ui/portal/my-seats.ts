import type { ApiFetch } from "@/lib/api/fetch";
import type { MemberSeatRef } from "@/lib/members/types";
import type { SeatDto } from "@/lib/seats/types";
import { seatsCopy } from "../copy/seats";
import type { SeatsResult } from "../seats/seats-api";
import { actionOutcome, type ActionResult, type Outcome } from "../seats/seat-actions";

type RequestsStatus = "loading" | "error" | "ready";

export type SeatsLoad = { ok: true; seats: SeatDto[] } | { ok: false; code: string };

/** The caller's own member id from a `/api/me` response; null for anything else (R6: the only id source). */
export async function readOwnMemberId(res: Response): Promise<string | null> {
  if (!res.ok) return null;
  try {
    const id = ((await res.json()) as { member?: { id?: unknown } } | null)?.member?.id;
    return typeof id === "string" && id !== "" ? id : null;
  } catch {
    return null;
  }
}

/** Seats sorted by room then code. A `not_found` seat (released elsewhere) is dropped; any other failure is an error. */
export function composeSeats(
  refs: readonly MemberSeatRef[],
  results: readonly SeatsResult<SeatDto>[],
): SeatsLoad {
  const seats: SeatDto[] = [];
  for (let i = 0; i < refs.length; i++) {
    const r = results[i];
    if (r === undefined) return { ok: false, code: "internal" };
    if (r.ok) seats.push(r.value);
    else if (r.code !== "not_found") return { ok: false, code: r.code };
  }
  seats.sort((a, b) => a.roomCode.localeCompare(b.roomCode) || a.code.localeCompare(b.code));
  return { ok: true, seats };
}

const BATCH = 20;
const fail = (code: string): SeatsLoad => ({ ok: false, code });

/** `/api/me` -> `/api/members/<id>` -> one `/api/seats/<id>` per ref (batches of 20). */
export async function loadMySeats(
  apiFetch: ApiFetch,
  seatsApi: { get: (id: string) => Promise<SeatsResult<SeatDto>> },
): Promise<SeatsLoad> {
  try {
    const me = await apiFetch("/api/me", { method: "GET" });
    if (!me.ok) return fail("internal");
    const id = await readOwnMemberId(me);
    if (id === null) return fail("internal");
    const res = await apiFetch(`/api/members/${encodeURIComponent(id)}`, { method: "GET" });
    if (!res.ok) return fail("internal");
    const refs = ((await res.json()) as { seats?: unknown } | null)?.seats;
    if (!Array.isArray(refs)) return fail("internal");
    const list = refs as MemberSeatRef[];
    const results: SeatsResult<SeatDto>[] = [];
    for (let i = 0; i < list.length; i += BATCH) {
      results.push(...(await Promise.all(list.slice(i, i + BATCH).map((r) => seatsApi.get(r.id)))));
    }
    return composeSeats(list, results);
  } catch {
    return fail("unavailable");
  }
}

/** The empty state shows only with no seat and a loaded, empty request list. */
export function seatTabEmpty(
  seats: readonly unknown[],
  requestsStatus: RequestsStatus,
  requestCount: number,
): boolean {
  return seats.length === 0 && requestsStatus === "ready" && requestCount === 0;
}

export type ReleaseView = { title: string; body: string; submitLabel: string };

export function releaseView(seat: Pick<SeatDto, "code">): ReleaseView {
  return {
    title: seatsCopy.actions.releaseTitle(seat.code),
    body: seatsCopy.actions.releaseBody,
    submitLabel: seatsCopy.actions.releaseSubmit,
  };
}

export const releaseOutcome = (result: ActionResult): Outcome => actionOutcome("release", result);
