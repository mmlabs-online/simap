import { describe, expect, it } from "vitest";
import { decideOrg, sortOrgs } from "./orgs";
import type { OrgChoice } from "./types";

const A: OrgChoice = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Alpha" };
const B: OrgChoice = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Beta" };
const C: OrgChoice = { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", name: "Gamma" };
const d = (orgs: OrgChoice[], remembered: string | null = null, denied: string[] = []) =>
  decideOrg({ orgs, remembered, denied });

describe("decideOrg", () => {
  it("0 orgs -> none, no notice", () => {
    expect(d([])).toEqual({ kind: "none" });
  });

  it("1 org -> enter it, even when remembered names another id", () => {
    expect(d([A])).toEqual({ kind: "enter", org: A });
    expect(d([A], B.id)).toEqual({ kind: "enter", org: A });
  });

  it("2 orgs + remembered listed -> enter the remembered one", () => {
    expect(d([A, B], B.id)).toEqual({ kind: "enter", org: B });
  });

  it("2 orgs + remembered unlisted or null -> pick, sorted", () => {
    expect(d([B, A], C.id)).toEqual({ kind: "pick", orgs: [A, B] });
    expect(d([B, A])).toEqual({ kind: "pick", orgs: [A, B] });
  });

  it("ids are compared case-insensitively", () => {
    expect(d([A, B], B.id.toUpperCase())).toEqual({ kind: "enter", org: B });
  });

  it("duplicate ids give one entry; the input is not mutated", () => {
    const input = [B, A, { ...A, name: "Alpha again" }];
    expect(d(input)).toEqual({ kind: "pick", orgs: [A, B] });
    expect(input).toHaveLength(3);
    expect(input[0]).toBe(B);
  });

  it("after a denial it never enters", () => {
    // remembered org listed
    expect(d([A, B], A.id, [C.id])).toEqual({ kind: "pick", orgs: [A, B], notice: "org_denied" });
    // a single org left
    expect(d([A, B], null, [B.id])).toEqual({ kind: "pick", orgs: [A], notice: "org_denied" });
    // the only org was denied (still listed)
    expect(d([A], A.id, [A.id.toUpperCase()])).toEqual({ kind: "none", notice: "org_denied" });
    // the denied org is not offered
    expect(d([A, B, C], null, [B.id])).toEqual({
      kind: "pick",
      orgs: [A, C],
      notice: "org_denied",
    });
  });
});

describe("sortOrgs", () => {
  it("sorts Vietnamese names with diacritics; ties by id; NFD equals NFC", () => {
    const mk = (id: string, name: string): OrgChoice => ({ id, name });
    const out = sortOrgs([mk("4", "Đà Nẵng"), mk("3", "Bình"), mk("2", "Ánh"), mk("1", "An")]).map(
      (o) => o.name,
    );
    expect(out).toEqual(["An", "Ánh", "Bình", "Đà Nẵng"]);
    const nfd = "Ánh".normalize("NFD");
    expect(sortOrgs([mk("9", "Ánh"), mk("8", nfd)]).map((o) => o.id)).toEqual(["8", "9"]);
    expect(sortOrgs([mk("9", nfd), mk("8", "Ánh")]).map((o) => o.id)).toEqual(["8", "9"]);
  });
});
