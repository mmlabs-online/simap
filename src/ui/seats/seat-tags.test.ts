import { describe, expect, it } from "vitest";
import { initialSelection, tagOptions, tagsPatch } from "./seat-tags";

const g = { id: "g1", name: "Dev", color: "#fff" };
const p = { id: "p1", code: "A", name: "Alpha" };
const tagged = { group: g, project: p };
const bare = { group: null, project: null };

describe("tagsPatch", () => {
  it("unchanged -> null", () => {
    expect(tagsPatch(tagged, initialSelection(tagged))).toBeNull();
    expect(tagsPatch(bare, { groupId: null, projectId: null })).toBeNull();
  });
  it("sends only changed keys", () => {
    expect(tagsPatch(bare, { groupId: "g1", projectId: null })).toEqual({ groupId: "g1" });
    expect(tagsPatch(bare, { groupId: null, projectId: "p1" })).toEqual({ projectId: "p1" });
    expect(tagsPatch(tagged, { groupId: "g2", projectId: "p1" })).toEqual({ groupId: "g2" });
  });
  it("both, and clear to null", () => {
    expect(tagsPatch(bare, { groupId: "g1", projectId: "p1" })).toEqual({
      groupId: "g1",
      projectId: "p1",
    });
    expect(tagsPatch(tagged, { groupId: null, projectId: null })).toEqual({
      groupId: null,
      projectId: null,
    });
  });
});

describe("tagOptions", () => {
  it("keeps list order", () => {
    const list = [{ id: "b" }, { id: "a" }];
    expect(tagOptions(list, { id: "a" })).toEqual(list);
    expect(tagOptions(list, null)).toEqual(list);
  });
  it("keeps the current tag when the list lacks it", () => {
    expect(tagOptions([{ id: "a" }], { id: "z" })).toEqual([{ id: "a" }, { id: "z" }]);
  });
});
