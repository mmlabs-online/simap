import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { INITIAL_PICKER, type PickerState } from "./member-picker";
import { MemberPickerFields } from "./MemberPickerDialog";

const ready = (over: Partial<PickerState> = {}): PickerState => ({
  ...INITIAL_PICKER,
  status: "ready",
  items: [
    { id: "a", displayName: "Nguyễn Văn Ân", employeeCode: "E001" },
    { id: "b", displayName: "No Code", employeeCode: null },
  ],
  ...over,
});
const render = (state: PickerState, occupantId: string | null = null, canMore = false) =>
  renderToStaticMarkup(
    <MemberPickerFields
      state={state}
      query=""
      occupantId={occupantId}
      canMore={canMore}
      onQuery={() => {}}
      onSelect={() => {}}
      onMore={() => {}}
      onRetry={() => {}}
    />,
  );

describe("MemberPickerFields", () => {
  it("shows name and code; a null code never prints null; diacritics unchanged", () => {
    const html = render(ready());
    expect(html).toContain("Nguyễn Văn Ân");
    expect(html).toContain("E001");
    expect(html).toContain("No Code");
    expect(html).not.toContain("null");
  });
  it('Load more and Retry are type="button"; search is type="text"; no required or maxLength', () => {
    const more = render(ready({ nextCursor: "c" }), null, true);
    expect(more).toMatch(/<button type="button"[^>]*>Load more/);
    const err = render({ ...INITIAL_PICKER, status: "error", errorCode: "internal" });
    expect(err).toMatch(/<button type="button"[^>]*>Try again/);
    expect(more).toContain('type="text"');
    expect(more).not.toMatch(/required|maxLength/);
  });
  it("list has max-h in dvh and overflow-y-auto; empty and error states", () => {
    const html = render(ready());
    expect(html).toContain("max-h-[35dvh]");
    expect(html).toContain("overflow-y-auto");
    expect(render(ready({ items: [] }))).toContain("No active members found.");
    expect(render({ ...INITIAL_PICKER, status: "error" })).toContain("Could not load the members.");
  });
  it("the current occupant radio is disabled and labelled", () => {
    const html = render(ready(), "a");
    const radios = html.match(/<input[^>]*type="radio"[^>]*>/g) ?? [];
    expect(radios).toHaveLength(2);
    expect(radios[0]).toContain("disabled");
    expect(radios[1]).not.toContain("disabled");
    expect(html).toContain("(sits here)");
  });
});
