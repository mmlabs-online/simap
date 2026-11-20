import { describe, expect, it } from "vitest";
import type { RoomDto } from "@/lib/rooms/types";
import { roomsCopy } from "../copy/rooms";
import {
  codeInput,
  emptyForm,
  fieldMessage,
  formFromRoom,
  renameWarningFor,
  toCreateBody,
  toPatchBody,
} from "./room-form";

const room: RoomDto = {
  id: "r1",
  code: "C302",
  name: "Phòng họp",
  description: "Tầng ba",
  floor: "3",
  seatCount: 4,
  occupiedCount: 1,
};
const msg = (r: { kind: string; message?: string }) => (r.kind === "invalid" ? r.message : null);

describe("codeInput", () => {
  it("uppercases as typed and keeps spaces", () => {
    expect(codeInput("c302")).toBe("C302");
    expect(codeInput("c3a-b")).toBe("C3A-B");
    expect(codeInput(" c3a ")).toBe(" C3A ");
  });
});

describe("toCreateBody", () => {
  const ok = { ...emptyForm(), code: " c302 ", name: "Phòng họp" };
  it("returns the validator output", () => {
    expect(toCreateBody(ok)).toEqual({
      kind: "ok",
      body: { code: "C302", name: "Phòng họp", description: null, floor: null },
    });
  });
  it("maps each invalid field to its message", () => {
    expect(msg(toCreateBody({ ...ok, code: "" }))).toBe(roomsCopy.fieldErrors.code);
    expect(msg(toCreateBody({ ...ok, name: " " }))).toBe(roomsCopy.fieldErrors.name);
    expect(msg(toCreateBody({ ...ok, description: "x".repeat(501) }))).toBe(
      roomsCopy.fieldErrors.description,
    );
    expect(msg(toCreateBody({ ...ok, floor: "x".repeat(41) }))).toBe(roomsCopy.fieldErrors.floor);
  });
});

describe("toPatchBody", () => {
  it("sends only changed fields", () => {
    expect(toPatchBody({ ...formFromRoom(room), name: "Họp lớn" }, room)).toEqual({
      kind: "ok",
      body: { name: "Họp lớn" },
    });
  });
  it("treats the same code in another case as unchanged", () => {
    expect(toPatchBody({ ...formFromRoom(room), code: " c302 " }, room)).toEqual({
      kind: "unchanged",
    });
  });
  it("clearing the description sends null", () => {
    expect(toPatchBody({ ...formFromRoom(room), description: "" }, room)).toEqual({
      kind: "ok",
      body: { description: null },
    });
  });
  it("reports an invalid changed field", () => {
    expect(msg(toPatchBody({ ...formFromRoom(room), code: "a b" }, room))).toBe(
      roomsCopy.fieldErrors.code,
    );
  });
});

describe("fieldMessage", () => {
  it("falls back to the body message", () => {
    expect(fieldMessage("nope")).toBe(roomsCopy.fieldErrors.body);
  });
});

describe("renameWarningFor", () => {
  it("warns in edit mode when the code changes", () => {
    const w = renameWarningFor("edit", "C302", "c303");
    expect(w).toContain("C302-01");
    expect(w).toContain("C303-01");
  });
  it("is null for the same code, an invalid code, or create mode", () => {
    expect(renameWarningFor("edit", "C302", " c302 ")).toBeNull();
    expect(renameWarningFor("edit", "C302", "a b")).toBeNull();
    expect(renameWarningFor("create", "", "C303")).toBeNull();
  });
});
