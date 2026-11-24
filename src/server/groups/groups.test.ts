import { describe, expect, it } from "vitest";
import type { OrgScope } from "@/server/http/org-scope";
import {
  createGroup,
  createProject,
  deleteGroup,
  deleteProject,
  getGroupImpact,
  getProjectImpact,
  listGroups,
  listProjects,
  updateGroup,
  updateProject,
} from "./groups";

const scope = { orgId: "11111111-1111-4111-8111-111111111111" } as OrgScope;
const ACTOR = "22222222-2222-4222-8222-222222222222";
const GID = "33333333-3333-4333-8333-333333333333";

type Call = [string, unknown[]];
type Script = (sql: string, values: unknown[]) => unknown[] | Error;

function fakeDb(script: Script) {
  const calls: Call[] = [];
  const query = async (text: string, values: unknown[] = []) => {
    const sql = text.replace(/\s+/g, " ").trim();
    calls.push([sql, values]);
    if (/^(begin|commit|rollback)$/.test(sql)) return { rows: [] };
    const out = script(sql, values);
    if (out instanceof Error) throw out;
    return { rows: out };
  };
  const db = { query, connect: async () => ({ query, release: () => {} }) };
  const sqls = () => calls.map(([s]) => s);
  return { db, calls, sqls };
}

const uniq = (constraint: string) => Object.assign(new Error("dup"), { code: "23505", constraint });
const groupRow = { id: GID, name: "Dev", color: "#5B6CF0" };
const impact = (seats: number, members = 0) => ({ seats, members });

const groupScript =
  (imp: { seats: number; members: number } | null): Script =>
  (sql) => {
    if (sql.startsWith("select name from groups")) return imp ? [{ name: "Dev" }] : [];
    if (sql.startsWith("select id from groups")) return imp ? [{ id: GID }] : [];
    if (sql.includes("as members")) return [imp];
    if (sql.startsWith("select id, name, color")) return [groupRow];
    if (sql.startsWith("insert into groups")) return [{ id: GID }];
    return [];
  };

describe("org scoping (R6)", () => {
  it("every statement filters org_id = $1 and binds the scope org first", async () => {
    const t = fakeDb((sql) => {
      if (sql.startsWith("select name from groups")) return [{ name: "Dev" }];
      if (sql.startsWith("select code from projects")) return [{ code: "P1" }];
      if (sql.startsWith("select id from")) return [{ id: GID }];
      if (sql.includes("as members")) return [impact(1, 1)];
      if (sql.includes("as seats")) return [{ seats: 1 }];
      if (sql.startsWith("insert into")) return [{ id: GID }];
      return [groupRow];
    });
    await listGroups(t.db, scope);
    await createGroup(t.db, scope, ACTOR, { name: "Dev", color: "#5B6CF0" });
    await updateGroup(t.db, scope, ACTOR, GID, { name: "Ops" });
    await getGroupImpact(t.db, scope, GID);
    await deleteGroup(t.db, scope, ACTOR, GID, true);
    await listProjects(t.db, scope);
    await createProject(t.db, scope, ACTOR, { code: "P1", name: "n" });
    await updateProject(t.db, scope, ACTOR, GID, { name: "m" });
    await getProjectImpact(t.db, scope, GID);
    await deleteProject(t.db, scope, ACTOR, GID, true);
    const data = t.calls.filter(([s]) => !/^(begin|commit|rollback)$/.test(s));
    expect(data.length).toBeGreaterThan(20);
    for (const [sql, values] of data) {
      expect(sql).toMatch(/org_id\s*=\s*\$1/);
      expect(values[0]).toBe(scope.orgId);
    }
  });
});

describe("create / update", () => {
  it("duplicate group name -> 409 group_name_taken and rollback", async () => {
    const t = fakeDb((sql) =>
      sql.startsWith("insert into groups") ? uniq("groups_org_name_key") : [],
    );
    const r = await createGroup(t.db, scope, ACTOR, { name: "Dev", color: "#5B6CF0" });
    expect(r).toEqual({ ok: false, status: 409, code: "group_name_taken" });
    expect(t.sqls()).toContain("rollback");
  });

  it("duplicate project code on update -> 409 project_code_taken", async () => {
    const t = fakeDb((sql) => {
      if (sql.startsWith("select code from projects")) return [{ code: "P1" }];
      if (sql.startsWith("update projects")) return uniq("projects_org_code_key");
      return [];
    });
    const r = await updateProject(t.db, scope, ACTOR, GID, { code: "P2" });
    expect(r).toEqual({ ok: false, status: 409, code: "project_code_taken" });
  });

  it("update of a missing group -> 404 and no update issued", async () => {
    const t = fakeDb(groupScript(null));
    expect(await updateGroup(t.db, scope, ACTOR, GID, { name: "x" })).toEqual({
      ok: false,
      status: 404,
      code: "not_found",
    });
    expect(t.sqls().some((s) => s.startsWith("update groups"))).toBe(false);
  });
});

describe("getGroupImpact / getProjectImpact", () => {
  it("counts seats and members for a group", async () => {
    const t = fakeDb(groupScript(impact(3, 2)));
    expect(await getGroupImpact(t.db, scope, GID)).toEqual({
      ok: true,
      value: { seats: 3, members: 2 },
    });
  });

  it("counts none for an unused group", async () => {
    const t = fakeDb(groupScript(impact(0, 0)));
    expect(await getGroupImpact(t.db, scope, GID)).toEqual({
      ok: true,
      value: { seats: 0, members: 0 },
    });
  });

  it("project impact is seats only; missing -> 404", async () => {
    const found = fakeDb((sql) =>
      sql.startsWith("select id from") ? [{ id: GID }] : [{ seats: 4 }],
    );
    expect(await getProjectImpact(found.db, scope, GID)).toEqual({ ok: true, value: { seats: 4 } });
    const missing = fakeDb(() => []);
    expect(await getProjectImpact(missing.db, scope, GID)).toEqual({
      ok: false,
      status: 404,
      code: "not_found",
    });
    expect(await getGroupImpact(missing.db, scope, GID)).toEqual({
      ok: false,
      status: 404,
      code: "not_found",
    });
  });
});

describe("deleteGroup", () => {
  it("used without force -> 409 in_use, nothing is updated or deleted, rolled back", async () => {
    const t = fakeDb(groupScript(impact(2, 1)));
    expect(await deleteGroup(t.db, scope, ACTOR, GID, false)).toEqual({
      ok: false,
      status: 409,
      code: "in_use",
    });
    const s = t.sqls();
    expect(s.some((x) => /^(update|delete)/.test(x))).toBe(false);
    expect(s.some((x) => x.startsWith("insert into audit_log"))).toBe(false);
    expect(s).toContain("rollback");
  });

  it("force: members cleared before seats, then delete, then audit with counts", async () => {
    const t = fakeDb(groupScript(impact(2, 1)));
    expect(await deleteGroup(t.db, scope, ACTOR, GID, true)).toEqual({ ok: true, value: null });
    const s = t.sqls();
    const at = (re: RegExp) => s.findIndex((x) => re.test(x));
    expect(at(/^update members set group_id = null/)).toBeGreaterThan(-1);
    expect(at(/^update members/)).toBeLessThan(at(/^update seats set group_id = null/));
    expect(at(/^update seats/)).toBeLessThan(at(/^delete from groups/));
    expect(at(/^delete from groups/)).toBeLessThan(at(/^insert into audit_log/));
    const audit = t.calls[at(/^insert into audit_log/)]![1];
    expect(audit.slice(2)).toEqual([
      "group.delete",
      "group",
      GID,
      JSON.stringify({ name: "Dev", seats: 2, members: 1, forced: true }),
    ]);
  });

  it("unused: deleted without clearing anything", async () => {
    const t = fakeDb(groupScript(impact(0, 0)));
    expect((await deleteGroup(t.db, scope, ACTOR, GID, false)).ok).toBe(true);
    const s = t.sqls();
    expect(s.some((x) => /^update (members|seats)/.test(x))).toBe(false);
    expect(s.some((x) => x.startsWith("delete from groups"))).toBe(true);
  });

  it("missing -> 404", async () => {
    const t = fakeDb(groupScript(null));
    expect(await deleteGroup(t.db, scope, ACTOR, GID, true)).toEqual({
      ok: false,
      status: 404,
      code: "not_found",
    });
  });
});

describe("deleteProject", () => {
  const script: Script = (sql) => {
    if (sql.startsWith("select code from projects")) return [{ code: "P1" }];
    if (sql.includes("as seats")) return [{ seats: 2 }];
    return [];
  };

  it("used without force -> 409 in_use and no writes", async () => {
    const t = fakeDb(script);
    expect(await deleteProject(t.db, scope, ACTOR, GID, false)).toEqual({
      ok: false,
      status: 409,
      code: "in_use",
    });
    expect(t.sqls().some((x) => /^(update|delete)/.test(x))).toBe(false);
  });

  it("force clears seats then deletes", async () => {
    const t = fakeDb(script);
    expect((await deleteProject(t.db, scope, ACTOR, GID, true)).ok).toBe(true);
    const s = t.sqls();
    const u = s.findIndex((x) => x.startsWith("update seats set project_id = null"));
    expect(u).toBeGreaterThan(-1);
    expect(u).toBeLessThan(s.findIndex((x) => x.startsWith("delete from projects")));
  });
});
