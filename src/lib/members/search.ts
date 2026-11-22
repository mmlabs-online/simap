/** Escapes `\`, `%` and `_` so user text matches literally in `ilike ... escape '\'`. */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}
