import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SegmentedFilter } from "./SegmentedFilter";

const html = renderToStaticMarkup(
  <SegmentedFilter
    options={[
      { value: "a", label: "Alpha" },
      { value: "b", label: "Beta" },
    ]}
    value="b"
    onChange={() => {}}
    ariaLabel="Pick one"
  />,
);

describe("SegmentedFilter", () => {
  it("role=group with aria-label; one type=button per option; aria-pressed true only on the selected value; selected segment has the selected classes", () => {
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Pick one"');
    expect(html.match(/<button type="button"/g)).toHaveLength(2);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(1);
    const beta = html.match(/<button[^>]*aria-pressed="true"[^>]*>Beta<\/button>/)![0];
    expect(beta).toContain("bg-surface text-primary shadow-sm");
    expect(html.match(/<button[^>]*aria-pressed="false"[^>]*>Alpha<\/button>/)![0]).not.toContain(
      "shadow-sm",
    );
  });
});
