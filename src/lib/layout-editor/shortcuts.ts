export type ShortcutId = "rotate" | "delete" | "nudge" | "undo" | "save" | "escape";

/** Every keyboard action once; the shortcut list is built from this (a missing copy row fails typecheck). */
export const SHORTCUTS: readonly ShortcutId[] = [
  "rotate",
  "delete",
  "nudge",
  "undo",
  "save",
  "escape",
];

export type KeyInput = {
  key: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  alt: boolean;
  repeat: boolean;
  composing: boolean;
  defaultPrevented: boolean;
  inTextField: boolean;
};

export type KeyCtx = {
  dialogOpen: boolean;
  gesturing: boolean;
  armed: boolean;
  hasSelection: boolean;
};

export type KeyResult =
  | { type: "rotate" | "delete" | "undo" | "save" | "escape" }
  | { type: "nudge"; dx: number; dy: number }
  | null;

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/** True for elements that take typed text, where keys belong to the field. */
export function isTextField(el: { tagName?: string; isContentEditable?: boolean } | null): boolean {
  if (!el) return false;
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    el.isContentEditable === true
  );
}

/** The editor action for a key press, or null when the key is not ours (see plan A6, A7). */
export function keyAction(i: KeyInput, ctx: KeyCtx): KeyResult {
  if (i.inTextField || ctx.dialogOpen || i.defaultPrevented || i.composing || i.alt) return null;
  if (ctx.gesturing) return null;
  if (i.ctrl || i.meta) {
    if (i.shift) return null;
    const k = i.key.toLowerCase();
    if (k === "z") return { type: "undo" };
    if (k === "s" && !i.repeat) return { type: "save" };
    return null;
  }
  if (i.key === "Escape") return ctx.armed || ctx.hasSelection ? { type: "escape" } : null;
  if (!ctx.hasSelection) return null;
  const arrow = ARROWS[i.key];
  if (arrow) return i.shift ? null : { type: "nudge", dx: arrow[0], dy: arrow[1] };
  if (i.repeat) return null;
  if (i.key.toLowerCase() === "r") return { type: "rotate" };
  if (i.key === "Delete" || i.key === "Backspace") return { type: "delete" };
  return null;
}
