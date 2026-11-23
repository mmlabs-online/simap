import { describe, expect, it } from "vitest";
import { SHORTCUTS, isTextField, keyAction, type KeyCtx, type KeyInput } from "./shortcuts";

const input = (key: string, over: Partial<KeyInput> = {}): KeyInput => ({
  key,
  ctrl: false,
  meta: false,
  shift: false,
  alt: false,
  repeat: false,
  composing: false,
  defaultPrevented: false,
  inTextField: false,
  ...over,
});
const ctx = (over: Partial<KeyCtx> = {}): KeyCtx => ({
  dialogOpen: false,
  gesturing: false,
  armed: false,
  hasSelection: true,
  ...over,
});

describe("keyAction", () => {
  it("maps r and R to rotate, Delete and Backspace to delete, the four arrows to nudge (±1), Ctrl+Z and Cmd+Z to undo, Ctrl+S and Cmd+S to save, Escape to escape", () => {
    expect(keyAction(input("r"), ctx())).toEqual({ type: "rotate" });
    expect(keyAction(input("R"), ctx())).toEqual({ type: "rotate" });
    expect(keyAction(input("Delete"), ctx())).toEqual({ type: "delete" });
    expect(keyAction(input("Backspace"), ctx())).toEqual({ type: "delete" });
    expect(keyAction(input("ArrowLeft"), ctx())).toEqual({ type: "nudge", dx: -1, dy: 0 });
    expect(keyAction(input("ArrowRight"), ctx())).toEqual({ type: "nudge", dx: 1, dy: 0 });
    expect(keyAction(input("ArrowUp"), ctx())).toEqual({ type: "nudge", dx: 0, dy: -1 });
    expect(keyAction(input("ArrowDown"), ctx())).toEqual({ type: "nudge", dx: 0, dy: 1 });
    expect(keyAction(input("z", { ctrl: true }), ctx())).toEqual({ type: "undo" });
    expect(keyAction(input("z", { meta: true }), ctx())).toEqual({ type: "undo" });
    expect(keyAction(input("Z", { ctrl: true }), ctx())).toEqual({ type: "undo" });
    expect(keyAction(input("s", { ctrl: true }), ctx())).toEqual({ type: "save" });
    expect(keyAction(input("s", { meta: true }), ctx())).toEqual({ type: "save" });
    expect(keyAction(input("Escape"), ctx())).toEqual({ type: "escape" });
  });

  it("in a text field (input, textarea, select, contenteditable) every key is ignored, incl. Backspace, Ctrl+Z and Ctrl+S", () => {
    const t = { inTextField: true };
    expect(keyAction(input("Backspace", t), ctx())).toBeNull();
    expect(keyAction(input("z", { ...t, ctrl: true }), ctx())).toBeNull();
    expect(keyAction(input("s", { ...t, ctrl: true }), ctx())).toBeNull();
    expect(keyAction(input("r", t), ctx())).toBeNull();
    expect(keyAction(input("Escape", t), ctx())).toBeNull();
  });

  it("ignored with the dialog open, when defaultPrevented, while composing (IME), with Alt, and mid-gesture", () => {
    expect(keyAction(input("r"), ctx({ dialogOpen: true }))).toBeNull();
    expect(keyAction(input("r", { defaultPrevented: true }), ctx())).toBeNull();
    expect(keyAction(input("r", { composing: true }), ctx())).toBeNull();
    expect(keyAction(input("Process", { composing: true }), ctx())).toBeNull();
    expect(keyAction(input("r", { alt: true }), ctx())).toBeNull();
    expect(keyAction(input("r"), ctx({ gesturing: true }))).toBeNull();
    expect(keyAction(input("Escape"), ctx({ gesturing: true }))).toBeNull();
  });

  it("unmapped: Shift+Ctrl+Z, Ctrl+Y, Ctrl+R, Ctrl+Delete, Shift+Arrow, Space, Enter", () => {
    expect(keyAction(input("Z", { ctrl: true, shift: true }), ctx())).toBeNull();
    expect(keyAction(input("y", { ctrl: true }), ctx())).toBeNull();
    expect(keyAction(input("r", { ctrl: true }), ctx())).toBeNull();
    expect(keyAction(input("Delete", { ctrl: true }), ctx())).toBeNull();
    expect(keyAction(input("ArrowLeft", { shift: true }), ctx())).toBeNull();
    expect(keyAction(input(" "), ctx())).toBeNull();
    expect(keyAction(input("Enter"), ctx())).toBeNull();
  });

  it("repeat: arrows and undo repeat; R, Delete, Backspace and save ignore auto-repeat", () => {
    const rep = { repeat: true };
    expect(keyAction(input("ArrowLeft", rep), ctx())).not.toBeNull();
    expect(keyAction(input("z", { ...rep, ctrl: true }), ctx())).toEqual({ type: "undo" });
    expect(keyAction(input("r", rep), ctx())).toBeNull();
    expect(keyAction(input("Delete", rep), ctx())).toBeNull();
    expect(keyAction(input("Backspace", rep), ctx())).toBeNull();
    expect(keyAction(input("s", { ...rep, ctrl: true }), ctx())).toBeNull();
  });

  it("with no selection, arrows, R and Delete give null (the region scrolls); Escape gives null when nothing is armed or selected", () => {
    const none = ctx({ hasSelection: false });
    expect(keyAction(input("ArrowLeft"), none)).toBeNull();
    expect(keyAction(input("r"), none)).toBeNull();
    expect(keyAction(input("Delete"), none)).toBeNull();
    expect(keyAction(input("Escape"), none)).toBeNull();
    expect(keyAction(input("Escape"), ctx({ hasSelection: false, armed: true }))).toEqual({
      type: "escape",
    });
    expect(keyAction(input("z", { ctrl: true }), none)).toEqual({ type: "undo" });
  });
});

describe("isTextField", () => {
  it("INPUT, TEXTAREA, SELECT and contentEditable are true; BUTTON, DIV and null are false", () => {
    expect(isTextField({ tagName: "INPUT" })).toBe(true);
    expect(isTextField({ tagName: "TEXTAREA" })).toBe(true);
    expect(isTextField({ tagName: "SELECT" })).toBe(true);
    expect(isTextField({ tagName: "DIV", isContentEditable: true })).toBe(true);
    expect(isTextField({ tagName: "BUTTON" })).toBe(false);
    expect(isTextField({ tagName: "DIV", isContentEditable: false })).toBe(false);
    expect(isTextField(null)).toBe(false);
  });

  it("SHORTCUTS lists each action once", () => {
    expect([...SHORTCUTS].sort()).toEqual(
      ["delete", "escape", "nudge", "rotate", "save", "undo"].sort(),
    );
    expect(new Set(SHORTCUTS).size).toBe(SHORTCUTS.length);
  });
});
