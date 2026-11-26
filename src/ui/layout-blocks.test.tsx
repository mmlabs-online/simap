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
  it("renders tablist, roving tabIndex, aria-controls, selected tab has border-primary text-primary", () => {
    const html = bar("b");
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-label="Sections"');
    const a = btn(html, "t-a");
    const b = btn(html, "t-b");
    expect(a).toContain('tabindex="-1"');
    expect(a).toContain('aria-controls="p-a"');
    expect(a).not.toContain("border-primary");
    expect(b).toContain('tabindex="0"');
    expect(b).toContain('aria-selected="true"');
    expect(b).toContain("border-primary text-primary");
  });

  it("icons and chip are aria-hidden; chip text is inside the selected tab button", () => {
    const b = btn(bar("b"), "t-b");
    expect(b).toMatch(/<span[^>]*aria-hidden="true"[^>]*>person<\/span>/);
    expect(b).toMatch(/<span[^>]*aria-hidden="true"[^>]*>You<\/span>/);
    expect(btn(bar("b"), "t-a")).not.toContain("You");
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
    expect(full).toContain("border-b border-outline-variant");
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
    expect(r({ label: "x", tone: "accent" })).toContain("bg-primary-container");
    expect(r({ label: "x", tone: "neutral" })).toContain("bg-surface-high");
    expect(r({ label: "x", tone: "success" })).toContain("bg-success-container");
    expect(r({ label: "x", tone: "warning" })).toContain("bg-warning-container");
    expect(r({ label: "x", tone: "danger" })).toContain("bg-error-container");
    expect(r({ label: "x" })).toContain("bg-surface-high");
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
