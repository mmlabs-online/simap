import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EditorWarnings } from "./EditorWarnings";

describe("EditorWarnings", () => {
  it("renders nothing without warnings", () => {
    expect(renderToStaticMarkup(<EditorWarnings noDoor={false} unreachable={[]} />)).toBe("");
  });

  it("shows no-door and unreachable seat codes", () => {
    const html = renderToStaticMarkup(
      <EditorWarnings
        noDoor
        unreachable={[
          { key: "s:1", code: "Phòng-A-01" },
          { key: "n:1", code: null },
        ]}
      />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain("no usable door");
    expect(html).toContain("Phòng-A-01");
    expect(html).toContain("new desk");
    expect(html).toContain("bg-warning-tint");
    expect(html).not.toContain("amber-");
  });
});
