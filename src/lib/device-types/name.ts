/** Precomposed Vietnamese capitals and their lowercase forms, same order. Mirrored in `device_type_key()` (migration). */
export const VI_UPPER = "ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝĂĐĨŨƠƯẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼẾỀỂỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪỬỮỰỲỴỶỸ";
export const VI_LOWER = "àáâãèéêìíòóôõùúýăđĩũơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ";

const MAP = new Map([...VI_UPPER].map((c, i) => [c, [...VI_LOWER][i]!]));

/**
 * D61 match key: ASCII whitespace runs collapsed and trimmed, Vietnamese capitals lowered by the map, then ASCII
 * lowercase. Diacritics are kept ("May" and "Máy" differ). Same as the SQL `device_type_key()`.
 */
export function deviceTypeKey(s: string): string {
  return [...s.replace(/[ \t\n\v\f\r]+/g, " ").replace(/^ | $/g, "")]
    .map((c) => MAP.get(c) ?? (c >= "A" && c <= "Z" ? c.toLowerCase() : c))
    .join("");
}
