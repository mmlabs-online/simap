import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Pill } from "./Chip";
import { FormFooterBar } from "./FormFooterBar";
import { PageHeader } from "./PageHeader";
import { SectionCard } from "./SectionCard";
import { TabBar } from "./TabBar";

const tabs = [
  { id: "a", label: "Alpha", icon: "chair" as const },
  { id: "b", label: "Beta", icon: "person" as const, chip: "You" },
];
const bar = (active: string) =>
  renderToStaticMarkup(
    <TabBar
      tabs={tabs}
      active={active}
      onSelect={() => {}}
      ariaLabel="Sections"
      tabIdOf={(i) => `t-${i}`}
      panelIdOf={(i) => `p-${i}`}
    />,
  );
const btn = (html: string, id: string) =>
  html.match(new RegExp(`<button[^>]*id="${id}"[^>]*>.*?</button>`))![0];

describe("TabBar", () => {
  it("renders tablist, roving tabIndex, aria-controls, selected tab has border-workspace-primary text-text-primary", () => {
    const html = bar("b");
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-label="Sections"');
    const a = btn(html, "t-a");
    const b = btn(html, "t-b");
    expect(a).toContain('tabindex="-1"');
    expect(a).toContain('aria-controls="p-a"');
    expect(a).toContain("border-transparent text-text-secondary");
    expect(a).toContain("min-h-control");
    expect(b).toContain('tabindex="0"');
    expect(b).toContain('aria-selected="true"');
    expect(b).toContain("border-workspace-primary text-text-primary");
    expect(b).toContain("min-h-control");
  });

  it("icons and chip are aria-hidden; chip text is inside the selected tab button", () => {
    const b = btn(bar("b"), "t-b");
    expect(b).toMatch(/<span[^>]*aria-hidden="true"[^>]*>person<\/span>/);
    expect(b).toMatch(/<span[^>]*aria-hidden="true"[^>]*>You<\/span>/);
    expect(btn(bar("b"), "t-a")).not.toContain("You");
  });
});

describe("TabBar pill", () => {
  const html = renderToStaticMarkup(
    <TabBar
      variant="pill"
      tabs={[
        { id: "a", label: "Alpha", count: 7 },
        { id: "b", label: "Beta" },
      ]}
      active="a"
      onSelect={() => {}}
      ariaLabel="Sections"
      tabIdOf={(i) => `t-${i}`}
      panelIdOf={(i) => `p-${i}`}
    />,
  );
  it("wrapper scrolls with a gap and has no underline border", () => {
    const wrap = html.match(/<div role="tablist"[^>]*>/)![0];
    expect(wrap).toContain("gap-2 overflow-x-auto");
    expect(wrap).not.toContain("border-b");
  });

  it("selected is pixel green, unselected plain; both are rounded 44 px pills", () => {
    const a = btn(html, "t-a");
    const b = btn(html, "t-b");
    expect(a).toContain("bg-pixel-primary text-on-action");
    expect(b).toContain("text-text-secondary");
    for (const x of [a, b]) {
      expect(x).toContain("min-h-control shrink-0 rounded-lg");
      expect(x).not.toContain("border-b-2");
    }
  });

  it("count is a mono span in the button; roving tabindex and aria-controls as underline", () => {
    const a = btn(html, "t-a");
    expect(a).toMatch(/<span class="font-mono text-caption">7<\/span>/);
    expect(btn(html, "t-b")).not.toContain("font-mono");
    expect(a).toContain('tabindex="0"');
    expect(btn(html, "t-b")).toContain('tabindex="-1"');
    expect(a).toContain('aria-controls="p-a"');
  });
});

describe("PageHeader", () => {
  it("renders h2 by default, h3 with level=3, subtitle and aside", () => {
    const html = renderToStaticMarkup(
      <PageHeader title="T" subtitle="Sub" aside={<i>aside-marker</i>} />,
    );
    expect(html).toMatch(/<h2[^>]*>T<\/h2>/);
    expect(html).toContain("Sub");
    expect(html).toContain("aside-marker");
    expect(renderToStaticMarkup(<PageHeader title="T" level={3} />)).toMatch(/<h3[^>]*>T<\/h3>/);
    expect(renderToStaticMarkup(<PageHeader title="T" />)).not.toContain("<p");
    expect(renderToStaticMarkup(<PageHeader title="T" />)).not.toContain("adorn-m");
    expect(renderToStaticMarkup(<PageHeader title="T" titleAdornment={<i>adorn-m</i>} />)).toMatch(
      /<\/h2><i>adorn-m<\/i>/,
    );
  });
});

describe("PageHeader headingRef", () => {
  it("makes the heading focusable only when a ref is given", () => {
    expect(renderToStaticMarkup(<PageHeader title="T" headingRef={() => {}} />)).toMatch(
      /<h2[^>]*tabindex="-1"[^>]*outline-none/,
    );
    expect(renderToStaticMarkup(<PageHeader title="T" />)).not.toContain("tabindex");
  });
});

describe("SectionCard flush", () => {
  it("flush body has no padding", () => {
    const r = (flush: boolean) =>
      renderToStaticMarkup(
        <SectionCard headingId="h" title="T" flush={flush}>
          body-m
        </SectionCard>,
      );
    expect(r(true)).toContain('<div class="">body-m</div>');
    expect(r(false)).toContain('<div class="p-4 sm:p-5">body-m</div>');
  });
});

describe("SectionCard", () => {
  it("is a section labelled by its h3; subtitle, aside and footer slots render only when given", () => {
    const full = renderToStaticMarkup(
      <SectionCard
        headingId="h1"
        title="Title"
        subtitle="Sub"
        aside={<i>aside-m</i>}
        footer={<i>footer-m</i>}
      >
        body-m
      </SectionCard>,
    );
    expect(full).toContain('<section aria-labelledby="h1"');
    expect(full).toMatch(/<h3 id="h1"[^>]*>Title<\/h3>/);
    for (const m of ["Sub", "aside-m", "footer-m", "body-m"]) expect(full).toContain(m);
    expect(full).toContain("border-b border-divider");
    const bare = renderToStaticMarkup(
      <SectionCard headingId="h2" title="Title" divided={false}>
        body-m
      </SectionCard>,
    );
    expect(bare).not.toContain("aside-m");
    expect(bare).not.toContain("footer-m");
    expect(bare).not.toContain("border-t");
    expect(bare).not.toContain("border-b");
  });
});

describe("Pill", () => {
  it("tones map to classes; decorative sets aria-hidden", () => {
    const r = (p: Parameters<typeof Pill>[0]) => renderToStaticMarkup(<Pill {...p} />);
    expect(r({ label: "x", tone: "accent" })).toContain("bg-workspace-action");
    expect(r({ label: "x", tone: "neutral" })).toContain("bg-canvas");
    expect(r({ label: "x", tone: "success" })).toContain("bg-success-tint");
    expect(r({ label: "x", tone: "warning" })).toContain("bg-warning-tint");
    expect(r({ label: "x", tone: "danger" })).toContain("bg-danger-tint");
    expect(r({ label: "x", tone: "info" })).toContain("bg-info-tint");
    expect(r({ label: "x" })).toContain("rounded-full");
    expect(r({ label: "x" })).toContain("text-caption");
    expect(r({ label: "x" })).toContain("bg-canvas");
    expect(r({ label: "x" })).not.toContain("rounded-full bg-current");
    expect(r({ label: "x", dot: true })).toMatch(
      /<span aria-hidden="true"[^>]*bg-current"><\/span>/,
    );
    expect(r({ label: "x" })).not.toContain("aria-hidden");
    expect(r({ label: "x", decorative: true })).toContain('aria-hidden="true"');
  });
});

describe("FormFooterBar", () => {
  const render = (p: Partial<Parameters<typeof FormFooterBar>[0]> = {}) =>
    renderToStaticMarkup(
      <FormFooterBar
        status={{ tone: "dirty", text: "Unsaved" }}
        cancelLabel="Cancel"
        saveLabel="Save"
        busyLabel="Saving"
        canCancel
        canSave
        busy={false}
        onCancel={() => {}}
        {...p}
      />,
    );
  const button = (html: string, label: string) =>
    html.match(new RegExp(`<button[^>]*>(?:(?!</button>).)*${label}</button>`))![0];

  it("status role=status, error role=alert; Save is submit and disabled when !canSave or busy; Cancel disabled when !canCancel or busy; busy label", () => {
    expect(render()).toContain('role="status"');
    expect(render({ status: { tone: "error", text: "Bad" } })).toContain('role="alert"');
    expect(render({ status: { tone: "saved", text: "Ok", detail: "d" } })).toContain(">check<");
    const ok = render();
    expect(button(ok, "Save")).toContain('type="submit"');
    expect(button(ok, "Save")).not.toContain('disabled=""');
    expect(button(ok, "Cancel")).toContain('type="button"');
    expect(button(render({ canSave: false }), "Save")).toContain('disabled=""');
    expect(button(render({ canCancel: false }), "Cancel")).toContain('disabled=""');
    const busy = render({ busy: true });
    expect(button(busy, "Saving")).toContain('disabled=""');
    expect(button(busy, "Cancel")).toContain('disabled=""');
    expect(busy).not.toContain(">Save<");
  });
});
