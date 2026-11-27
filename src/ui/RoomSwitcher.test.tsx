import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { RoomDto } from "@/lib/rooms/types";
import { shellCopy } from "./copy/shell";
import { RoomSwitcherView } from "./RoomSwitcher";

const room = (code: string, name: string): RoomDto => ({
  id: code,
  code,
  name,
  description: null,
  floor: null,
  seatCount: 0,
  occupiedCount: 0,
});

const render = (selected: string) =>
  renderToStaticMarkup(
    <RoomSwitcherView
      rooms={[room("C302", "Phòng <họp>"), room("A1", "Lab")]}
      selected={selected}
      onSelect={() => {}}
      onGo={() => {}}
    />,
  );

describe("RoomSwitcherView", () => {
  it("has the placeholder plus one option per room, current selected", () => {
    const html = render("A1");
    expect(html.match(/<option/g)).toHaveLength(3);
    expect(html).toContain(shellCopy.roomSwitcher.placeholder);
    expect(html).toMatch(/<option value="A1" selected="">/);
    expect(html).not.toMatch(/<option value="C302" selected/);
  });
  it("escapes room names", () => {
    const html = render("");
    expect(html).toContain("Phòng &lt;họp&gt;");
    expect(html).not.toContain("<họp>");
  });
  it("labels the select, visually hidden", () => {
    const html = render("");
    expect(html).toMatch(
      new RegExp(`<label for="([^"]+)" class="sr-only">${shellCopy.roomSwitcher.label}</label>`),
    );
    const id = /<label for="([^"]+)"/.exec(html)?.[1];
    expect(html).toContain(`<select id="${id}"`);
  });
  it("Go is a plain button that is never disabled", () => {
    const html = render("");
    const btn = /<button[^>]*>/.exec(html)?.[0] ?? "";
    expect(btn).toContain('type="button"');
    expect(btn).not.toMatch(/ disabled[ =>]/);
  });
  it("select uses the control scale", () => {
    const tag = /<select [^>]*>/.exec(render(""))![0];
    for (const c of [
      "min-h-control",
      "rounded-lg",
      "border-border-strong",
      "bg-surface",
      "text-label",
      "text-text-primary",
      "md:max-w-xs",
    ]) {
      expect(tag, c).toContain(c);
    }
    expect(tag).not.toMatch(/\bh-10\b|rounded-md3|lg:/);
  });
});
