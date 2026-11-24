/** CSV export (SIM-018, DSH-02): pure helpers shared by the route and the UI. */

export const EXPORT_KINDS = ["seats", "devices", "members"] as const;
export type ExportKind = (typeof EXPORT_KINDS)[number];

/** Rows per file; the server asks for one more to learn whether the file was cut. */
export const EXPORT_MAX_ROWS = 10_000;

export const isExportKind = (v: string): v is ExportKind =>
  (EXPORT_KINDS as readonly string[]).includes(v);

const BOM = "﻿";
const FORMULA_START = /^[=+\-@\t\r]/;

/** One cell: null becomes empty, formula starters get a leading `'` (OWASP), then RFC 4180 quoting. */
export function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (FORMULA_START.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

/** BOM + header + rows, CRLF after every row (Excel opens it as UTF-8). */
export function toCsv(
  columns: readonly string[],
  rows: readonly (readonly (string | number | null | undefined)[])[],
): string {
  const lines = [columns, ...rows].map((r) => r.map(csvCell).join(","));
  return BOM + lines.join("\r\n") + "\r\n";
}

/** ASCII filename from the whitelisted kind and the UTC date. */
export function exportFilename(kind: ExportKind, now: Date): string {
  const d = now.toISOString().slice(0, 10).replaceAll("-", "");
  return `simap-${kind}-${d}.csv`;
}
