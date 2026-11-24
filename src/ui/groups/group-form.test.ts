import { describe, expect, it } from "vitest";
import { validateGroupCreate } from "@/lib/validate/group";
import { groupsCopy } from "../copy/groups";
import {
  DEFAULT_GROUP_COLOR,
  emptyGroupForm,
  formFromGroup,
  toGroupCreate,
  toGroupPatch,
  toProjectCreate,
  toProjectPatch,
} from "./group-form";

const group = { id: "1", name: "Nhóm A", color: "#AABBCC" };
const project = { id: "2", code: "ABC", name: "Kỹ thuật" };

describe("group create", () => {
  it("trims and NFC-normalizes the name and keeps Vietnamese diacritics", () => {
    const decomposed = "  Nhóm Kỹ thuật ".normalize("NFD");
    const r = toGroupCreate({ name: decomposed, color: "#3366ff" });
    expect(r).toEqual({ kind: "ok", body: { name: "Nhóm Kỹ thuật", color: "#3366ff" } });
  });
  it("an empty or 61-char name gives the name message", () => {
    for (const name of ["  ", "a".repeat(61)]) {
      expect(toGroupCreate({ name, color: "#3366ff" })).toEqual({
        kind: "invalid",
        message: groupsCopy.fieldErrors.groupName,
      });
    }
  });
  it("a bad color gives the color message", () => {
    expect(toGroupCreate({ name: "A", color: "blue" })).toEqual({
      kind: "invalid",
      message: groupsCopy.fieldErrors.color,
    });
  });
  it("the default color is valid and the form lowercases a stored color", () => {
    expect(validateGroupCreate({ name: "A", color: DEFAULT_GROUP_COLOR }).ok).toBe(true);
    expect(emptyGroupForm().color).toBe(DEFAULT_GROUP_COLOR);
    expect(formFromGroup(group).color).toBe("#aabbcc");
  });
});

describe("group patch", () => {
  it("sends only changed fields", () => {
    expect(toGroupPatch({ name: "Nhóm B", color: "#aabbcc" }, group)).toEqual({
      kind: "ok",
      body: { name: "Nhóm B" },
    });
    expect(toGroupPatch({ name: "Nhóm A", color: "#112233" }, group)).toEqual({
      kind: "ok",
      body: { color: "#112233" },
    });
  });
  it("same name after trim, or color differing only by case, is unchanged", () => {
    expect(toGroupPatch({ name: " Nhóm A ", color: "#aabbcc" }, group)).toEqual({
      kind: "unchanged",
    });
  });
  it("an emptied name is invalid", () => {
    expect(toGroupPatch({ name: " ", color: "#aabbcc" }, group)).toEqual({
      kind: "invalid",
      message: groupsCopy.fieldErrors.groupName,
    });
  });
});

describe("projects", () => {
  it("create uppercases and trims the code", () => {
    expect(toProjectCreate({ code: " abc ", name: " Kỹ thuật " })).toEqual({
      kind: "ok",
      body: { code: "ABC", name: "Kỹ thuật" },
    });
  });
  it("a bad code or a 33-char code gives the code message; a long name the project name message", () => {
    for (const code of ["a b", "a".repeat(33)]) {
      expect(toProjectCreate({ code, name: "N" })).toEqual({
        kind: "invalid",
        message: groupsCopy.fieldErrors.code,
      });
    }
    expect(toProjectCreate({ code: "A", name: "n".repeat(121) })).toEqual({
      kind: "invalid",
      message: groupsCopy.fieldErrors.projectName,
    });
  });
  it("patch: a code differing by case or spaces is unchanged; a changed name is sent alone", () => {
    expect(toProjectPatch({ code: " abc ", name: "Kỹ thuật" }, project)).toEqual({
      kind: "unchanged",
    });
    expect(toProjectPatch({ code: "ABC", name: "Khác" }, project)).toEqual({
      kind: "ok",
      body: { name: "Khác" },
    });
  });
});
