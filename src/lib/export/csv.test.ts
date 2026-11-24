import { describe, expect, it } from "vitest";
import { csvCell, exportFilename, isExportKind, toCsv } from "./csv";

describe("csvCell", () => {
  it("plain text is left unquoted", () => {
    expect(csvCell("abc")).toBe("abc");
  });
  it("quotes cells containing comma, double quote, CR or LF", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("a\nb")).toBe('"a\nb"');
    expect(csvCell("a\r\nb")).toBe('"a\r\nb"');
  });
  it("prefixes = + - @ TAB CR with an apostrophe", () => {
    for (const v of ["=1+1", "+1", "-1", "@SUM(A1)", "\tx", "\rx"]) {
      expect(csvCell(v).replace(/^"/, "").startsWith("'"), JSON.stringify(v)).toBe(true);
    }
    expect(csvCell("=1+1")).toBe("'=1+1");
  });
  it("formula guard then quoting compose", () => {
    expect(csvCell("=a,b")).toBe('"\'=a,b"');
    expect(csvCell('-"x"')).toBe('"\'-""x"""');
    expect(csvCell("\rx")).toBe('"\'\rx"');
  });
  it("does not touch a leading apostrophe or safe symbols mid-string", () => {
    for (const v of ["a=b", "x-y", "'ok"]) expect(csvCell(v)).toBe(v);
  });
  it("null, undefined and empty become empty cells", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell("")).toBe("");
  });
  it("keeps Vietnamese text intact", () => {
    for (const v of ["Nguyễn Thị Ánh", "Đặng", "Nguyễn"]) expect(csvCell(v)).toBe(v);
  });
});

describe("toCsv", () => {
  it("starts with U+FEFF, uses CRLF between and after rows, header first", () => {
    const out = toCsv(
      ["A", "B"],
      [
        ["1", "x,y"],
        ["2", null],
      ],
    );
    expect(out).toBe('﻿A,B\r\n1,"x,y"\r\n2,\r\n');
  });
  it("with zero rows still outputs BOM + header", () => {
    expect(toCsv(["A", "B"], [])).toBe("﻿A,B\r\n");
  });
});

describe("exportFilename / isExportKind", () => {
  it("exportFilename is ASCII and built from kind and UTC date", () => {
    expect(exportFilename("seats", new Date("2026-11-24T10:00:00Z"))).toBe(
      "simap-seats-20261124.csv",
    );
    expect(exportFilename("members", new Date("2026-11-24T23:59:59Z"))).toBe(
      "simap-members-20261124.csv",
    );
    expect(exportFilename("devices", new Date("2026-11-24T23:59:59Z"))).toMatch(/^[\x20-\x7e]+$/);
  });
  it("isExportKind rejects unknown, empty and prototype names", () => {
    for (const v of ["constructor", "__proto__", "Seats", "", "toString"]) {
      expect(isExportKind(v), v).toBe(false);
    }
    for (const v of ["seats", "devices", "members"]) expect(isExportKind(v)).toBe(true);
  });
});
