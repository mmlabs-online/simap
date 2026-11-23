import type { Draft } from "./types";

export const UNDO_LIMIT = 50;

export type History = { past: Draft[]; present: Draft };

export const startHistory = (draft: Draft): History => ({ past: [], present: draft });

/** One committed operation is one undo step; the oldest steps beyond the limit are dropped. */
export function commit(h: History, next: Draft): History {
  return { past: [...h.past, h.present].slice(-UNDO_LIMIT), present: next };
}

export function undo(h: History): History {
  if (h.past.length === 0) return h;
  return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1] };
}

export const canUndo = (h: History): boolean => h.past.length > 0;
