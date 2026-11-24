import { describe, expect, it } from "vitest";
import { ApiAccessError, type ApiFetch } from "@/lib/api/fetch";
import type { DashboardDto } from "@/lib/dashboard/types";
import { createDashboardApi } from "./dashboard-api";

const jsonRes = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const apiWith = (respond: () => Response | Promise<Response>) =>
  createDashboardApi((async () => respond()) as unknown as ApiFetch);
const throwing = (e: unknown) =>
  createDashboardApi((async () => Promise.reject(e)) as unknown as ApiFetch);

const dto: DashboardDto = {
  totals: { rooms: 0, seats: 0, occupied: 0, devicesPlaced: 0, devicesInventory: 0 },
  rooms: [],
  roomsTruncated: false,
  deactivatedHolders: null,
};

describe("dashboard-api get", () => {
  it("ok body returns the value and calls GET /api/dashboard", async () => {
    const calls: [string, RequestInit | undefined][] = [];
    const api = createDashboardApi((async (p: string, i?: RequestInit) => {
      calls.push([p, i]);
      return jsonRes(dto);
    }) as unknown as ApiFetch);
    expect(await api.get()).toEqual({ ok: true, value: dto });
    expect(calls[0]![0]).toBe("/api/dashboard");
    expect(calls[0]![1]?.method).toBe("GET");
  });
  it("non-ok returns the error code", async () => {
    const api = apiWith(() => jsonRes({ error: { code: "forbidden" } }, 403));
    expect(await api.get()).toEqual({ ok: false, code: "forbidden" });
  });
  it("signed_out maps to unauthenticated", async () => {
    const api = throwing(new ApiAccessError("signed_out"));
    expect(await api.get()).toEqual({ ok: false, code: "unauthenticated" });
  });
  it("a thrown fetch is unavailable", async () => {
    expect(await throwing(new Error("net")).get()).toEqual({ ok: false, code: "unavailable" });
  });
  it("a body without totals or rooms is internal", async () => {
    expect(await apiWith(() => jsonRes({})).get()).toEqual({ ok: false, code: "internal" });
    expect(await apiWith(() => jsonRes({ totals: {} })).get()).toEqual({
      ok: false,
      code: "internal",
    });
  });
});
