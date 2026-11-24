import { describe, expect, it } from "vitest";
import { ApiAccessError, type ApiFetch } from "@/lib/api/fetch";
import { createGroupsApi } from "./groups-api";

type Call = [string, RequestInit | undefined];

function fake(respond: () => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetcher = (async (path: string, init?: RequestInit) => {
    calls.push([path, init]);
    return respond();
  }) as unknown as ApiFetch;
  return { api: createGroupsApi(fetcher), calls };
}
const jsonRes = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const throwing = (e: unknown) =>
  createGroupsApi((async () => Promise.reject(e)) as unknown as ApiFetch);

const group = { id: "a/b", name: "Nhóm A", color: "#3366ff" };
const project = { id: "p/1", code: "KT", name: "Kỹ thuật" };

describe("groups-api: groups", () => {
  it("list reads `groups`; a missing key is internal", async () => {
    const a = fake(() => jsonRes({ groups: [group] }));
    expect(await a.api.groups.list()).toEqual({ ok: true, value: [group] });
    expect(a.calls[0][0]).toBe("/api/groups");
    expect(a.calls[0][1]?.method).toBe("GET");
    expect(await fake(() => jsonRes({ projects: [] })).api.groups.list()).toEqual({
      ok: false,
      code: "internal",
    });
  });
  it("create POSTs JSON", async () => {
    const a = fake(() => jsonRes(group, 201));
    const body = { name: "Nhóm A", color: "#3366ff" };
    expect(await a.api.groups.create(body)).toEqual({ ok: true, value: group });
    const [path, init] = a.calls[0];
    expect(path).toBe("/api/groups");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({ "content-type": "application/json" });
    expect(JSON.parse(init?.body as string)).toEqual(body);
  });
  it("update PATCHes the encoded id", async () => {
    const a = fake(() => jsonRes(group));
    await a.api.groups.update("a/b", { name: "X" });
    expect(a.calls[0][0]).toBe("/api/groups/a%2Fb");
    expect(a.calls[0][1]?.method).toBe("PATCH");
    expect(JSON.parse(a.calls[0][1]?.body as string)).toEqual({ name: "X" });
  });
  it("impact GETs delete-impact", async () => {
    const a = fake(() => jsonRes({ seats: 2, members: 1 }));
    expect(await a.api.groups.impact("a/b")).toEqual({
      ok: true,
      value: { seats: 2, members: 1 },
    });
    expect(a.calls[0][0]).toBe("/api/groups/a%2Fb/delete-impact");
    expect(a.calls[0][1]?.method).toBe("GET");
  });
  it("remove adds ?force=true only when forced; 204 is ok", async () => {
    const a = fake(() => new Response(null, { status: 204 }));
    expect(await a.api.groups.remove("a/b", false)).toEqual({ ok: true, value: null });
    await a.api.groups.remove("a/b", true);
    expect(a.calls[0][0]).toBe("/api/groups/a%2Fb");
    expect(a.calls[1][0]).toBe("/api/groups/a%2Fb?force=true");
    expect(a.calls[1][1]?.method).toBe("DELETE");
  });
});

describe("groups-api: projects", () => {
  it("list reads `projects`; the same paths under /api/projects", async () => {
    const a = fake(() => jsonRes({ projects: [project] }));
    expect(await a.api.projects.list()).toEqual({ ok: true, value: [project] });
    expect(a.calls[0][0]).toBe("/api/projects");
    await a.api.projects.create({ code: "KT", name: "Kỹ thuật" });
    expect(a.calls[1][0]).toBe("/api/projects");
    expect(a.calls[1][1]?.method).toBe("POST");
    await a.api.projects.update("p/1", { code: "KT2" });
    expect(a.calls[2][0]).toBe("/api/projects/p%2F1");
    await a.api.projects.impact("p/1");
    expect(a.calls[3][0]).toBe("/api/projects/p%2F1/delete-impact");
    await a.api.projects.remove("p/1", true);
    expect(a.calls[4][0]).toBe("/api/projects/p%2F1?force=true");
  });
});

describe("groups-api: errors", () => {
  const errRes = (code: string, status: number) => () => jsonRes({ error: { code } }, status);
  it("409 domain codes resolve to a failed result", async () => {
    const g = await fake(errRes("group_name_taken", 409)).api.groups.create({
      name: "A",
      color: "#000000",
    });
    expect(g).toEqual({ ok: false, code: "group_name_taken" });
    const p = await fake(errRes("project_code_taken", 409)).api.projects.create({
      code: "A",
      name: "A",
    });
    expect(p).toEqual({ ok: false, code: "project_code_taken" });
    expect(await fake(errRes("in_use", 409)).api.groups.remove("x", false)).toEqual({
      ok: false,
      code: "in_use",
    });
  });
  it("a network error is unavailable; a signed-out access error is unauthenticated", async () => {
    expect(await throwing(new Error("down")).groups.list()).toEqual({
      ok: false,
      code: "unavailable",
    });
    expect(await throwing(new ApiAccessError("signed_out")).groups.list()).toEqual({
      ok: false,
      code: "unauthenticated",
    });
  });
  it("an error body that is not JSON is internal", async () => {
    const a = fake(() => new Response("oops", { status: 500 }));
    expect(await a.api.projects.list()).toEqual({ ok: false, code: "internal" });
  });
});
