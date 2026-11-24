/**
 * The single fold rule for search: case and diacritics are ignored (DSH-02, spec §8). `foldText` is the TS side;
 * `foldSql` builds the same fold in SQL from the `FOLD_FROM`/`FOLD_TO` map, so no database extension is needed.
 */
export function foldText(s: string): string {
  return s
    .normalize("NFC")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase();
}

function buildMap(): { from: string; to: string } {
  let from = "";
  let to = "";
  const ranges: [number, number][] = [
    [0x00c0, 0x024f],
    [0x1e00, 0x1eff],
  ];
  for (const [lo, hi] of ranges) {
    for (let cp = lo; cp <= hi; cp++) {
      const c = String.fromCodePoint(cp);
      const f = foldText(c);
      if (f !== c && /^[a-z]$/.test(f)) {
        from += c;
        to += f;
      }
    }
  }
  return { from, to };
}

const MAP = buildMap();
/** Characters that SQL `translate()` folds (both cases), and the ASCII letter each becomes at the same index. */
export const FOLD_FROM: string = MAP.from;
export const FOLD_TO: string = MAP.to;

/** SQL expression folding `col` (a constant column name from server code, never user text). */
export function foldSql(col: string): string {
  return `lower(translate(${col}, '${FOLD_FROM}', '${FOLD_TO}'))`;
}

/** Hex digits of a MAC-like query with `:`, `-` and `.` removed; null when it is not 1-12 hex chars. */
export function macCompact(q: string): string | null {
  const c = q.replace(/[:.-]/g, "").toLowerCase();
  return /^[0-9a-f]{1,12}$/.test(c) ? c : null;
}
