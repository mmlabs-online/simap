import { describe, expect, it } from "vitest";
import type { ApiFetch } from "@/lib/api/fetch";
import type { SeatDto } from "@/lib/seats/types";
import { seatsCopy } from "../copy/seats";
import type { SeatsResult } from "../seats/seats-api";
import {
  composeSeats,
  loadMySeats,
  readOwnMemberId,
  releaseOutcome,
  releaseView,
  seatTabEmpty,
} from "./my-seats";

const seat = (code: string, roomCode: string, over: Partial<SeatDto> = {}): SeatDto =>
  ({
    id: `id-${roomCode}-${code}`,
    code,
    roomCode,
    group: { id: "g", name: "Team", color: "#fff" },
    project: { id: "p", code: "P", name: "Proj" },
    ...over,
  }) as SeatDto;
const ok = (s: SeatDto): SeatsResult<SeatDto> => ({ ok: true, value: s });
const ref = (s: SeatDto) => ({ id: s.id, code: s.code });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("readOwnMemberId", () => {
  it("reads member.id from a 200 body, else null", async () => {
    expect(await readOwnMemberId(json({ member: { id: "m1" } }))).toBe("m1");
    expect(await readOwnMemberId(json({}))).toBeNull();
    expect(await readOwnMemberId(json({ member: { id: 5 } }))).toBeNull();
    expect(await readOwnMemberId(json({ member: { id: "m1" } }, 500))).toBeNull();
    expect(await readOwnMemberId(new Response("not json"))).toBeNull();
  });
});

describe("composeSeats", () => {
  it("handles 0, 1 and 2 seats, sorted by room then code, tags carried", () => {
    expect(composeSeats([], [])).toEqual({ ok: true, seats: [] });
    const a = seat("B2", "R2");
    const b = seat("A9", "R2");
    const c = seat("Z1", "R1");
    expect(composeSeats([ref(a)], [ok(a)])).toEqual({ ok: true, seats: [a] });
    const r = composeSeats([a, b, c].map(ref), [a, b, c].map(ok));
    expect(r).toEqual({ ok: true, seats: [c, b, a] });
    expect(r.ok && r.seats[0].group?.name).toBe("Team");
  });
  it("drops a not_found seat; any other failure is an error", () => {
    const a = seat("A1", "R1");
    const b = seat("A2", "R1");
    const gone = { ok: false, code: "not_found" } as const;
    expect(composeSeats([a, b].map(ref), [ok(a), gone])).toEqual({ ok: true, seats: [a] });
    expect(composeSeats([a, b].map(ref), [ok(a), { ok: false, code: "unavailable" }])).toEqual({
      ok: false,
      code: "unavailable",
    });
  });
});

describe("loadMySeats", () => {
  const a = seat("A1", "R1");
  const b = seat("A2", "R1");
  const run = (routes: Record<string, Response>, calls: string[] = []) =>
    loadMySeats(
      (async (path: string) => {
        calls.push(path);
        return routes[path] ?? json({}, 404);
      }) as unknown as ApiFetch,
      {
        get: async (id) => {
          calls.push(`seat:${id}`);
          return id === b.id ? { ok: false, code: "not_found" } : ok(a);
        },
      },
    );

  it("calls /api/me, then /api/members/<id>, then one seat per ref; a released seat is dropped", async () => {
    const calls: string[] = [];
    const r = await run(
      {
        "/api/me": json({ member: { id: "m 1" } }),
        "/api/members/m%201": json({ seats: [ref(a), ref(b)] }),
      },
      calls,
    );
    expect(calls).toEqual(["/api/me", "/api/members/m%201", `seat:${a.id}`, `seat:${b.id}`]);
    expect(r).toEqual({ ok: true, seats: [a] });
  });
  it("404 on members gives error; no id gives error", async () => {
    expect((await run({ "/api/me": json({ member: { id: "m1" } }) })).ok).toBe(false);
    expect((await run({ "/api/me": json({ member: null }) })).ok).toBe(false);
  });
});

describe("seatTabEmpty", () => {
  it("is true only with no seat and a ready, empty request list", () => {
    expect(seatTabEmpty([], "ready", 0)).toBe(true);
    expect(seatTabEmpty([1], "ready", 0)).toBe(false);
    expect(seatTabEmpty([], "ready", 1)).toBe(false);
    expect(seatTabEmpty([], "loading", 0)).toBe(false);
    expect(seatTabEmpty([], "error", 0)).toBe(false);
  });
});

describe("releaseView", () => {
  it("uses the seats copy; ok reloads, not_allowed shows releaseChanged", () => {
    expect(releaseView({ code: "A1" })).toEqual({
      title: "Release seat A1?",
      body: seatsCopy.actions.releaseBody,
      submitLabel: seatsCopy.actions.releaseSubmit,
    });
    expect(releaseOutcome({ ok: true }).reload).toBe(true);
    const o = releaseOutcome({ ok: false, code: "not_allowed" });
    expect(o.message).toBe(seatsCopy.actions.releaseChanged);
  });
});
